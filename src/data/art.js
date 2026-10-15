// The art manifest (written by tools/extract_art.py) joined with the rosters.
import ART from './art.json';
import TEAMS from './teams.json';

export const FIELD = ART.field; // image calibration: play area = 13 cols x 24 rows (incl. 2 end-zone rows each end)
export const PUNCH = ART.punch;
export const DOWNS = ART.uniforms._downs;
export { TEAMS };

export const teamById = (id) => TEAMS.find((t) => t.id === id);
export const uniformsFor = (id) => ART.uniforms[id] ?? [];
export const uniformOf = (id, uid) => uniformsFor(id).find((u) => u.id === uid) ?? uniformsFor(id)[0];
export const teamColors = (id, uid) => uniformOf(id, uid)?.colors ?? ['#333', '#fff'];

// the 8 players in art order (ascending jersey number), with their roster details
export function rosterFor(id, uid) {
  const team = teamById(id);
  const u = uniformOf(id, uid);
  if (!team || !u) return [];
  return u.nums.map((num, row) => ({ ...team.players.find((p) => p.num === num), row }));
}

export const artUrl = (file) => `/art/${file}`;
