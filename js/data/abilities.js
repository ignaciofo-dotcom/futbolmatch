/* Ability definitions. positionSpawnWeights: 0 = never, higher = more common (single source of truth). */
window.ABILITIES = {
  ABILITY_SPEED: {
    id: 'ABILITY_SPEED', icon: '⚡', color: '#38bdf8', category: 'MOBILITY',
    activationType: 'TIMED', durationSeconds: 5, maximumStack: 1,
    positionSpawnWeights: { GOALKEEPER: 10, DEFENDER: 10, MIDFIELDER: 10, FORWARD: 10 },
  },
  ABILITY_DRIBBLE: {
    id: 'ABILITY_DRIBBLE', icon: '👟', color: '#34d399', category: 'OFFENSIVE',
    activationType: 'TIMED', durationSeconds: 5, maximumStack: 1,
    positionSpawnWeights: { GOALKEEPER: 3, DEFENDER: 10, MIDFIELDER: 10, FORWARD: 10 },
  },
  ABILITY_TACKLE: {
    id: 'ABILITY_TACKLE', icon: '🛡️', color: '#f59e0b', category: 'DEFENSIVE',
    activationType: 'TIMED', durationSeconds: 5, maximumStack: 1,
    positionSpawnWeights: { GOALKEEPER: 3, DEFENDER: 10, MIDFIELDER: 10, FORWARD: 3 },
  },
  ABILITY_SUPER_SAVE: {
    id: 'ABILITY_SUPER_SAVE', icon: '🧤', color: '#a855f7', category: 'GOALKEEPING',
    activationType: 'TIMED', durationSeconds: 5, maximumStack: 1,
    positionSpawnWeights: { GOALKEEPER: 12, DEFENDER: 0, MIDFIELDER: 0, FORWARD: 0 },
  },
  ABILITY_BICYCLE_KICK: {
    id: 'ABILITY_BICYCLE_KICK', icon: '🔴', color: '#ef4444', category: 'OFFENSIVE',
    activationType: 'CONDITIONAL_SINGLE_USE', durationSeconds: 0, maximumStack: 1,
    positionSpawnWeights: { GOALKEEPER: 0, DEFENDER: 2, MIDFIELDER: 5, FORWARD: 6 },
  },
};

window.ABILITY_ORDER = ['ABILITY_SPEED', 'ABILITY_DRIBBLE', 'ABILITY_TACKLE', 'ABILITY_SUPER_SAVE', 'ABILITY_BICYCLE_KICK'];
