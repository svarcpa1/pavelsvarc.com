document.addEventListener("DOMContentLoaded", () => {
    loadProjects();
    initTheme();
});

const GROUPS = [
    { key: "public", label: "Public" },
    { key: "private", label: "Private" },
];

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

        const html = GROUPS.map(group => {
            const items = projects.filter(p => (p.category || "public") === group.key);
            if (items.length === 0) return "";
            return renderGroup(group.label, items);
        }).join("");

        container.innerHTML = html || '<p class="projects-empty">Projects coming soon...</p>';
        initCarousels();

    } catch {
        container.innerHTML = '<p class="projects-empty">Projects coming soon...</p>';
    }
}

function renderGroup(label, items) {
    const tiles = items.map(renderTile).join("");

    return `
        <div class="project-group">
            <h2 class="group-title">${escapeHtml(label)}</h2>
            <div class="carousel-wrap">
                <button type="button" class="carousel-arrow prev" aria-label="Scroll left" hidden>&lsaquo;</button>
                <div class="carousel">${tiles}</div>
                <button type="button" class="carousel-arrow next" aria-label="Scroll right" hidden>&rsaquo;</button>
            </div>
        </div>
    `;
}

function renderTile(project) {
    const tags = project.tags
        ? project.tags.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join(" ")
        : "";

    const linkOpen = project.url
        ? `<a href="${escapeHtml(project.url)}" class="tile" target="_blank" rel="noopener">`
        : `<div class="tile">`;
    const linkClose = project.url ? `</a>` : `</div>`;

    return `
        ${linkOpen}
            <h3>${escapeHtml(project.title)}</h3>
            <p>${escapeHtml(project.description)}</p>
            ${tags}
        ${linkClose}
    `;
}

function initCarousels() {
    document.querySelectorAll(".carousel-wrap").forEach(wrap => {
        const track = wrap.querySelector(".carousel");
        const prev = wrap.querySelector(".carousel-arrow.prev");
        const next = wrap.querySelector(".carousel-arrow.next");

        const scrollBy = () => Math.max(track.clientWidth * 0.8, 240);

        prev.addEventListener("click", () => track.scrollBy({ left: -scrollBy(), behavior: "smooth" }));
        next.addEventListener("click", () => track.scrollBy({ left: scrollBy(), behavior: "smooth" }));

        const update = () => {
            const overflow = track.scrollWidth - track.clientWidth > 1;
            const atStart = track.scrollLeft <= 1;
            const atEnd = track.scrollLeft >= track.scrollWidth - track.clientWidth - 1;
            prev.hidden = !overflow || atStart;
            next.hidden = !overflow || atEnd;
        };

        track.addEventListener("scroll", update, { passive: true });
        window.addEventListener("resize", update);
        update();
    });
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
