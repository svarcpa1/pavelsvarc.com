/* LiftLog — mobile-first fitness tracker */

const API = "/liftlog/api";
const TOTAL_BODY_PARTS = 7;

let currentWorkout = null; // { id, gym_id, gym_name, started_at }
let exercises = [];        // exercises in current workout
let gyms = [];
let bodyParts = [];
let timerInterval = null;

// Exercise modal state
let selectedBodyPartIds = [];
let editingExerciseId = null;

// ---- Screen management ----

function showScreen(id) {
    document.querySelectorAll(".screen").forEach(s => s.hidden = true);
    document.getElementById(id).hidden = false;
}

// ---- Toast notifications ----

function showToast(message, type = "error") {
    // Remove existing toast
    const existing = document.querySelector(".toast");
    if (existing) existing.remove();

    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => toast.classList.add("visible"), 10);
    setTimeout(() => {
        toast.classList.remove("visible");
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ---- API helpers ----

async function api(endpoint, opts = {}) {
    const res = await fetch(`${API}/${endpoint}`, {
        headers: { "Content-Type": "application/json" },
        ...opts,
    });
    if (res.status === 401) {
        showScreen("screen-login");
        throw new Error("Unauthorized");
    }
    if (res.status === 429) {
        const data = await res.json();
        showToast(data.error || "Too many attempts. Try again later.");
        throw new Error("Rate limited");
    }
    if (!res.ok) {
        showToast("Something went wrong. Please try again.");
        throw new Error(res.statusText);
    }
    return res.json();
}

// ---- Auth ----

async function checkAuth() {
    try {
        const data = await api("auth.php");
        if (data.authenticated) {
            await checkActiveWorkout();
        } else {
            showScreen("screen-login");
        }
    } catch {
        showScreen("screen-login");
    }
}

async function checkActiveWorkout() {
    try {
        // Check for unfinished workout
        const workouts = await api("workouts.php?limit=1");
        if (workouts.length > 0 && !workouts[0].finished_at) {
            const w = workouts[0];
            // Fetch full workout detail with exercises
            const detail = await api(`workouts.php?id=${w.id}`);

            currentWorkout = {
                id: w.id,
                gym_id: null,
                gym_name: w.gym_name,
                started_at: w.started_at,
            };
            exercises = detail.exercises || [];

            document.getElementById("workout-gym-name").textContent = currentWorkout.gym_name;
            renderExercises();
            startTimer(new Date(currentWorkout.started_at));
            showScreen("screen-workout");
            return;
        }
    } catch {
        // If check fails, just go to home
    }
    showScreen("screen-home");
}

async function login() {
    const pin = document.getElementById("pin-input").value;
    const errorEl = document.getElementById("login-error");
    errorEl.hidden = true;

    try {
        await api("auth.php", {
            method: "POST",
            body: JSON.stringify({ pin }),
        });
        document.getElementById("pin-input").value = "";
        await checkActiveWorkout();
    } catch {
        errorEl.hidden = false;
    }
}

async function logout() {
    if (currentWorkout) {
        if (!confirm("You have an active workout. Logging out won't delete it. Continue?")) return;
    }
    await api("auth.php", { method: "DELETE" });
    stopTimer();
    currentWorkout = null;
    exercises = [];
    showScreen("screen-login");
}

// ---- Gym picker ----

async function showGymPicker() {
    if (gyms.length === 0) {
        gyms = await api("gyms.php");
    }

    const container = document.getElementById("gym-list");
    container.innerHTML = gyms.map(g =>
        `<div class="gym-card" data-id="${g.id}">${escapeHtml(g.name)}</div>`
    ).join("");

    container.querySelectorAll(".gym-card").forEach(card => {
        card.addEventListener("click", () => startWorkout(parseInt(card.dataset.id)));
    });

    showScreen("screen-gym");
}

// ---- Workout ----

async function startWorkout(gymId) {
    const workout = await api("workouts.php", {
        method: "POST",
        body: JSON.stringify({ gym_id: gymId }),
    });

    const gym = gyms.find(g => g.id === gymId);
    currentWorkout = {
        id: workout.id,
        gym_id: gymId,
        gym_name: gym ? gym.name : "Gym",
        started_at: workout.started_at,
    };
    exercises = [];

    document.getElementById("workout-gym-name").textContent = currentWorkout.gym_name;
    renderExercises();
    startTimer(new Date(currentWorkout.started_at));
    showScreen("screen-workout");
}

function isFullBody(exerciseList) {
    const ids = new Set();
    exerciseList.forEach(ex => {
        if (ex.body_parts) {
            ex.body_parts.forEach(bp => ids.add(bp.id));
        }
    });
    return ids.size >= TOTAL_BODY_PARTS;
}

function renderExercises() {
    const container = document.getElementById("exercise-list");
    const workoutScreen = document.getElementById("screen-workout");

    // Toggle finish/cancel buttons based on exercise count
    document.getElementById("btn-finish-workout").hidden = exercises.length === 0;
    document.getElementById("btn-cancel-workout").hidden = exercises.length > 0;

    if (exercises.length === 0) {
        container.innerHTML = '<p class="empty-state">No exercises yet. Tap + Add Exercise to start.</p>';
        workoutScreen.classList.remove("full-body");
        return;
    }

    const fullBody = isFullBody(exercises);
    workoutScreen.classList.toggle("full-body", fullBody);

    container.innerHTML = exercises.map(ex => {
        const badges = (ex.body_parts || []).map(bp =>
            `<span class="body-part-badge">${escapeHtml(bp.name)}</span>`
        ).join("");
        const weightStr = ex.max_weight !== null ? `${ex.max_weight} kg` : "";

        return `
            <div class="exercise-item" data-id="${ex.id}">
                <div class="exercise-item-content">
                    <div class="exercise-name">${escapeHtml(ex.name)}</div>
                    <div class="exercise-meta">
                        ${badges}
                        ${ex.machine ? `<span style="color:#777">${escapeHtml(ex.machine)}</span>` : ""}
                    </div>
                    ${weightStr ? `<div class="exercise-weight">${weightStr}</div>` : ""}
                </div>
                <div class="exercise-actions">
                    <button class="btn-icon btn-edit-exercise" data-id="${ex.id}" aria-label="Edit exercise">&#9998;</button>
                    <button class="btn-icon btn-delete btn-delete-exercise" data-id="${ex.id}" aria-label="Delete exercise">&#128465;</button>
                </div>
            </div>
        `;
    }).join("");

    // Edit exercise
    container.querySelectorAll(".btn-edit-exercise").forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            const ex = exercises.find(x => x.id === parseInt(btn.dataset.id));
            if (ex) openExerciseModal(ex);
        });
    });

    // Delete exercise
    container.querySelectorAll(".btn-delete-exercise").forEach(btn => {
        btn.addEventListener("click", async (e) => {
            e.stopPropagation();
            if (!confirm("Delete this exercise?")) return;
            try {
                await api(`exercises.php?id=${btn.dataset.id}`, { method: "DELETE" });
                exercises = exercises.filter(x => x.id !== parseInt(btn.dataset.id));
                renderExercises();
            } catch {
                // Error already shown by api()
            }
        });
    });
}

