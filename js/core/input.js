/* Keyboard input abstraction. Gameplay reads abstract actions, never raw keys —
   this lets touch/gamepad be added later without touching match logic. */
window.Input = (function () {
  const profiles = {
    ARROWS: {
      up: ['ArrowUp'], down: ['ArrowDown'], left: ['ArrowLeft'], right: ['ArrowRight'],
      action1: ['KeyZ'], action2: ['KeyX'], requestPass: ['KeyC'], sprint: ['ShiftLeft', 'ShiftRight'],
      slots: ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5'],
      pause: ['KeyP', 'Escape'], confirm: ['Enter'], back: ['Escape'], quit: ['KeyQ'],
    },
    WASD: {
      up: ['KeyW'], down: ['KeyS'], left: ['KeyA'], right: ['KeyD'],
      action1: ['KeyJ'], action2: ['KeyK'], requestPass: ['KeyL'], sprint: ['ShiftLeft', 'ShiftRight'],
      slots: ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5'],
      pause: ['KeyP', 'Escape'], confirm: ['Enter'], back: ['Escape'], quit: ['KeyQ'],
    },
  };

  let profile = 'ARROWS';
  const held = {};           // code -> true while down
  const edgeCodes = {};      // code -> count of unconsumed press-edges (survives keyup)

  let textMode = false;
  let textBuffer = '';
  let textCommit = null, textCancel = null;

  function map() { return profiles[profile]; }

  function actionsForCode(code) {
    const m = map(), out = [];
    for (const a in m) {
      if (a === 'slots') { const i = m.slots.indexOf(code); if (i >= 0) out.push('slot' + (i + 1)); }
      else if (m[a].includes(code)) out.push(a);
    }
    return out;
  }

  window.addEventListener('keydown', (e) => {
    if (textMode) {
      if (e.key === 'Enter') { const v = textBuffer; textMode = false; const cb = textCommit; textCommit = null; if (cb) cb(v); }
      else if (e.key === 'Escape') { textMode = false; const cb = textCancel; textCancel = null; if (cb) cb(); }
      else if (e.key === 'Backspace') { textBuffer = textBuffer.slice(0, -1); if (window.Bus) window.Bus.emit('textInput', textBuffer); }
      else if (e.key.length === 1 && textBuffer.length < 14) { textBuffer += e.key; if (window.Bus) window.Bus.emit('textInput', textBuffer); }
      e.preventDefault();
      return;
    }
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    if (!held[e.code]) {
      held[e.code] = true;
      edgeCodes[e.code] = (edgeCodes[e.code] || 0) + 1; // queue one press-edge (OS key-repeat is guarded by !held)
      window.Bus && window.Bus.emit('anyKey', e.code);
    }
  });

  // Keep the press-edge latched after keyup so a poll can still consume it. A fast tap
  // (key down+up entirely between two animation frames) must not be lost — pressed() below
  // reads the latch, not the current held state. The latch is reset on the next fresh keydown.
  window.addEventListener('keyup', (e) => { held[e.code] = false; });
  window.addEventListener('blur', () => { for (const k in held) held[k] = false; });

  // held-state query for continuous actions (movement, sprint, charge)
  function isDown(action) {
    const m = map();
    const codes = m[action] || [];
    return codes.some(c => held[c]);
  }

  // edge query: true once per physical press
  function pressed(action) {
    const m = map();
    let codes;
    if (/^slot[1-5]$/.test(action)) codes = [m.slots[parseInt(action.slice(4), 10) - 1]];
    else codes = m[action] || [];
    for (const c of codes) {
      // Consume one queued press-edge regardless of whether the key is still physically down,
      // so quick taps (and several rapid taps within one frame) are never dropped.
      if (edgeCodes[c] > 0) { edgeCodes[c]--; return true; }
    }
    return false;
  }

  function moveVector() {
    // Field coords: up (into screen) = +x toward opponent goal; right = +y.
    let x = 0, y = 0;
    if (isDown('up')) x += 1;
    if (isDown('down')) x -= 1;
    if (isDown('right')) y += 1;
    if (isDown('left')) y -= 1;
    const len = Math.hypot(x, y);
    if (len > 0) { x /= len; y /= len; }
    return { x, y };
  }

  // Mark every currently-held key as already-consumed so an in-flight press
  // (e.g. the Enter that caused a screen change) can't re-fire on the new screen.
  function consumeAll() { for (const c in edgeCodes) edgeCodes[c] = 0; }

  function setProfile(p) { if (profiles[p]) profile = p; }
  function getProfile() { return profile; }

  function beginText(initial, onCommit, onCancel) {
    textMode = true; textBuffer = initial || ''; textCommit = onCommit; textCancel = onCancel;
  }
  function isTextMode() { return textMode; }

  return { isDown, pressed, moveVector, setProfile, getProfile, beginText, isTextMode, actionsForCode, consumeAll };
})();
