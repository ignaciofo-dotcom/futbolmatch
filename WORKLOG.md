# Camino a la Copa — Work Log

A running record of the project so a new session can pick up quickly.
Newest entries at the top. See `docs/design.html` for the full spec and `README.md` for how to run.

**Stack:** vanilla JS + Canvas, no build step. Classic scripts on a global namespace
(`window.CONFIG`, `window.Sim`, `window.MatchEngine`, `window.Renderer`, `window.UI`,
`window.Input`, `window.TouchUI`, `window.Tournament`, `window.Progression`, …).
**Hosting:** GitHub Pages via `.github/workflows/pages.yml` →
https://ignaciofo-dotcom.github.io/futbolmatch/ (redeploys on push to the default branch).
**Branch:** `claude/plan-review-html-adapt-qwnx5y` (also the repo's default branch).

## File map
- `js/data/config.js` — all balancing/timing. `abilities.js` — ability defs. `teams.js`. `i18n-data.js`.
- `js/core/` — `events.js` (bus), `i18n.js`, `save.js` (localStorage+versioning), `input.js`
  (keyboard + virtual/touch actions), `touch.js` (mobile controls + fullscreen), `audio.js` (WebAudio SFX).
- `js/meta/` — `progression.js` (XP/levels/attrs), `tournament.js` (generation/difficulty/trophies).
- `js/match/` — `engine.js` (clock/halves/breaks/state machine + `Scoring`), `sim.js` (physics + AI),
  `abilities.js` (spawn/inventory/activation), `render.js` (2.5D renderer), `penalties.js`.
- `js/ui/screens.js` — DOM screens + HUD + overlays. `js/main.js` — global state machine + game loop.

## Coordinate model (current)
Field is `CONFIG.field` = 105 (x, length) × 68 (y, width). Home attacks +x (right goal), away −x.
Renderer is now **top-down horizontal**: x→screen-horizontal, y→screen-vertical, uniform scale
(`js/match/render.js`, `Renderer.project`). Movement input is direct top-down (right=+x, down=+y).

---

## Backlog from user (2026-07 session) — status

| # | Request | Status |
| --- | --- | --- |
| 1 | Goalkeeper must actually stop shots | DONE — active GK save in `sim.handlePossession` (catches shots within reach) + goal-line save |
| 2 | Take control of the GK when the opponent attacks | DONE — `switchToBall` now includes the GK in the Space cycle |
| 3 | Kickoff: each team on its own half | DONE — `resetKickoff` clamps everyone to own half |
| 4 | Kickoff aiming arrow | DONE — KICKOFF phase; aim with stick, kick with Pase/Tiro (`sim.stepKickoff`, `render.drawAim`) |
| 5 | Fewer players (1 GK + 3) and bigger | DONE — `FORMATION` 4-a-side; renderer draws large tokens |
| 6 | Horizontal top-down field | DONE — `render.js` rewritten |
| 7 | D-pad N=Sprint E=Tiro W=Pase S=Ability | DONE — `#tc-pad` compass in `touch.js`+CSS; actions `sprint/action2/action1/ability` |
| 8 | Abilities = Super Tiro (fire), Rabona (curve), Bicicleta; bare icons on field | DONE — `data/abilities.js`, `match/abilities.js`, `render.drawIcon` |
| 9 | Difficulty selection | DONE — Settings; `CONFIG.difficulties` scales opponent skill |
| 10 | Play sounds | DONE — WebAudio SFX fire (verified no errors); browsers need a first user gesture (splash tap/keydown) |
| 11 | Hydration break → 10 s | DONE — `CONFIG.match.hydrationLength = 10` |
| 12 | Match length 1–10 min input | DONE — Settings `matchMinutes`; engine derives halves/breaks |
| 13 | In-break upgrades (spend score on team stats) | DONE — hydration overlay buttons; `buyUpgrade` spends `stats.performance` (150 pts → +6 speed/defense/power) |

### Controls (current)
- Move: Arrows / WASD / left joystick. Sprint: Shift / North. Pase (low): Z/J / West.
  Tiro (higher): X/K / East. Ability (selected): C/L / South. Switch (incl. GK): Space / Cambiar.
  Select ability: number keys 1–3 or tap a HUD slot (also uses it). Pause: P/Esc.
- Abilities are one-shot special shots you must have the ball for (except conditions differ per one):
  Super Tiro = high-power fire shot; Rabona = curved shot; Bicicleta = needs an aerial ball near goal.

### Known follow-ups / polish ideas (not blocking)
- East button label shows "Disparo" (hud.shoot); user asked for "Tiro" — cosmetic only.
- Rabona currently reuses the shot path with lateral curve; could get a dedicated animation.
- In-break upgrades apply for the current match only and cost performance points (which also feed XP) —
  confirm the intended economy with the user.

---

## History (done)
- **Match redesign (all 13 backlog items above)**: top-down horizontal pitch, 4-a-side with bigger
  players, own-half kickoff with an aim-and-kick arrow, working goalkeeper saves + GK control,
  N/E/W/S touch D-pad, new ability set (Super Tiro 🔥 / Rabona 🌀 / Bicicleta 🚲) shown as bare
  field icons, difficulty selection, 10 s hydration break, 1–10 min match-length input, and in-break
  stat upgrades. Verified end-to-end on desktop + emulated mobile, no console errors.
- **Mobile polish**: fit menus to the visible viewport (dvh), re-enabled scroll, translucent/smaller
  field buttons, bigger players + flatter perspective (D_FAR 2.0). Fullscreen toggle + web-app manifest.
- **Mobile/touch support**: auto-detect touch; on-screen joystick + action buttons; tap navigation;
  portrait rotate gate. Input abstraction extended with virtual actions (`setVirtual`/`setTouchMove`).
- **Gameplay**: lofted kick (sets up bicycle), player switching (auto on pass, Space on defense),
  fixed a score-runaway bug (goals only count during PLAY; ball frozen on a goal).
- **Ability field circles** show the ability icon.
- **Hosting**: GitHub Pages workflow (auto-enables Pages; deploys on push).
- **MVP**: full playable game (menus, creation, tournament, 2×5-min match with hydration breaks,
  5-slot abilities incl. conditional bicycle kick, penalties on draws, progression, trophies).
- **Design doc**: corrected the original mobile/Unity spec into an HTML/keyboard design (`docs/design.html`).
