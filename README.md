# Camino a la Copa (Road to the Cup)

An arcade-style football game for the **browser**, played entirely with the **keyboard**.

The user creates and controls **one footballer** (goalkeeper, defender, midfielder, or forward) and competes in an infinite sequence of elimination tournaments. During matches, ability circles appear on the pitch — up to five can be collected and activated strategically (Speed, Dribble, Tackle, Super Save, and the *Chilenita* bicycle kick). Matches last ten playable minutes with hydration breaks; losing only replays the current match and never costs progression. Winning a final grants a trophy and unlocks a harder tournament.

Bilingual: Spanish (default) and English.

## Design document

The complete, corrected game design and development specification lives at
[`docs/design.html`](docs/design.html) — open it in any browser.

It is the HTML/keyboard adaptation of the original mobile-oriented design PDF: all logic
inconsistencies were fixed (match-clock model, ability/position tables, MVP team count,
state machine, save schema) and every screen mockup was redrawn for keyboard input.
Appendix A of the document lists every change against the original.

## Planned stack

- Vanilla JavaScript (ES modules) + Canvas 2D — no dependencies, no build step
- DOM/CSS overlays for menus and HUD
- `localStorage` for versioned save data
- JSON-based localization (Spanish default) and balancing configuration

Implementation will follow the phases described in §43 of the design document.
