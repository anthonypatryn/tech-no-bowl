// The shot director: decides when the camera leaves the coach's view for a cinematic moment, from the engine's log.
//   throw  a pass of 8+ squares: chase cam behind the ball, slow motion at the top of the arc, low lens at the target
//   hit    a tackle, fumble or knockdown: snap zoom, shake, debris
//   sack   the passer buried behind the line: slow low push-in, a ring of dust
//   td     a touchdown: slow orbit round the scorer, confetti (it waits for the runner to reach the end zone)
//   onfire a player is set ON FIRE: close orbit, flames
//   skill  a special ability fires (stiff arm, spin move, juke, shove, bring the heat...): snap to it, its effect
//   kick   a field goal: low behind the kicker, the ball end over end at the posts
import { useEffect, useMemo, useState } from 'react';
import { settings } from './prefs';

export const LONG_THROW = 8;
const DUR = { throw: 3.0, hit: 2.0, sack: 2.4, td: 3.4, onfire: 3.2, skill: 2.4, kick: 3.6 };
const WALK = 6.5; // squares per second, as the board walks them
// log kind -> [callout, effect]
export const SKILL_FX = {
  stiffarm: ['STIFF ARM!', 'spark'], spin: ['SPIN MOVE!', 'swirl'], heat: ['BRING THE HEAT!', 'fire'], intercept: ['JUMPS THE ROUTE!', 'swirl'],
  fuego: ['EN FUEGO!', 'fire'], firebomb: ['FIRE BOMB!', 'fire'], dogpile: ['DOGPILE!', 'dust'], dodge: ['DODGE!', 'swirl'],
};
const CHECK_FX = { juke: ['JUKE!', 'swirl'], shake: ['SHAKE!', 'swirl'], shove: ['SHOVE!', 'dust'] };
// the callout for a log entry (banner text), or null
export function calloutFor(e) {
  if (!e) return null;
  if (SKILL_FX[e.kind]) return SKILL_FX[e.kind][0];
  if (e.kind === 'onfire') return 'ON FIRE!';
  if (e.kind === 'fieldgoal') return 'FIELD GOAL!';
  if (e.kind === 'timeout') return 'TIMEOUT!';
  if (e.kind === 'kick' && !e.good) return 'NO GOOD!';
  if (e.kind === 'check' && e.success && CHECK_FX[e.action]) return CHECK_FX[e.action][0];
  if (e.kind === 'check' && e.success && e.action === 'block' && e.asMove) return 'BLITZ!';
  return null;
}

export function shotFor(e, players) {
  if (!e) return null;
  const sqOfPid = (pid) => { const p = players[pid]; return p && p.col != null ? [p.col, p.row] : null; };
  if (e.kind === 'check' && e.action === 'pass' && (e.dist >= LONG_THROW || e.bomb) && e.from && e.to) return { kind: 'throw', from: e.from, to: e.to, bomb: !!e.bomb };
  if (e.kind === 'tackle') return e.at ? { kind: 'hit', at: e.at } : null;
  if (e.kind === 'sack') { const at = sqOfPid(e.pid); return at ? { kind: 'sack', at } : null; }
  // flattened by a critical block / shove: the same snap-zoom as a big hit, at where he lands
  if (e.kind === 'push' && e.knock && e.to) return { kind: 'hit', at: e.to, big: true };
  if (e.kind === 'knockdown' || (e.kind === 'fumble' && e.crit)) { const at = sqOfPid(e.pid); return at ? { kind: 'hit', at, big: e.kind !== 'knockdown' } : null; }
  if (e.kind === 'td') { const at = e.at ?? (e.pid && sqOfPid(e.pid)); return at ? { kind: 'td', at, side: e.side } : null; }
  if (e.kind === 'onfire') { const at = sqOfPid(e.pid); return at ? { kind: 'onfire', at, pid: e.pid } : null; }
  if (SKILL_FX[e.kind]) { const at = sqOfPid(e.pid); return at ? { kind: 'skill', at, label: SKILL_FX[e.kind][0], fx: SKILL_FX[e.kind][1] } : null; }
  if (e.kind === 'check' && e.success && CHECK_FX[e.action]) { const at = sqOfPid(e.pid); return at ? { kind: 'skill', at, label: CHECK_FX[e.action][0], fx: CHECK_FX[e.action][1] } : null; }
  if (e.kind === 'kick' && e.from) return { kind: 'kick', from: e.from, dir: e.dir, good: e.good, side: e.side };
  return null;
}
// does this shot take the camera away from the view you picked? Settings → Cinematic camera: 'big' (touchdowns, long
// throws, kicks), 'all', 'off'. Overhead and Free always stay put (the effects and callouts still play).
export function movesCamera(shot, view, pref = 'big') {
  if (!shot || pref === 'off' || view === 'overhead' || view === 'free') return false;
  return pref === 'all' || ['td', 'throw', 'kick'].includes(shot.kind);
}

// how long until a moment is really on screen: a touchdown waits for the runner's cube to walk into the end zone
export function delayFor(log, i) {
  const e = log[i];
  if (e?.kind !== 'td') return 0;
  for (let j = i - 1; j >= Math.max(0, i - 4); j--) if (log[j].kind === 'move' && log[j].pid === e.pid) return Math.min(2.5, (log[j].path?.length ?? 1) / WALK + 0.15);
  return 0;
}

// each kind plays in full the first time; after that a shorter cut (a long throw keeps its length: the ball's flight
// is timed to it). Any shot can be skipped: skipShot() (the Skip button, Enter, a click on the field).
const seen = new Map();
export const skipShot = () => window.dispatchEvent(new Event('tb-skip-shot'));

// the shot running now (or null). The newest cinematic log entry wins.
export function useShot(log, players, { full = false } = {}) {
  const last = useMemo(() => {
    for (let i = log.length - 1; i >= Math.max(0, log.length - 6); i--) {
      const sh = shotFor(log[i], players);
      if (!sh) continue;
      // a touchdown caught off a long throw (or a FIRE BOMB): the throw plays first, then the touchdown
      let lead = null;
      if (sh.kind === 'td') for (let j = i - 1; j >= Math.max(0, i - 4); j--) { const t = shotFor(log[j], players); if (t?.kind === 'throw') { lead = { ...t, id: log[j].id }; break; } }
      return { ...sh, id: log[i].id, wait: delayFor(log, i), lead };
    }
    return null;
  }, [log, players]);
  const [shot, setShot] = useState(null);
  useEffect(() => {
    if (!last || settings().calm) return;
    let t2, t3;
    const run = (sh, then) => {
      const n = seen.get(sh.kind) ?? 0;
      seen.set(sh.kind, n + 1);
      const s = { ...sh, t0: performance.now(), dur: DUR[sh.kind] * (n && !full && sh.kind !== 'throw' ? 0.6 : 1) };
      setShot(s);
      t2 = setTimeout(() => { if (then) then(); else setShot((x) => (x?.id === s.id ? null : x)); }, s.dur * 1000);
    };
    const t1 = setTimeout(() => {
      if (last.lead) run(last.lead, () => { t3 = setTimeout(() => run(last), 50); });
      else run(last);
    }, (last.lead ? 0 : last.wait) * 1000);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [last?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const skip = () => setShot(null);
    window.addEventListener('tb-skip-shot', skip);
    return () => window.removeEventListener('tb-skip-shot', skip);
  }, []);
  return shot;
}
