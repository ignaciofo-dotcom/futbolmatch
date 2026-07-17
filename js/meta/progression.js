/* Experience, levels, attribute points. Permanent — never reduced on defeat. */
window.Progression = (function () {
  const C = window.CONFIG.progression;

  function xpForLevel(level) { return C.xpPerLevel * level; } // level -> level+1

  // Compute XP from a finished match. roundNumber: 1-based (QF=1).
  function matchXP({ isVictory, performancePoints, roundNumber, isFinalVictory }) {
    return Math.round(
      C.baseMatchXP +
      (isVictory ? C.victoryBonus : 0) +
      Math.max(0, performancePoints) * C.perfFactor +
      roundNumber * C.roundBonus +
      (isFinalVictory ? C.finalVictoryBonus : 0)
    );
  }

  // Apply XP to profile, handle level-ups. Returns { levelsGained, xpGained }.
  function applyXP(profile, xpGained) {
    profile.experience += xpGained;
    let levelsGained = 0;
    while (profile.experience >= xpForLevel(profile.level)) {
      profile.experience -= xpForLevel(profile.level);
      profile.level += 1;
      profile.attributePoints += C.attrPointsPerLevel;
      levelsGained += 1;
    }
    return { levelsGained, xpGained };
  }

  // Cost (in attribute points) to raise an attribute by 1 — cheaper for position-primary attrs.
  function attrCost(profile, attr) {
    const primary = {
      GOALKEEPER: ['reflexes', 'goalkeeping', 'positioning'],
      DEFENDER: ['tackling', 'strength', 'positioning'],
      MIDFIELDER: ['passing', 'dribbling', 'stamina'],
      FORWARD: ['shooting', 'speed', 'dribbling'],
    }[profile.position] || [];
    return primary.includes(attr) ? 1 : 2;
  }

  function spendPoint(profile, attr) {
    const cost = attrCost(profile, attr);
    if (profile.attributePoints >= cost && profile.attributes[attr] < window.CONFIG.progression.attrMax) {
      profile.attributePoints -= cost;
      profile.attributes[attr] = Math.min(window.CONFIG.progression.attrMax, profile.attributes[attr] + 1);
      return true;
    }
    return false;
  }

  // Match rating 1.0–10.0 from performance points, scaled by position (GK not punished for no goals).
  function matchRating({ performancePoints, isVictory, position }) {
    let base = 5.0 + performancePoints / 90;
    if (isVictory) base += 0.8;
    return Math.max(1, Math.min(10, Math.round(base * 10) / 10));
  }

  return { xpForLevel, matchXP, applyXP, attrCost, spendPoint, matchRating };
})();
