# NutriDuo — Duolingo‑style Nutrition Game

A lightweight, installable web app that quizzes you on everyday foods — calories, protein, fiber and more — with XP, hearts, streaks, and a daily goal.

## Features
- **Daily lesson** with hearts (lives), XP, progress bar, streak & best streak.
- **Skill practice**: Calories, Protein, Fiber, Carbs, Fats, Comparisons, True/False.
- **Lenient numeric checks**: accept answers within ±10% (configurable).
- **Review mistakes** after each lesson.
- **Food editor**: add your own foods and nutrients; import/export JSON.
- **PWA**: install on desktop/mobile and work offline.

> Dataset values are approximate per common serving sizes; for precise diet tracking, consult labels or official databases.

## Quick Start (Local)
1. Download and unzip this project.
2. Open `index.html` in your browser. (Double‑click works on most systems.)
3. Click **Start Daily Lesson**.

## Deploy (Launch to the web)

### Option A — Vercel (recommended, free)
1. Push this folder to a **GitHub** repo (or import directly on vercel.com).
2. On **Vercel → New Project**, import the repo.
3. **Framework Preset**: *Other* (static).
4. **Build & Output**: none required; output directory is the project root.
5. Deploy — your app will be live in ~1 minute.

### Option B — Netlify (drag‑and‑drop)
1. Go to **app.netlify.com** → **Add new site** → **Deploy manually**.
2. Drag the entire project folder into the drop zone.

### Option C — GitHub Pages
1. Commit and push to GitHub.
2. Settings → Pages → Select branch: `main` (root).
3. Save — your site will appear at `https://<you>.github.io/<repo>/`.

## Customize
- Open the **⚙️ Settings → Food Editor** in the app to add foods.
- Change daily goal and numeric leniency under **Preferences**.
- Replace the icons under `assets/` if you want your own branding.

## Tech
Vanilla HTML/CSS/JS + Service Worker (no frameworks). Installs as a PWA.

## License
MIT © 2025
