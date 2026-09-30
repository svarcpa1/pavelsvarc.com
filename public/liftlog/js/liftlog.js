/* LiftLog — mobile-first fitness tracker */

const API = "/liftlog/api";
const TOTAL_BODY_PARTS = 7;

// Dashboard chart styling
const CHART_INK = "#222";
const CHART_PALETTE = ["#222", "#4caf50", "#2196f3", "#ff9800", "#9c27b0", "#00bcd4", "#e91e63"];
let dashboardCharts = []; // live Chart.js instances, destroyed before re-render
let exerciseCharts = [];  // same, for the exercise progress screen

let currentWorkout = null; // { id, gym_id, gym_name, started_at }
let exercises = [];        // exercises in current workout
let gyms = [];
let bodyParts = [];
let timerInterval = null;

// Exercise modal state
let selectedBodyPartIds = [];
let editingExerciseId = null;
let exerciseSuggestions = []; // distinct names for the current body-part selection
let machineSuggestions = [];  // distinct machines for the current exercise name

// ---- Screen management ----

function showScreen(id) {
    document.querySelectorAll(".screen").forEach(s => s.hidden = true);
    document.getElementById(id).hidden = false;
}

// ---- Toast notifications ----

function showToast(message, type = "error", durationMs = 3000) {
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
    }, durationMs);
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
                gym_id: w.gym_id,
                gym_name: w.gym_name,
                started_at: w.started_at,
            };
            exercises = detail.exercises || [];

            document.getElementById("workout-gym-name").textContent = currentWorkout.gym_name;
            renderExercises();
            startTimer(parseTs(currentWorkout.started_at));
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
    startTimer(parseTs(currentWorkout.started_at));
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
        const weightStr = ex.max_weight !== null ? `${formatWeight(ex.max_weight)} kg${recordMark(ex)}` : "";

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
    const elapsed = Math.floor((Date.now() - parseTs(currentWorkout.started_at).getTime()) / 1000);
    const mins = Math.floor(elapsed / 60);

    const exerciseRows = exercises.map(ex => {
        const badges = (ex.body_parts || []).map(bp =>
            `<span class="body-part-badge">${escapeHtml(bp.name)}</span>`
        ).join("");
        const weightStr = ex.max_weight !== null ? `${formatWeight(ex.max_weight)} kg${recordMark(ex)}` : "";
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

    const recordCount = exercises.filter(ex => ex.is_record).length;
    const recordLine = recordCount
        ? `<div class="finish-records">🏆 ${recordCount} new record${recordCount > 1 ? "s" : ""}</div>`
        : "";

    summary.innerHTML = `
        <div class="finish-meta">
            <div class="finish-gym">${escapeHtml(currentWorkout.gym_name)}</div>
            <div class="finish-duration">${mins} min · ${exercises.length} exercises</div>
            ${recordLine}
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
    exerciseSuggestions = [];
    machineSuggestions = [];
    clearValidation();
    hideAutocomplete();
    hideMachineDropdown();
    const lwi = document.getElementById("last-weight-info");
    if (lwi) lwi.hidden = true;

    // Set modal title
    const titleEl = document.getElementById("modal-title");

    if (exercise) {
        // Edit mode
        editingExerciseId = exercise.id;
        titleEl.textContent = "Edit Exercise";
        document.getElementById("exercise-name").value = exercise.name || "";
        document.getElementById("exercise-machine").value = exercise.machine || "";
        document.getElementById("exercise-weight").value = exercise.max_weight !== null ? formatWeight(exercise.max_weight) : "";
        selectedBodyPartIds = (exercise.body_parts || []).map(bp => bp.id);
    } else {
        // Add mode
        titleEl.textContent = "Add Exercise";
        document.getElementById("exercise-name").value = "";
        document.getElementById("exercise-machine").value = "";
        document.getElementById("exercise-weight").value = "";
    }

    // Compute already-trained body parts from current workout
    const trainedBodyPartIds = new Set();
    exercises.forEach(ex => {
        // Skip the exercise being edited
        if (exercise && ex.id === exercise.id) return;
        (ex.body_parts || []).forEach(bp => trainedBodyPartIds.add(bp.id));
    });

    // Render body part grid
    const grid = document.getElementById("body-part-grid");
    grid.innerHTML = bodyParts.map(bp => {
        const selected = selectedBodyPartIds.includes(bp.id) ? " selected" : "";
        const trained = trainedBodyPartIds.has(bp.id) ? " trained" : "";
        return `<button class="body-part-btn${selected}${trained}" data-id="${bp.id}">${escapeHtml(bp.name)}</button>`;
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
            // Body parts drive both the last-weight hint and the exercise suggestions
            refreshLastWeight();
            loadExerciseSuggestions();
        });
    });

    // Preload cascading suggestions for the current state
    loadExerciseSuggestions();
    if (editingExerciseId) loadMachineSuggestions();

    document.getElementById("modal-exercise").classList.add("active");
}

function closeExerciseModal() {
    document.getElementById("modal-exercise").classList.remove("active");
    hideAutocomplete();
    hideMachineDropdown();
}

// ---- Cascading suggestions (body part -> exercise -> machine) ----

// Load distinct exercise names for the current body-part selection (global data).
async function loadExerciseSuggestions() {
    try {
        const params = new URLSearchParams({ suggest: "exercises" });
        if (selectedBodyPartIds.length) params.set("body_parts", selectedBodyPartIds.join(","));
        exerciseSuggestions = await api(`exercises.php?${params}`);
    } catch {
        exerciseSuggestions = [];
    }
    // Refresh the dropdown if the name field is the active input
    if (document.activeElement === document.getElementById("exercise-name")) {
        renderExerciseDropdown();
    }
}

// Render the exercise-name dropdown, filtered live by whatever is typed.
function renderExerciseDropdown() {
    const input = document.getElementById("exercise-name");
    const dropdown = document.getElementById("autocomplete-dropdown");
    const q = input.value.trim().toLowerCase();
    const matches = exerciseSuggestions.filter(n => n.toLowerCase().includes(q));
    if (matches.length === 0) {
        dropdown.hidden = true;
        return;
    }
    dropdown.innerHTML = matches.map(n =>
        `<div class="ac-item" data-name="${escapeHtml(n)}"><span class="ac-name">${escapeHtml(n)}</span></div>`
    ).join("");
    dropdown.hidden = false;
    dropdown.querySelectorAll(".ac-item").forEach(item => {
        // mousedown fires before blur, so focus stays put and selection sticks
        item.addEventListener("mousedown", (e) => {
            e.preventDefault();
            selectExerciseSuggestion(item.dataset.name);
        });
    });
}

function selectExerciseSuggestion(name) {
    const input = document.getElementById("exercise-name");
    input.value = name;
    input.classList.remove("validation-error");
    hideAutocomplete();
    refreshLastWeight();
    loadMachineSuggestions();
}

// Load distinct machines used for the current exercise name (global data).
async function loadMachineSuggestions() {
    const name = document.getElementById("exercise-name").value.trim();
    if (!name) {
        machineSuggestions = [];
        return;
    }
    try {
        const params = new URLSearchParams({ suggest: "machines", name });
        machineSuggestions = await api(`exercises.php?${params}`);
    } catch {
        machineSuggestions = [];
    }
    if (document.activeElement === document.getElementById("exercise-machine")) {
        renderMachineDropdown();
    }
}

function renderMachineDropdown() {
    const input = document.getElementById("exercise-machine");
    const dropdown = document.getElementById("machine-dropdown");
    const q = input.value.trim().toLowerCase();
    const matches = machineSuggestions.filter(m => m.toLowerCase().includes(q));
    if (matches.length === 0) {
        dropdown.hidden = true;
        return;
    }
    dropdown.innerHTML = matches.map(m =>
        `<div class="ac-item" data-machine="${escapeHtml(m)}"><span class="ac-name">${escapeHtml(m)}</span></div>`
    ).join("");
    dropdown.hidden = false;
    dropdown.querySelectorAll(".ac-item").forEach(item => {
        item.addEventListener("mousedown", (e) => {
            e.preventDefault();
            selectMachineSuggestion(item.dataset.machine);
        });
    });
}

function selectMachineSuggestion(machine) {
    document.getElementById("exercise-machine").value = machine;
    hideMachineDropdown();
    refreshLastWeight();
}

function hideMachineDropdown() {
    const dd = document.getElementById("machine-dropdown");
    if (dd) dd.hidden = true;
}

// Fetch and show the last recorded weight for the current name + machine + gym + body parts combo.
// Only shows a result when all four match a previous workout (current workout excluded).
async function refreshLastWeight() {
    const name    = document.getElementById("exercise-name").value.trim();
    const machine = document.getElementById("exercise-machine").value.trim();
    const el      = document.getElementById("last-weight-info");

    // All four criteria must be present to attempt a match
    if (!name || !currentWorkout?.gym_id || selectedBodyPartIds.length === 0) {
        el.hidden = true;
        return;
    }

    try {
        const params = new URLSearchParams({
            name,
            gym_id:          currentWorkout.gym_id,
            exclude_workout: currentWorkout.id,
            body_parts:      selectedBodyPartIds.join(","),
        });
        if (machine) params.set("machine", machine);

        const result = await api(`exercises.php?${params}`);
        showLastWeight(result.max_weight, result.last_date);
    } catch {
        el.hidden = true;
    }
}

function hideAutocomplete() {
    const dd = document.getElementById("autocomplete-dropdown");
    if (dd) dd.hidden = true;
}

function showLastWeight(weight, dateStr) {
    const el = document.getElementById("last-weight-info");
    if (!el) return;
    if (!weight || weight === "") {
        el.hidden = true;
        return;
    }
    const date = parseTs(dateStr);
    const formatted = date.toLocaleDateString("cs-CZ", {
        day: "numeric", month: "numeric", year: "numeric",
    });
    el.textContent = `Last time: ${formatWeight(weight)} kg (${formatted})`;
    el.hidden = false;
}

function clearValidation() {
    document.getElementById("exercise-name").classList.remove("validation-error");
    document.getElementById("body-part-grid").classList.remove("validation-error");
}

async function saveExercise() {
    const nameInput = document.getElementById("exercise-name");
    const name = nameInput.value.trim();
    const machine = document.getElementById("exercise-machine").value.trim();
    // Normalize decimal separator: accept both "," (CZ locale) and "." before parsing
    const weight = document.getElementById("exercise-weight").value.trim().replace(",", ".");

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
        let saved;
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
            saved = updated;
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
            saved = exercise;
        }

        renderExercises();
        closeExerciseModal();

        if (saved.is_record) {
            const label = saved.machine ? `${saved.name} · ${saved.machine}` : saved.name;
            showToast(
                `🎉 New record! ${label}: ${formatWeight(saved.max_weight)} kg (was ${formatWeight(saved.previous_best)} kg)`,
                "success",
                4500,
            );
        }
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
        const date = parseTs(w.started_at);
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
                    const weightStr = ex.max_weight !== null ? `${formatWeight(ex.max_weight)} kg${recordMark(ex)}` : "";
                    return `
                        <div class="exercise-row exercise-link" data-name="${escapeHtml(ex.name)}">
                            <div>
                                ${badges}
                                ${escapeHtml(ex.name)}
                                ${ex.machine ? `<span style="color:#aaa"> · ${escapeHtml(ex.machine)}</span>` : ""}
                            </div>
                            <div class="weight">${weightStr}</div>
                        </div>
                    `;
                }).join("");

                detail.querySelectorAll(".exercise-link").forEach(row => {
                    row.addEventListener("click", () => showExerciseProgress(row.dataset.name, "screen-history"));
                });
            }

            detail.dataset.loaded = "true";
        } catch {
            return;
        }
    }

    detail.hidden = false;
}

// ---- Dashboard (analytics) ----

async function showDashboard() {
    const container = document.getElementById("dashboard-content");
    container.innerHTML = '<p class="empty-state">Loading…</p>';
    showScreen("screen-dashboard");

    let stats;
    try {
        stats = await api("stats.php");
    } catch {
        container.innerHTML = '<p class="empty-state">Could not load stats.</p>';
        return;
    }
    renderDashboard(stats);
}

function statCard(value, label, icon, tint) {
    return `<div class="stat-card">
                <div class="stat-icon" style="background:${tint}">${icon}</div>
                <div class="stat-value">${escapeHtml(String(value))}</div>
                <div class="stat-label">${escapeHtml(label)}</div>
            </div>`;
}

// Short month label from a "YYYY-MM" string.
function monthLabel(ym) {
    const [y, m] = ym.split("-").map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "short" });
}

function capitalize(str) {
    return str ? str.charAt(0).toUpperCase() + str.slice(1) : str;
}

function renderDashboard(stats) {
    const container = document.getElementById("dashboard-content");
    const s = stats.summary || {};

    // Tear down charts from a previous visit before re-rendering
    dashboardCharts.forEach(c => c.destroy());
    dashboardCharts = [];

    const summary = `
        <div class="stat-grid">
            ${statCard(s.total_workouts ?? 0, "Workouts", "🏋️", "rgba(33,150,243,0.14)")}
            ${statCard(s.workouts_30d ?? 0, "Last 30 days", "📅", "rgba(76,175,80,0.16)")}
            ${statCard(s.total_exercises ?? 0, "Exercises", "💪", "rgba(255,152,0,0.18)")}
            ${statCard(s.avg_duration_min != null ? `${s.avg_duration_min} min` : "—", "Avg duration", "⏱️", "rgba(156,39,176,0.14)")}
        </div>`;

    const freq = stats.frequency || [];
    const prs = stats.personal_records || [];
    const daysSince = stats.days_since || [];
    const weekly = stats.weekly_body_parts || [];
    const exerciseList = stats.exercises || [];

    const empty = '<p class="empty-state">No data yet.</p>';

    container.innerHTML = `
        ${summary}
        <section class="report">
            <h3>Days since last trained</h3>
            <div class="days-grid">${daysSince.map(daysChip).join("")}</div>
        </section>
        <section class="report">
            <h3>Exercises</h3>
            ${exerciseList.length ? `
                <input type="text" id="exercise-search" class="search-input" placeholder="Search exercises" autocomplete="off">
                <div id="exercise-overview" class="ex-list">${exerciseList.map(exerciseListItem).join("")}</div>
            ` : empty}
        </section>
        <section class="report">
            <h3>Workouts per month</h3>
            <div class="chart-box"><canvas id="chart-frequency"></canvas></div>
        </section>
        <section class="report">
            <h3>Body parts per week</h3>
            ${weekly.some(w => Number(w.count) > 0) ? '<div class="chart-box chart-box--tall"><canvas id="chart-weekly"></canvas></div>' : empty}
        </section>
        <section class="report">
            <h3>Personal records</h3>
            ${prs.length ? '<div class="chart-box chart-box--tall"><canvas id="chart-records"></canvas></div>' : empty}
        </section>
    `;

    // ---- Exercise list: search + tap to open progress ----
    const overview = document.getElementById("exercise-overview");
    if (overview) {
        overview.querySelectorAll(".ex-list-item").forEach(item => {
            item.addEventListener("click", () => showExerciseProgress(item.dataset.name, "screen-dashboard"));
        });
        document.getElementById("exercise-search").addEventListener("input", (e) => {
            const q = e.target.value.trim().toLowerCase();
            overview.querySelectorAll(".ex-list-item").forEach(item => {
                item.hidden = !item.dataset.name.toLowerCase().includes(q);
            });
        });
    }

    // ---- Workouts per month (line) ----
    dashboardCharts.push(new Chart(document.getElementById("chart-frequency"), {
        type: "line",
        data: {
            labels: freq.map(f => monthLabel(f.month)),
            datasets: [{
                data: freq.map(f => Number(f.count)),
                borderColor: CHART_INK,
                backgroundColor: "rgba(34,34,34,0.08)",
                fill: true,
                tension: 0.3,
                pointBackgroundColor: CHART_INK,
                pointRadius: 4,
            }],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
        },
    }));

    // ---- Body parts per week (stacked bar, one series per body part) ----
    const weeklyCanvas = document.getElementById("chart-weekly");
    if (weeklyCanvas) {
        const weeks = [...new Set(weekly.map(w => w.week))];
        const partNames = [...new Set(weekly.map(w => w.name))];
        const countOf = new Map(weekly.map(w => [`${w.week}|${w.name}`, Number(w.count)]));

        dashboardCharts.push(new Chart(weeklyCanvas, {
            type: "bar",
            data: {
                labels: weeks.map(weekLabel),
                datasets: partNames.map((name, i) => ({
                    label: capitalize(name),
                    data: weeks.map(wk => countOf.get(`${wk}|${name}`) || 0),
                    backgroundColor: CHART_PALETTE[i % CHART_PALETTE.length],
                })),
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: "bottom", labels: { boxWidth: 12, font: { size: 11 } } },
                    tooltip: { callbacks: { title: items => `Week of ${items[0].label}` } },
                },
                scales: {
                    x: { stacked: true, ticks: { font: { size: 10 } } },
                    y: { stacked: true, beginAtZero: true, ticks: { precision: 0 } },
                },
            },
        }));
    }

    // ---- Personal records (horizontal bar, tap a bar to open progress) ----
    if (prs.length) {
        dashboardCharts.push(new Chart(document.getElementById("chart-records"), {
            type: "bar",
            data: {
                labels: prs.map(r => r.name),
                datasets: [{
                    data: prs.map(r => Number(r.max_weight)),
                    backgroundColor: CHART_INK,
                    borderRadius: 4,
                }],
            },
            options: {
                indexAxis: "y",
                responsive: true,
                maintainAspectRatio: false,
                onClick: (_evt, elements) => {
                    if (elements.length) showExerciseProgress(prs[elements[0].index].name, "screen-dashboard");
                },
                plugins: {
                    legend: { display: false },
                    tooltip: { callbacks: { label: ctx => `${formatWeight(ctx.parsed.x)} kg` } },
                },
                scales: { x: { beginAtZero: true, ticks: { callback: v => `${v} kg` } } },
            },
        }));
    }
}

// Colour-coded "days since trained" chip: green ≤ 7, amber 8–14, red 15+ or never.
function daysChip(bp) {
    const days = bp.days === null ? null : Number(bp.days);
    const level = days === null || days > 14 ? "bad" : days > 7 ? "warn" : "ok";
    const text = days === null ? "never" : days === 0 ? "today" : `${days} d`;
    return `<div class="days-chip days-chip--${level}">
                <span class="days-chip-name">${escapeHtml(capitalize(bp.name))}</span>
                <span class="days-chip-value">${text}</span>
            </div>`;
}

const TREND_ARROWS = { up: "↑", down: "↓", flat: "→" };

function exerciseListItem(ex) {
    const best = ex.best_weight !== null ? `${formatWeight(ex.best_weight)} kg` : "";
    const trend = ex.trend ? `<span class="trend trend-${ex.trend}">${TREND_ARROWS[ex.trend]}</span>` : "";
    return `<button type="button" class="ex-list-item" data-name="${escapeHtml(ex.name)}">
                <span>
                    <span class="ex-list-name">${escapeHtml(ex.name)}</span>
                    <span class="ex-list-meta">${ex.times}× · last ${formatDate(ex.last_date)}</span>
                </span>
                <span class="ex-list-best">${best}${trend}</span>
            </button>`;
}

// "22 Sep" from a "YYYY-MM-DD" week-start string.
function weekLabel(ymd) {
    const [y, m, d] = ymd.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

// ---- Exercise progress ----

async function showExerciseProgress(name, backScreen) {
    document.getElementById("btn-exercise-back").dataset.screen = backScreen;
    document.getElementById("exercise-title").textContent = name;
    const container = document.getElementById("exercise-content");
    container.innerHTML = '<p class="empty-state">Loading…</p>';
    showScreen("screen-exercise");
    window.scrollTo(0, 0);

    let data;
    try {
        data = await api(`stats.php?exercise=${encodeURIComponent(name)}`);
    } catch {
        container.innerHTML = '<p class="empty-state">Could not load exercise.</p>';
        return;
    }
    renderExerciseProgress(data);
}

function renderExerciseProgress(data) {
    const container = document.getElementById("exercise-content");
    const sessions = data.sessions || [];

    exerciseCharts.forEach(c => c.destroy());
    exerciseCharts = [];

    if (sessions.length === 0) {
        container.innerHTML = '<p class="empty-state">No sessions logged.</p>';
        return;
    }

    const badges = (data.body_parts || []).map(bp =>
        `<span class="body-part-badge">${escapeHtml(bp)}</span>`
    ).join("");

    const weighted = sessions.filter(s => s.max_weight !== null);
    const last = sessions[sessions.length - 1];
    let tiles;
    let chartHtml;

    if (weighted.length) {
        const best = weighted.reduce((a, b) => (Number(b.max_weight) > Number(a.max_weight) ? b : a));
        const lastWeighted = weighted[weighted.length - 1];

        // Change since first, on the machine used most recently
        const sameMachine = weighted.filter(s => sameText(s.machine, lastWeighted.machine));
        const change = sameMachine.length > 1
            ? Number(lastWeighted.max_weight) - Number(sameMachine[0].max_weight)
            : null;
        const changeStr = change === null ? "—" : `${change > 0 ? "+" : ""}${formatWeight(change)} kg`;
        const changeLabel = lastWeighted.machine ? `Change (${lastWeighted.machine})` : "Change since first";

        tiles = `
            ${statCard(`${formatWeight(best.max_weight)} kg`, `Best · ${formatDate(best.started_at)}${best.machine ? ` · ${best.machine}` : ""}`, "🏆", "rgba(255,193,7,0.2)")}
            ${statCard(`${formatWeight(lastWeighted.max_weight)} kg`, `Last · ${formatDate(lastWeighted.started_at)}`, "🕒", "rgba(33,150,243,0.14)")}
            ${statCard(sessions.length, "Times logged", "🔁", "rgba(76,175,80,0.16)")}
            ${statCard(changeStr, changeLabel, "📈", "rgba(156,39,176,0.14)")}`;
        chartHtml = '<h3>Weight over time</h3><div class="chart-box"><canvas id="chart-exercise"></canvas></div>';
    } else {
        // Bodyweight / no-weight exercise: show how often it's done instead
        tiles = `
            ${statCard(sessions.length, "Times logged", "🔁", "rgba(76,175,80,0.16)")}
            ${statCard(formatDate(last.started_at), "Last done", "🕒", "rgba(33,150,243,0.14)")}`;
        chartHtml = '<h3>Sessions per month</h3><div class="chart-box"><canvas id="chart-exercise"></canvas></div>';
    }

    const rows = sessions.slice().reverse().map(s => `
        <div class="session-row">
            <div>
                <div class="session-date">${formatDate(s.started_at)}</div>
                <div class="session-meta">${escapeHtml(s.gym)}${s.machine ? ` · ${escapeHtml(s.machine)}` : ""}</div>
            </div>
            <div class="weight">${s.max_weight !== null ? `${formatWeight(s.max_weight)} kg` : "—"}${recordMark(s)}</div>
        </div>`).join("");

    container.innerHTML = `
        ${badges ? `<div class="exercise-badges">${badges}</div>` : ""}
        <div class="stat-grid">${tiles}</div>
        <section class="report">${chartHtml}</section>
        <section class="report">
            <h3>Sessions</h3>
            <div class="session-list">${rows}</div>
        </section>
    `;

    const canvas = document.getElementById("chart-exercise");
    if (weighted.length) {
        exerciseCharts.push(new Chart(canvas, weightChartConfig(weighted)));
    } else {
        exerciseCharts.push(new Chart(canvas, sessionsPerMonthConfig(sessions)));
    }
}

// Weight line chart, one line per machine (machines aren't comparable).
// Record-setting sessions get a bigger point.
function weightChartConfig(weighted) {
    const machines = [...new Set(weighted.map(s => s.machine || "(no machine)"))];
    return {
        type: "line",
        data: {
            labels: weighted.map(s => formatDate(s.started_at)),
            datasets: machines.map((m, i) => {
                const color = CHART_PALETTE[i % CHART_PALETTE.length];
                const own = s => (s.machine || "(no machine)") === m;
                return {
                    label: m,
                    data: weighted.map(s => (own(s) ? Number(s.max_weight) : null)),
                    borderColor: color,
                    backgroundColor: color,
                    pointRadius: weighted.map(s => (own(s) && s.is_record ? 6 : 3)),
                    spanGaps: true,
                    tension: 0.2,
                };
            }),
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: machines.length > 1, position: "bottom", labels: { boxWidth: 12, font: { size: 11 } } },
                tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${formatWeight(ctx.parsed.y)} kg` } },
            },
            scales: {
                x: { ticks: { font: { size: 10 }, maxRotation: 0, autoSkip: true } },
                y: { ticks: { callback: v => `${v} kg` } },
            },
        },
    };
}

