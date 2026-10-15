// Stand-in line-ups so pages can show two teams on the field before the rules engine exists (Batch 1).
// Offense attacks towards row 0 (the blue end zone) from its own 20: the line of scrimmage sits between
// rows 17 and 18. Squares are [col, row].
import { rosterFor } from '../data/art';

const OFFENSE = [[6, 18], [4, 18], [8, 18], [1, 18], [11, 18], [6, 19], [6, 21], [9, 20]];
const DEFENSE = [[6, 17], [4, 17], [8, 17], [2, 15], [10, 15], [6, 14], [6, 11], [3, 12]];

// TECHNO mode is 7-vs-7: #51 sits out. Centre = a solid 3/4, passer = the best 6/7 behind him.
export function lineUp(teamId, uniformId, side, { pro = false } = {}) {
  const roster = rosterFor(teamId, uniformId).filter((p) => pro || p.num !== 51);
  const bySkill = [...roster].sort((a, b) => a.skill - b.skill);
  const spots = side === 'offense' ? OFFENSE : DEFENSE;
  let order;
  if (side === 'offense') {
    const center = bySkill.find((p) => p.skill <= 4) ?? bySkill[0];
    const passer = [...bySkill].reverse().find((p) => p !== center && p.skill >= 6) ?? bySkill.at(-1);
    const rest = bySkill.filter((p) => p !== center && p !== passer);
    // line: the strong (low numbers) beside the centre; receivers: the fast ones out wide
    order = [center, rest[0], rest[1], rest.at(-1), rest.at(-2), passer, ...rest.slice(2, -2)];
  } else {
    order = bySkill;
  }
  return order.filter(Boolean).map((p, i) => ({ ...p, sq: spots[i] }));
}
