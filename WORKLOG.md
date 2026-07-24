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
- **"Quitarla" is now a lunge/slide steal**: the tackle used to fire only if you were already
  within 2.6 m of the carrier, but the AI dribbles away and you could never close that gap — so the
  button felt dead. Pressing action-2 without the ball now triggers `startLunge`: a committed dash
  toward the nearest opposing carrier (or loose ball within ~11 m), and `tryLungeSteal` (called each
  frame from `sim.step` while `lungeT > 0 && stealArmed`) wins the ball on first contact, one attempt
  per lunge (base chance 0.6 + tackling attribute). `tackleCooldown` lowered 0.8→0.55 s for snappier
  pressure. Measured ~63% steal from 4 m behind a stationary carrier (was 0%); repeated presses win it
  reliably. Replaces the old stationary `doTackle`.
- **5-a-side + possession-aware action button**: back to 5 players per side (formation 1-1-2-1:
  GK, DEF, 2×MID, FWD in `engine.FORMATION`, numbers `[1,4,6,8,9]`, `config.playersPerSide: 5`).
  The action-2 control is now labelled by possession: **"Disparo"** while you hold the ball,
  **"Quitarla"** when you don't (new `hud.steal` i18n key). Applies to both the touch East button
  (relabelled each frame in `screens.updateHUD`) and the keyboard HUD legend. The underlying action
  was already possession-sensitive (charge-shot with the ball, tackle without it) — this is the label.
- **Universal "control the ball holder" rule**: `sim.step` ends with a single rule — if a **home**
  player owns the ball and isn't the current `userPlayer`, `switchControl` to them. This means you
  always control whichever of your players holds the ball, no matter how they got it (kickoff, pass,
  tackle, interception, loose ball); opponents holding the ball never steal your control. Replaced the
  earlier fragile flag-based `passSwitchActive`/`passSwitchT` handoff (removed from `step`, `doPass`,
  `kickoffKick`, `handlePossession`). `doPass` still switches to the aimed teammate immediately for
  responsiveness; the universal rule confirms/corrects it when the ball actually arrives. Verified with
  Playwright drives (`scratchpad/drive_kickoff.js`, `drive_pass.js`, `drive_owner.js`): kickoff pass,
  mid-play directional pass (kb + touch), AI teammate acquiring the ball, and opponent possession.
- **Match polish**: players are now little animated footballers (shirt body, head+hair, swinging
  legs/arms via `p.animPhase`), bigger; the kickoff aim arrow is a glowing gold chevron arrow
  (`render.drawAim`); the touch D-pad buttons sit closer together.
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
