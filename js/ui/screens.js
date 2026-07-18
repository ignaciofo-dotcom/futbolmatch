/* UI manager: DOM screens, menus (keyboard navigable), HUD, and match overlays.
   Controllers emit Bus 'nav:*' events; main.js owns transitions. */
window.UI = (function () {
  const t = (k, p) => window.I18N.t(k, p);
  const POS = ['GOALKEEPER', 'DEFENDER', 'MIDFIELDER', 'FORWARD'];
  const ATTRS = ['speed', 'acceleration', 'shooting', 'passing', 'dribbling', 'tackling', 'strength', 'stamina', 'positioning', 'reflexes', 'goalkeeping'];

  let active = null;
  const controllers = {};

  function $(id) { return document.getElementById(id); }
  function hideAllScreens() {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    $('hud').classList.add('hidden');
  }

  function show(name, ctx) {
    hideAllScreens();
    const c = controllers[name];
    if (name === 'match') { $('hud').classList.remove('hidden'); active = null; return; }
    if (!c) return;
    $('screen-' + name).classList.remove('hidden');
    active = c;
    c.enter(ctx || {});
    c.render();
    window.I18N.refresh($('screen-' + name));
  }

  function input(action, match) { if (active && active.nav) active.nav(action); }

  // ---------- generic list controller ----------
  function listNav(ctrl, count, action, onConfirm, opts) {
    opts = opts || {};
    if (action === 'up' || (opts.horizontal && action === 'left')) { ctrl.idx = (ctrl.idx - 1 + count) % count; window.Audio2.play('select'); ctrl.render(); }
    else if (action === 'down' || (opts.horizontal && action === 'right')) { ctrl.idx = (ctrl.idx + 1) % count; window.Audio2.play('select'); ctrl.render(); }
    else if (action === 'confirm') { window.Audio2.play('select'); onConfirm(ctrl.idx); }
  }

  // ============ MENU ============
  controllers.menu = {
    idx: 0, opts: [['menu.play', 'play'], ['menu.player', 'player'], ['menu.tournament', 'tournament'], ['menu.trophies', 'trophies'], ['menu.settings', 'settings']],
    enter() {},
    render() {
      const wrap = $('menu-buttons'); wrap.innerHTML = '';
      this.opts.forEach(([k], i) => {
        const b = document.createElement('div'); b.className = 'btn' + (i === this.idx ? ' sel' : '');
        b.textContent = t(k); wrap.appendChild(b);
      });
      const p = window.Game.profile;
      $('menu-status').textContent = p ? `${p.displayName} · ${t('myplayer.level')} ${p.level} · ${t('tournament.title', { n: p.currentTournament })}` : '';
    },
    nav(a) {
      if (a === 'up') { this.idx = (this.idx + this.opts.length - 1) % this.opts.length; window.Audio2.play('select'); this.render(); }
      else if (a === 'down') { this.idx = (this.idx + 1) % this.opts.length; window.Audio2.play('select'); this.render(); }
      else if (a === 'confirm') { window.Audio2.play('select'); window.Bus.emit('nav:' + this.opts[this.idx][1]); }
    },
  };

  // ============ CREATE ============
  controllers.create = {
    idx: 0, data: null,
    enter() {
      this.idx = 0;
      this.data = { name: 'Alexis', teamIdx: 0, posIdx: 3, number: 10, skin: 1, hair: 1 };
      this.fields = ['name', 'country', 'position', 'number', 'skin', 'hair', 'continue'];
    },
    render() {
      const box = $('create-form'); box.innerHTML = '';
      const d = this.data, team = window.TEAMS[d.teamIdx];
      const rows = [
        ['create.name', d.name, 'name'],
        ['create.country', team.flag + ' ' + team.name, 'country'],
        ['create.position', t('pos.' + POS[d.posIdx]), 'position'],
        ['create.number', d.number, 'number'],
        ['create.skin', '●'.padStart(1), 'skin'],
        ['create.hair', '●', 'hair'],
      ];
      rows.forEach(([label, val, key], i) => {
        const f = document.createElement('div');
        f.className = 'field' + (i === this.idx ? ' sel' : '') + (this._editing && key === 'name' ? ' editing' : '');
        const editable = ['country', 'position', 'number', 'skin', 'hair'].includes(key);
        f.innerHTML = `<label>${t(label)}</label>${editable ? '<span class="arr">◀</span>' : ''}<span class="val">${val}</span>${editable ? '<span class="arr">▶</span>' : ''}`;
        box.appendChild(f);
      });
      const cont = document.createElement('div');
      cont.className = 'field action' + (this.idx === 6 ? ' sel' : '');
      cont.textContent = t('create.continue');
      box.appendChild(cont);
      this.renderAvatar();
    },
    renderAvatar() {
      const d = this.data, team = window.TEAMS[d.teamIdx];
      const skins = ['#f2c9a0', '#e0ac69', '#c68642', '#8d5524'];
      const hairs = ['#2b1c10', '#5b3b1a', '#111111', '#caa04a'];
      $('create-avatar').innerHTML = `<div class="avatar">
        <div class="hair" style="background:${hairs[d.hair]}"></div>
        <div class="head" style="background:${skins[d.skin]}"></div>
        <div class="shirt" style="background:linear-gradient(135deg,${team.colors[0]},${team.colors[1]})">${d.number}</div>
        <div class="shorts" style="background:${team.colors[1]}"></div>
      </div>`;
    },
    nav(a) {
      if (this._editing) return; // text handled by Input
      const d = this.data;
      if (a === 'up') { this.idx = (this.idx + 6) % 7; window.Audio2.play('select'); this.render(); return; }
      if (a === 'down') { this.idx = (this.idx + 1) % 7; window.Audio2.play('select'); this.render(); return; }
      const dir = a === 'left' ? -1 : a === 'right' ? 1 : 0;
      const key = this.fields[this.idx];
      if (dir) {
        if (key === 'country') d.teamIdx = (d.teamIdx + dir + window.TEAMS.length) % window.TEAMS.length;
        else if (key === 'position') d.posIdx = (d.posIdx + dir + POS.length) % POS.length;
        else if (key === 'number') d.number = Math.max(1, Math.min(99, d.number + dir));
        else if (key === 'skin') d.skin = (d.skin + dir + 4) % 4;
        else if (key === 'hair') d.hair = (d.hair + dir + 4) % 4;
        window.Audio2.play('select'); this.render(); return;
      }
      if (a === 'confirm') {
        if (key === 'name') {
          this._editing = true; this.render();
          window.Input.beginText(d.name, (v) => { d.name = (v || 'Jugador').trim() || 'Jugador'; this._editing = false; this.render(); },
            () => { this._editing = false; this.render(); });
        } else if (key === 'continue') {
          window.Audio2.play('select');
          window.Bus.emit('nav:createDone', {
            displayName: d.name, teamId: window.TEAMS[d.teamIdx].id, position: POS[d.posIdx],
            shirtNumber: d.number, appearance: { skin: d.skin, hair: d.hair },
          });
        }
      }
    },
  };
  window.Bus.on('textInput', (buf) => { const c = controllers.create; if (c._editing) { c.data.name = buf; c.render(); } });

  // ============ MY PLAYER ============
  controllers.myplayer = {
    idx: 0,
    enter() { this.idx = 0; },
    render() {
      const p = window.Game.profile, box = $('myplayer-content');
      if (!p) { box.innerHTML = `<p>${t('myplayer.noPlayer')}</p>`; return; }
      let html = `<div style="text-align:center;margin-bottom:10px">
        <b>${p.displayName}</b> · ${window.getTeam(p.teamId).flag} · ${t('pos.' + p.position)} · #${p.shirtNumber}<br>
        <span style="color:var(--muted)">${t('myplayer.level')} ${p.level} · ${t('myplayer.points')}: <b style="color:var(--gold)">${p.attributePoints}</b> · ${t('myplayer.trophies')}: ${p.trophies.length}</span></div>`;
      html += '<div class="form-box" style="max-width:520px">';
      ATTRS.forEach((attr, i) => {
        const cost = window.Progression.attrCost(p, attr);
        html += `<div class="field${i === this.idx ? ' sel' : ''}"><label>${t('attr.' + attr)}</label>
          <span class="val">${p.attributes[attr]}</span>
          <span class="arr" style="opacity:${p.attributePoints >= cost ? 1 : .3}">+${cost === 1 ? '' : ''}▲(${cost})</span></div>`;
      });
      html += '</div>';
      box.innerHTML = html;
    },
    nav(a) {
      const p = window.Game.profile; if (!p) return;
      if (a === 'up') { this.idx = (this.idx + ATTRS.length - 1) % ATTRS.length; window.Audio2.play('select'); this.render(); }
      else if (a === 'down') { this.idx = (this.idx + 1) % ATTRS.length; window.Audio2.play('select'); this.render(); }
      else if (a === 'confirm') {
        if (window.Progression.spendPoint(p, ATTRS[this.idx])) { window.Audio2.play('levelup'); window.Save.save(p); this.render(); }
        else window.Audio2.play('error');
      } else if (a === 'back') window.Bus.emit('nav:back');
    },
  };

  // ============ TOURNAMENT ============
  controllers.tournament = {
    enter() {},
    render() {
      const p = window.Game.profile;
      const tr = window.Tournament.ensure(p);
      $('tournament-title').textContent = t('tournament.title', { n: p.currentTournament }) + ' · ' + t('tournament.difficulty') + ' ×' + tr.difficultyMultiplier;
      const path = $('tournament-path'); path.innerHTML = '';
      const hint = document.createElement('div'); hint.className = 'path-cup'; hint.textContent = '🏆'; path.appendChild(hint);
      // rounds top(final) -> bottom(first); column-reverse so append first-round first
      tr.rounds.forEach((r, i) => {
        if (i > 0) { const conn = document.createElement('div'); conn.className = 'connector'; path.appendChild(conn); }
        const row = document.createElement('div');
        const state = r.result ? 'done' : (i === p.currentRoundIndex ? 'cur' : (i < p.currentRoundIndex ? 'done' : 'lock'));
        row.className = 'round-row ' + state;
        const opp = window.getTeam(r.opponentTeamId);
        const st = r.result ? '✔' : (i === p.currentRoundIndex ? '▶' : '🔒');
        const who = r.result ? `${r.result.home}–${r.result.away}` : `${t('tournament.vs')} ${opp.flag} ${opp.name}`;
        row.innerHTML = `<span class="st">${st}</span>${t('round.' + r.round)}<span class="who">${who}</span>`;
        path.appendChild(row);
      });
    },
    nav(a) { if (a === 'confirm') window.Bus.emit('nav:play'); else if (a === 'back') window.Bus.emit('nav:back'); },
  };

  // ============ TROPHIES ============
  controllers.trophies = {
    enter() {},
    render() {
      const p = window.Game.profile, box = $('trophies-list');
      if (!p || !p.trophies.length) { box.innerHTML = `<p style="color:var(--muted)">${t('trophy.none')}</p>`; return; }
      const icons = { BRONZE: '🥉', SILVER: '🥈', GOLD: '🏆', CHAMPION: '🏆', LEGEND: '👑' };
      box.innerHTML = p.trophies.map(tr => `<div class="trophy-card">
        <div class="big">${icons[tr.tier] || '🏆'}</div>
        <div class="tier">${t('trophy.tier.' + tr.tier)}</div>
        <div class="meta">${t('tournament.title', { n: tr.tournament })}<br>${window.getTeam(tr.finalOpponent).flag} ${tr.finalScore}<br>${tr.date}</div>
      </div>`).join('');
    },
    nav(a) { if (a === 'back' || a === 'confirm') window.Bus.emit('nav:back'); },
  };

  // ============ SETTINGS ============
  controllers.settings = {
    idx: 0,
    enter() { this.idx = 0; this.fields = ['language', 'controls', 'sound', 'matchLength', 'reset']; },
    render() {
      const p = window.Game.profile, box = $('settings-form'); box.innerHTML = '';
      const lang = window.I18N.lang === 'en' ? 'English' : 'Español';
      const ctrl = (p ? p.controlProfile : 'ARROWS') === 'WASD' ? 'WASD + J/K' : 'Flechas + Z/X';
      const sound = (p ? p.sound : true) ? t('settings.on') : t('settings.off');
      const ml = (p && p.testShortMatch) ? '30 s' : '5:00';
      const rows = [['settings.language', lang], ['settings.controls', ctrl], ['settings.sound', sound], ['settings.matchLength', ml]];
      rows.forEach(([label, val], i) => {
        const f = document.createElement('div'); f.className = 'field' + (i === this.idx ? ' sel' : '');
        f.innerHTML = `<label>${t(label)}</label><span class="arr">◀</span><span class="val">${val}</span><span class="arr">▶</span>`;
        box.appendChild(f);
      });
      const r = document.createElement('div'); r.className = 'field action' + (this.idx === 4 ? ' sel' : ''); r.textContent = t('settings.reset');
      box.appendChild(r);
    },
    nav(a) {
      const p = window.Game.profile;
      if (a === 'up') { this.idx = (this.idx + 4) % 5; window.Audio2.play('select'); this.render(); return; }
      if (a === 'down') { this.idx = (this.idx + 1) % 5; window.Audio2.play('select'); this.render(); return; }
      const dir = a === 'left' ? -1 : a === 'right' ? 1 : 0;
      const key = this.fields[this.idx];
      if (dir || (a === 'confirm' && key !== 'reset')) {
        if (key === 'language') { window.I18N.setLang(window.I18N.lang === 'es' ? 'en' : 'es'); if (p) p.language = window.I18N.lang; }
        else if (key === 'controls') { const np = (p ? p.controlProfile : 'ARROWS') === 'ARROWS' ? 'WASD' : 'ARROWS'; window.Input.setProfile(np); if (p) p.controlProfile = np; }
        else if (key === 'sound') { const v = p ? !p.sound : false; if (p) p.sound = v; window.Audio2.setEnabled(v); }
        else if (key === 'matchLength') { if (p) p.testShortMatch = !p.testShortMatch; }
        if (p) window.Save.save(p);
        window.Audio2.play('select'); this.render(); window.I18N.refresh($('screen-settings')); return;
      }
      if (a === 'confirm' && key === 'reset') { window.Audio2.play('error'); window.Bus.emit('nav:reset'); return; }
      if (a === 'back') window.Bus.emit('nav:back');
    },
  };

  // ============ PREMATCH ============
  controllers.prematch = {
    enter(ctx) { this.ctx = ctx; },
    render() {
      const p = window.Game.profile;
      const round = window.Tournament.currentRound(p);
      const home = window.getTeam(p.teamId), away = window.getTeam(round.opponentTeamId);
      $('prematch-round').textContent = t('round.' + round.round) + ' · ' + t('tournament.title', { n: p.currentTournament });
      $('prematch-teams').innerHTML = `
        <div class="team"><div class="flag">${home.flag}</div>${home.name}<div style="color:var(--cyan);font-size:.7em">${t('prematch.you')} #${p.shirtNumber}</div></div>
        <div class="vs">${t('tournament.vs')}</div>
        <div class="team"><div class="flag">${away.flag}</div>${away.name}</div>`;
      const tr = window.Tournament.ensure(p);
      $('prematch-info').innerHTML = `${t('pos.' + p.position)} · ${t('tournament.difficulty')} ×${tr.difficultyMultiplier}<br>${t('prematch.objective')}`;
    },
    nav(a) { if (a === 'confirm') window.Bus.emit('nav:startMatch'); },
  };

  // ============ RESULT ============
  controllers.result = {
    enter(ctx) { this.ctx = ctx; },
    render() {
      const r = this.ctx; const m = r.match, p = window.Game.profile;
      const win = r.userWon;
      const nextOpp = r.nextOpponent ? window.getTeam(r.nextOpponent) : null;
      $('result-content').innerHTML = `
        <div class="verdict ${win ? 'win' : 'lose'}">${win ? t('result.victory') : t('result.defeat')}</div>
        <div class="score">${m.home.score} – ${m.away.score}</div>
        ${m.penalties ? `<div class="pens">${t('penalties.title')}: ${m.penalties.home} – ${m.penalties.away}</div>` : ''}
        <div class="result-body">
          <table>
            <tr><td>${t('result.goals')}</td><td>${m.stats.goals}</td></tr>
            <tr><td>${t('result.assists')}</td><td>${m.stats.assists}</td></tr>
            <tr><td>${t('result.saves')}</td><td>${m.stats.saves}</td></tr>
            <tr><td>${t('result.recoveries')}</td><td>${m.stats.recoveries}</td></tr>
            <tr><td>${t('result.shots')}</td><td>${m.stats.shotsOnTarget}</td></tr>
            <tr><td>${t('result.rating')}</td><td>${r.rating.toFixed(1)}</td></tr>
            <tr><td>${t('result.points')}</td><td>${m.stats.performance}</td></tr>
          </table>
          <div class="xp-box">
            <div class="lbl">${t('result.xp')}</div>
            <div class="gain">+${r.xpGained} XP</div>
            <div class="xp-bar"><i style="width:${r.xpPct}%"></i></div>
            <div class="lbl">${t('result.level')} ${p.level}${r.levelsGained ? ` · <span class="levelup">${t('result.levelUp')}</span>` : ''}</div>
            ${nextOpp ? `<div class="lbl">${t('result.next')}: ${nextOpp.flag} ${nextOpp.name}</div>` : ''}
          </div>
        </div>
        <div class="btn primary center" style="pointer-events:none">${win ? t('result.continue') : t('result.rematch')} &nbsp;(Enter)</div>`;
    },
    nav(a) { if (a === 'confirm') window.Bus.emit('nav:resultDone'); },
  };

  // ============ TROPHY ============
  controllers.trophy = {
    enter(ctx) { this.ctx = ctx; },
    render() {
      const r = this.ctx;
      const icons = { BRONZE: '🥉', SILVER: '🥈', GOLD: '🏆', CHAMPION: '🏆', LEGEND: '👑' };
      $('trophy-content').innerHTML = `
        <div class="big">${icons[r.tier] || '🏆'}</div>
        <div class="title">${t('trophy.champion', { n: r.tournamentNumber })}</div>
        <div class="reward-chip">🎽 ${t('trophy.unlockedKit')}</div>
        <div class="reward-chip">🕺 ${t('trophy.unlockedCeleb')}</div>
        <div class="btn primary center" style="pointer-events:none;margin-top:10px">${t('trophy.next')} &nbsp;(Enter)</div>`;
    },
    nav(a) { if (a === 'confirm') window.Bus.emit('nav:trophyDone'); },
  };

  // ---------- HUD ----------
  function halfLabel(match) {
    const es = window.I18N.lang === 'es';
    return (match.half === 1 ? '1' : '2') + (es ? 'T' : 'H');
  }
  function fmtClock(sec) { const m = Math.floor(sec / 60), s = Math.floor(sec % 60); return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s; }

  function updateHUD(match) {
    const home = match.home.teamRef.short, away = match.away.teamRef.short;
    $('hud-home').textContent = home; $('hud-away').textContent = away;
    $('hud-score').textContent = `${match.home.score} – ${match.away.score}`;
    $('hud-half').textContent = halfLabel(match);
    $('hud-clock').textContent = fmtClock(match.halfClock);

    // slots
    const slots = $('hud-slots');
    if (slots.childElementCount !== 5) { slots.innerHTML = ''; for (let i = 0; i < 5; i++) { const d = document.createElement('div'); d.className = 'slot empty'; d.innerHTML = `<span class="ic"></span><span class="key">${i + 1}</span>`; slots.appendChild(d); } }
    for (let i = 0; i < 5; i++) {
      const slot = slots.children[i], id = match.inventory[i];
      const def = id ? window.ABILITIES[id] : null;
      slot.className = 'slot ' + (def ? 'full' : 'empty') + (def && match.activeEffects[id] ? ' active' : '');
      slot.style.color = def ? def.color : '';
      slot.querySelector('.ic').textContent = def ? def.icon : '';
    }
    // stamina
    $('hud-stamina').style.width = Math.max(0, match.userPlayer.stamina) + '%';
    // legend — keys shown for the current control profile, actions for the current situation
    const hasBall = match.ball.owner === match.userPlayer;
    const wasd = window.Input.getProfile() === 'WASD';
    const K = wasd ? { a1: 'J', a2: 'K', loft: 'L' } : { a1: 'Z', a2: 'X', loft: 'C' };
    $('hud-legend').innerHTML = hasBall
      ? `<span><b>${K.a1}</b> ${t('hud.pass')}</span><span><b>${K.a2}</b> ${t('hud.shoot')}</span>
         <span><b>${K.loft}</b> ${t('hud.loft')}</span><span><b>⇧</b> ${t('hud.sprint')}</span>`
      : `<span><b>${K.a2}</b> ${t('hud.tackle')}</span><span><b>Space</b> ${t('hud.switch')}</span>
         <span><b>⇧</b> ${t('hud.sprint')}</span><span><b>P</b> ${t('hud.pause')}</span>`;
    // banner / toast
    const banner = $('hud-banner'), toast = $('hud-toast');
    if (match.banner) { banner.textContent = t(match.banner); banner.classList.remove('hidden'); } else banner.classList.add('hidden');
    if (match.toast) { toast.textContent = t(match.toast); toast.classList.remove('hidden'); } else toast.classList.add('hidden');
  }

  // ---------- match overlays ----------
  function toggle(id, on) { $(id).classList.toggle('hidden', !on); }
  const tips = ['tip.speed', 'tip.bicycle', 'tip.tackle', 'tip.sprint'];
  let curTip = 'tip.speed';

  function updateOverlays(match) {
    toggle('overlay-hydration', match.phase === 'HYDRATION');
    toggle('overlay-halftime', match.phase === 'HALFTIME');
    toggle('overlay-pause', match.phase === 'PAUSED');
    toggle('overlay-penalties', match.phase === 'PENALTIES');

    if (match.phase === 'HYDRATION') { $('hydration-count').textContent = fmtClock(Math.max(0, match.stateTimer)); $('hydration-tip').textContent = t(curTip); }
    if (match.phase === 'HALFTIME') { $('halftime-score').textContent = `${match.home.score} – ${match.away.score}`; $('halftime-count').textContent = fmtClock(Math.max(0, match.stateTimer)); }
    if (match.phase === 'PENALTIES') renderPenalties(match);
  }
  function pickTip() { curTip = tips[Math.floor(Math.random() * tips.length)]; }

  function renderPenalties(match) {
    const P = match.penalties; if (!P) return;
    $('pen-score').textContent = `${match.home.teamRef.short} ${P.home} – ${P.away} ${match.away.teamRef.short}`;
    const zones = document.querySelectorAll('#pen-goal .pen-zone');
    zones.forEach((z, i) => z.classList.toggle('sel', (P.phase === 'SHOOT_SELECT' || P.phase === 'SAVE_SELECT') && P.selDir === i));
    const leftFor = d => ['8%', '44%', '80%'][d];
    const gk = $('pen-gk'), ball = $('pen-ball'), power = $('pen-power'), marker = $('pen-power-marker'), msg = $('pen-msg');
    // GK position
    let gkDir = 1;
    if (P.phase === 'SAVE_SELECT') gkDir = P.selDir;
    else if (P.phase === 'RESULT') gkDir = P.keeperDir;
    gk.style.left = leftFor(gkDir);
    // ball
    if (P.phase === 'RESULT') { ball.classList.remove('hidden'); ball.style.left = leftFor(P.shooterDir); ball.style.bottom = P.result === 'miss' ? '150px' : '70px'; }
    else { ball.classList.add('hidden'); }
    // power
    if (P.phase === 'SHOOT_POWER') { power.classList.remove('hidden'); marker.style.left = (P.power * 98) + '%'; }
    else power.classList.add('hidden');
    // msg
    msg.className = 'pen-msg' + (P.result ? ' ' + P.result : '');
    msg.textContent = P.result ? t('penalties.' + (P.result === 'goal' ? 'goal' : P.result === 'saved' ? 'saved' : 'miss')) : t(P.msg);
  }

  function init() { /* nothing yet */ }

  return { init, show, input, updateHUD, updateOverlays, pickTip, controllers };
})();
