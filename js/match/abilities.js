/* Ability circles: spawning, collection, inventory (max 5), activation (incl. conditional bicycle kick).
   Abilities belong to the user's controlled player. */
window.MatchAbilities = (function () {
  const CFG = window.CONFIG.ability, F = window.CONFIG.field;
  let toastCd = 0;

  function reset(match) {
    match.circles = []; match.inventory = []; match.activeEffects = {};
    match.abilitySpawnTimer = CFG.initialSpawnDelay;
    match._circleId = 0;
  }

  function step(match, dt) {
    if (!match.abilitySpawnTimer && match.abilitySpawnTimer !== 0) reset(match);
    if (toastCd > 0) toastCd -= dt;

    // decay active timed effects
    for (const id in match.activeEffects) {
      match.activeEffects[id] -= dt;
      if (match.activeEffects[id] <= 0) delete match.activeEffects[id];
    }

    // spawn
    match.abilitySpawnTimer -= dt;
    if (match.abilitySpawnTimer <= 0 && match.circles.length < CFG.maxActiveCircles) {
      trySpawn(match);
      match.abilitySpawnTimer = rand(CFG.respawnMin, CFG.respawnMax);
    }

    // lifetime + collection
    const u = match.userPlayer;
    for (let i = match.circles.length - 1; i >= 0; i--) {
      const c = match.circles[i];
      c.t -= dt;
      if (c.t <= 0) { match.circles.splice(i, 1); continue; }
      if (Math.hypot(u.x - c.x, u.y - c.y) <= CFG.collectRadius) {
        if (match.inventory.length < CFG.maxInventory) {
          match.inventory.push(c.abilityId);
          match.circles.splice(i, 1);
          window.Audio2.play('collect');
          window.Bus.emit('abilityCollected', { match, id: c.abilityId });
        } else if (toastCd <= 0) {
          window.MatchEngine.showToast(match, 'msg.inventoryFull', 1.2); toastCd = 1.4;
        }
      }
    }

    // activation via number keys
    for (let s = 1; s <= CFG.maxInventory; s++) {
      if (window.Input.pressed('slot' + s)) activateSlot(match, s - 1);
    }
  }

  function trySpawn(match) {
    const pos = match.userPlayer.position;
    const abilityId = pickAbility(pos);
    if (!abilityId) return;
    for (let attempt = 0; attempt < 20; attempt++) {
      const x = rand(14, F.length - 14);
      const y = rand(6, F.width - 6);
      if (inPenaltyArea(x)) continue;
      if (tooClose(match, x, y)) continue;
      const def = window.ABILITIES[abilityId];
      match.circles.push({ id: ++match._circleId, abilityId, x, y, t: CFG.lifetime, icon: def.icon, color: def.color });
      window.Bus.emit('abilitySpawned', { match, id: abilityId });
      return;
    }
  }

  function pickAbility(position) {
    let total = 0; const weights = [];
    for (const id of window.ABILITY_ORDER) {
      const w = window.ABILITIES[id].positionSpawnWeights[position] || 0;
      weights.push([id, w]); total += w;
    }
    if (total <= 0) return null;
    let r = Math.random() * total;
    for (const [id, w] of weights) { r -= w; if (r <= 0) return id; }
    return weights[0][0];
  }

  function inPenaltyArea(x) { return x < F.penaltyAreaDepth || x > F.length - F.penaltyAreaDepth; }
  function tooClose(match, x, y) {
    for (const c of match.circles) if (Math.hypot(c.x - x, c.y - y) < CFG.minDistance) return true;
    for (const p of match.players) if (Math.hypot(p.x - x, p.y - y) < 3) return true;
    return false;
  }

  function activateSlot(match, idx) {
    const id = match.inventory[idx];
    if (!id) return;
    const def = window.ABILITIES[id];
    if (def.activationType === 'CONDITIONAL_SINGLE_USE') {
      if (id === 'ABILITY_BICYCLE_KICK') { tryBicycle(match, idx); return; }
    }
    if (def.activationType === 'TIMED') {
      match.activeEffects[id] = window.CONFIG.ability.durations[id] || def.durationSeconds || 5;
      match.inventory.splice(idx, 1);
      window.Audio2.play('activate');
      window.Bus.emit('abilityActivated', { match, id });
    }
  }

  function tryBicycle(match, idx) {
    const u = match.userPlayer, ball = match.ball;
    const goalX = u.attackDir > 0 ? F.length : 0;
    const near = Math.hypot(goalX - u.x, window.Sim.GOAL_Y - u.y) <= CFG.bicycleKick.goalRadius;
    const aerial = ball.z >= CFG.bicycleKick.minBallHeight;
    const close = Math.hypot(u.x - ball.x, u.y - ball.y) <= CFG.bicycleKick.maxBallDist;
    if (near && aerial && close) {
      // perform spectacular shot from ball position
      const aimY = window.Sim.GOAL_Y + rand(-3, 3);
      const dx = goalX - ball.x, dy = aimY - ball.y, d = Math.hypot(dx, dy) || 1;
      const spd = window.CONFIG.ball.shotSpeed * CFG.bicycleKick.power;
      ball.owner = null; ball.vx = dx / d * spd; ball.vy = dy / d * spd; ball.vz = 6;
      ball.lastTouch = u; ball.kickerCd = window.CONFIG.player.kickCooldown; u.kickCd = window.CONFIG.player.kickCooldown;
      u.bicycleT = 0.6;
      match.inventory.splice(idx, 1);
      window.Scoring.add(match, 'shotOnTarget');
      window.Audio2.play('bicycle');
      window.MatchEngine.showBanner(match, 'msg.bicycle', 1.8);
      window.Bus.emit('bicycleKick', { match });
    } else {
      window.MatchEngine.showToast(match, 'msg.bicycleHint', 2);
      window.Audio2.play('error');
    }
  }

  // ---- effect queries used by sim ----
  function effectActive(match, id) { return (match.activeEffects[id] || 0) > 0; }
  function ownerShielded(match, owner) {
    return owner.isUser && (effectActive(match, 'ABILITY_SHIELD') || effectActive(match, 'ABILITY_DRIBBLE'));
  }
  function consumeShotBoost() { return 1; }      // post-MVP super shot hook
  function consumePerfectPass() { return false; } // post-MVP perfect pass hook

  function rand(a, b) { return a + Math.random() * (b - a); }

  return { reset, step, effectActive, ownerShielded, consumeShotBoost, consumePerfectPass, activateSlot };
})();
