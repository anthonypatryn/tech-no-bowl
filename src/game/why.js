// "Why?": the reasons behind a move's cost and a contact roll's modifiers, with the players causing them, so the
// screen can list them and ring those players on the field while you hover.
import { leaveCost, moveReach, threateners, contactMods, netModifier, hasSkill } from '../engine/rules.js';
import { stepExtra, key } from '../engine/board.js';

const tag = (p) => `#${p.num}`;

// a move to `to` (a square from the act request): every square's cost along the cheapest path
export function moveWhy(s, p, to, left, parity = 0) {
  const m = moveReach(s, p, left, parity, { allowOut: true }).get(key(...to));
  if (!m) return null;
  const carrying = s.ball.at === 'held' && s.ball.pid === p.pid;
  let here = [p.col, p.row], par = parity, squares = 0, diag = 0;
  const zones = new Map(); // pid -> extra cost he caused
  for (const step of m.path) {
    const dc = step[0] - here[0], dr = step[1] - here[1];
    diag += stepExtra(dc, dr, par);
    const cost = leaveCost(s, here, p, carrying, step);
    const ts = cost > 1 ? threateners(s, here, 1 - p.side, [p.pid]) : [];
    if (!ts.length) squares++;
    // a threatened square costs 2 per threatening opponent (3 with the ball, or for a LOCKDOWN), instead of 1
    else if (cost === ts.length * 2 || cost === ts.reduce((n, t) => n + (carrying || hasSkill(s, t, 'LOCKDOWN') ? 3 : 2), 0)) {
      for (const t of ts) zones.set(t.pid, (zones.get(t.pid) ?? 0) + (carrying || hasSkill(s, t, 'LOCKDOWN') ? 3 : 2));
    } else for (const t of ts) zones.set(t.pid, (zones.get(t.pid) ?? 0) + cost / ts.length); // SIDELINER with the ball
    if (dc && dr) par = 1 - par;
    here = step;
  }
  const lines = [];
  if (squares) lines.push([`${squares} open square${squares === 1 ? '' : 's'}`, `+${squares}`]);
  for (const [pid, n] of zones) {
    const t = s.players[pid];
    lines.push([`leaving ${tag(t)}'s zone${carrying ? ' (you have the ball)' : hasSkill(s, t, 'LOCKDOWN') ? ' (LOCKDOWN)' : ''}`, `+${n}`]);
  }
  if (diag) lines.push([`second diagonal${diag > 1 ? 's' : ''}`, `+${diag}`]);
  return { kind: 'move', total: m.cost, left, lines, against: [...zones.keys()], help: [] };
}

// a block / tackle / shove / juke / shake / dirty hit on `target`: every modifier and who causes it
export function contactWhy(s, actor, target, action = 'block') {
  const mods = contactMods(s, actor, target, action);
  const speed = action === 'juke' || action === 'shake';
  const lines = [];
  const sk = mods.parts.skill;
  if (sk) lines.push([`${speed ? 'speed' : 'rating'}: ${tag(actor)} skill ${actor.skill} vs ${tag(target)} skill ${target.skill}`, sk > 0 ? `+${sk}` : `${sk}`]);
  const helpers = threateners(s, [target.col, target.row], actor.side, [actor.pid, target.pid]);
  const hurters = threateners(s, [actor.col, actor.row], target.side, [actor.pid, target.pid]);
  for (const h of helpers) lines.push([`${tag(h)} helps (threatens ${tag(target)})${hasSkill(s, h, 'TEAM PLAYER') ? ' TEAM PLAYER' : ''}`, hasSkill(s, h, 'TEAM PLAYER') ? '+2' : '+1']);
  for (const h of hurters) lines.push([`${tag(h)} hurts (threatens ${tag(actor)})${hasSkill(s, h, 'TEAM PLAYER') ? ' TEAM PLAYER' : ''}`, hasSkill(s, h, 'TEAM PLAYER') ? '-2' : '-1']);
  if ((action === 'block' || action === 'shove') && hasSkill(s, actor, 'BLOCK +1')) lines.push(['BLOCK +1', '+1']);
  if (action === 'tackle' && hasSkill(s, actor, 'TACKLE +3')) lines.push(['TACKLE +3', '+3']);
  else if (action === 'tackle' && hasSkill(s, actor, 'TACKLE +1')) lines.push(['TACKLE +1', '+1']);
  if (action === 'dirty') lines.push(['dirty hit on a downed player', '+1']);
  if (actor.onFire) lines.push(['ON FIRE', '+3']);
  const net = netModifier(mods.bonus, mods.penalty);
  if (mods.bonus > 3 || mods.penalty > 3) lines.push(['bonuses and penalties each stop at 3', '']);
  return { kind: 'contact', net, lines, help: helpers.map((h) => h.pid), against: hurters.map((h) => h.pid), target: target.pid };
}
