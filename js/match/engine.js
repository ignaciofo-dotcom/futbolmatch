/* Match engine: builds the match, owns the clock / halves / hydration breaks / phase machine.
   Physics + AI live in sim.js; ability circles in abilities.js. Communicates via Bus. */
window.MatchEngine = (function () {
  const CFG = window.CONFIG;
  const F = CFG.field;

  // Formation for a team attacking +x (own goal at x=0). 5-a-side 1-1-2-1, all on own half.
  const FORMATION = [
    { role: 'GK',  pos: 'GOALKEEPER', x: 6,  y: 34 },
    { role: 'DEF', pos: 'DEFENDER',   x: 24, y: 34 },
    { role: 'MID', pos: 'MIDFIELDER', x: 40, y: 20 },
    { role: 'MID', pos: 'MIDFIELDER', x: 40, y: 48 },
    { role: 'FWD', pos: 'FORWARD',    x: 48, y: 34 },
  ];

  function mirrorX(x) { return F.length - x; }

  function buildPlayer(opts) {
    return Object.assign({
      x: 0, y: 0, vx: 0, vy: 0, facing: 0,
      stamina: CFG.player.staminaMax, kickCd: 0, tackleCd: 0,
      diveT: 0, diveDir: 0, // animation helpers
      lungeT: 0,
    }, opts);
  }

  function attrsForAI(position, skill) {
    const base = window.Save.defaultAttrs(position);
    const boost = Math.round((skill - 0.5) * 40);
    for (const k in base) base[k] = Math.max(1, Math.min(100, base[k] + boost));
    return base;
  }

  function buildTeam(side, teamRef, attackDir, controlledPos, profile, skill) {
    const players = [];
    // ensure exactly one controlled slot matches the user's chosen position
    let userAssigned = false;
    FORMATION.forEach((slot, i) => {
      const isUserSlot = side === 'home' && !userAssigned && slot.pos === controlledPos;
      if (isUserSlot) userAssigned = true;
      const homeX = attackDir > 0 ? slot.x : mirrorX(slot.x);
      const homeY = slot.y;
      const baseNumbers = [1, 4, 6, 8, 9];
      let number = isUserSlot ? profile.shirtNumber : baseNumbers[i];
      if (!isUserSlot && number === profile.shirtNumber && side === 'home') number = baseNumbers[i] + 10;
      players.push(buildPlayer({
        id: side + '_' + i,
        team: side, teamRef, attackDir,
        role: slot.role, position: slot.pos, isGK: slot.role === 'GK',
        homeX, homeY, x: homeX, y: homeY,
        number, colors: teamRef.colors,
        isUser: isUserSlot,
        attrs: isUserSlot ? profile.attributes : attrsForAI(slot.pos, skill),
        skill: isUserSlot ? 0.9 : skill,
        appearance: isUserSlot ? profile.appearance : { skin: i % 4, hair: i % 4 },
      }));
    });
    // If user's chosen position wasn't in formation (shouldn't happen), assign the last slot.
    if (side === 'home' && !userAssigned) { const p = players[players.length - 1]; p.isUser = true; p.number = profile.shirtNumber; p.attrs = profile.attributes; }
    return players;
  }

  function create(profile, opponentTeamId, difficulty, roundNumber) {
    const homeTeam = window.getTeam(profile.teamId);
    const awayTeam = window.getTeam(opponentTeamId);
    const diff = CFG.difficulties[profile.difficulty] || CFG.difficulties.NORMAL;
    const awaySkill = Math.max(0.5, Math.min(0.97, diff.oppSkill * (0.92 + (difficulty - 1) * 0.4)));
    const homeAISkill = 0.8;

    const homePlayers = buildTeam('home', homeTeam, +1, profile.position, profile, homeAISkill);
    const awayPlayers = buildTeam('away', awayTeam, -1, 'FORWARD',
      { attributes: window.Save.defaultAttrs('FORWARD'), shirtNumber: 9, position: 'FORWARD', appearance: {} },
      awaySkill);
    awayPlayers.forEach(p => p.isUser = false);

    const players = homePlayers.concat(awayPlayers);
    const userPlayer = homePlayers.find(p => p.isUser);
    const minutes = Math.max(CFG.match.minMinutes, Math.min(CFG.match.maxMinutes, profile.matchMinutes || CFG.match.defaultMinutes));

    const match = {
      difficulty, roundNumber, assist: diff.assist, minutes, halfSeconds: minutes * 60 / 2,
      home: { side: 'home', teamRef: homeTeam, score: 0, isUser: true, attackDir: +1 },
      away: { side: 'away', teamRef: awayTeam, score: 0, isUser: false, attackDir: -1 },
      players, homePlayers, awayPlayers, userPlayer, ownPlayer: userPlayer,
      ball: { x: F.length / 2, y: F.width / 2, z: 0, vx: 0, vy: 0, vz: 0, owner: null, lastTouch: null, kickerCd: 0, curve: 0, fire: 0 },
      phase: 'INTRO', half: 1, halfClock: 0,
      hydrationTriggered: { 1: false, 2: false },
      stateTimer: CFG.match.introLength,
      playing: false,
      circles: [], inventory: [], activeEffects: {}, selectedAbility: 0,
      stats: { goals: 0, assists: 0, saves: 0, recoveries: 0, shotsOnTarget: 0, passesCompleted: 0, tackles: 0, performance: 0 },
      spent: 0, // performance points spent on in-break upgrades
      lastGoalTeam: null, finished: false, result: null,
      toast: null, toastT: 0, banner: null, bannerT: 0,
      shotCharge: 0, chargingShot: false,
      kickoffKicker: null, kickoffAim: 0,
    };
    resetKickoff(match, 'home'); // home kicks off first
    window.Bus.emit('matchCreated', match);
    return match;
  }

  function halfLength(match) { return match.halfSeconds; }
  function hydrationAt(match) { return match.halfSeconds / 2; }

  // Place both teams on their own halves, put the ball at centre, and hand the kickoff to a kicker.
  function resetKickoff(match, kickingSide) {
    match.players.forEach(p => {
      let hx = p.homeX;
      if (p.attackDir > 0) hx = Math.min(hx, F.length / 2 - 2); else hx = Math.max(hx, F.length / 2 + 2);
      p.x = hx; p.y = p.homeY; p.vx = p.vy = 0; p.diveT = 0; p.lungeT = 0; p.isUser = false;
    });
    const ball = match.ball;
    ball.x = F.length / 2; ball.y = F.width / 2; ball.z = 0; ball.vx = ball.vy = ball.vz = 0;
    ball.owner = null; ball.lastTouch = null; ball.lastPasser = null; ball.kickerCd = 0; ball.curve = 0; ball.fire = 0;
    // control returns to the user's own player each kickoff
    match.userPlayer = match.ownPlayer; match.ownPlayer.isUser = true;

    let kicker;
    if (kickingSide === 'home') kicker = match.ownPlayer;                       // the user takes their kickoff
    else { const out = match.awayPlayers.filter(p => !p.isGK); kicker = out.reduce((a, b) => Math.abs(b.x - F.length / 2) < Math.abs(a.x - F.length / 2) ? b : a); }
    const dir = kicker.attackDir;
    kicker.x = F.length / 2 - dir * 1.6; kicker.y = F.width / 2;
    ball.owner = kicker; ball.x = kicker.x + dir * 1.0; ball.y = kicker.y;
    match.kickoffKicker = kicker; match.kickoffAim = dir > 0 ? 0 : Math.PI; match.kickingSide = kickingSide;
  }

  function setPhase(match, phase, timer) {
    match.phase = phase;
    match.stateTimer = timer != null ? timer : 0;
    match.playing = (phase === 'PLAY');
    window.Bus.emit('phaseChange', { match, phase });
  }

  function showToast(match, key, dur) { match.toast = key; match.toastT = dur || 1.6; }
  function showBanner(match, key, dur) { match.banner = key; match.bannerT = dur || 2.0; window.Bus.emit('banner', key); }

  // Main step. dt in seconds (real time). Returns nothing; mutates match.
  function step(match, dt) {
    if (match.toastT > 0) match.toastT -= dt; if (match.toastT <= 0) match.toast = null;
    if (match.bannerT > 0) match.bannerT -= dt; if (match.bannerT <= 0) match.banner = null;

    switch (match.phase) {
      case 'INTRO':
        match.stateTimer -= dt;
        if (match.stateTimer <= 0) { window.Audio2.play('whistle'); setPhase(match, 'KICKOFF', 1.0); }
        break;

      case 'KICKOFF':
        window.Sim.stepKickoff(match, dt);
        break;

      case 'PLAY': {
        // advance clock
        match.halfClock += dt;
        window.Sim.step(match, dt);
        window.MatchAbilities.step(match, dt);
        // hydration trigger
        if (!match.hydrationTriggered[match.half] && match.halfClock >= hydrationAt(match)) {
          match.hydrationTriggered[match.half] = true;
          startHydration(match);
          break;
        }
        // end of half
        if (match.halfClock >= halfLength(match)) {
          match.halfClock = halfLength(match);
          endHalf(match);
        }
        break;
      }

      case 'HYDRATION':
        match.stateTimer -= dt; // real-time countdown
        window.Bus.emit('hydrationTick', Math.max(0, match.stateTimer));
        if (match.stateTimer <= 0) { window.Bus.emit('hydrationEnd', match); setPhase(match, 'PLAY'); }
        break;

      case 'HALFTIME':
        match.stateTimer -= dt;
        window.Bus.emit('halftimeTick', Math.max(0, match.stateTimer));
        if (match.stateTimer <= 0) startSecondHalf(match);
        break;

      case 'GOAL':
        match.stateTimer -= dt;
        window.Sim.stepBallOnly(match, dt); // let celebration animation breathe
        if (match.stateTimer <= 0) {
          resetKickoff(match, match.lastGoalTeam === 'home' ? 'away' : 'home'); // conceding team kicks off
          setPhase(match, 'KICKOFF', 1.0);
        }
        break;

      case 'FULLTIME':
        match.stateTimer -= dt;
        if (match.stateTimer <= 0) finishOrPenalties(match);
        break;

      case 'PENALTIES':
        window.Penalties.step(match, dt);
        break;

      default: break;
    }
  }

  function startHydration(match) {
    window.Audio2.play('whistle');
    setPhase(match, 'HYDRATION', CFG.match.hydrationLength);
    window.Bus.emit('hydrationStart', match);
  }

  function endHalf(match) {
    window.Audio2.play('whistle');
    if (match.half === 1) {
      showBanner(match, 'msg.halfTime', 1.5);
      setPhase(match, 'HALFTIME', CFG.match.halfTimeLength);
      window.Bus.emit('halftimeStart', match);
    } else {
      showBanner(match, 'msg.fullTime', 2);
      setPhase(match, 'FULLTIME', 2.2);
      window.Bus.emit('fulltimeStart', match);
    }
  }

  function skipHalftime(match) { if (match.phase === 'HALFTIME') startSecondHalf(match); }

  function startSecondHalf(match) {
    match.half = 2; match.halfClock = 0;
    resetKickoff(match, 'away'); // away kicks off the second half
    window.Bus.emit('halftimeEnd', match);
    setPhase(match, 'KICKOFF', 1.0);
    window.Audio2.play('whistle');
  }

  function finishOrPenalties(match) {
    if (match.home.score === match.away.score) {
      window.Penalties.begin(match);
      setPhase(match, 'PENALTIES');
    } else {
      finish(match);
    }
  }

  function finish(match) {
    match.finished = true;
    const userWon = match.home.score > match.away.score ||
      (match.penalties && match.penalties.home > match.penalties.away);
    match.result = {
      userWon,
      homeScore: match.home.score, awayScore: match.away.score,
      penalties: match.penalties || null,
    };
    setPhase(match, 'ENDED');
    window.Bus.emit('matchEnded', match);
  }

  // called by sim when a goal is scored
  function onGoal(match, scoringSide, scorer, assist) {
    match[scoringSide].score += 1;
    match.lastGoalTeam = scoringSide;
    if (scoringSide === 'home') {
      match.stats.goals += (scorer && scorer.isUser) ? 1 : 0;
      // assist credit if user assisted
      if (assist && assist.isUser) match.stats.assists += 1;
      if (scorer && scorer.isUser) window.Scoring.add(match, 'goal');
      else if (assist && assist.isUser) window.Scoring.add(match, 'assist');
    }
    window.Audio2.play('goal');
    showBanner(match, 'msg.goal', 2.2);
    window.Bus.emit('goal', { match, scoringSide });
    // Park the ball so it stops crossing the line during the celebration.
    match.ball.owner = null; match.ball.vx = match.ball.vy = match.ball.vz = 0;
    setPhase(match, 'GOAL', CFG.match.goalCelebration);
  }

  function pause(match) { if (match.phase === 'PLAY') { match._resumePhase = 'PLAY'; setPhase(match, 'PAUSED'); } }
  function resume(match) { if (match.phase === 'PAUSED') setPhase(match, 'PLAY'); }

  return { create, step, onGoal, skipHalftime, pause, resume, finish, halfLength, hydrationAt,
           showToast, showBanner, setPhase, resetKickoff, FORMATION };
})();

/* Performance scoring helper. */
window.Scoring = (function () {
  const S = window.CONFIG.scoring;
  function add(match, action) {
    const pts = S[action] || 0;
    match.stats.performance += pts;
    if (action === 'save' || action === 'superSave') match.stats.saves += 1;
    if (action === 'recovery' || action === 'interception') match.stats.recoveries += 1;
    if (action === 'shotOnTarget') match.stats.shotsOnTarget += 1;
    if (action === 'tackle') match.stats.tackles += 1;
    if (action === 'pass' || action === 'keyPass') match.stats.passesCompleted += 1;
  }
  return { add };
})();
