// What each special ability does, in a sentence or two (full wording: docs/rules-and-rosters.md §2).
// Abilities only count in ALL TECHNO / ALL PRO / INFERNO; the team select shows them in every mode.
export const ABILITIES = {
  'BLITZ': 'On defense, can block as part of a move.',
  'BLOCK +1': '+1 on blocks (and shoves).',
  'BLOCK PARTY': 'When his block earns a free activation, a teammate who blocks with it gets +2.',
  'CATCH': 'When he is thrown to, his own bench cards can boost the throw.',
  'DIVING TACKLE': 'Can tackle as part of a move. Miss, and he hits the turf.',
  'DODGE': 'Spend his bench cards to give a block or tackle on him -1 each.',
  'INTERCEPTOR': 'A bad throw near him drops to him instead of scattering (sport check to hold on).',
  'JUKE': 'With the ball, beat a defender like a block, but the faster player gets the bonus.',
  'LOCKDOWN': 'Leaving his threat zone costs 3 instead of 2.',
  'MAN DEFENDER': 'Throws to a receiver he is covering get -3.',
  'OPTION': 'When a defender closes in, can stop him and pitch first (needs Pitch).',
  'PITCH': 'A hand-off from up to 3 squares away.',
  'POCKET PASSER': '+2 on his throw after the called play, if he took the snap and has not moved.',
  'QB READ': 'Can read and react with the ball even when the defense did not.',
  'ROUTE PASSER': '+1 on throws to open grass.',
  'RUN BLOCK': 'On offense, can block as part of a move, even with the ball.',
  'SCREEN PASSER': '+1 on throws behind the line of scrimmage.',
  'SHAKE': 'Without the ball, beat a defender like a juke to get open.',
  'SHOVE': 'His blocks drive the target back 2 squares.',
  'SIDELINER': 'Running along the sideline, threat barely slows him.',
  'SPIN MOVE': 'Tacklers roll an extra die: a match cancels a die and he can spin past.',
  'SQUEEZE PLAY': 'Can slip diagonally between two players.',
  'STIFF ARM': 'Tacklers roll an extra die: a match cancels a die and can flatten the tackler.',
  'TACKLE +1': '+1 on tackles.',
  'TACKLE +3': '+3 on tackles.',
  'TEAM PLAYER': 'His teamwork counts double (+2 / -2).',
  'ZONE DEFENDER': 'Counts as covering any throw landing within 3 squares of him.',
};
export const abilityText = (a) => ABILITIES[a] ?? (a.startsWith('INFERNO') ? 'Only in INFERNO mode, while ON FIRE.' : a);

// Teams with alternate players: each slot = the regular player and the one who can suit up instead.
// Most share a number; the Reapers' #4 John McFadden takes #44 Howie Short's spot (he wears the #44 cube).
export function altSlots(team) {
  const alt = team?.alternate;
  if (!alt) return [];
  return alt.replacements.map((rep) => {
    let out = team.players.find((p) => p.num === rep.num);
    if (!out) {
      const m = alt.note.match(new RegExp(`#(\\d+)[^#]*?->\\s*#${rep.num}\\b`));
      out = m && team.players.find((p) => p.num === Number(m[1]));
    }
    return out ? { slot: out.num, regular: out, alternate: rep } : null;
  }).filter(Boolean);
}

// the roster a team takes the field with: picks = { [slot]: 'alt' }
export function lineup(team, picks = {}) {
  const swap = new Map(altSlots(team).filter((s) => picks[s.slot] === 'alt').map((s) => [s.slot, s.alternate]));
  return team.players.map((p) => (swap.has(p.num) ? { ...swap.get(p.num), artNum: p.num } : { ...p, artNum: p.num }));
}
