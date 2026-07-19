/* 2.5D perspective renderer. Simulation is flat (field coords); here we project to a tilted
   pitch that recedes toward a stadium horizon. Fixed full-pitch camera. */
window.Renderer = (function () {
  const F = window.CONFIG.field;
  let canvas, ctx, W = 1280, H = 720;

  // projection params
  // D_FAR = far-end scale denominator; lower = flatter perspective so far players aren't tiny.
  const HORIZON = 196, GROUND_BOTTOM = 706, D_FAR = 2.0, DEPTH = D_FAR - 1;
  const NEAR_HALF_W = 660;          // pitch half-width in px at the near (bottom) edge
  const HSPREAD = NEAR_HALF_W / (F.width / 2);
  const HEIGHT_PX = 17;             // px per metre of ball/player height at near scale
  const INV_FAR = 1 / D_FAR;

  const THEMES = {
    DAY_STADIUM:    { sky: ['#3f7bc4', '#8fc0e8'], grass: ['#2aa64f', '#38d06a'], stand: '#2b3f66' },
    NIGHT_STADIUM:  { sky: ['#0c1c3c', '#16305e'], grass: ['#1f9e4a', '#2fd463'], stand: '#12234a' },
    SUNSET_STADIUM: { sky: ['#8a3b6b', '#e6994a'], grass: ['#279a4a', '#37c862'], stand: '#3a2b52' },
  };

  function init() {
    canvas = document.getElementById('pitch');
    ctx = canvas.getContext('2d');
    W = canvas.width; H = canvas.height;
  }

  function scaleAt(t) { return 1 / (1 + t * DEPTH); }        // near=1, far=1/D_FAR
  function project(x, y, z) {
    const t = x / F.length;
    const inv = scaleAt(t);
    const sy = GROUND_BOTTOM - (GROUND_BOTTOM - HORIZON) * (1 - inv) / (1 - INV_FAR) - (z || 0) * HEIGHT_PX * inv;
    const sx = W / 2 + (y - F.width / 2) * HSPREAD * inv;
    return { x: sx, y: sy, s: inv };
  }

  function draw(match) {
    const theme = THEMES[match.stadiumTheme] || THEMES.NIGHT_STADIUM;
    drawBackground(theme);
    drawPitch(theme);
    drawLines();
    drawGoals();

    // ability circles first (on the ground), then entities back-to-front
    for (const c of match.circles) drawOrb(c);

    const ents = [];
    for (const p of match.players) ents.push({ x: p.x, kind: 'player', ref: p });
    ents.push({ x: match.ball.x, kind: 'ball', ref: match.ball });
    ents.sort((a, b) => b.x - a.x); // far (large x) first
    for (const e of ents) { if (e.kind === 'player') drawPlayer(match, e.ref); else drawBall(match, e.ref); }

    if (match.chargingShot) drawCharge(match);
  }

  function drawBackground(theme) {
    const g = ctx.createLinearGradient(0, 0, 0, HORIZON + 30);
    g.addColorStop(0, theme.sky[0]); g.addColorStop(1, theme.sky[1]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, HORIZON + 30);
    // stands
    for (let i = 0; i < 3; i++) { ctx.fillStyle = shade(theme.stand, i * 10); ctx.fillRect(0, 40 + i * 22, W, 22); }
    // floodlights glow
    for (let i = 0; i < 6; i++) {
      const x = 90 + i * 220;
      const gl = ctx.createRadialGradient(x, 24, 3, x, 24, 70);
      gl.addColorStop(0, 'rgba(255,255,240,.7)'); gl.addColorStop(1, 'rgba(255,255,240,0)');
      ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(x, 24, 70, 0, 7); ctx.fill();
    }
    // dark surround filling the area outside the pitch trapezoid (avoids stark black voids)
    const sg = ctx.createLinearGradient(0, HORIZON, 0, H);
    sg.addColorStop(0, shade(theme.stand, -14)); sg.addColorStop(1, '#04070e');
    ctx.fillStyle = sg; ctx.fillRect(0, HORIZON, W, H - HORIZON);
  }

  function fieldPoly(points) { // points: [[x,y,z?]]
    ctx.beginPath();
    points.forEach((p, i) => { const s = project(p[0], p[1], p[2] || 0); i ? ctx.lineTo(s.x, s.y) : ctx.moveTo(s.x, s.y); });
    ctx.closePath();
  }

  function drawPitch(theme) {
    // base grass
    const g = ctx.createLinearGradient(0, HORIZON, 0, GROUND_BOTTOM);
    g.addColorStop(0, theme.grass[0]); g.addColorStop(1, theme.grass[1]);
    ctx.fillStyle = g;
    fieldPoly([[0, 0], [0, F.width], [F.length, F.width], [F.length, 0]]); ctx.fill();
    // mowed stripes along the length
    const N = 10;
    for (let i = 0; i < N; i++) {
      if (i % 2) continue;
      const x0 = i / N * F.length, x1 = (i + 1) / N * F.length;
      ctx.fillStyle = 'rgba(255,255,255,.06)';
      fieldPoly([[x0, 0], [x0, F.width], [x1, F.width], [x1, 0]]); ctx.fill();
    }
    // vignette
    const vg = ctx.createRadialGradient(W / 2, GROUND_BOTTOM - 40, 120, W / 2, GROUND_BOTTOM - 40, 720);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.28)');
    ctx.fillStyle = vg; ctx.fillRect(0, HORIZON, W, H - HORIZON);
  }

  function strokeField(points, close) {
    ctx.beginPath();
    points.forEach((p, i) => { const s = project(p[0], p[1], p[2] || 0); i ? ctx.lineTo(s.x, s.y) : ctx.moveTo(s.x, s.y); });
    if (close) ctx.closePath();
    ctx.stroke();
  }

  function drawLines() {
    ctx.strokeStyle = 'rgba(255,255,255,.82)'; ctx.lineWidth = 2.5;
    strokeField([[0.4, 0.4], [0.4, F.width - 0.4], [F.length - 0.4, F.width - 0.4], [F.length - 0.4, 0.4]], true);
    // halfway line
    strokeField([[F.length / 2, 0.4], [F.length / 2, F.width - 0.4]]);
    // centre circle
    const cc = []; for (let a = 0; a <= 32; a++) { const th = a / 32 * Math.PI * 2; cc.push([F.length / 2 + Math.cos(th) * F.centreCircle, F.width / 2 + Math.sin(th) * F.centreCircle]); }
    strokeField(cc, true);
    // penalty areas
    const pW = F.penaltyAreaWidth / 2, pD = F.penaltyAreaDepth;
    strokeField([[0.4, F.width / 2 - pW], [pD, F.width / 2 - pW], [pD, F.width / 2 + pW], [0.4, F.width / 2 + pW]]);
    strokeField([[F.length - 0.4, F.width / 2 - pW], [F.length - pD, F.width / 2 - pW], [F.length - pD, F.width / 2 + pW], [F.length - 0.4, F.width / 2 + pW]]);
  }

  function drawGoals() {
    const gh = 2.6, gy0 = F.width / 2 - F.goalWidth / 2, gy1 = F.width / 2 + F.goalWidth / 2;
    ctx.lineWidth = 3; ctx.strokeStyle = '#ffffff';
    [0.2, F.length - 0.2].forEach(gx => {
      // posts + crossbar
      const p0 = project(gx, gy0, 0), p0t = project(gx, gy0, gh);
      const p1 = project(gx, gy1, 0), p1t = project(gx, gy1, gh);
      // net
      ctx.fillStyle = 'rgba(255,255,255,.10)';
      ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p0t.x, p0t.y); ctx.lineTo(p1t.x, p1t.y); ctx.lineTo(p1.x, p1.y); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p0t.x, p0t.y); ctx.lineTo(p1t.x, p1t.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
    });
  }

  function drawOrb(c) {
    const s = project(c.x, c.y, 0), sc = s.s;
    const pulse = 0.9 + 0.1 * Math.sin(performance.now() / 240 + c.id);
    const R = 15 * sc * pulse;           // bubble radius
    const oy = s.y - 13 * sc;            // hovers above its ground spot
    const icon = c.icon || (window.ABILITIES[c.abilityId] && window.ABILITIES[c.abilityId].icon) || '★';

    // coloured ground aura (keeps the per-ability colour cue) + soft shadow
    const gl = ctx.createRadialGradient(s.x, s.y, 1, s.x, s.y, R * 2.0);
    gl.addColorStop(0, c.color + 'aa'); gl.addColorStop(1, c.color + '00');
    ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(s.x, s.y, R * 2.0, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,.22)';
    ctx.beginPath(); ctx.ellipse(s.x, s.y, 8 * sc, 3 * sc, 0, 0, 7); ctx.fill();

    // light bubble backing so the icon reads clearly against the grass, with a coloured ring
    const g = ctx.createRadialGradient(s.x - R * 0.4, oy - R * 0.4, 1, s.x, oy, R);
    g.addColorStop(0, 'rgba(255,255,255,.98)'); g.addColorStop(1, 'rgba(233,240,252,.92)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(s.x, oy, R, 0, 7); ctx.fill();
    ctx.lineWidth = 2.6 * sc; ctx.strokeStyle = c.color;
    ctx.beginPath(); ctx.arc(s.x, oy, R, 0, 7); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.4)';               // glossy top highlight
    ctx.beginPath(); ctx.ellipse(s.x, oy - R * 0.4, R * 0.5, R * 0.26, 0, 0, 7); ctx.fill();

    // the ability figure — the same emoji shown in the HUD slot (Speed -> ⚡, etc.)
    ctx.font = `${Math.round(20 * sc)}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(icon, s.x, oy + 1);
  }

  const SKIN = ['#f2c9a0', '#e0ac69', '#c68642', '#8d5524'];
  const HAIR = ['#2b1c10', '#5b3b1a', '#111111', '#caa04a'];

  function drawPlayer(match, p) {
    const feet = project(p.x, p.y, 0);
    const s = feet.s * 1.4;   // enlarge the figure (esp. far players) without moving its ground anchor
    const H0 = 30 * s; // figure height px
    const col1 = p.colors[0], col2 = p.colors[1];
    // screen-space facing nub direction (+x field = up, +y field = right)
    const fdx = Math.sin(p.facing), fdy = -Math.cos(p.facing);

    // shadow
    ctx.fillStyle = 'rgba(0,0,0,.32)';
    ctx.beginPath(); ctx.ellipse(feet.x, feet.y, 15 * s, 5 * s, 0, 0, 7); ctx.fill();

    // user highlight ring
    if (p.isUser) {
      const gl = ctx.createRadialGradient(feet.x, feet.y, 3, feet.x, feet.y, 26 * s);
      gl.addColorStop(0, 'rgba(125,211,252,.45)'); gl.addColorStop(1, 'rgba(125,211,252,0)');
      ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(feet.x, feet.y, 26 * s, 0, 7); ctx.fill();
      ctx.strokeStyle = '#7dd3fc'; ctx.lineWidth = 2.5 * s;
      ctx.beginPath(); ctx.ellipse(feet.x, feet.y, 16 * s, 5.5 * s, 0, 0, 7); ctx.stroke();
    }
    // active-effect aura
    if (p.isUser) {
      const eff = Object.keys(match.activeEffects || {})[0];
      if (eff && window.ABILITIES[eff]) {
        ctx.strokeStyle = window.ABILITIES[eff].color; ctx.lineWidth = 2 * s; ctx.globalAlpha = .8;
        ctx.beginPath(); ctx.ellipse(feet.x, feet.y - H0 * 0.5, 14 * s, H0 * 0.6, 0, 0, 7); ctx.stroke(); ctx.globalAlpha = 1;
      }
    }

    // dive/lunge lean
    const lean = (p.diveT > 0 ? p.diveDir * 10 * s : 0) + (p.lungeT > 0 ? fdx * 8 * s : 0);
    const cx = feet.x + lean;

    // legs
    ctx.strokeStyle = col2; ctx.lineWidth = 3.4 * s; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx - 4 * s, feet.y - H0 * 0.28); ctx.lineTo(feet.x - 5 * s, feet.y - 1);
    ctx.moveTo(cx + 4 * s, feet.y - H0 * 0.28); ctx.lineTo(feet.x + 5 * s, feet.y - 1); ctx.stroke();

    // torso (shaded)
    const ty = feet.y - H0 * 0.5;
    const g = ctx.createLinearGradient(cx - 12 * s, ty - 12 * s, cx + 12 * s, ty + 12 * s);
    g.addColorStop(0, shade(col1, 18)); g.addColorStop(1, col2);
    ctx.fillStyle = g;
    roundRect(cx - 11 * s, ty - 12 * s, 22 * s, 26 * s, 9 * s); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.22)'; ctx.lineWidth = 1.4 * s; ctx.stroke();
    // highlight
    ctx.fillStyle = 'rgba(255,255,255,.18)';
    ctx.beginPath(); ctx.ellipse(cx - 4 * s, ty - 4 * s, 5 * s, 8 * s, 0, 0, 7); ctx.fill();

    // number
    ctx.fillStyle = '#fff'; ctx.font = `bold ${Math.round(11 * s)}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(p.number, cx, ty + 1);

    // head + hair
    const hy = feet.y - H0 - 2 * s + (p.diveT > 0 ? 4 * s : 0);
    const hx = cx + (p.diveT > 0 ? p.diveDir * 6 * s : 0);
    ctx.fillStyle = SKIN[(p.appearance && p.appearance.skin) || 0];
    ctx.beginPath(); ctx.arc(hx, hy, 6.5 * s, 0, 7); ctx.fill();
    ctx.fillStyle = HAIR[(p.appearance && p.appearance.hair) || 0];
    ctx.beginPath(); ctx.arc(hx, hy - 1.5 * s, 6.5 * s, Math.PI * 1.05, Math.PI * 2 - 0.05); ctx.fill();

    // facing nub
    ctx.fillStyle = 'rgba(255,255,255,.8)';
    ctx.beginPath(); ctx.arc(hx + fdx * 5 * s, hy + fdy * 5 * s, 1.8 * s, 0, 7); ctx.fill();

    // bicycle flash
    if (p.bicycleT > 0) {
      p.bicycleT -= 1 / 60;
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2 * s; ctx.globalAlpha = p.bicycleT;
      ctx.beginPath(); ctx.arc(cx, ty, 22 * s, 0, 7); ctx.stroke(); ctx.globalAlpha = 1;
    }
  }

  function drawBall(match, ball) {
    const ground = project(ball.x, ball.y, 0);
    const air = project(ball.x, ball.y, ball.z);
    const s = ground.s * 1.3;
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,.3)';
    ctx.beginPath(); ctx.ellipse(ground.x, ground.y, 7 * s, 2.6 * s, 0, 0, 7); ctx.fill();
    const r = 6 * s;
    const g = ctx.createRadialGradient(air.x - r * 0.4, air.y - r * 0.4, 1, air.x, air.y, r);
    g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#cbd5e1');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(air.x, air.y, r, 0, 7); ctx.fill();
    ctx.fillStyle = '#0f172a'; ctx.font = `${Math.round(7 * s)}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('✦', air.x, air.y);
  }

  function drawCharge(match) {
    const u = match.userPlayer; const s = project(u.x, u.y, 0);
    const pct = Math.min(1, (match.shotCharge || 0) / window.CONFIG.ball.maxShotCharge);
    ctx.strokeStyle = 'rgba(0,0,0,.4)'; ctx.lineWidth = 5 * s.s;
    ctx.beginPath(); ctx.arc(s.x, s.y, 22 * s.s, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * 1); ctx.stroke();
    ctx.strokeStyle = pct > 0.8 ? '#ef4444' : '#f5c542'; ctx.lineWidth = 5 * s.s;
    ctx.beginPath(); ctx.arc(s.x, s.y, 22 * s.s, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pct); ctx.stroke();
  }

  // helpers
  function roundRect(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16); let r = (n >> 16) + amt, g = ((n >> 8) & 255) + amt, b = (n & 255) + amt;
    r = Math.max(0, Math.min(255, r)); g = Math.max(0, Math.min(255, g)); b = Math.max(0, Math.min(255, b));
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  function clear() { if (ctx) ctx.clearRect(0, 0, W, H); }

  return { init, draw, project, clear };
})();