async function cancelWorkout() {
    if (!currentWorkout) return;
    if (!confirm("Cancel this workout? It will not be saved.")) return;

    try {
        await api(`workouts.php?id=${currentWorkout.id}`, { method: "DELETE" });
    } catch {
        // Error already shown by api()
        return;
    }

    stopTimer();
    currentWorkout = null;
    exercises = [];
    showScreen("screen-home");
}

function showFinishSummary() {
    if (!currentWorkout) return;

    const summary = document.getElementById("finish-summary");
    const elapsed = Math.floor((Date.now() - new Date(currentWorkout.started_at).getTime()) / 1000);
    const mins = Math.floor(elapsed / 60);

    const exerciseRows = exercises.map(ex => {
        const badges = (ex.body_parts || []).map(bp =>
            `<span class="body-part-badge">${escapeHtml(bp.name)}</span>`
        ).join("");
        const weightStr = ex.max_weight !== null ? `${ex.max_weight} kg` : "";
        return `
            <div class="finish-exercise-row">
                <div>
                    ${badges}
                    ${escapeHtml(ex.name)}
                    ${ex.machine ? `<span style="color:#aaa"> · ${escapeHtml(ex.machine)}</span>` : ""}
                </div>
                <div class="weight">${weightStr}</div>
            </div>
        `;
    }).join("");

    summary.innerHTML = `
        <div class="finish-meta">
            <div class="finish-gym">${escapeHtml(currentWorkout.gym_name)}</div>
            <div class="finish-duration">${mins} min · ${exercises.length} exercises</div>
        </div>
        ${exercises.length > 0
            ? `<div class="finish-exercises">${exerciseRows}</div>`
            : '<p class="empty-state" style="padding:1rem">No exercises added.</p>'}
    `;

    document.getElementById("modal-finish").classList.add("active");
}

