/* Touch / mobile support. Auto-detects touch devices and adds on-screen controls that feed the
   SAME abstract actions as the keyboard (via Input.setVirtual / Input.setTouchMove), so no
   gameplay code changes. Any element with a data-vkey="<action>" attribute becomes a virtual
   button; the match screen also gets a floating movement joystick. */
window.TouchUI = (function () {
  const isTouch = (window.matchMedia && matchMedia('(pointer: coarse)').matches) ||
    'ontouchstart' in window || navigator.maxTouchPoints > 0;

  let wrap, moveZone, stick, thumb, stickId = null, ox = 0, oy = 0;
  const STICK_R = 55;
  const activePointers = new Map(); // pointerId -> { action, el }

  function build() {
    wrap = document.createElement('div');
    wrap.id = 'touch-match';
    wrap.innerHTML = `
      <div id="tc-move"></div>
      <div id="tc-stick" class="hidden"><div id="tc-thumb"></div></div>
      <button class="tc-pause" data-vkey="pause" aria-label="pause">⏸</button>
      <div id="tc-buttons">
        <button class="tc-btn sprint" data-vkey="sprint" data-i18n="hud.sprint">Sprint</button>
        <button class="tc-btn switch" data-vkey="switchPlayer" data-i18n="hud.switch">Cambiar</button>
        <button class="tc-btn loft" data-vkey="loft" data-i18n="hud.loft">Globo</button>
        <button class="tc-btn pass" data-vkey="action1" data-i18n="hud.pass">Pase</button>
        <button class="tc-btn shoot" data-vkey="action2" data-i18n="hud.shoot">Disparo</button>
      </div>`;
    document.getElementById('app').appendChild(wrap);
    moveZone = wrap.querySelector('#tc-move');
    stick = wrap.querySelector('#tc-stick');
    thumb = wrap.querySelector('#tc-thumb');
    wireJoystick();
    if (window.I18N) window.I18N.refresh(wrap);
  }

  // ---- floating movement joystick ----
  function wireJoystick() {
    moveZone.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      stickId = e.pointerId; try { moveZone.setPointerCapture(e.pointerId); } catch (_) {}
      ox = e.clientX; oy = e.clientY;
      stick.style.left = ox + 'px'; stick.style.top = oy + 'px';
      stick.classList.remove('hidden');
      thumb.style.transform = 'translate(-50%,-50%)';
    }, { passive: false });
    moveZone.addEventListener('pointermove', (e) => {
      if (e.pointerId !== stickId) return;
      const dx = e.clientX - ox, dy = e.clientY - oy, d = Math.hypot(dx, dy) || 1;
      const mag = Math.min(1, d / STICK_R), nx = dx / d, ny = dy / d;
      thumb.style.transform = `translate(calc(-50% + ${nx * mag * STICK_R}px), calc(-50% + ${ny * mag * STICK_R}px))`;
      // screen up (-y) -> field +x (toward opponent goal); screen right (+x) -> field +y
      window.Input.setTouchMove(-ny * mag, nx * mag);
    });
    const end = (e) => { if (e.pointerId !== stickId) return; stickId = null; stick.classList.add('hidden'); window.Input.setTouchMove(0, 0); };
    moveZone.addEventListener('pointerup', end);
    moveZone.addEventListener('pointercancel', end);
  }

  // ---- generic virtual buttons (any [data-vkey], incl. HUD slots and overlay buttons) ----
  function onDown(e) {
    const el = e.target.closest && e.target.closest('[data-vkey]');
    if (!el) return;
    e.preventDefault();
    const action = el.dataset.vkey;
    activePointers.set(e.pointerId, { action, el });
    window.Input.setVirtual(action, true);
    el.classList.add('vpress');
  }
  function onUp(e) {
    const rec = activePointers.get(e.pointerId);
    if (!rec) return;
    activePointers.delete(e.pointerId);
    let stillHeld = false; activePointers.forEach(r => { if (r.action === rec.action) stillHeld = true; });
    if (!stillHeld) window.Input.setVirtual(rec.action, false);
    rec.el.classList.remove('vpress');
  }

  // ---- show/hide the match controls with the match phase ----
  function setVisible(on) { if (wrap) wrap.classList.toggle('visible', on); if (!on) window.Input.setTouchMove(0, 0); }

  function init() {
    if (isTouch) document.body.classList.add('touch');
    build();

    document.addEventListener('pointerdown', onDown, { passive: false });
    document.addEventListener('pointerup', onUp);
    document.addEventListener('pointercancel', onUp);

    // splash advances on tap; back buttons and (as a fallback) any tap emit the right nav
    const splash = document.getElementById('screen-splash');
    if (splash) splash.addEventListener('pointerdown', () => window.Bus.emit('anyKey'));
    document.addEventListener('click', (e) => {
      if (e.target.closest && e.target.closest('.touch-back')) window.Bus.emit('nav:back');
    });

    window.Bus.on('stateChanged', (s) => { if (s !== 'MATCH') { setVisible(false); window.Input.clearVirtual(); } });
    window.Bus.on('phaseChange', ({ phase }) => setVisible(phase === 'PLAY' || phase === 'INTRO' || phase === 'GOAL'));
    window.Bus.on('langChanged', () => { if (wrap && window.I18N) window.I18N.refresh(wrap); });
  }

  return { init, isTouch };
})();

// self-init once the DOM (scripts sit at end of <body>) is available
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => window.TouchUI.init());
else window.TouchUI.init();
