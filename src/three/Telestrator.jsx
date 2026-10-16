// The telestrator: on a replay of a big play, the TV analyst draws on the field as the play unfolds. The ball
// carrier's run as a yellow arrow, the throw as a white arc, a circle round each big block or hit with an arrow
// where the man went. Each mark draws itself in (a slightly wobbly hand-drawn line) when the replay reaches it.
import { useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import { sq } from './Field';

const Y = 0.07;
const YELLOW = '#ffe14a', WHITE = '#ffffff', RED = '#ff4a3a';
const at = (c, r, y = Y) => { const [x, , z] = sq(c, r); return [x, y, z]; };
// a small, steady wobble so lines look drawn by hand (same every frame)
const wob = (i, k) => Math.sin(i * 12.9898 + k * 78.233) * 0.06;
function hand(points) {
  const out = [];
  for (let i = 0; i < points.length - 1; i++) {
    const [a, b] = [points[i], points[i + 1]];
    for (let t = 0; t < 4; t++) {
      const u = t / 4;
      out.push([a[0] + (b[0] - a[0]) * u + wob(i * 4 + t, 1), a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u + wob(i * 4 + t, 2)]);
    }
  }
  out.push(points.at(-1));
  return out;
}
function arrowHead(a, b, size = 0.45) {
  const dx = b[0] - a[0], dz = b[2] - a[2], len = Math.hypot(dx, dz) || 1, ux = dx / len, uz = dz / len;
  const back = [b[0] - ux * size, b[1], b[2] - uz * size];
  return [[back[0] - uz * size * 0.6, b[1], back[2] + ux * size * 0.6], b, [back[0] + uz * size * 0.6, b[1], back[2] - ux * size * 0.6]];
}
function circle(c, r, rad = 0.62) {
  const [x, , z] = sq(c, r);
  return Array.from({ length: 29 }, (_, i) => { const a = (i / 26) * Math.PI * 2 + 0.3; const w = 1 + wob(i, 3) * 0.8; return [x + Math.cos(a) * rad * w, Y, z + Math.sin(a) * rad * w]; });
}

// the marks for a play: [{ at: event index it appears at, kind, points, color, dashed?, head? }]
export function telestrate(play) {
  const marks = [];
  let holder = null;
  const pos = {};
  for (const [side, spots] of Object.entries(play.spots)) for (const sp of spots) pos[`${side}:${sp.num}`] = [sp.col, sp.row];
  for (const m of play.motions) pos[m.pid] = m.to;
  play.events.forEach((e, i) => {
    if (e.kind === 'snap' || e.kind === 'handoff') holder = e.to;
    if (e.kind === 'catch' || (e.kind === 'sport' && e.ok)) holder = e.pid;
    if (e.kind === 'move' && e.path?.length) {
      const from = pos[e.pid];
      if (e.pid === holder && from) {
        const pts = [from, ...e.path].map(([c, r]) => at(c, r));
        if (pts.length > 1) marks.push({ at: i, points: hand(pts), color: YELLOW, head: arrowHead(pts.at(-2), pts.at(-1)) });
      }
    }
    if (e.kind === 'check' && e.action === 'pass' && e.from && e.to && e.success) {
      const a = at(...e.from), b = at(...e.to);
      const mid = [(a[0] + b[0]) / 2, 1.6 + Math.hypot(b[0] - a[0], b[2] - a[2]) * 0.12, (a[2] + b[2]) / 2];
      const arc = Array.from({ length: 17 }, (_, k) => { const u = k / 16; return [(1 - u) ** 2 * a[0] + 2 * (1 - u) * u * mid[0] + u * u * b[0], (1 - u) ** 2 * a[1] + 2 * (1 - u) * u * mid[1] + u * u * b[1], (1 - u) ** 2 * a[2] + 2 * (1 - u) * u * mid[2] + u * u * b[2]]; });
      marks.push({ at: i, points: arc, color: WHITE, dashed: true, head: arrowHead(arc.at(-2), arc.at(-1), 0.4) });
    }
    // a block or hit that worked: circle the hitter, arrow to where his man ended up
    if (e.kind === 'check' && e.success && ['block', 'shove', 'tackle', 'juke', 'shake'].includes(e.action) && e.pid && pos[e.pid]) {
      marks.push({ at: i, points: circle(...pos[e.pid]), color: e.action === 'tackle' ? RED : WHITE });
    }
    if (e.kind === 'push' && pos[e.pid] && e.to) {
      const a = at(...pos[e.pid]), b = at(...e.to);
      marks.push({ at: i, points: hand([a, b]), color: WHITE, head: arrowHead(a, b, 0.35) });
    }
    if (e.kind === 'move' && e.to) pos[e.pid] = e.to;
    if (e.kind === 'push' && e.to) pos[e.pid] = e.to;
  });
  return marks;
}

// is a play worth drawing on? touchdowns, long runs, long throws, knockdowns, chained free activations
export function bigPlay(play) {
  if (!play) return false;
  return play.big || play.chain >= 2 || play.events.some((e) => (e.kind === 'move' && (e.path?.length ?? 0) >= 6)
    || (e.kind === 'check' && e.action === 'pass' && e.dist >= 8) || e.kind === 'knockdown' || e.kind === 'td');
}

function Mark({ m }) {
  const t0 = useRef(performance.now());
  const [n, setN] = useState(2);
  useFrame(() => {
    const u = Math.min(1, (performance.now() - t0.current) / 650);
    const k = Math.max(2, Math.round(u * m.points.length));
    if (k !== n) setN(k);
  });
  const pts = m.points.slice(0, n);
  return (
    <group>
      <Line points={pts} color={m.color} lineWidth={5} dashed={!!m.dashed} dashSize={0.3} gapSize={0.18} transparent opacity={0.95} depthTest={false} renderOrder={10} />
      {m.head && n >= m.points.length && <Line points={m.head} color={m.color} lineWidth={5} depthTest={false} renderOrder={10} />}
    </group>
  );
}

// shown: how many of the replay's events have happened so far
export function Telestrator({ marks, shown }) {
  const live = useMemo(() => marks.filter((m) => m.at < shown), [marks, shown]);
  return <group>{live.map((m, i) => <Mark key={i} m={m} />)}</group>;
}
