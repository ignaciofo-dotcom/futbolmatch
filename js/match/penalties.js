/* Penalty shootout mini-game (draws only). Keyboard: ←/↑/→ pick corner or dive, X to commit.
   User always takes the kicks and keeps in goal (arcade rule). */
window.Penalties = (function () {
  const K = window.CONFIG.penalties;

  function begin(match) {
    match.penalties = {
      home: 0, away: 0, homeKicks: 0, awayKicks: 0,
      turn: 'home', phase: 'SHOOT_SELECT', timer: 0,
      selDir: 1, power: 0, powerDir: 1, keeperDir: 1, shooterDir: 1,
      msg: 'penalties.yourTurn', result: null, done: false, ballAnim: 0,
    };
    window.Audio2.play('whistle');
  }

  function step(match, dt) {
    const P = match.penalties;
    if (P.done) return;

    switch (P.phase) {
      case 'SHOOT_SELECT': // user chooses corner
        P.msg = 'penalties.yourTurn';
        if (window.Input.pressed('left')) { P.selDir = 0; window.Audio2.play('select'); }
        if (window.Input.pressed('up')) { P.selDir = 1; window.Audio2.play('select'); }
        if (window.Input.pressed('right')) { P.selDir = 2; window.Audio2.play('select'); }
        if (window.Input.pressed('action2') || window.Input.pressed('confirm')) { P.phase = 'SHOOT_POWER'; P.power = 0; P.powerDir = 1; }
        break;

      case 'SHOOT_POWER':
        P.power += P.powerDir * K.powerSpeed * dt;
        if (P.power >= 1) { P.power = 1; P.powerDir = -1; }
        if (P.power <= 0) { P.power = 0; P.powerDir = 1; }
        if (window.Input.pressed('action2') || window.Input.pressed('confirm')) resolveShot(match);
        break;

      case 'SAVE_SELECT': // AI shoots, user dives
        P.msg = 'penalties.saveTurn';
        if (window.Input.pressed('left')) { P.selDir = 0; window.Audio2.play('select'); }
        if (window.Input.pressed('up')) { P.selDir = 1; window.Audio2.play('select'); }
        if (window.Input.pressed('right')) { P.selDir = 2; window.Audio2.play('select'); }
        if (window.Input.pressed('action2') || window.Input.pressed('confirm')) resolveSave(match);
        break;

      case 'RESULT':
        P.timer -= dt; P.ballAnim = Math.min(1, P.ballAnim + dt * 2.5);
        if (P.timer <= 0) advance(match);
        break;
    }
  }

  function resolveShot(match) {
    const P = match.penalties;
    P.keeperDir = Math.floor(Math.random() * 3);
    P.shooterDir = P.selDir;
    const badPower = P.power < 0.12 || P.power > 0.97;
    let outcome;
    if (badPower) outcome = 'miss';
    else if (P.keeperDir === P.selDir && Math.random() < 0.75) outcome = 'saved';
    else outcome = 'goal';
    if (outcome === 'goal') { P.home++; window.Audio2.play('goal'); }
    else window.Audio2.play('save');
    P.result = outcome; P.homeKicks++; P.phase = 'RESULT'; P.timer = 1.3; P.ballAnim = 0;
  }

  function resolveSave(match) {
    const P = match.penalties;
    P.shooterDir = Math.floor(Math.random() * 3);
    P.keeperDir = P.selDir;
    const aiMiss = Math.random() < 0.08;
    let outcome;
    if (aiMiss) outcome = 'miss';
    else if (P.selDir === P.shooterDir && Math.random() < 0.7) outcome = 'saved';
    else outcome = 'goal';
    if (outcome === 'goal') { P.away++; window.Audio2.play('goal'); }
    else window.Audio2.play('save');
    P.result = outcome; P.awayKicks++; P.phase = 'RESULT'; P.timer = 1.3; P.ballAnim = 0;
  }

  function advance(match) {
    const P = match.penalties;
    // decide if finished (both have taken equal kicks and >=5 and scores differ)
    if (P.homeKicks === P.awayKicks && P.homeKicks >= K.kicksPerTeam && P.home !== P.away) {
      P.done = true; window.MatchEngine.finish(match); return;
    }
    // early clinch within regulation 5: if a side can't be caught
    const remainingHome = Math.max(0, K.kicksPerTeam - P.homeKicks);
    const remainingAway = Math.max(0, K.kicksPerTeam - P.awayKicks);
    if (P.home > P.away + remainingAway || P.away > P.home + remainingHome) {
      // finish only on a completed pair to keep display tidy
      if (P.homeKicks === P.awayKicks && P.home !== P.away) { P.done = true; window.MatchEngine.finish(match); return; }
    }
    P.turn = P.turn === 'home' ? 'away' : 'home';
    P.phase = P.turn === 'home' ? 'SHOOT_SELECT' : 'SAVE_SELECT';
    P.selDir = 1; P.result = null;
  }

  return { begin, step };
})();
