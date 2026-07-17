/* Team pool. Colours are [shirt1, shirt2] used for the 3D-shaded player tokens. */
window.TEAMS = [
  { id: 'team_argentina', name: 'Argentina', flag: '🇦🇷', colors: ['#6cb7ef', '#1e5fb0'], short: 'ARG' },
  { id: 'team_brazil',    name: 'Brasil',    flag: '🇧🇷', colors: ['#f7d54a', '#128a3e'], short: 'BRA' },
  { id: 'team_uruguay',   name: 'Uruguay',   flag: '🇺🇾', colors: ['#5aa9e6', '#123a6b'], short: 'URU' },
  { id: 'team_france',    name: 'Francia',   flag: '🇫🇷', colors: ['#3b6fd6', '#101a3a'], short: 'FRA' },
  { id: 'team_spain',     name: 'España',    flag: '🇪🇸', colors: ['#e23b3b', '#8a0f0f'], short: 'ESP' },
  { id: 'team_germany',   name: 'Alemania',  flag: '🇩🇪', colors: ['#e6e6e6', '#222222'], short: 'GER' },
  { id: 'team_england',   name: 'Inglaterra',flag: '🏴',  colors: ['#f2f2f2', '#c8102e'], short: 'ENG' },
  { id: 'team_chile',     name: 'Chile',     flag: '🇨🇱', colors: ['#e23b3b', '#123a6b'], short: 'CHI' },
  { id: 'team_mexico',    name: 'México',    flag: '🇲🇽', colors: ['#1f8f4e', '#0d5a2e'], short: 'MEX' },
  { id: 'team_portugal',  name: 'Portugal',  flag: '🇵🇹', colors: ['#c8102e', '#0a5c36'], short: 'POR' },
];

window.getTeam = function (id) { return window.TEAMS.find(t => t.id === id) || window.TEAMS[0]; };