function closeFinishSummary() {
    document.getElementById("modal-finish").classList.remove("active");
}

async function confirmFinishWorkout() {
    if (!currentWorkout) return;

    try {
        await api("workouts.php", {
            method: "PATCH",
            body: JSON.stringify({ id: currentWorkout.id }),
        });
    } catch {
        return;
    }

    closeFinishSummary();
    stopTimer();
    currentWorkout = null;
    exercises = [];
    showScreen("screen-home");
}

// ---- Timer ----

function startTimer(startTime) {
    const el = document.getElementById("workout-timer");
    const startMs = startTime ? startTime.getTime() : Date.now();

    // Show immediately
    updateTimerDisplay(el, startMs);

    timerInterval = setInterval(() => {
        updateTimerDisplay(el, startMs);
    }, 1000);
}

function updateTimerDisplay(el, startMs) {
    const elapsed = Math.floor((Date.now() - startMs) / 1000);
    const mins = Math.floor(elapsed / 60);
    const secs = elapsed % 60;
    el.textContent = `${mins}:${secs.toString().padStart(2, "0")}`;
}

function stopTimer() {
    clearInterval(timerInterval);
    timerInterval = null;
}

// ---- Exercise Modal (add + edit) ----

async function openExerciseModal(exercise = null) {
    if (bodyParts.length === 0) {
        bodyParts = await api("body-parts.php");
    }

    // Reset state
    selectedBodyPartIds = [];
    editingExerciseId = null;
    clearValidation();

    // Set modal title
    const titleEl = document.getElementById("modal-title");

    if (exercise) {
        // Edit mode
        editingExerciseId = exercise.id;
        titleEl.textContent = "Edit Exercise";
        document.getElementById("exercise-name").value = exercise.name || "";
        document.getElementById("exercise-machine").value = exercise.machine || "";
        document.getElementById("exercise-weight").value = exercise.max_weight !== null ? exercise.max_weight : "";
        selectedBodyPartIds = (exercise.body_parts || []).map(bp => bp.id);
    } else {
        // Add mode
        titleEl.textContent = "Add Exercise";
        document.getElementById("exercise-name").value = "";
        document.getElementById("exercise-machine").value = "";
        document.getElementById("exercise-weight").value = "";
    }

    // Render body part grid
    const grid = document.getElementById("body-part-grid");
    grid.innerHTML = bodyParts.map(bp => {
        const selected = selectedBodyPartIds.includes(bp.id) ? " selected" : "";
        return `<button class="body-part-btn${selected}" data-id="${bp.id}">${escapeHtml(bp.name)}</button>`;
    }).join("");

    grid.querySelectorAll(".body-part-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const id = parseInt(btn.dataset.id);
            btn.classList.toggle("selected");
            if (selectedBodyPartIds.includes(id)) {
                selectedBodyPartIds = selectedBodyPartIds.filter(x => x !== id);
            } else {
                selectedBodyPartIds.push(id);
            }
            // Clear body part validation error when selecting
            document.getElementById("body-part-grid").classList.remove("validation-error");
        });
    });

    document.getElementById("modal-exercise").classList.add("active");
}

