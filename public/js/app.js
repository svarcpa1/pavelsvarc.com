document.addEventListener("DOMContentLoaded", () => {
    loadProjects();
    initTheme();
});

async function loadProjects() {
    const container = document.getElementById("projects");

    try {
        const res = await fetch("/api/projects.php");
        if (!res.ok) throw new Error(res.statusText);

        const projects = await res.json();

        if (projects.length === 0) {
            container.innerHTML = '<p class="projects-empty">Projects coming soon...</p>';
            return;
        }

        container.innerHTML = projects.map(project => {
            const tags = project.tags
                ? project.tags.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join(" ")
                : "";

            const linkOpen = project.url
                ? `<a href="${escapeHtml(project.url)}" class="tile" target="_blank" rel="noopener">`
                : `<div class="tile">`;
            const linkClose = project.url ? `</a>` : `</div>`;

            return `
                ${linkOpen}
                    <h2>${escapeHtml(project.title)}</h2>
                    <p>${escapeHtml(project.description)}</p>
                    ${tags}
                ${linkClose}
            `;
        }).join("");

    } catch (err) {
        container.innerHTML = '<p class="projects-empty">Projects coming soon...</p>';
    }
}

function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

function initTheme() {
    const saved = localStorage.getItem("theme");
    if (saved === "dark") {
        document.body.classList.add("dark");
    }

    document.getElementById("theme-toggle").addEventListener("click", () => {
        document.body.classList.toggle("dark");
        const isDark = document.body.classList.contains("dark");
        localStorage.setItem("theme", isDark ? "dark" : "light");
    });
}
