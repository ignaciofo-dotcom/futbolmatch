/* Top-down horizontal pitch renderer. Field runs left→right (goals on the left and right).
   Simulation stays in flat field coords (x = length 0..105, y = width 0..68); here we just scale
   the field into the canvas. Uniform scale, so players never shrink into the distance. */
window.Renderer = (function () {
  const F = window.CONFIG.field;
  let canvas, ctx, W = 1280, H = 720;
  let scale = 1, x0 = 0, y0 = 0;

  const THEMES = {
    DAY_STADIUM:    { grass: ['#2aa64f', '#37c65f'], line: 'rgba(255,255,255,.9)',  surround: '#0c2b16' },
    NIGHT_STADIUM:  { grass: ['#1f9e4a', '#28b455'], line: 'rgba(255,255,255,.82)', surround: '#08160c' },
    SUNSET_STADIUM: { grass: ['#279a4a', '#31b656'], line: 'rgba(255,255,255,.85)', surround: '#231018' },
  };

  function init() { canvas = document.getElementById('pitch'); ctx = canvas.getContext('2d'); W = canvas.width; H = canvas.height; layout(); }
  function layout() {
    const MX = 40, MY = 48;
    scale = Math.min((W - 2 * MX) / F.length, (H - 2 * MY) / F.width);
    x0 = (W - F.length * scale) / 2;
    y0 = (H - F.width * scale) / 2;
  }
  const M = m => m * scale;                                 // metres -> px
  function project(fx, fy, z) { return { x: x0 + fx * scale, y: y0 + fy * scale - (z || 0) * scale * 0.55, s: scale }; }

  function draw(match) {
    if (!ctx) return;
    const theme = THEMES[match.stadiumTheme] || THEMES.NIGHT_STADIUM;
    ctx.fillStyle = theme.surround; ctx.fillRect(0, 0, W, H);
    drawPitch(theme);
    for (const c of match.circles) drawIcon(c);
    // draw back-to-front by y so nearer (lower) tokens overlap
    const ents = match.players.map(p => ({ y: p.y, kind: 'p', ref: p }));
    ents.push({ y: match.ball.y + (match.ball.z || 0), kind: 'b', ref: match.ball });
    ents.sort((a, b) => a.y - b.y);
    for (const e of ents) { if (e.kind === 'p') drawPlayer(match, e.ref); else drawBall(match, e.ref); }
    if (match.phase === 'KICKOFF' && match.kickoffKicker) drawAim(match);
    if (match.chargingShot) drawCharge(match);
  }

  function drawPitch(theme) {
    const g = ctx.createLinearGradient(0, y0, 0, y0 + F.width * scale);
    g.addColorStop(0, theme.grass[0]); g.addColorStop(1, theme.grass[1]);
    ctx.fillStyle = g; ctx.fillRect(x0, y0, F.length * scale, F.width * scale);
    // mowed stripes across the length
    const N = 12;
    for (let i = 0; i < N; i++) { if (i % 2) continue; ctx.fillStyle = 'rgba(255,255,255,.05)'; ctx.fillRect(x0 + i / N * F.length * scale, y0, F.length * scale / N, F.width * scale); }

    ctx.strokeStyle = theme.line; ctx.lineWidth = Math.max(2, M(0.22));
    ctx.strokeRect(x0 + M(0.6), y0 + M(0.6), (F.length - 1.2) * scale, (F.width - 1.2) * scale);
    // halfway line + centre circle
    line(F.length / 2, 0.6, F.length / 2, F.width - 0.6);
    ctx.beginPath(); ctx.arc(x0 + M(F.length / 2), y0 + M(F.width / 2), M(F.centreCircle), 0, 7); ctx.stroke();
    dot(F.length / 2, F.width / 2, 0.4, theme.line);
    // penalty areas
    const pw = F.penaltyAreaWidth / 2, pd = F.penaltyAreaDepth, cy = F.width / 2;
    ctx.strokeRect(x0 + M(0.6), y0 + M(cy - pw), M(pd), M(pw * 2));
    ctx.strokeRect(x0 + M(F.length - 0.6 - pd), y0 + M(cy - pw), M(pd), M(pw * 2));
    drawGoal(0); drawGoal(F.length);
  }
  function line(ax, ay, bx, by) { ctx.beginPath(); ctx.moveTo(x0 + M(ax), y0 + M(ay)); ctx.lineTo(x0 + M(bx), y0 + M(by)); ctx.stroke(); }
  function dot(fx, fy, r, col) { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x0 + M(fx), y0 + M(fy), M(r), 0, 7); ctx.fill(); }
  function drawGoal(gx) {
    const cy = F.width / 2, gh = F.goalWidth / 2, depth = 2.4, dir = gx === 0 ? -1 : 1;
    const x = x0 + M(gx);
    ctx.fillStyle = 'rgba(255,255,255,.14)'; ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(2, M(0.25));
    ctx.beginPath(); ctx.rect(x + (dir < 0 ? -M(depth) : 0), y0 + M(cy - gh), M(depth), M(gh * 2)); ctx.fill(); ctx.stroke();
  }

  function drawIcon(c) {                                    // ability pickup: bare icon, no bubble
    const P = project(c.x, c.y, 0);
    const bob = Math.sin(performance.now() / 300 + c.id) * M(0.4);
    const size = M(3.4);
    const gl = ctx.createRadialGradient(P.x, P.y + bob, 2, P.x, P.y + bob, size * 1.25);
    gl.addColorStop(0, c.color + 'bb'); gl.addColorStop(1, c.color + '00');
    ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(P.x, P.y + bob, size * 1.25, 0, 7); ctx.fill();
    ctx.font = `${Math.round(size)}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(c.icon, P.x, P.y + bob);
  }

  function drawPlayer(match, p) {
    const P = project(p.x, p.y, 0);
    const r = M(1.95);
    ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.beginPath(); ctx.ellipse(P.x, P.y + r * 0.55, r * 1.05, r * 0.5, 0, 0, 7); ctx.fill();
    if (p.isUser) {
      const gl = ctx.createRadialGradient(P.x, P.y, r * 0.3, P.x, P.y, r * 2);
      gl.addColorStop(0, 'rgba(125,211,252,.34)'); gl.addColorStop(1, 'rgba(125,211,252,0)');
      ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(P.x, P.y, r * 2, 0, 7); ctx.fill();
      ctx.strokeStyle = '#7dd3fc'; ctx.lineWidth = M(0.35); ctx.beginPath(); ctx.arc(P.x, P.y, r + M(0.5), 0, 7); ctx.stroke();
      const eff = Object.keys(match.activeEffects || {})[0];
      if (eff && window.ABILITIES[eff]) { ctx.strokeStyle = window.ABILITIES[eff].color; ctx.lineWidth = M(0.3); ctx.beginPath(); ctx.arc(P.x, P.y, r + M(1.1), 0, 7); ctx.stroke(); }
    }
    const g = ctx.createRadialGradient(P.x - r * 0.4, P.y - r * 0.4, r * 0.2, P.x, P.y, r);
    g.addColorStop(0, shade(p.colors[0], 28)); g.addColorStop(1, p.colors[1]);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(P.x, P.y, r, 0, 7); ctx.fill();
    ctx.lineWidth = M(0.18); ctx.strokeStyle = 'rgba(0,0,0,.4)'; ctx.stroke();
    if (p.isGK) { ctx.strokeStyle = '#fde047'; ctx.lineWidth = M(0.28); ctx.beginPath(); ctx.arc(P.x, P.y, r * 0.66, 0, 7); ctx.stroke(); }
    const fx = Math.cos(p.facing), fy = Math.sin(p.facing);
    ctx.fillStyle = 'rgba(255,255,255,.92)'; ctx.beginPath(); ctx.arc(P.x + fx * r * 0.78, P.y + fy * r * 0.78, r * 0.24, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = `bold ${Math.round(r * 1.05)}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(p.number, P.x, P.y);
  }

  function drawBall(match, ball) {
    const ground = project(ball.x, ball.y, 0), air = project(ball.x, ball.y, ball.z);
    const r = M(0.75);
    if (ball.fire > 0) {                                    // super-shot fire trail
      for (let i = 0; i < 6; i++) { const t = i / 6; const fx = air.x - ball.vx * t * 0.05 * scale, fy = air.y - ball.vy * t * 0.05 * scale;
        ctx.fillStyle = `rgba(${255},${120 - t * 90},20,${(1 - t) * 0.6})`; ctx.beginPath(); ctx.arc(fx, fy, r * (1.4 - t), 0, 7); ctx.fill(); }
      ball.fire -= 1 / 60;
    }
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(ground.x, ground.y, r * 1.15, r * 0.5, 0, 0, 7); ctx.fill();
    const g = ctx.createRadialGradient(air.x - r * 0.4, air.y - r * 0.4, r * 0.2, air.x, air.y, r);
    g.addColorStop(0, '#fff'); g.addColorStop(1, '#cbd5e1');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(air.x, air.y, r, 0, 7); ctx.fill();
    ctx.fillStyle = '#0f172a'; ctx.font = `${Math.round(r * 1.1)}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('⬡', air.x, air.y);
  }

  function drawAim(match) {
    const k = match.kickoffKicker; if (!k) return;
    const P = project(k.x, k.y, 0), a = match.kickoffAim || 0, len = M(11);
    ctx.strokeStyle = 'rgba(245,197,66,.95)'; ctx.lineWidth = M(0.45);
    const ex = P.x + Math.cos(a) * len, ey = P.y + Math.sin(a) * len;
    ctx.beginPath(); ctx.moveTo(P.x, P.y); ctx.lineTo(ex, ey); ctx.stroke();
    ctx.fillStyle = 'rgba(245,197,66,.95)'; ctx.save(); ctx.translate(ex, ey); ctx.rotate(a);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-M(1.8), -M(1)); ctx.lineTo(-M(1.8), M(1)); ctx.closePath(); ctx.fill(); ctx.restore();
  }

  function drawCharge(match) {
    const u = match.userPlayer, P = project(u.x, u.y, 0);
    const pct = Math.min(1, (match.shotCharge || 0) / window.CONFIG.ball.maxShotCharge), r = M(2.6);
    ctx.strokeStyle = 'rgba(0,0,0,.4)'; ctx.lineWidth = M(0.5); ctx.beginPath(); ctx.arc(P.x, P.y, r, 0, 7); ctx.stroke();
    ctx.strokeStyle = pct > 0.8 ? '#ef4444' : '#f5c542'; ctx.lineWidth = M(0.5);
    ctx.beginPath(); ctx.arc(P.x, P.y, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pct); ctx.stroke();
  }

  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16); let r = (n >> 16) + amt, g = ((n >> 8) & 255) + amt, b = (n & 255) + amt;
    r = Math.max(0, Math.min(255, r)); g = Math.max(0, Math.min(255, g)); b = Math.max(0, Math.min(255, b));
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }
  function clear() { if (ctx) ctx.clearRect(0, 0, W, H); }

  return { init, draw, project, clear, layout };
})();