function closeExerciseModal() {
    document.getElementById("modal-exercise").classList.remove("active");
}

function clearValidation() {
    document.getElementById("exercise-name").classList.remove("validation-error");
    document.getElementById("body-part-grid").classList.remove("validation-error");
}

async function saveExercise() {
    const nameInput = document.getElementById("exercise-name");
    const name = nameInput.value.trim();
    const machine = document.getElementById("exercise-machine").value.trim();
    const weight = document.getElementById("exercise-weight").value;

    // Validation with feedback
    clearValidation();
    let valid = true;

    if (!name) {
        nameInput.classList.add("validation-error");
        valid = false;
    }
    if (selectedBodyPartIds.length === 0) {
        document.getElementById("body-part-grid").classList.add("validation-error");
        valid = false;
    }

    if (!valid) {
        showToast("Please fill in exercise name and select at least one body part.", "warning");
        return;
    }

    const saveBtn = document.getElementById("btn-save-exercise");
    if (saveBtn.disabled) return;
    saveBtn.disabled = true;

    try {
        if (editingExerciseId) {
            const updated = await api("exercises.php", {
                method: "PUT",
                body: JSON.stringify({
                    id: editingExerciseId,
                    body_part_ids: selectedBodyPartIds,
                    name,
                    machine: machine || null,
                    max_weight: weight !== "" ? parseFloat(weight) : null,
                }),
            });

            const idx = exercises.findIndex(x => x.id === editingExerciseId);
            if (idx !== -1) exercises[idx] = updated;
        } else {
            const exercise = await api("exercises.php", {
                method: "POST",
                body: JSON.stringify({
                    workout_id: currentWorkout.id,
                    body_part_ids: selectedBodyPartIds,
                    name,
                    machine: machine || null,
                    max_weight: weight !== "" ? parseFloat(weight) : null,
                }),
            });

            exercises.push(exercise);
        }

        renderExercises();
        closeExerciseModal();
    } catch {
        // Error already shown by api()
    } finally {
        saveBtn.disabled = false;
    }
}

// ---- History ----

async function showHistory() {
    const workouts = await api("workouts.php?limit=50");
    const container = document.getElementById("history-list");

    if (workouts.length === 0) {
        container.innerHTML = '<p class="empty-state">No workouts yet.</p>';
        showScreen("screen-history");
        return;
    }

    container.innerHTML = workouts.map(w => {
        const date = new Date(w.started_at);
        const dateStr = date.toLocaleDateString("cs-CZ", {
            day: "numeric", month: "numeric", year: "numeric",
        });
        const timeStr = date.toLocaleTimeString("cs-CZ", {
            hour: "2-digit", minute: "2-digit",
        });

        const fullBody = w.body_part_ids && w.body_part_ids.length >= TOTAL_BODY_PARTS;
        const fullBodyClass = fullBody ? " full-body" : "";
        const fullBodyBadge = fullBody ? '<span class="full-body-badge">Full Body</span>' : "";

        return `
            <div class="history-item${fullBodyClass}" data-id="${w.id}">
                <div class="history-header">
                    <div>
                        <div class="date">${dateStr} ${timeStr}</div>
                        <div class="gym">${escapeHtml(w.gym_name)}</div>
                    </div>
                    <div style="display:flex;align-items:center;gap:0.3rem">
                        <div class="count">${w.exercise_count} exercises${fullBodyBadge}</div>
                        <button class="btn-icon btn-delete btn-delete-workout" data-id="${w.id}" aria-label="Delete workout">&#128465;</button>
                    </div>
                </div>
                <div class="history-detail" hidden></div>
            </div>
        `;
    }).join("");

    // Tap to expand detail
    container.querySelectorAll(".history-header").forEach(header => {
        header.addEventListener("click", (e) => {
            if (e.target.closest(".btn-delete-workout")) return;
            toggleHistoryDetail(header.closest(".history-item"));
        });
    });

    // Delete workout
    container.querySelectorAll(".btn-delete-workout").forEach(btn => {
        btn.addEventListener("click", async (e) => {
            e.stopPropagation();
            if (!confirm("Delete this workout and all its exercises?")) return;
            try {
                await api(`workouts.php?id=${btn.dataset.id}`, { method: "DELETE" });
                btn.closest(".history-item").remove();
                if (container.children.length === 0) {
                    container.innerHTML = '<p class="empty-state">No workouts yet.</p>';
                }
            } catch {
                // Error already shown by api()
            }
        });
    });

    showScreen("screen-history");
}

