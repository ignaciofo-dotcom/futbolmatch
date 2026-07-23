/* Versioned localStorage save. Guarantees permanent progression is never lost on defeat. */
window.Save = (function () {
  const KEY = window.CONFIG.saveKey;

  function defaultAttrs(position) {
    const a = { speed: 55, acceleration: 55, shooting: 50, passing: 55, dribbling: 55,
      tackling: 45, strength: 50, stamina: 60, positioning: 55, reflexes: 40, goalkeeping: 20 };
    if (position === 'GOALKEEPER') { a.reflexes = 65; a.goalkeeping = 65; a.positioning = 60; }
    else if (position === 'DEFENDER') { a.tackling = 65; a.strength = 62; }
    else if (position === 'MIDFIELDER') { a.passing = 65; a.dribbling = 62; a.stamina = 68; }
    else if (position === 'FORWARD') { a.shooting = 65; a.speed = 62; a.dribbling = 62; }
    return a;
  }

  function newProfile(opts) {
    return {
      saveVersion: window.CONFIG.saveVersion,
      language: window.I18N.lang,
      controlProfile: 'ARROWS',
      sound: true,
      difficulty: 'NORMAL',
      matchMinutes: window.CONFIG.match.defaultMinutes,
      displayName: opts.displayName,
      teamId: opts.teamId,
      position: opts.position,
      shirtNumber: opts.shirtNumber,
      appearance: opts.appearance || { skin: 0, hair: 0 },
      level: 1,
      experience: 0,
      attributePoints: 0,
      attributes: defaultAttrs(opts.position),
      currentTournament: 1,
      currentRoundIndex: 0,
      tournament: null,        // generated lazily by TournamentManager
      trophies: [],
      equipmentUnlocked: [],
      celebrationsUnlocked: [],
      selectedCelebration: 'CELEBRATION_KNEE_SLIDE',
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      return migrate(data);
    } catch (e) { console.warn('save load failed', e); return null; }
  }

  function migrate(data) {
    if (data.saveVersion == null) data.saveVersion = 1;
    if (data.difficulty == null) data.difficulty = 'NORMAL';
    if (data.matchMinutes == null) data.matchMinutes = window.CONFIG.match.defaultMinutes;
    return data;
  }

  function save(profile) {
    if (!profile) return;
    try { localStorage.setItem(KEY, JSON.stringify(profile)); }
    catch (e) { console.warn('save failed', e); }
  }

  function clear() { try { localStorage.removeItem(KEY); } catch (e) {} }

  return { newProfile, load, save, clear, defaultAttrs };
})();
