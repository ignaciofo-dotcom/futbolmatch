# Camino a la Copa (Road to the Cup)

An arcade-style football game for the **browser**, played entirely with the **keyboard**,
rendered in a **2.5D perspective** (a tilted pitch that recedes toward a stadium horizon).

The user creates and controls **one footballer** (goalkeeper, defender, midfielder, or forward)
and competes in an infinite sequence of elimination tournaments. During matches, ability circles
appear on the pitch — up to five can be collected and activated strategically (Speed, Dribble,
Tackle, Super Save, and the *Chilenita* bicycle kick). Matches last ten playable minutes with
hydration breaks; losing only replays the current match and never costs progression. Winning a
final grants a trophy and unlocks a harder tournament.

Bilingual: Spanish (default) and English.

## Play it

It's a static site — no build step, no dependencies.

```bash
# from the repository root, serve the folder over HTTP (localStorage needs a real origin):
python3 -m http.server 8000
# then open http://localhost:8000 in a browser
```

Opening `index.html` directly via `file://` also works, except save data won't persist.

### Controls (default profile — configurable in Ajustes)

| Action | Key |
| --- | --- |
| Move | Arrow keys |
| Sprint | Shift (hold) |
| Pass (auto-switches control to the receiver) / pressure | Z |
| Shoot (hold to charge, aim with heading) / tackle | X |
| Lofted / chip kick (pops the ball up to set up a bicycle kick) | C |
| Switch player (when the other team has the ball) | Space |
| Activate ability slot 1–5 | 1–5 |
| Pause | P / Esc |
| Menus | Arrows + Enter, Esc to go back |

A second profile (WASD + J/K, lob on L, switch on Space) is available in Settings.

### On a phone

The game **auto-detects touch devices** (no manual toggle) and shows on-screen controls: a
floating movement joystick on the left and **Pase / Disparo / Globo / Cambiar / Sprint** buttons
on the right, plus tappable ability slots and a pause button; every menu becomes tap-to-select.
Play in landscape — if the phone is held in portrait, a prompt asks you to rotate (the pitch is 16:9).
The same abstract input layer drives keyboard, touch, and (later) gamepad, so gameplay code is shared.

The layout auto-fits the **visible** screen (it uses dynamic viewport units, so the browser's
address/tab bars never cut off the game), and any screen taller than the view scrolls instead of
clipping. A **⛶ fullscreen** button (top-right on touch, and in the pause menu) toggles fullscreen
where the browser supports it; on iPhone Safari (no Fullscreen API) it explains how to “Add to Home
Screen”, which launches the game fullscreen via the included web-app manifest.

## Project layout

```
index.html            # page skeleton: canvas + DOM screens/HUD/overlays
css/ui.css            # dark-blue/gold theme
js/data/              # config.js (all balancing), i18n-data.js, teams.js, abilities.js
js/core/              # events bus, i18n, save (localStorage+versioning), input (keyboard), audio (WebAudio)
js/meta/              # progression (XP/levels/attributes), tournament (generation/difficulty)
js/match/             # engine (clock/halves/breaks/state machine), sim (physics+AI),
                      #   abilities (spawn/inventory/activation), render (2.5D projection), penalties
js/ui/screens.js      # all DOM screens and the HUD
js/main.js            # global state machine + fixed-timestep game loop
docs/design.html      # full corrected design specification
```

Design principles followed: no hard-coded gameplay values (all in `js/data/config.js`), every
visible string via localization keys (Spanish fallback), keyboard input behind an abstraction
layer (so touch/gamepad can be added later), versioned save data, and event-driven communication
between the match engine, UI, and audio.

See [`docs/design.html`](docs/design.html) for the complete design document.
