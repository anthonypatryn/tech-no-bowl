// The shot director: decides when the camera leaves the coach's view for a cinematic moment, from the engine's log.
//   throw  a pass of 8+ squares: chase cam behind the ball, slow motion at the top of the arc, low lens at the target
//   hit    a tackle, sack, fumble or knockdown: snap zoom, shake, debris
//   td     a touchdown: slow orbit round the scorer, confetti
import { useEffect, useMemo, useState } from 'react';
import { settings } from './prefs';

export const LONG_THROW = 8;
const DUR = { throw: 3.0, hit: 1.5, td: 3.4 };

export function shotFor(e, players) {
  if (!e) return null;
  const sqOfPid = (pid) => { const p = players[pid]; return p && p.col != null ? [p.col, p.row] : null; };
  if (e.kind === 'check' && e.action === 'pass' && e.dist >= LONG_THROW) return { kind: 'throw', from: e.from, to: e.to };
  if (e.kind === 'tackle') return { kind: 'hit', at: e.at };
  if (e.kind === 'sack' || e.kind === 'knockdown' || (e.kind === 'fumble' && e.crit)) { const at = sqOfPid(e.pid); return at ? { kind: 'hit', at, big: e.kind !== 'knockdown' } : null; }
  if (e.kind === 'td') return { kind: 'td', at: e.at, side: e.side };
  return null;
}

// the shot running now (or null). The newest cinematic log entry wins.
export function useShot(log, players) {
  const last = useMemo(() => {
    for (let i = log.length - 1; i >= Math.max(0, log.length - 6); i--) { const sh = shotFor(log[i], players); if (sh) return { ...sh, id: log[i].id }; }
    return null;
  }, [log, players]);
  const [shot, setShot] = useState(null);
  useEffect(() => {
    if (!last || settings().calm) return;
    const s = { ...last, t0: performance.now(), dur: DUR[last.kind] };
    setShot(s);
    const t = setTimeout(() => setShot((x) => (x?.id === s.id ? null : x)), s.dur * 1000);
    return () => clearTimeout(t);
  }, [last?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  return shot;
}