// Bar chart of sessions per month, from the first session's month to now.
function sessionsPerMonthConfig(sessions) {
    const counts = new Map();
    sessions.forEach(s => {
        const ym = String(s.started_at).slice(0, 7);
        counts.set(ym, (counts.get(ym) || 0) + 1);
    });
    const months = [];
    const [fy, fm] = String(sessions[0].started_at).slice(0, 7).split("-").map(Number);
    const cursor = new Date(fy, fm - 1, 1);
    const now = new Date();
    while (cursor <= now) {
        months.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`);
        cursor.setMonth(cursor.getMonth() + 1);
    }
    return {
        type: "bar",
        data: {
            labels: months.map(monthLabel),
            datasets: [{ data: months.map(m => counts.get(m) || 0), backgroundColor: CHART_INK, borderRadius: 4 }],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
        },
    };
}

// ---- Utility ----

function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    // div.innerHTML escapes &, <, > but not quotes — escape them too so the
    // result is safe inside HTML attributes (e.g. data-name="...").
    return div.innerHTML.replace(/"/g, "&quot;");
}

// Parse a PostgreSQL timestamp ("YYYY-MM-DD HH:MM:SS", space-separated). Safari/iOS
// only accepts ISO 8601, so normalize the date/time separator to "T".
function parseTs(ts) {
    if (!ts) return new Date(NaN);
    return new Date(String(ts).replace(" ", "T"));
}

// "28. 9. 2026" from a PostgreSQL timestamp.
function formatDate(ts) {
    return parseTs(ts).toLocaleDateString("cs-CZ", { day: "numeric", month: "numeric", year: "numeric" });
}

// Case-insensitive, null-safe text match (null and "" count as equal).
function sameText(a, b) {
    return (a || "").toLowerCase() === (b || "").toLowerCase();
}

// Trophy after the weight of a record-setting entry.
function recordMark(ex) {
    return ex.is_record ? ' <span class="record-mark" title="New record">🏆</span>' : "";
}

// NUMERIC weights come back as strings like "60.00" — drop trailing zeros.
function formatWeight(w) {
    const n = parseFloat(w);
    return Number.isFinite(n) ? String(n) : String(w);
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
    document.getElementById("btn-dashboard").addEventListener("click", showDashboard);

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

    // Escape key closes modals + autocomplete
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            const acOpen = !document.getElementById("autocomplete-dropdown").hidden;
            const mOpen = !document.getElementById("machine-dropdown").hidden;
            if (acOpen || mOpen) {
                hideAutocomplete();
                hideMachineDropdown();
                return;
            }
            if (document.getElementById("modal-exercise").classList.contains("active")) {
                closeExerciseModal();
            } else if (document.getElementById("modal-finish").classList.contains("active")) {
                closeFinishSummary();
            }
        }
    });

    // Exercise name suggestions (open on focus, filter live)
    const exerciseNameInput = document.getElementById("exercise-name");

    exerciseNameInput.addEventListener("focus", renderExerciseDropdown);
    exerciseNameInput.addEventListener("input", renderExerciseDropdown);

    exerciseNameInput.addEventListener("blur", () => {
        // Delay so a mousedown selection can complete first
        setTimeout(() => {
            hideAutocomplete();
            const query = exerciseNameInput.value.trim();
            if (query.length >= 2) {
                refreshLastWeight();
                loadMachineSuggestions();
            } else {
                document.getElementById("last-weight-info").hidden = true;
            }
        }, 150);
    });

    // Machine suggestions (depend on the chosen exercise name)
    const exerciseMachineInput = document.getElementById("exercise-machine");

    exerciseMachineInput.addEventListener("focus", () => {
        if (machineSuggestions.length) {
            renderMachineDropdown();
        } else {
            loadMachineSuggestions();
        }
    });
    exerciseMachineInput.addEventListener("input", renderMachineDropdown);

    exerciseMachineInput.addEventListener("blur", () => {
        setTimeout(() => {
            hideMachineDropdown();
            const name = document.getElementById("exercise-name").value.trim();
            if (name.length >= 2) refreshLastWeight();
        }, 150);
    });

    // Click outside a suggestion wrapper dismisses that dropdown
    document.addEventListener("click", (e) => {
        const wrapper = e.target.closest(".autocomplete-wrapper");
        if (!wrapper || !wrapper.contains(document.getElementById("autocomplete-dropdown"))) {
            hideAutocomplete();
        }
        if (!wrapper || !wrapper.contains(document.getElementById("machine-dropdown"))) {
            hideMachineDropdown();
        }
    });

    // Start
    checkAuth();
});
