/* Tiny event bus so the match engine can talk to UI/audio without touching them directly. */
window.Bus = (function () {
  const listeners = {};
  return {
    on(evt, fn) { (listeners[evt] = listeners[evt] || []).push(fn); return () => this.off(evt, fn); },
    off(evt, fn) { if (listeners[evt]) listeners[evt] = listeners[evt].filter(f => f !== fn); },
    emit(evt, data) { (listeners[evt] || []).forEach(fn => { try { fn(data); } catch (e) { console.error(e); } }); },
  };
})();
