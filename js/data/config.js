/* Global configuration — all balancing/timing values live here (no hard-coded gameplay numbers elsewhere). */
window.CONFIG = {
  saveVersion: 1,
  saveKey: 'caminoCopa.save.v1',
  defaultLanguage: 'es',

  // Logical pitch (metres). Simulation runs in these coords; renderer projects to 2.5D.
  field: {
    length: 105,   // x axis: own goal (x=0, near camera) -> opponent goal (x=105, far)
    width: 68,     // y axis
    goalWidth: 12, // a bit wider than real for arcade scoring
    goalDepth: 3,
    penaltyAreaDepth: 16,
    penaltyAreaWidth: 40,
    centreCircle: 9.15,
  },

  // Match timing. Total playable minutes is a user input (1–10); halves/breaks derive from it.
  match: {
    defaultMinutes: 6,        // default total playable minutes (user can pick 1–10)
    minMinutes: 1, maxMinutes: 10,
    hydrationLength: 10,      // 10 s real time (was 60)
    halfTimeLength: 8,        // seconds, skippable
    introLength: 2.5,
    goalCelebration: 2.2,
    playersPerSide: 5,        // 1 GK + 4 outfield (arcade 5-a-side)
  },

  // User-selectable difficulty (scales opponent skill + hidden assistance).
  difficulties: {
    EASY:   { oppSkill: 0.60, assist: 0.30 },
    NORMAL: { oppSkill: 0.75, assist: 0.10 },
    HARD:   { oppSkill: 0.92, assist: 0.0  },
  },

  // Player physics (metres/second etc.)
  player: {
    baseSpeed: 8.5,
    sprintMultiplier: 1.45,
    accel: 45,
    controlRadius: 1.8,       // gain possession within this distance of a free ball
    kickCooldown: 0.35,
    tackleRange: 2.6,
    tackleCooldown: 0.55,
    staminaMax: 100,
    staminaSprintDrain: 12,   // per second sprinting
    staminaRegen: 6,          // per second not sprinting
    lowStaminaSpeedFactor: 0.7,
  },

  ball: {
    friction: 0.62,           // velocity retained factor per second (ground)
    gravity: 22,              // for aerial balls (z)
    bounce: 0.45,
    passSpeed: 22,
    shotSpeed: 34,
    maxShotCharge: 1.6,       // seconds to full charge
    radius: 0.4,
    loftRise: 11,             // upward velocity of a lofted/chip kick (sets up the bicycle kick)
    loftForward: 2.8,         // small forward velocity so the ball drops back near the kicker
  },

  ability: {
    maxInventory: 3,
    maxActiveCircles: 3,
    initialSpawnDelay: 6,     // shorter than design (20s) so MVP matches surface abilities quickly
    respawnMin: 8,
    respawnMax: 16,
    lifetime: 20,
    minDistance: 12,
    collectRadius: 2.2,
    bicycleKick: {
      goalRadius: 30,         // must be within this distance of opponent goal
      minBallHeight: 1.4,     // ball must be airborne above this
      maxBallDist: 4.0,       // player must be near the ball
      power: 1.9,             // shot power multiplier
    },
    durations: { // seconds; single-use abilities are 0
      ABILITY_SPEED: 5, ABILITY_DRIBBLE: 5, ABILITY_TACKLE: 5,
      ABILITY_SUPER_SAVE: 5, ABILITY_SHIELD: 5, ABILITY_STAMINA: 5,
    },
    speedBoost: 1.4,
  },

  ai: {
    baseSpeedFactor: 0.9,       // AI outfield speed vs user base (scaled by difficulty)
    reactionBase: 0.25,         // seconds delay in decisions (reduced by difficulty)
    shootRange: 26,             // distance from goal AI will attempt a shot
    passRange: 30,
    gkSpeed: 7,
    gkHoldTime: 1.4,            // seconds an AI keeper holds the ball before releasing it
    supportSpread: 10,
  },

  scoring: {
    goal: 100, assist: 50, pass: 5, keyPass: 15, recovery: 10,
    tackle: 15, interception: 10, save: 20, superSave: 40,
    dribble: 10, shotOnTarget: 10, victory: 200, cleanSheet: 75, ownGoal: -50,
  },

  progression: {
    baseMatchXP: 100,
    victoryBonus: 100,
    perfFactor: 0.20,
    roundBonus: 25,
    finalVictoryBonus: 500,
    xpPerLevel: 100,        // level n->n+1 needs 100*n
    attrPointsPerLevel: 2,
    attrMax: 100,
  },

  tournament: {
    mvpRounds: ['QUARTER_FINAL', 'SEMI_FINAL', 'FINAL'],
    difficultyBase: 1,
    difficultyLogFactor: 0.20,
    opponentPoolSize: 4,
  },

  penalties: {
    kicksPerTeam: 5,
    powerSpeed: 1.8,   // gauge cycles per second
  },

  // Attribute -> gameplay influence is gentle (never gating).
  attrInfluence: {
    speed: 0.0035,       // per point above 50 added to speed multiplier
    shooting: 0.004,
    passing: 0.004,
    dribbling: 0.004,
    tackling: 0.004,
    reflexes: 0.004,
    goalkeeping: 0.004,
  },
};
