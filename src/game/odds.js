// What a check is likely to do, for the hover help: success (7+) and total success (10+) chances for a net modifier.
import { pAtLeast } from '../engine/ai.js';
import { contactMods, netModifier } from '../engine/rules.js';

export const pct = (p) => `${Math.round(p * 100)}%`;
export function odds(net) { return { net, success: pAtLeast(7, net), total: pAtLeast(10, net) }; }
const sign = (n) => (n > 0 ? `+${n}` : `${n}`);

// a block or tackle by `actor` on `target`, before any bench boost
export function contactOdds(s, actor, target, label, action = label === 'Tackle' ? 'tackle' : 'block') {
  const m = contactMods(s, actor, target, action);
  const o = odds(netModifier(m.bonus, m.penalty));
  return `${label} #${target.num}: skill ${sign(m.parts.skill)}, teamwork ${sign(m.parts.teamwork)}${m.parts.ability ? `, abilities ${sign(m.parts.ability)}` : ''} = ${sign(o.net)} -> ${pct(o.success)} to succeed, ${pct(o.total)} total success`;
}
export function passOdds(p) {
  const o = odds(Math.min(3, p.bonus) - p.penalty);
  return `Throw ${p.dist}: ${p.bonus ? `+${p.bonus}` : 'no bonus'}${p.penalty ? `, -${p.penalty} coverage` : ''} = ${sign(o.net)} -> ${pct(o.success)} on target, ${pct(o.total)} total success${p.target ? '' : ' (open grass: someone still has to catch it)'}`;
}
