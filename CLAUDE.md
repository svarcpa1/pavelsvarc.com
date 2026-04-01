# Project: pavelsvarc.com

Personal portfolio/project showcase website hosted on webglobe.cz.

## Tech Stack
- **Frontend:** HTML, CSS, JavaScript (vanilla)
- **Backend:** PHP (API endpoints for DB access)
- **Database:** PostgreSQL (on webglobe.cz)
- **Hosting:** webglobe.cz, deployed via SFTP from GitHub Actions
- **Domain:** pavelsvarc.com

## Project Structure
```
public/              # Document root — deployed to webglobe.cz /public_html/
  css/               # Stylesheets
  js/                # Client-side JavaScript
  img/               # Images
  api/               # PHP backend endpoints (inside public so they're web-accessible)
    db.php           # DB connection helper (reads .env from server, above public_html)
    projects.php     # JSON endpoint for project tiles
  index.html         # Landing page
  liftlog/           # LiftLog fitness tracker sub-app
    index.html       # SPA shell (all screens as sections)
    css/liftlog.css  # Mobile-first styles
    js/liftlog.js    # App logic (auth, screens, API calls)
    api/             # LiftLog-specific endpoints
      auth.php       # PIN auth (session-based)
      workouts.php   # CRUD for workouts
      exercises.php  # CRUD for exercises
      gyms.php       # List gyms
      body-parts.php # List body parts
db/                  # Database migrations and schema (not deployed)
  001_projects.sql   # Landing page projects table
  002_liftlog_schema.sql  # LiftLog tables (ll_ prefix)
.github/workflows/   # GitHub Actions (auto-deploy on push to main)
```

## Server Structure (webglobe.cz)
```
pavelsvarc.com/
  .env               # DB + app credentials — NOT in public_html, not web-accessible
  public_html/       # Document root (contents of public/ get deployed here)
    index.html
    css/
    js/
    api/
    liftlog/         # Fitness tracker app
```

## Key Concepts
- The landing page is minimalistic: "I build things" heading with project tiles below
- Project tiles are dynamic — stored in the database, not hardcoded
- Each tile represents a separate project (fitness app, wedding page, etc.)
- LinkedIn link in top-right corner

## Sub-Projects
### LiftLog (`/liftlog/`)
- Mobile-first fitness tracker, PIN-protected (single user)
- SPA: login → home → pick gym → add exercises → finish workout
- DB tables prefixed `ll_` (ll_gyms, ll_body_parts, ll_workouts, ll_exercises)
- Auth: bcrypt PIN hash in .env, PHP sessions scoped to /liftlog/

## Development Guidelines
- Keep it simple — vanilla HTML/CSS/JS, no build tools
- PHP is used only for API endpoints (DB read/write)
- Ask clarifying questions when requirements are ambiguous
- Always test locally before pushing to main (auto-deploys)

## GitHub
- Repo: https://github.com/svarcpa1/pavelsvarc.com (public)
- Branch `main` auto-deploys to production via GitHub Actions + SFTP
