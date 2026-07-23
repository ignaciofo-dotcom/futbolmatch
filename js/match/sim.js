/* Simulation: player movement, keyboard control, AI, ball physics, goals, GK saves.
   All in flat field coordinates; the renderer projects to 2.5D. */
window.Sim = (function () {
  const CFG = window.CONFIG, F = CFG.field, P = CFG.player, B = CFG.ball;
  const GOAL_HALF = F.goalWidth / 2;
  const GOAL_Y = F.width / 2;

  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const rand = (a, b) => a + Math.random() * (b - a);

  function speedFactor(attrs) { return 1 + (attrs.speed - 50) * CFG.attrInfluence.speed; }
  function inMouth(y) { return y > GOAL_Y - GOAL_HALF && y < GOAL_Y + GOAL_HALF; }

  function teammates(match, p) { return (p.team === 'home' ? match.homePlayers : match.awayPlayers); }
  function opponents(match, p) { return (p.team === 'home' ? match.awayPlayers : match.homePlayers); }

  function nearest(list, x, y, filter) {
    let best = null, bd = Infinity;
    for (const p of list) { if (filter && !filter(p)) continue; const d = Math.hypot(p.x - x, p.y - y); if (d < bd) { bd = d; best = p; } }
    return { player: best, d: bd };
  }

  function step(match, dt) {
    match.ball.kickerCd = Math.max(0, match.ball.kickerCd - dt);
    if (match.passSwitchT > 0) { match.passSwitchT -= dt; if (match.passSwitchT <= 0) match.passSwitchActive = false; }
    for (const p of match.players) { p.kickCd = Math.max(0, p.kickCd - dt); p.tackleCd = Math.max(0, p.tackleCd - dt); if (p.lungeT > 0) p.lungeT -= dt; if (p.diveT > 0) p.diveT -= dt; }

    // decide + move players
    for (const p of match.players) {
      if (p.isUser) updateUser(match, p, dt);
      else updateAI(match, p, dt);
      integratePlayer(p, dt);
    }
    handlePossession(match, dt);
    updateBall(match, dt);
  }

  function stepBallOnly(match, dt) { updateBall(match, dt); }

  // ---------------- user control ----------------
  function updateUser(match, p, dt) {
    const hasBall = match.ball.owner === p;

    // Manual player switch when off the ball: take control of the outfield teammate
    // nearest the ball (e.g. to defend when the opponent has possession).
    if (!hasBall && window.Input.pressed('switchPlayer')) { switchToBall(match); return; }

    const mv = window.Input.moveVector();
    const sprinting = window.Input.isDown('sprint') && p.stamina > 1;
    let sp = P.baseSpeed * speedFactor(p.attrs);
    if (window.MatchAbilities.effectActive(match, 'ABILITY_SPEED')) sp *= CFG.ability.speedBoost;
    if (sprinting) sp *= P.sprintMultiplier;
    if (p.stamina < 20) sp *= P.lowStaminaSpeedFactor;

    p.desx = mv.x * sp; p.desy = mv.y * sp;
    if (mv.x || mv.y) p.facing = Math.atan2(mv.y, mv.x);

    // stamina
    if (sprinting && (mv.x || mv.y) && !window.MatchAbilities.effectActive(match, 'ABILITY_STAMINA'))
      p.stamina = clamp(p.stamina - P.staminaSprintDrain * dt, 0, P.staminaMax);
    else p.stamina = clamp(p.stamina + P.staminaRegen * dt, 0, P.staminaMax);

    // shooting via charge (hold X with ball); tackle via tap X without ball
    if (hasBall) {
      if (window.Input.isDown('action2')) { match.chargingShot = true; match.shotCharge = Math.min(B.maxShotCharge, (match.shotCharge || 0) + dt); }
      else if (match.chargingShot) { match.chargingShot = false; doShot(match, p, match.shotCharge / B.maxShotCharge); match.shotCharge = 0; }
      if (window.Input.pressed('action1')) doPass(match, p);
    } else {
      match.chargingShot = false; match.shotCharge = 0;
      if (window.Input.pressed('action2')) doTackle(match, p);
    }
  }

  // ---------------- player switching ----------------
  function switchControl(match, target) {
    if (!target || target.team !== 'home' || target === match.userPlayer) return;
    if (match.userPlayer) match.userPlayer.isUser = false;
    target.isUser = true;
    match.userPlayer = target;
    match.chargingShot = false; match.shotCharge = 0;
    window.Audio2.play('select');
    window.Bus.emit('switchPlayer', { match, to: target });
  }

  // Take control of the home player nearest the ball (INCLUDING the goalkeeper, so the user can
  // grab the keeper when the opponent attacks); repeated presses cycle by proximity.
  function switchToBall(match) {
    const ball = match.ball;
    const cands = match.homePlayers.slice();
    if (!cands.length) return;
    cands.sort((a, b) => Math.hypot(a.x - ball.x, a.y - ball.y) - Math.hypot(b.x - ball.x, b.y - ball.y));
    const idx = cands.indexOf(match.userPlayer);
    switchControl(match, cands[(idx + 1) % cands.length]);
  }

  // Kickoff: the kicker holds the ball at centre; the user aims with the stick and kicks with
  // Pase (low) or Tiro (higher). The AI aims at a teammate. A mis-hit just puts the ball in play.
  function stepKickoff(match, dt) {
    const k = match.kickoffKicker, ball = match.ball;
    if (!k) { window.MatchEngine.setPhase(match, 'PLAY'); return; }
    ball.owner = k;
    ball.x = clamp(k.x + Math.cos(match.kickoffAim) * 1.2, 1, F.length - 1);
    ball.y = clamp(k.y + Math.sin(match.kickoffAim) * 1.2, 1, F.width - 1);
    ball.z = 0; ball.vx = ball.vy = ball.vz = 0;
    if (match.kickingSide === 'home') {
      const mv = window.Input.moveVector();
      if (mv.x || mv.y) match.kickoffAim = Math.atan2(mv.y, mv.x);
      const p1 = window.Input.pressed('action1'), p2 = window.Input.pressed('action2');
      if (p1 || p2) kickoffKick(match, p2 ? 'shot' : 'pass');
    } else {
      match.stateTimer -= dt;
      if (match.stateTimer <= 0) {
        const mates = teammates(match, k).filter(m => m !== k && !m.isGK);
        const tgt = mates.length ? mates[Math.floor(Math.random() * mates.length)] : null;
        if (tgt) match.kickoffAim = Math.atan2(tgt.y - k.y, tgt.x - k.x);
        kickoffKick(match, 'pass');
      }
    }
  }
  function kickoffKick(match, type) {
    const k = match.kickoffKicker, ball = match.ball, a = match.kickoffAim;
    const spd = type === 'shot' ? B.shotSpeed * 0.85 : B.passSpeed;
    ball.owner = null; ball.vx = Math.cos(a) * spd; ball.vy = Math.sin(a) * spd; ball.vz = type === 'shot' ? 3 : 0;
    ball.lastTouch = k; ball.lastPasser = k; ball.kickerCd = CFG.player.kickCooldown; k.kickCd = CFG.player.kickCooldown;
    window.Audio2.play(type === 'shot' ? 'shot' : 'pass');
    match.kickoffKicker = null;
    window.MatchEngine.showBanner(match, 'msg.kickoff', 0.9);
    window.MatchEngine.setPhase(match, 'PLAY');
  }

  // ---------------- AI ----------------
  function updateAI(match, p, dt) {
    const ball = match.ball;
    const ownerTeam = ball.owner ? ball.owner.team : null;
    const teamHasBall = ownerTeam === p.team;
    const oppHasBall = ownerTeam && ownerTeam !== p.team;
    const goalX = p.attackDir > 0 ? F.length : 0;
    let sp = P.baseSpeed * speedFactor(p.attrs) * CFG.ai.baseSpeedFactor * (0.9 + p.skill * 0.2);

    if (p.isGK) { updateGK(match, p, dt, sp); return; }

    let tx = p.homeX, ty = p.homeY;

    if (ball.owner === p) {
      // I have the ball
      const dGoal = Math.hypot(goalX - p.x, GOAL_Y - p.y);
      const presser = nearest(opponents(match, p), p.x, p.y, o => !o.isGK);
      const pressured = presser.player && presser.d < 3.2;
      if (p.kickCd <= 0 && dGoal < CFG.ai.shootRange && Math.random() < 0.03 + p.skill * 0.05) {
        aiShoot(match, p, goalX);
        return;
      }
      if (pressured && p.kickCd <= 0) {
        const mate = bestPassTarget(match, p);
        if (mate && Math.random() < 0.5 + p.skill * 0.4) { passTo(match, p, mate); return; }
      }
      // dribble toward goal
      tx = goalX; ty = GOAL_Y + (p.y - GOAL_Y) * 0.3;
      steer(p, tx, ty, sp * 0.92, dt);
      p.facing = Math.atan2(ty - p.y, tx - p.x);
      return;
    } else if (teamHasBall) {
      // support: push up the pitch, spread around ball
      tx = p.homeX + p.attackDir * 18;
      ty = p.homeY + (ball.y - p.homeY) * 0.25;
    } else if (oppHasBall) {
      const closest = nearest(teammates(match, p), ball.x, ball.y, t => !t.isGK);
      if (closest.player === p) { tx = ball.x; ty = ball.y; // chase & tackle
        if (dist(p, ball) < P.tackleRange && p.tackleCd <= 0) aiTackle(match, p);
      } else { tx = p.homeX - p.attackDir * 4; ty = p.homeY + (ball.y - p.homeY) * 0.35; }
    } else {
      // free ball
      const closest = nearest(teammates(match, p), ball.x, ball.y, t => !t.isGK);
      if (closest.player === p) { tx = ball.x; ty = ball.y; }
      else { tx = p.homeX; ty = p.homeY + (ball.y - p.homeY) * 0.2; }
    }
    tx = clamp(tx, 2, F.length - 2); ty = clamp(ty, 2, F.width - 2);
    steer(p, tx, ty, sp, dt);
  }

  function updateGK(match, p, dt, sp) {
    const ball = match.ball;
    const lineX = p.attackDir > 0 ? 3.5 : F.length - 3.5;
    const ty = clamp(ball.y, GOAL_Y - GOAL_HALF - 1, GOAL_Y + GOAL_HALF + 1);
    // come off line slightly if ball close
    const ballOnMySide = (p.attackDir > 0) ? ball.x < 25 : ball.x > F.length - 25;
    const tx = ballOnMySide ? lineX + p.attackDir * clamp((25 - Math.abs(ball.x - lineX)) * 0.15, 0, 4) : lineX;
    steer(p, tx, ty, CFG.ai.gkSpeed, dt);
    p.facing = p.attackDir > 0 ? 0 : Math.PI;
  }

  function steer(p, tx, ty, sp, dt) {
    const dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy);
    if (d < 0.2) { p.desx = 0; p.desy = 0; return; }
    p.desx = dx / d * sp; p.desy = dy / d * sp;
    if (sp > 0.5) p.facing = Math.atan2(dy, dx);
  }

  function integratePlayer(p, dt) {
    const ax = ((p.desx || 0) - p.vx), ay = ((p.desy || 0) - p.vy);
    const k = Math.min(1, P.accel * dt / Math.max(1, Math.hypot(ax, ay) || 1));
    p.vx += ax * k; p.vy += ay * k;
    p.x = clamp(p.x + p.vx * dt, 0.5, F.length - 0.5);
    p.y = clamp(p.y + p.vy * dt, 0.5, F.width - 0.5);
    p.animPhase = (p.animPhase || 0) + Math.hypot(p.vx, p.vy) * dt * 0.35; // run-cycle for the leg/arm animation
  }

  // ---------------- possession & actions ----------------
  function handlePossession(match, dt) {
    const ball = match.ball;
    if (ball.owner) {
      const o = ball.owner;
      // glue ball just ahead of owner (dribble)
      const ox = Math.cos(o.facing), oy = Math.sin(o.facing);
      ball.x = o.x + ox * 1.1; ball.y = o.y + oy * 1.1; ball.z = 0;
      ball.vx = o.vx; ball.vy = o.vy; ball.vz = 0;
      // shield / dribble reduce steal chance handled in tackle
      return;
    }
    // Goalkeepers actively stop shots that reach them (fixes the ball passing through the keeper).
    for (const gk of [match.homePlayers.find(p => p.isGK), match.awayPlayers.find(p => p.isGK)]) {
      if (!gk) continue;
      if (ball.kickerCd > 0 && ball.lastTouch === gk) continue;
      if (ball.z > 2.6) continue; // sailing over the keeper
      const dgk = Math.hypot(gk.x - ball.x, gk.y - ball.y);
      const towardGoal = gk.attackDir > 0 ? ball.vx < -0.5 : ball.vx > 0.5;
      let reach = CFG.player.controlRadius + 1.5 + (gk.attrs.reflexes - 50) * 0.02;
      if (window.MatchAbilities.effectActive(match, 'ABILITY_SUPER_SAVE') && gk.isUser) reach += 2.2;
      if (dgk < reach && (towardGoal || Math.hypot(ball.vx, ball.vy) < 6)) {
        ball.owner = gk; gk.diveT = 0.4; gk.diveDir = Math.sign(ball.y - gk.y) || 1;
        ball.x = gk.x; ball.y = gk.y; ball.z = 0; ball.vx = ball.vy = ball.vz = 0;
        ball.lastTouch = gk; ball.lastPasser = null;
        window.Audio2.play('save');
        if (gk.isUser && towardGoal) window.Scoring.add(match, 'save');
        window.Bus.emit('save', { match, gk });
        return;
      }
    }
    if (ball.z > 0.6) return; // can't collect a high ball on the ground
    // free ground ball: nearest eligible player collects
    const ballSpeed = Math.hypot(ball.vx, ball.vy);
    let best = null, bd = CFG.player.controlRadius;
    for (const p of match.players) {
      if (p.kickCd > 0) continue;
      if (ball.kickerCd > 0 && p === ball.lastTouch) continue;
      // keepers don't vacuum a fast shot in open play — let it reach the goal line where
      // the dedicated save logic (resolveGoalAttempt) decides save vs goal.
      if (p.isGK && ballSpeed > 16) continue;
      const d = Math.hypot(p.x - ball.x, p.y - ball.y);
      if (d < bd) { bd = d; best = p; }
    }
    if (best) {
      const prevTeam = ball.lastTouch ? ball.lastTouch.team : null;
      ball.owner = best; best.kickCd = 0.05;
      // after a user pass, take control of whoever actually receives the ball
      if (match.passSwitchActive) { if (best.team === 'home') switchControl(match, best); match.passSwitchActive = false; }
      if (prevTeam && prevTeam !== best.team) {
        // recovery/interception
        if (best.isUser) window.Scoring.add(match, ball.z > 0.1 ? 'interception' : 'recovery');
        ball.lastPasser = null;
      }
      ball.lastTouch = best;
      window.Bus.emit('possession', { match, player: best });
    }
  }

  function doPass(match, p) {
    const mate = bestPassTarget(match, p);
    if (!mate) return;
    const wasUser = p.isUser;
    passTo(match, p, mate);
    if (wasUser) {
      window.Scoring.add(match, 'pass');
      switchControl(match, mate);                 // follow the pass to the intended target...
      match.passSwitchActive = true; match.passSwitchT = 3; // ...then re-attach to whoever actually receives it
    }
  }

  function passTo(match, p, mate) {
    const ball = match.ball;
    const dx = mate.x - p.x, dy = mate.y - p.y, d = Math.hypot(dx, dy) || 1;
    const acc = window.MatchAbilities.consumePerfectPass ? window.MatchAbilities.consumePerfectPass(match) : false;
    const spread = acc ? 0 : (1 - p.skill) * 0.12;
    const ux = dx / d + rand(-spread, spread), uy = dy / d + rand(-spread, spread);
    const un = Math.hypot(ux, uy) || 1;
    ball.owner = null; ball.kickerCd = CFG.player.kickCooldown; p.kickCd = CFG.player.kickCooldown;
    ball.vx = ux / un * B.passSpeed; ball.vy = uy / un * B.passSpeed; ball.vz = 0;
    ball.lastTouch = p; ball.lastPasser = p;
    window.Audio2.play('pass');
    window.Bus.emit('pass', { match, from: p });
  }

  function bestPassTarget(match, p) {
    const mates = teammates(match, p).filter(m => m !== p && !m.isGK);
    let best = null, bs = -Infinity;
    for (const m of mates) {
      const ahead = (m.x - p.x) * p.attackDir; // positive = forward
      const d = dist(p, m);
      if (d < 3 || d > CFG.ai.passRange) continue;
      const opp = nearest(opponents(match, p), m.x, m.y, o => !o.isGK);
      const open = opp.player ? Math.min(opp.d, 8) : 8;
      const score = ahead * 1.5 + open * 1.2 - d * 0.15;
      if (score > bs) { bs = score; best = m; }
    }
    return best || (mates.length ? mates[0] : null);
  }

  function doShot(match, p, charge) {
    const goalX = p.attackDir > 0 ? F.length : 0;
    const power = (0.55 + 0.45 * charge);
    const boost = window.MatchAbilities.consumeShotBoost ? window.MatchAbilities.consumeShotBoost(match) : 1;
    // Aim follows the player's heading: hold a diagonal to place the ball toward a corner.
    const lateral = Math.sin(p.facing) * GOAL_HALF * 1.5;
    const aimY = clamp(GOAL_Y + lateral, GOAL_Y - GOAL_HALF + 0.5, GOAL_Y + GOAL_HALF - 0.5);
    shoot(match, p, goalX, aimY, power * boost, p.attrs.shooting, p.isUser);
  }

  function aiShoot(match, p, goalX) {
    shoot(match, p, goalX, GOAL_Y, 0.8, p.attrs.shooting, false, p.skill);
  }

  function shoot(match, p, goalX, goalY, power, shootingAttr, isUser, skill) {
    const ball = match.ball;
    const accBonus = (shootingAttr - 50) * CFG.attrInfluence.shooting;
    const spreadBase = isUser ? 0.05 : (1 - (skill || 0.7)) * 0.22;
    const spread = Math.max(0, spreadBase - accBonus) * F.goalWidth;
    const aimY = clamp(goalY + rand(-spread, spread), GOAL_Y - GOAL_HALF - 3, GOAL_Y + GOAL_HALF + 3);
    const dx = goalX - p.x, dy = aimY - p.y, d = Math.hypot(dx, dy) || 1;
    ball.owner = null; ball.kickerCd = CFG.player.kickCooldown; p.kickCd = CFG.player.kickCooldown;
    const spd = B.shotSpeed * power;
    ball.vx = dx / d * spd; ball.vy = dy / d * spd;
    ball.vz = 3 + Math.random() * 2 + power * 3; // loft: gives aerial balls for the bicycle kick
    ball.lastTouch = p;
    window.Audio2.play('shot');
    if (isUser && inMouth(aimY)) window.Scoring.add(match, 'shotOnTarget');
    window.Bus.emit('shot', { match, from: p });
  }

  function doTackle(match, p) {
    p.lungeT = 0.25; p.tackleCd = P.tackleCooldown;
    const ball = match.ball;
    if (ball.owner && ball.owner.team !== p.team) {
      const d = dist(p, ball.owner);
      let range = P.tackleRange;
      if (window.MatchAbilities.effectActive(match, 'ABILITY_TACKLE')) range *= 1.4;
      if (d < range) {
        // shield protects the owner
        if (window.MatchAbilities.ownerShielded && window.MatchAbilities.ownerShielded(match, ball.owner)) { window.Audio2.play('error'); return; }
        const chance = 0.4 + (p.attrs.tackling - 50) * CFG.attrInfluence.tackling +
          (window.MatchAbilities.effectActive(match, 'ABILITY_TACKLE') ? 0.3 : 0);
        if (Math.random() < chance) {
          const victim = ball.owner;
          ball.owner = p; victim.kickCd = 0.4; p.kickCd = 0.1;
          ball.lastTouch = p; ball.lastPasser = null;
          window.Audio2.play('tackle');
          if (p.isUser) window.Scoring.add(match, 'tackle');
          window.Bus.emit('tackle', { match, by: p });
        }
      }
    }
  }

  function aiTackle(match, p) {
    p.lungeT = 0.2; p.tackleCd = P.tackleCooldown;
    const ball = match.ball;
    if (!ball.owner || ball.owner.team === p.team) return;
    if (window.MatchAbilities.ownerShielded && window.MatchAbilities.ownerShielded(match, ball.owner)) return;
    const chance = 0.35 + (p.attrs.tackling - 50) * CFG.attrInfluence.tackling + p.skill * 0.1;
    if (Math.random() < chance) {
      const victim = ball.owner;
      ball.owner = p; victim.kickCd = 0.4; p.kickCd = 0.1; ball.lastTouch = p; ball.lastPasser = null;
      window.Audio2.play('tackle');
      if (victim.isUser) window.Bus.emit('userDispossessed', { match });
    }
  }

  // ---------------- ball physics ----------------
  function updateBall(match, dt) {
    const ball = match.ball;
    if (ball.owner) return; // glued in handlePossession

    // height (z) physics
    if (ball.z > 0 || ball.vz !== 0) {
      ball.vz -= B.gravity * dt;
      ball.z += ball.vz * dt;
      if (ball.z <= 0) { ball.z = 0; if (Math.abs(ball.vz) > 1.5) { ball.vz = -ball.vz * B.bounce; } else ball.vz = 0; }
    }
    // ground friction (less effect while airborne)
    const fr = Math.pow(B.friction, dt);
    ball.vx *= fr; ball.vy *= fr;
    // lateral curve (rabona / bent shots)
    if (ball.curve) { ball.vy += ball.curve * dt * 22; ball.curve *= Math.pow(0.4, dt); if (Math.abs(ball.curve) < 0.15) ball.curve = 0; }

    const nx = ball.x + ball.vx * dt;
    const ny = ball.y + ball.vy * dt;

    // touchlines (y): reflect inward (arcade throw-in)
    if (ny < 0.3) { ball.y = 0.3; ball.vy = Math.abs(ball.vy) * 0.5; }
    else if (ny > F.width - 0.3) { ball.y = F.width - 0.3; ball.vy = -Math.abs(ball.vy) * 0.5; }
    else ball.y = ny;

    // end lines (x) — only score/restart during live play. Outside PLAY (e.g. the goal
    // celebration) freeze the ball at the line instead, so a single goal can never be
    // counted repeatedly frame-after-frame while the ball still sits past the line.
    if (nx <= 0) {
      if (match.phase === 'PLAY') {
        if (ball.z < 2.4 && inMouth(ball.y)) resolveGoalAttempt(match, 'home', 'away');
        else goalKick(match, 'home');
      } else { ball.x = 0.6; ball.vx = 0; ball.vy *= 0.4; }
      return;
    }
    if (nx >= F.length) {
      if (match.phase === 'PLAY') {
        if (ball.z < 2.4 && inMouth(ball.y)) resolveGoalAttempt(match, 'away', 'home');
        else goalKick(match, 'away');
      } else { ball.x = F.length - 0.6; ball.vx = 0; ball.vy *= 0.4; }
      return;
    }
    ball.x = nx;
  }

  // defendingSide concedes; attackingSide scores (maybe saved).
  function resolveGoalAttempt(match, defendingSide, attackingSide) {
    const ball = match.ball;
    const gk = (defendingSide === 'home' ? match.homePlayers : match.awayPlayers).find(p => p.isGK);
    const crossY = clamp(ball.y, GOAL_Y - GOAL_HALF, GOAL_Y + GOAL_HALF);
    // Reach is deliberately smaller than the goal half-width so accurate corner shots beat a
    // centred keeper, while point-blank central shots are still saved.
    let reach = 4.6 + (gk.attrs.reflexes - 50) * 0.045;
    let skill = 0.55 + (gk.attrs.reflexes - 50) * CFG.attrInfluence.reflexes;
    if (window.MatchAbilities.effectActive(match, 'ABILITY_SUPER_SAVE') && gk.isUser) { reach += 4; skill += 0.35; }
    if (!gk.isUser) skill *= (0.85 + (match.difficulty - 1) * 0.4); // opponent GK better at higher difficulty
    const d = Math.hypot(gk.x - ball.x, gk.y - crossY);
    const saveProb = clamp((reach - d) / reach, 0, 1) * clamp(skill, 0, 0.97);
    if (Math.random() < saveProb) {
      // SAVE
      ball.owner = gk; gk.diveT = 0.5; gk.diveDir = Math.sign(crossY - gk.y) || 1;
      ball.x = gk.x; ball.y = gk.y; ball.z = 0; ball.vx = ball.vy = ball.vz = 0;
      ball.lastTouch = gk; ball.lastPasser = null;
      const superS = window.MatchAbilities.effectActive(match, 'ABILITY_SUPER_SAVE') && gk.isUser;
      window.Audio2.play('save');
      if (gk.isUser) { window.Scoring.add(match, superS ? 'superSave' : 'save'); if (superS) window.MatchEngine.showBanner(match, 'msg.superSave', 1.6); }
      window.Bus.emit('save', { match, gk });
    } else {
      // GOAL
      const scorer = ball.lastTouch;
      let assist = ball.lastPasser;
      if (assist && (assist === scorer || assist.team !== attackingSide)) assist = null;
      window.MatchEngine.onGoal(match, attackingSide, scorer, assist);
    }
  }

  function goalKick(match, defendingSide) {
    const ball = match.ball;
    const gk = (defendingSide === 'home' ? match.homePlayers : match.awayPlayers).find(p => p.isGK);
    ball.owner = gk; ball.x = gk.x; ball.y = gk.y; ball.z = 0; ball.vx = ball.vy = ball.vz = 0;
    ball.lastTouch = gk; ball.lastPasser = null; gk.kickCd = 0.3;
  }

  return { step, stepBallOnly, stepKickoff, inMouth, nearest, teammates, opponents, dist, GOAL_Y, GOAL_HALF };
})();