async function toggleHistoryDetail(item) {
    const detail = item.querySelector(".history-detail");

    if (!detail.hidden) {
        detail.hidden = true;
        return;
    }

    // Load exercises if not yet loaded
    if (!detail.dataset.loaded) {
        const id = parseInt(item.dataset.id);
        try {
            const workout = await api(`workouts.php?id=${id}`);

            if (workout.exercises.length === 0) {
                detail.innerHTML = '<p style="color:#aaa;font-size:0.85rem;padding:0.5rem 0">No exercises recorded.</p>';
            } else {
                detail.innerHTML = workout.exercises.map(ex => {
                    const badges = (ex.body_parts || []).map(bp =>
                        `<span class="body-part-badge">${escapeHtml(bp.name)}</span>`
                    ).join("");
                    const weightStr = ex.max_weight !== null ? `${ex.max_weight} kg` : "";
                    return `
                        <div class="exercise-row">
                            <div>
                                ${badges}
                                ${escapeHtml(ex.name)}
                                ${ex.machine ? `<span style="color:#aaa"> · ${escapeHtml(ex.machine)}</span>` : ""}
                            </div>
                            <div class="weight">${weightStr}</div>
                        </div>
                    `;
                }).join("");
            }

            detail.dataset.loaded = "true";
        } catch {
            return;
        }
    }

    detail.hidden = false;
}

// ---- Utility ----

function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

// ---- Event Listeners ----

document.addEventListener("DOMContentLoaded", () => {
    // Login
    document.getElementById("btn-login").addEventListener("click", login);
    document.getElementById("pin-input").addEventListener("keydown", e => {
        if (e.key === "Enter") login();
    });

    // Home
    document.getElementById("btn-logout").addEventListener("click", logout);
    document.getElementById("btn-start").addEventListener("click", showGymPicker);
    document.getElementById("btn-history").addEventListener("click", showHistory);

    // Workout
    document.getElementById("btn-add-exercise").addEventListener("click", () => openExerciseModal());
    document.getElementById("btn-finish-workout").addEventListener("click", showFinishSummary);
    document.getElementById("btn-cancel-workout").addEventListener("click", cancelWorkout);

    // Exercise modal
    document.getElementById("btn-save-exercise").addEventListener("click", saveExercise);
    document.getElementById("btn-cancel-exercise").addEventListener("click", closeExerciseModal);

    // Finish summary modal
    document.getElementById("btn-confirm-finish").addEventListener("click", confirmFinishWorkout);
    document.getElementById("btn-cancel-finish").addEventListener("click", closeFinishSummary);

    // Back buttons
    document.querySelectorAll(".btn-back").forEach(btn => {
        btn.addEventListener("click", () => showScreen(btn.dataset.screen));
    });

    // Escape key closes modals
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            if (document.getElementById("modal-exercise").classList.contains("active")) {
                closeExerciseModal();
            } else if (document.getElementById("modal-finish").classList.contains("active")) {
                closeFinishSummary();
            }
        }
    });

    // Start
    checkAuth();
});
