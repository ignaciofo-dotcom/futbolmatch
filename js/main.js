/* Orchestration: global state machine, game loop, and nav wiring. */
window.Game = (function () {
  const FIXED = 1 / 60;
  let state = 'SPLASH';
  let acc = 0, last = 0;
  const Self = { profile: null, match: null, get state() { return state; } };

  function init() {
    window.Renderer.init();
    window.UI.init();
    Self.profile = window.Save.load();
    if (Self.profile) {
      window.I18N.setLang(Self.profile.language || 'es');
      window.Input.setProfile(Self.profile.controlProfile || 'ARROWS');
      window.Audio2.setEnabled(Self.profile.sound !== false);
    }
    wireNav();
    setState('SPLASH');
    requestAnimationFrame(loop);
  }

  function setState(s, ctx) {
    state = s;
    window.Input.consumeAll(); // prevent the key that triggered this change from cascading
    switch (s) {
      case 'SPLASH': show('splash'); break;
      case 'MENU': window.UI.show('menu'); break;
      case 'CREATE': window.UI.show('create'); break;
      case 'MYPLAYER': window.UI.show('myplayer'); break;
      case 'TOURNAMENT': window.UI.show('tournament'); break;
      case 'TROPHIES': window.UI.show('trophies'); break;
      case 'SETTINGS': window.UI.show('settings'); break;
      case 'PREMATCH': window.UI.show('prematch'); break;
      case 'MATCH': window.UI.show('match'); break;
      case 'RESULT': window.UI.show('result', ctx); break;
      case 'TROPHY': window.UI.show('trophy', ctx); break;
    }
  }
  function show(name) { document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden')); document.getElementById('hud').classList.add('hidden'); document.getElementById('screen-' + name).classList.remove('hidden'); }

  // ---------------- nav wiring ----------------
  function wireNav() {
    const B = window.Bus;
    B.on('nav:play', () => { if (!Self.profile) setState('CREATE'); else { window.Tournament.ensure(Self.profile); setState('PREMATCH'); } });
    B.on('nav:player', () => setState('MYPLAYER'));
    B.on('nav:tournament', () => { if (!Self.profile) setState('CREATE'); else setState('TOURNAMENT'); });
    B.on('nav:trophies', () => setState('TROPHIES'));
    B.on('nav:settings', () => setState('SETTINGS'));
    B.on('nav:back', () => setState('MENU'));
    B.on('nav:createDone', (data) => {
      Self.profile = window.Save.newProfile(data);
      Self.profile.language = window.I18N.lang;
      Self.profile.controlProfile = window.Input.getProfile();
      window.Save.save(Self.profile);
      window.Tournament.ensure(Self.profile);
      setState('PREMATCH');
    });
    B.on('nav:reset', () => { window.Save.clear(); Self.profile = null; setState('CREATE'); });
    B.on('nav:startMatch', startMatch);
    B.on('nav:resultDone', onResultDone);
    B.on('nav:trophyDone', onTrophyDone);
  }

  // ---------------- match ----------------
  function startMatch() {
    const p = Self.profile;
    const tr = window.Tournament.ensure(p);
    const round = window.Tournament.currentRound(p);
    const match = window.MatchEngine.create(p, round.opponentTeamId, tr.difficultyMultiplier, window.Tournament.roundNumber(p));
    match.stadiumTheme = tr.stadiumTheme;
    window.MatchAbilities.reset(match);
    Self.match = match;
    window.UI.pickTip();
    setState('MATCH');
  }

  function onMatchEnded(match) {
    if (match._processed) return; match._processed = true;
    const p = Self.profile;
    const userWon = match.result.userWon;
    // finalize performance
    if (userWon) { window.Scoring.add(match, 'victory'); if (match.away.score === 0) window.Scoring.add(match, 'cleanSheet'); }
    const perf = match.stats.performance;
    const isFinal = window.Tournament.isFinal(p);
    const roundNo = window.Tournament.roundNumber(p);
    const rating = window.Progression.matchRating({ performancePoints: perf, isVictory: userWon, position: p.position });
    const xpGained = window.Progression.matchXP({ isVictory: userWon, performancePoints: perf, roundNumber: roundNo, isFinalVictory: userWon && isFinal });
    const lv = window.Progression.applyXP(p, xpGained);

    const finalRound = window.Tournament.currentRound(p);
    Self.finalRound = JSON.parse(JSON.stringify(finalRound)); // snapshot before advance
    const outcome = window.Tournament.recordResult(p, match.home.score, match.away.score);
    Self.pendingOutcome = outcome;
    window.Save.save(p);

    let nextOpponent = null;
    if (outcome === 'ADVANCE') nextOpponent = window.Tournament.currentRound(p).opponentTeamId;
    else if (outcome === 'REPLAY') nextOpponent = finalRound.opponentTeamId;

    const xpPct = Math.min(100, Math.round(p.experience / window.Progression.xpForLevel(p.level) * 100));
    setState('RESULT', { match, userWon, rating, xpGained, xpPct, levelsGained: lv.levelsGained, nextOpponent });
  }

  function onResultDone() {
    if (Self.pendingOutcome === 'TROPHY') {
      setState('TROPHY', {
        tournamentNumber: Self.profile.currentTournament,
        tier: window.Tournament.trophyTier(Self.profile.currentTournament),
      });
    } else {
      setState('PREMATCH');
    }
  }

  function onTrophyDone() {
    const info = window.Tournament.awardTrophyAndAdvance(Self.profile, Self.finalRound);
    window.Save.save(Self.profile);
    window.Audio2.play('trophy');
    setState('PREMATCH');
  }

  // ---------------- loop ----------------
  function loop(ts) {
    try { loopBody(ts); } catch (e) { console.error('LOOP THREW:', e && e.stack || e); }
    requestAnimationFrame(loop);
  }
  function loopBody(ts) {
    if (!last) last = ts;
    let dt = (ts - last) / 1000; last = ts;
    if (dt > 0.1) dt = 0.1; // clamp after tab-out
    acc += dt;

    // discrete UI input (menus) — once per frame
    if (['MENU', 'CREATE', 'MYPLAYER', 'TOURNAMENT', 'TROPHIES', 'SETTINGS', 'PREMATCH', 'RESULT', 'TROPHY'].includes(state)) {
      pollUI();
    }
    if (state === 'SPLASH') { if (window.Input.pressed('confirm') || anyKeyDown()) toMenu(); }

    if (state === 'MATCH' && Self.match) {
      const m = Self.match;
      // frame-level match controls
      if (m.phase === 'PLAY' && window.Input.pressed('pause')) { window.MatchEngine.pause(m); }
      else if (m.phase === 'PAUSED') {
        if (window.Input.pressed('pause')) window.MatchEngine.resume(m);
        else if (window.Input.pressed('quit')) { Self.match = null; setState('MENU'); }
      } else if (m.phase === 'HALFTIME' && window.Input.pressed('confirm')) window.MatchEngine.skipHalftime(m);

      // fixed-step simulation
      let steps = 0;
      while (acc >= FIXED && steps < 5) {
        if (m.phase !== 'PAUSED') window.MatchEngine.step(m, FIXED);
        acc -= FIXED; steps++;
        if (m.phase === 'ENDED') break;
      }
      window.Renderer.draw(m);
      window.UI.updateHUD(m);
      window.UI.updateOverlays(m);
      if (m.phase === 'ENDED') onMatchEnded(m);
    } else {
      acc = Math.min(acc, FIXED); // don't accumulate outside match
    }
  }

  function pollUI() {
    for (const a of ['up', 'down', 'left', 'right']) if (window.Input.pressed(a)) { window.UI.input(a); }
    if (window.Input.pressed('confirm')) window.UI.input('confirm');
    if (window.Input.pressed('back')) window.UI.input('back');
  }

  let splashReady = false;
  function toMenu() { window.Audio2.resume(); setState('MENU'); }
  function anyKeyDown() { return false; }

  // splash advances on ANY key
  window.Bus.on('anyKey', () => { if (state === 'SPLASH') toMenu(); });

  Self.init = init;
  Self.setState = setState;
  return Self;
})();

window.addEventListener('DOMContentLoaded', () => window.Game.init());
