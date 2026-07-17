/* Tournament generation, rounds, difficulty curve, opponent selection, trophies. */
window.Tournament = (function () {
  const C = window.CONFIG.tournament;

  function difficultyMultiplier(tournamentNumber) {
    return C.difficultyBase + Math.log(tournamentNumber + 1) * C.difficultyLogFactor;
  }

  function stadiumTheme(n) {
    const themes = ['DAY_STADIUM', 'NIGHT_STADIUM', 'SUNSET_STADIUM'];
    return themes[(n - 1) % themes.length];
  }

  function trophyTier(n) {
    if (n <= 2) return 'BRONZE';
    if (n <= 5) return 'SILVER';
    if (n <= 9) return 'GOLD';
    if (n <= 19) return 'CHAMPION';
    return 'LEGEND';
  }

  // Build a tournament: pick distinct opponents from the pool (excluding the player's team).
  function generate(tournamentNumber, playerTeamId, seed) {
    const rng = mulberry32((seed || tournamentNumber * 2654435761) >>> 0);
    const pool = window.TEAMS.filter(t => t.id !== playerTeamId);
    // shuffle
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    const rounds = C.mvpRounds.map((r, i) => ({
      round: r,
      opponentTeamId: pool[i % pool.length].id,
      result: null,        // { win, home, away } once played
    }));
    return {
      tournamentNumber,
      difficultyMultiplier: Math.round(difficultyMultiplier(tournamentNumber) * 100) / 100,
      stadiumTheme: stadiumTheme(tournamentNumber),
      rounds,
      completed: false,
    };
  }

  function ensure(profile) {
    if (!profile.tournament || profile.tournament.tournamentNumber !== profile.currentTournament) {
      profile.tournament = generate(profile.currentTournament, profile.teamId);
      profile.currentRoundIndex = 0;
    }
    return profile.tournament;
  }

  function currentRound(profile) {
    const t = ensure(profile);
    return t.rounds[profile.currentRoundIndex] || null;
  }

  function roundNumber(profile) { return profile.currentRoundIndex + 1; }
  function isFinal(profile) { return profile.currentRoundIndex === ensure(profile).rounds.length - 1; }

  // Record a played match. Returns 'ADVANCE' | 'REPLAY' | 'TROPHY'.
  function recordResult(profile, homeScore, awayScore) {
    const t = ensure(profile);
    const r = t.rounds[profile.currentRoundIndex];
    const win = homeScore > awayScore;
    r.result = { win, home: homeScore, away: awayScore };
    if (!win) return 'REPLAY';
    if (isFinal(profile)) {
      t.completed = true;
      return 'TROPHY';
    }
    profile.currentRoundIndex += 1;
    return 'ADVANCE';
  }

  // Award trophy and set up the next, harder tournament.
  function awardTrophyAndAdvance(profile, finalRound) {
    const n = profile.currentTournament;
    profile.trophies.push({
      tournament: n,
      tier: trophyTier(n),
      date: new Date().toISOString().slice(0, 10),
      difficulty: profile.tournament.difficultyMultiplier,
      finalOpponent: finalRound.opponentTeamId,
      finalScore: finalRound.result.home + '-' + finalRound.result.away,
    });
    // one cosmetic unlock per trophy (MVP)
    const kit = 'KIT_' + n;
    if (!profile.equipmentUnlocked.includes(kit)) profile.equipmentUnlocked.push(kit);
    const celebs = ['CELEBRATION_KNEE_SLIDE', 'CELEBRATION_BACKFLIP', 'CELEBRATION_DANCE', 'CELEBRATION_POINT_SKY'];
    const celeb = celebs[(n - 1) % celebs.length];
    if (!profile.celebrationsUnlocked.includes(celeb)) profile.celebrationsUnlocked.push(celeb);

    profile.currentTournament += 1;
    profile.tournament = generate(profile.currentTournament, profile.teamId);
    profile.currentRoundIndex = 0;
    return { kit, celeb, tier: trophyTier(n) };
  }

  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  return { difficultyMultiplier, generate, ensure, currentRound, roundNumber, isFinal,
           recordResult, awardTrophyAndAdvance, trophyTier, stadiumTheme };
})();
