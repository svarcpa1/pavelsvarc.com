/* LiftLog — mobile-first fitness tracker */

const API = "/liftlog/api";

let currentWorkout = null; // { id, gym_id, gym_name, started_at }
let exercises = [];        // exercises in current workout
let gyms = [];
let bodyParts = [];
let timerInterval = null;

// ---- Screen management ----

function showScreen(id) {
    document.querySelectorAll(".screen").forEach(s => s.hidden = true);
    document.getElementById(id).hidden = false;
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
    if (!res.ok) throw new Error(res.statusText);
    return res.json();
}

// ---- Auth ----

async function checkAuth() {
    try {
        const data = await api("auth.php");
        if (data.authenticated) {
            showScreen("screen-home");
        } else {
            showScreen("screen-login");
        }
    } catch {
        showScreen("screen-login");
    }
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
        showScreen("screen-home");
    } catch {
        errorEl.hidden = false;
    }
}

async function logout() {
    await api("auth.php", { method: "DELETE" });
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
    startTimer();
    showScreen("screen-workout");
}

function renderExercises() {
    const container = document.getElementById("exercise-list");

    if (exercises.length === 0) {
        container.innerHTML = '<p class="empty-state">No exercises yet. Tap + Add Exercise to start.</p>';
        return;
    }

    container.innerHTML = exercises.map(ex => {
        const meta = [ex.body_part];
        if (ex.machine) meta.push(ex.machine);
        const weightStr = ex.max_weight !== null ? `${ex.max_weight} kg` : "";

        return `
            <div class="exercise-item">
                <div class="exercise-name">${escapeHtml(ex.name)}</div>
                <div class="exercise-meta">
                    <span class="body-part-badge">${escapeHtml(ex.body_part)}</span>
                    ${ex.machine ? escapeHtml(ex.machine) : ""}
                </div>
                ${weightStr ? `<div class="exercise-weight">${weightStr}</div>` : ""}
            </div>
        `;
    }).join("");
}

async function finishWorkout() {
    if (!currentWorkout) return;

    await api("workouts.php", {
        method: "PATCH",
        body: JSON.stringify({ id: currentWorkout.id }),
    });

    stopTimer();
    currentWorkout = null;
    exercises = [];
    showScreen("screen-home");
}

// ---- Timer ----

function startTimer() {
    const el = document.getElementById("workout-timer");
    const start = Date.now();

    timerInterval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - start) / 1000);
        const mins = Math.floor(elapsed / 60);
        const secs = elapsed % 60;
        el.textContent = `${mins}:${secs.toString().padStart(2, "0")}`;
    }, 1000);
}

function stopTimer() {
    clearInterval(timerInterval);
    timerInterval = null;
}

// ---- Add Exercise Modal ----

let selectedBodyPartId = null;

async function openExerciseModal() {
    if (bodyParts.length === 0) {
        bodyParts = await api("body-parts.php");
    }

    selectedBodyPartId = null;

    const grid = document.getElementById("body-part-grid");
    grid.innerHTML = bodyParts.map(bp =>
        `<button class="body-part-btn" data-id="${bp.id}">${escapeHtml(bp.name)}</button>`
    ).join("");

    grid.querySelectorAll(".body-part-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            grid.querySelectorAll(".body-part-btn").forEach(b => b.classList.remove("selected"));
            btn.classList.add("selected");
            selectedBodyPartId = parseInt(btn.dataset.id);
        });
    });

    document.getElementById("exercise-name").value = "";
    document.getElementById("exercise-machine").value = "";
    document.getElementById("exercise-weight").value = "";

    document.getElementById("modal-exercise").classList.add("active");
}

function closeExerciseModal() {
    document.getElementById("modal-exercise").classList.remove("active");
}

async function saveExercise() {
    const name = document.getElementById("exercise-name").value.trim();
    const machine = document.getElementById("exercise-machine").value.trim();
    const weight = document.getElementById("exercise-weight").value;

    if (!selectedBodyPartId || !name) return;

    const exercise = await api("exercises.php", {
        method: "POST",
        body: JSON.stringify({
            workout_id: currentWorkout.id,
            body_part_id: selectedBodyPartId,
            name,
            machine: machine || null,
            max_weight: weight !== "" ? parseFloat(weight) : null,
        }),
    });

    exercises.push(exercise);
    renderExercises();
    closeExerciseModal();
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

        return `
            <div class="history-item" data-id="${w.id}">
                <div class="history-header">
                    <div>
                        <div class="date">${dateStr} ${timeStr}</div>
                        <div class="gym">${escapeHtml(w.gym_name)}</div>
                    </div>
                    <div class="count">${w.exercise_count} exercises</div>
                </div>
                <div class="history-detail" hidden></div>
            </div>
        `;
    }).join("");

    // Tap to expand detail
    container.querySelectorAll(".history-item").forEach(item => {
        item.querySelector(".history-header").addEventListener("click", () => {
            toggleHistoryDetail(item);
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
        const workout = await api(`workouts.php?id=${id}`);

        if (workout.exercises.length === 0) {
            detail.innerHTML = '<p style="color:#aaa;font-size:0.85rem;padding:0.5rem 0">No exercises recorded.</p>';
        } else {
            detail.innerHTML = workout.exercises.map(ex => {
                const weightStr = ex.max_weight !== null ? `${ex.max_weight} kg` : "";
                return `
                    <div class="exercise-row">
                        <div>
                            <span class="body-part-badge">${escapeHtml(ex.body_part)}</span>
                            ${escapeHtml(ex.name)}
                            ${ex.machine ? `<span style="color:#aaa"> · ${escapeHtml(ex.machine)}</span>` : ""}
                        </div>
                        <div class="weight">${weightStr}</div>
                    </div>
                `;
            }).join("");
        }

        detail.dataset.loaded = "true";
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
    document.getElementById("btn-add-exercise").addEventListener("click", openExerciseModal);
    document.getElementById("btn-finish-workout").addEventListener("click", finishWorkout);

    // Exercise modal
    document.getElementById("btn-save-exercise").addEventListener("click", saveExercise);
    document.getElementById("btn-cancel-exercise").addEventListener("click", closeExerciseModal);

    // Back buttons
    document.querySelectorAll(".btn-back").forEach(btn => {
        btn.addEventListener("click", () => showScreen(btn.dataset.screen));
    });

    // Start
    checkAuth();
});
