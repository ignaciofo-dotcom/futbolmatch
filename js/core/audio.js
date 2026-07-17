/* Minimal WebAudio SFX — synthesized placeholders (no asset files). Starts after first key. */
window.Audio2 = (function () {
  let ctx = null, enabled = true;

  function ensure() {
    if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ctx = null; } }
    if (ctx && ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone(freq, dur, type, gain) {
    if (!enabled || !ensure()) return;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'sine'; o.frequency.value = freq;
    g.gain.value = 0.0001;
    o.connect(g); g.connect(ctx.destination);
    const t = ctx.currentTime;
    g.gain.exponentialRampToValueAtTime(gain || 0.15, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.start(t); o.stop(t + dur + 0.02);
  }

  function chord(freqs, dur, type) { freqs.forEach(f => tone(f, dur, type, 0.09)); }

  const sfx = {
    kick: () => tone(180, 0.08, 'square', 0.12),
    pass: () => tone(320, 0.07, 'triangle', 0.1),
    shot: () => tone(140, 0.12, 'sawtooth', 0.16),
    goal: () => chord([523, 659, 784], 0.5, 'triangle'),
    save: () => tone(90, 0.18, 'square', 0.15),
    tackle: () => tone(110, 0.09, 'sawtooth', 0.13),
    whistle: () => { tone(2100, 0.15, 'sine', 0.08); setTimeout(() => tone(2100, 0.2, 'sine', 0.08), 180); },
    collect: () => chord([660, 990], 0.12, 'sine'),
    activate: () => chord([440, 660, 880], 0.2, 'triangle'),
    bicycle: () => { chord([300, 450], 0.15, 'sawtooth'); setTimeout(() => chord([600, 900], 0.3, 'triangle'), 120); },
    trophy: () => { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.3, 'triangle', 0.12), i * 120)); },
    levelup: () => chord([523, 784], 0.3, 'triangle'),
    select: () => tone(520, 0.05, 'sine', 0.08),
    error: () => tone(160, 0.12, 'square', 0.1),
  };

  function play(name) { if (sfx[name]) sfx[name](); }
  function setEnabled(v) { enabled = !!v; }
  function resume() { ensure(); }

  return { play, setEnabled, resume };
})();
