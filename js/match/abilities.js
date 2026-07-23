/* Ability pickups: spawning, collection, inventory (max 3), and execution of the SELECTED ability
   (Super Shot 🔥, Rabona 🌀, Bicicleta 🚲). Field pickups are drawn as bare icons by the renderer. */
window.MatchAbilities = (function () {
  const CFG = window.CONFIG.ability, F = window.CONFIG.field;
  let toastCd = 0;

  function reset(match) {
    match.circles = []; match.inventory = []; match.activeEffects = {}; match.selectedAbility = 0;
    match.abilitySpawnTimer = CFG.initialSpawnDelay; match._circleId = 0;
  }

  function step(match, dt) {
    if (!match.abilitySpawnTimer && match.abilitySpawnTimer !== 0) reset(match);
    if (toastCd > 0) toastCd -= dt;

    match.abilitySpawnTimer -= dt;
    if (match.abilitySpawnTimer <= 0 && match.circles.length < CFG.maxActiveCircles) {
      trySpawn(match); match.abilitySpawnTimer = rand(CFG.respawnMin, CFG.respawnMax);
    }

    const u = match.userPlayer;
    for (let i = match.circles.length - 1; i >= 0; i--) {
      const c = match.circles[i]; c.t -= dt;
      if (c.t <= 0) { match.circles.splice(i, 1); continue; }
      if (Math.hypot(u.x - c.x, u.y - c.y) <= CFG.collectRadius) {
        if (match.inventory.length < CFG.maxInventory) {
          match.inventory.push(c.abilityId); match.selectedAbility = match.inventory.length - 1;
          match.circles.splice(i, 1); window.Audio2.play('collect');
          window.Bus.emit('abilityCollected', { match, id: c.abilityId });
        } else if (toastCd <= 0) { window.MatchEngine.showToast(match, 'msg.inventoryFull', 1.2); toastCd = 1.4; }
      }
    }
    if (match.selectedAbility >= match.inventory.length) match.selectedAbility = Math.max(0, match.inventory.length - 1);

    // number keys select + use a slot; the Ability button/'C' uses the selected one
    for (let s = 1; s <= CFG.maxInventory; s++) if (window.Input.pressed('slot' + s)) { match.selectedAbility = s - 1; use(match, s - 1); }
    if (window.Input.pressed('ability')) use(match, match.selectedAbility);
  }

  function trySpawn(match) {
    const abilityId = pickAbility(match.userPlayer.position);
    if (!abilityId) return;
    for (let attempt = 0; attempt < 20; attempt++) {
      const x = rand(14, F.length - 14), y = rand(6, F.width - 6);
      if (inPenaltyArea(x) || tooClose(match, x, y)) continue;
      const def = window.ABILITIES[abilityId];
      match.circles.push({ id: ++match._circleId, abilityId, x, y, t: CFG.lifetime, icon: def.icon, color: def.color });
      window.Bus.emit('abilitySpawned', { match, id: abilityId });
      return;
    }
  }
  function pickAbility(position) {
    let total = 0; const weights = [];
    for (const id of window.ABILITY_ORDER) { const w = window.ABILITIES[id].positionSpawnWeights[position] || 0; weights.push([id, w]); total += w; }
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

  // ---- execution ----
  function use(match, idx) {
    const id = match.inventory[idx]; if (!id) return;
    if (id === 'ABILITY_BICYCLE_KICK') { tryBicycle(match, idx); return; }
    if (id === 'ABILITY_SUPER_SHOT') {
      if (userShoot(match, { power: 1.95, fire: true, spread: 1.3, vz: 2.5 })) { consume(match, idx); window.Audio2.play('bicycle'); window.MatchEngine.showBanner(match, 'msg.superShot', 1.4); }
      return;
    }
    if (id === 'ABILITY_RABONA') {
      if (userShoot(match, { power: 1.5, curve: (Math.random() < 0.5 ? 1 : -1) * 3.5, spread: 2, vz: 2 })) { consume(match, idx); window.Audio2.play('bicycle'); window.MatchEngine.showBanner(match, 'msg.rabona', 1.4); }
      return;
    }
  }
  function consume(match, idx) {
    match.inventory.splice(idx, 1);
    if (match.selectedAbility >= match.inventory.length) match.selectedAbility = Math.max(0, match.inventory.length - 1);
  }

  function userShoot(match, opts) {
    const u = match.userPlayer, ball = match.ball;
    if (ball.owner !== u) { if (toastCd <= 0) { window.MatchEngine.showToast(match, 'msg.needBall', 1.4); toastCd = 1.4; } window.Audio2.play('error'); return false; }
    const goalX = u.attackDir > 0 ? F.length : 0;
    const aimY = window.Sim.GOAL_Y + Math.sin(u.facing) * (opts.spread * 3) + rand(-opts.spread, opts.spread);
    const dx = goalX - u.x, dy = aimY - u.y, d = Math.hypot(dx, dy) || 1;
    const spd = window.CONFIG.ball.shotSpeed * (opts.power || 1.5);
    ball.owner = null; ball.vx = dx / d * spd; ball.vy = dy / d * spd; ball.vz = opts.vz || 2;
    if (opts.curve) ball.curve = opts.curve; if (opts.fire) ball.fire = 0.8;
    ball.lastTouch = u; ball.lastPasser = null; ball.kickerCd = window.CONFIG.player.kickCooldown; u.kickCd = window.CONFIG.player.kickCooldown;
    window.Scoring.add(match, 'shotOnTarget'); window.Bus.emit('shot', { match, from: u });
    return true;
  }

  function tryBicycle(match, idx) {
    const u = match.userPlayer, ball = match.ball;
    const goalX = u.attackDir > 0 ? F.length : 0;
    const near = Math.hypot(goalX - u.x, window.Sim.GOAL_Y - u.y) <= CFG.bicycleKick.goalRadius;
    const aerial = ball.z >= CFG.bicycleKick.minBallHeight;
    const close = Math.hypot(u.x - ball.x, u.y - ball.y) <= CFG.bicycleKick.maxBallDist;
    if (near && aerial && close) {
      const aimY = window.Sim.GOAL_Y + rand(-3, 3);
      const dx = goalX - ball.x, dy = aimY - ball.y, d = Math.hypot(dx, dy) || 1;
      const spd = window.CONFIG.ball.shotSpeed * CFG.bicycleKick.power;
      ball.owner = null; ball.vx = dx / d * spd; ball.vy = dy / d * spd; ball.vz = 4;
      ball.lastTouch = u; ball.lastPasser = null; ball.kickerCd = window.CONFIG.player.kickCooldown; u.kickCd = window.CONFIG.player.kickCooldown;
      u.bicycleT = 0.6; consume(match, idx);
      window.Scoring.add(match, 'shotOnTarget'); window.Audio2.play('bicycle');
      window.MatchEngine.showBanner(match, 'msg.bicycle', 1.6); window.Bus.emit('bicycleKick', { match });
    } else {
      window.MatchEngine.showToast(match, 'msg.bicycleHint', 2); window.Audio2.play('error');
    }
  }

  // Legacy effect queries used by sim — no timed effects exist in the current ability set.
  function effectActive() { return false; }
  function ownerShielded() { return false; }
  function consumeShotBoost() { return 1; }
  function consumePerfectPass() { return false; }
  function rand(a, b) { return a + Math.random() * (b - a); }

  return { reset, step, use, effectActive, ownerShielded, consumeShotBoost, consumePerfectPass };
})();
