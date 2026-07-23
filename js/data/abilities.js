/* Ability definitions. positionSpawnWeights: 0 = never, higher = more common (single source of truth).
   All three are one-shot special shots executed with the Ability button (South / 'C'). */
window.ABILITIES = {
  ABILITY_SUPER_SHOT: {
    id: 'ABILITY_SUPER_SHOT', icon: '🔥', color: '#f97316', category: 'OFFENSIVE',
    activationType: 'INSTANT_SHOT', maximumStack: 1,
    positionSpawnWeights: { GOALKEEPER: 2, DEFENDER: 8, MIDFIELDER: 10, FORWARD: 12 },
  },
  ABILITY_RABONA: {
    id: 'ABILITY_RABONA', icon: '🌀', color: '#22d3ee', category: 'OFFENSIVE',
    activationType: 'INSTANT_SHOT', maximumStack: 1,
    positionSpawnWeights: { GOALKEEPER: 2, DEFENDER: 8, MIDFIELDER: 12, FORWARD: 10 },
  },
  ABILITY_BICYCLE_KICK: {
    id: 'ABILITY_BICYCLE_KICK', icon: '🚲', color: '#ef4444', category: 'OFFENSIVE',
    activationType: 'CONDITIONAL_SINGLE_USE', maximumStack: 1,
    positionSpawnWeights: { GOALKEEPER: 0, DEFENDER: 4, MIDFIELDER: 9, FORWARD: 11 },
  },
};

window.ABILITY_ORDER = ['ABILITY_SUPER_SHOT', 'ABILITY_RABONA', 'ABILITY_BICYCLE_KICK'];
