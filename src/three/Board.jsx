// The live game on the 3D field: cubes that walk their paths, the ball (carried, loose or hanging in the air),
// the line of scrimmage, the down cube, clickable square highlights and the camera.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { Field, Lights, sq, ROWS, COLS } from './Field';
import { PlayerCube, DownCube, CUBE } from './Cube';
import { uniformOf, teamColors, artRows } from '../data/art';
import { DiceRolls } from './Dice';
import { settings } from '../game/prefs';

const SPEED = 6.5; // squares per second when walking

// ---------- players ----------
// p: { pid, side, num, col, row, down }. path: the squares of the move that brought him here (if any)
function Mover({ p, uniform, row, path, positions, ring, onPick }) {
  const g = useRef();
  const pos = useRef(null);
  const queue = useRef([]);
  const hop = useRef(0);
  const at = `${p.col},${p.row}`;
  useLayoutEffect(() => {
    const goal = new THREE.Vector3(...sq(p.col, p.row));
    if (!pos.current || settings().calm) { pos.current = goal.clone(); queue.current = []; return; }
    if (pos.current.distanceTo(goal) < 0.01) return;
    const walking = path?.length && path[path.length - 1][0] === p.col && path[path.length - 1][1] === p.row;
    // anything that isn't a walk along a path and is more than a push away (a new down's formation) is a teleport
    if (!walking && pos.current.distanceTo(goal) > 2.5) { pos.current = goal.clone(); queue.current = []; return; }
    queue.current = (walking ? path : [[p.col, p.row]]).map(([c, r]) => new THREE.Vector3(...sq(c, r)));
  }, [at, path, p.col, p.row]);
  useFrame((_, dt) => {
    if (!pos.current || !g.current) return;
    const q = queue.current;
    if (q.length) {
      const next = q[0];
      const d = pos.current.distanceTo(next);
      const step = SPEED * dt;
      if (d <= step) { pos.current.copy(next); q.shift(); hop.current = 0; } else { pos.current.lerp(next, step / d); hop.current += dt * SPEED; }
    }
    g.current.position.set(pos.current.x, q.length ? Math.abs(Math.sin(hop.current * Math.PI)) * 0.12 : 0, pos.current.z);
    positions.current[p.pid] = g.current.position;
  });
  return (
    <group ref={g}>
      <PlayerCube uniform={uniform} row={row} facing={Math.PI / 2} down={p.down}
        onClick={onPick ? (e) => { e.stopPropagation(); onPick(p.pid); } : undefined} />
      {ring && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
          <ringGeometry args={[0.5, 0.6, 32]} />
          <meshBasicMaterial color={ring} transparent opacity={0.95} toneMapped={false} />
        </mesh>
      )}
    </group>
  );
}

// ---------- the ball ----------
function Ball({ ball, positions, slowmo, snapFrom }) {
  const g = useRef();
  const from = useRef(null), to = useRef(new THREE.Vector3()), t = useRef(1), arc = useRef(0), long = useRef(false);
  const spin = useRef(), roll = useRef();
  const goalOf = () => {
    if (ball.at === 'held') { const p = positions.current[ball.pid]; return p ? new THREE.Vector3(p.x, CUBE + 0.18 + p.y, p.z) : null; }
    if (ball.at === 'dead') return null;
    const [x, , z] = sq(ball.col, ball.row);
    return new THREE.Vector3(x, ball.at === 'air' ? 1.6 : 0.14, z);
  };
  const sig = ball.at === 'held' ? `h${ball.pid}` : `${ball.at}${ball.col},${ball.row}`;
  useEffect(() => {
    const goal = goalOf();
    if (!goal || !g.current) return;
    // the snap: the ball comes out of the center's hands, not out of thin air
    const hiker = !g.current.visible && snapFrom && ball.at === 'held' ? positions.current[snapFrom] : null;
    from.current = hiker ? new THREE.Vector3(hiker.x, CUBE * 0.55, hiker.z) : g.current.position.clone();
    to.current = goal;
    const d = from.current.distanceTo(goal);
    t.current = settings().calm || d < 0.05 ? 1 : 0;
    arc.current = Math.min(4.5, d * 0.35);
    long.current = d >= 7.5 && slowmo;
  }, [sig]);
  useFrame((_, dt) => {
    if (!g.current) return;
    const goal = goalOf();
    if (!goal) { g.current.visible = false; return; }
    g.current.visible = true;
    if (t.current < 1 && from.current) {
      // a long throw hangs: slow motion through the top of the arc (fast off the hand, fast into the hands)
      const dur = long.current ? 2.2 : 0.25 + from.current.distanceTo(to.current) * 0.06;
      t.current = Math.min(1, t.current + dt / dur);
      const k = long.current ? t.current + (0.8 * Math.sin(2 * Math.PI * t.current)) / (2 * Math.PI) : t.current;
      const prev = g.current.position.clone();
      g.current.position.lerpVectors(from.current, goal, k);
      g.current.position.y += Math.sin(k * Math.PI) * arc.current;
      // a spiral: nose along the flight path, spinning round its long axis
      const vel = g.current.position.clone().sub(prev);
      if (vel.lengthSq() > 1e-8) spin.current.lookAt(g.current.position.clone().add(vel)); // world point ahead of the ball
      roll.current.rotation.z += dt * (long.current ? 14 : 22);
    } else {
      g.current.position.copy(goal);
      if (ball.at === 'air') g.current.position.y += Math.sin(performance.now() / 300) * 0.08;
      // at rest / carried: lying along the field, laces up
      spin.current.rotation.set(0, 0, 0);
      roll.current.rotation.z *= 0.9;
    }
    positions.current.__ball = g.current.position;
  });
  const target = ball.at === 'air' ? sq(ball.col, ball.row) : null;
  return (
    <>
      <group ref={g}>
        <group ref={spin}>
          <group ref={roll}>
            <mesh castShadow scale={[0.17, 0.17, 0.27]}>
              <sphereGeometry args={[1, 24, 16]} />
              <meshStandardMaterial color="#7a3f1c" roughness={0.55} />
            </mesh>
            {/* the white stripes near each end, and the laces along the top */}
            {[0.17, -0.17].map((z) => (
              <mesh key={z} position={[0, 0, z]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.136, 0.136, 0.022, 24, 1, true]} /><meshStandardMaterial color="#f2efe6" side={THREE.DoubleSide} /></mesh>
            ))}
            <mesh position={[0, 0.17, 0]}><boxGeometry args={[0.024, 0.02, 0.16]} /><meshStandardMaterial color="#f7f4ec" /></mesh>
            {[-0.06, -0.03, 0, 0.03, 0.06].map((z) => (
              <mesh key={z} position={[0, 0.168, z]}><boxGeometry args={[0.085, 0.02, 0.016]} /><meshStandardMaterial color="#f7f4ec" /></mesh>
            ))}
          </group>
        </group>
      </group>
      {target && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[target[0], 0.03, target[2]]}>
          <ringGeometry args={[0.28, 0.45, 32]} />
          <meshBasicMaterial color="#ff2b2b" toneMapped={false} />
        </mesh>
      )}
    </>
  );
}

// ---------- particles: debris on a big hit, confetti on a touchdown ----------
function Burst({ at, colors, count = 40, confetti }) {
  const ref = useRef();
  const tmp = useMemo(() => new THREE.Object3D(), []);
  const parts = useMemo(() => Array.from({ length: count }, () => ({
    p: new THREE.Vector3(0, confetti ? 1.2 : 0.5, 0),
    v: new THREE.Vector3((Math.random() - 0.5) * (confetti ? 4 : 5), confetti ? 2.5 + Math.random() * 2.5 : 2 + Math.random() * 4, (Math.random() - 0.5) * (confetti ? 4 : 5)),
    r: new THREE.Euler(Math.random() * 6, Math.random() * 6, 0), s: confetti ? 0.09 : 0.05 + Math.random() * 0.07,
  })), [count, confetti]);
  const col = useMemo(() => new THREE.Color(), []);
  useLayoutEffect(() => {
    parts.forEach((_, i) => ref.current?.setColorAt(i, col.set(colors[i % colors.length])));
    if (ref.current?.instanceColor) ref.current.instanceColor.needsUpdate = true;
  }, [parts, colors, col]);
  useFrame((_, dt) => {
    if (!ref.current) return;
    parts.forEach((q, i) => {
      q.v.y -= (confetti ? 2.6 : 9) * dt;
      if (confetti) { q.v.x *= 0.98; q.v.z *= 0.98; }
      q.p.addScaledVector(q.v, dt);
      if (q.p.y < 0.02) { q.p.y = 0.02; q.v.multiplyScalar(0.3); }
      q.r.x += dt * 6; q.r.y += dt * 4;
      tmp.position.copy(q.p); tmp.rotation.copy(q.r); tmp.scale.setScalar(q.s); tmp.updateMatrix();
      ref.current.setMatrixAt(i, tmp.matrix);
    });
    ref.current.instanceMatrix.needsUpdate = true;
  });
  return (
    <group position={at}>
      <instancedMesh ref={ref} args={[null, null, count]} raycast={() => null}>
        <boxGeometry args={[1, confetti ? 0.15 : 1, 1]} />
        <meshStandardMaterial roughness={0.6} />
      </instancedMesh>
      {!confetti && <pointLight color="#ffd27a" intensity={6} distance={4} decay={2} position={[0, 0.8, 0]} />}
    </group>
  );
}

// ---------- a sack: a ring of dust kicked up round the passer ----------
function Dust({ at }) {
  const ref = useRef();
  const tmp = useMemo(() => new THREE.Object3D(), []);
  const n = 34;
  const parts = useMemo(() => Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2 + Math.random() * 0.2;
    return { a, sp: 1.6 + Math.random() * 1.4, up: 0.4 + Math.random() * 0.8, s: 0.12 + Math.random() * 0.12 };
  }), []);
  const t = useRef(0);
  useFrame((_, dt) => {
    if (!ref.current) return;
    t.current += dt;
    const k = 1 - Math.exp(-t.current * 2.2);
    parts.forEach((q, i) => {
      const r = 0.3 + q.sp * k;
      tmp.position.set(Math.cos(q.a) * r, 0.08 + q.up * k * Math.exp(-t.current * 1.2), Math.sin(q.a) * r);
      tmp.scale.setScalar(q.s * (1 + k * 1.8));
      tmp.rotation.set(t.current * 2, q.a, 0);
      tmp.updateMatrix();
      ref.current.setMatrixAt(i, tmp.matrix);
    });
    ref.current.instanceMatrix.needsUpdate = true;
    ref.current.material.opacity = Math.max(0, 0.85 - t.current * 0.38);
  });
  return (
    <group position={at}>
      <instancedMesh ref={ref} args={[null, null, n]} raycast={() => null}>
        <icosahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color="#b49a72" roughness={1} transparent opacity={0.85} depthWrite={false} />
      </instancedMesh>
    </group>
  );
}

// ---------- the opening run-out ----------
// Both teams pour out of tunnels under the end-zone stands and line up across their own 35s, through smoke.
const ease = (u) => u * u * (3 - 2 * u);
export function RunOut({ teams, unis, rows, t0, startAt }) {
  const group = useRef();
  const squads = useMemo(() => teams.map((roster, side) => {
    const tunnelZ = side === 0 ? 14.2 : -14.2;
    const lineZ = side === 0 ? 3.2 : -3.2;
    return roster.map((p, i) => ({
      key: `${side}:${p.num}`, side, num: p.num,
      from: new THREE.Vector3((i % 2 ? 1 : -1) * 0.4, 0, tunnelZ),
      to: new THREE.Vector3((i - (roster.length - 1) / 2) * 1.3, 0, lineZ),
      delay: 0.35 + i * 0.32 + side * 0.15, dur: 2.4 + Math.random() * 0.4, hop: 3 + Math.random() * 2,
    }));
  }).flat(), [teams]);
  const refs = useRef({});
  const [smoke, setSmoke] = useState(false); // the smoke bursts when the run-out starts, not under the title card
  useFrame(() => {
    const rel = (performance.now() - t0) / 1000 - startAt;
    if (!smoke && rel > 0) setSmoke(true);
    for (const q of squads) {
      const o = refs.current[q.key];
      if (!o) continue;
      const u = Math.min(1, Math.max(0, (rel - q.delay) / q.dur));
      o.visible = rel >= q.delay;
      const k = ease(u);
      o.position.lerpVectors(q.from, q.to, k);
      o.position.y = u < 1 ? Math.abs(Math.sin(u * Math.PI * q.hop)) * 0.28 : 0;
      o.rotation.y = Math.PI / 2 + (u < 1 ? Math.sin(u * 20) * 0.12 : 0);
    }
  });
  return (
    <group ref={group}>
      {squads.map((q) => (
        <group key={q.key} ref={(o) => { refs.current[q.key] = o; }} visible={false}>
          <PlayerCube uniform={unis[q.side]} row={rows[q.side][q.num] ?? 0} />
        </group>
      ))}
      {/* tunnel mouths: dark arches under the stands, with smoke */}
      {[14.4, -14.4].map((z, i) => (
        <group key={z} position={[0, 0, z]}>
          <mesh position={[0, 0.9, i ? -0.4 : 0.4]}><boxGeometry args={[3.2, 1.8, 0.8]} /><meshStandardMaterial color="#0d0f13" /></mesh>
          {smoke && <Burst confetti at={[0, 0, i ? 0.8 : -0.8]} colors={['#9aa0a6', '#c8ccd0', '#6f757b']} count={60} />}
        </group>
      ))}
    </group>
  );
}
// camera for the run-out: low at the home tunnel, sweep along the field, crane up to the wide shot
function introCam(rel) {
  const keys = [
    [0, [3.2, 1.0, 16.5], [0, 0.6, 12.5]],
    [2.6, [5.5, 2.2, 9], [0, 0.4, 4]],
    [5.0, [11, 6.5, 1.5], [0, 0, 0]],
    [7.6, [15, 12, 0.5], [0, 0, 0]],
  ];
  let i = 0;
  while (i < keys.length - 2 && rel > keys[i + 1][0]) i++;
  const [ta, pa, la] = keys[i], [tb, pb, lb] = keys[i + 1];
  const u = ease(Math.min(1, Math.max(0, (rel - ta) / (tb - ta))));
  const lerp = (a, b) => a.map((v, k) => v + (b[k] - v) * u);
  return { pos: new THREE.Vector3(...lerp(pa, pb)), target: new THREE.Vector3(...lerp(la, lb)), rate: 6 };
}

// ---------- highlights ----------
// tiles: [{ sq:[c,r], color, value }]. One instanced mesh, so hundreds of pass squares stay cheap.
function Tiles({ tiles, onPick, onHover }) {
  const ref = useRef();
  const tmp = useMemo(() => new THREE.Object3D(), []);
  const col = useMemo(() => new THREE.Color(), []);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    tiles.forEach((t, i) => {
      const [x, , z] = sq(t.sq[0], t.sq[1]);
      tmp.position.set(x, 0.015, z); tmp.rotation.set(-Math.PI / 2, 0, 0); tmp.updateMatrix();
      m.setMatrixAt(i, tmp.matrix);
      m.setColorAt(i, col.set(t.color));
    });
    m.count = tiles.length;
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.computeBoundingSphere();
  }, [tiles, tmp, col]);
  // clicks land on one invisible plane over the field and are turned into a square (cheaper and surer than
  // raycasting hundreds of instances)
  const byKey = useMemo(() => new Map(tiles.map((t) => [`${t.sq[0]},${t.sq[1]}`, t])), [tiles]);
  const tileAt = (e) => byKey.get(`${Math.floor(e.point.x + COLS / 2)},${Math.floor(e.point.z + ROWS / 2)}`) ?? null;
  if (!tiles.length) return null;
  const bucket = Math.ceil(tiles.length / 400);
  return (
    <>
      <instancedMesh key={bucket} ref={ref} args={[null, null, bucket * 400]} raycast={() => null}>
        <planeGeometry args={[0.9, 0.9]} />
        <meshBasicMaterial transparent opacity={0.5} toneMapped={false} depthWrite={false} />
      </instancedMesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}
        onClick={(e) => { const t = tileAt(e); if (t) { e.stopPropagation(); onPick?.(t); } }}
        onPointerMove={(e) => onHover?.(tileAt(e))}
        onPointerOut={() => onHover?.(null)}>
        <planeGeometry args={[COLS, ROWS]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
      </mesh>
    </>
  );
}

// ---------- camera ----------
const VIEW = {
  free: (f) => ({ pos: [f.x + 12.5, 9, f.z + 0.5], target: [f.x - 0.5, 0, f.z - 0.3] }), // only used if 'free' has no controls yet
  broadcast: (f) => ({ pos: [f.x + 12.5, 9, f.z + 0.5], target: [f.x - 0.5, 0, f.z - 0.3] }),
  endzone: (f, dir) => ({ pos: [f.x, 7.5, f.z - dir * 11], target: [f.x, 0, f.z + dir * 2] }),
  overhead: (f) => ({ pos: [f.x + 0.01, 25, f.z], target: [f.x, 0, f.z] }),
  low: (f) => ({ pos: [f.x + 6, 1.2, f.z + 2.5], target: [f.x - 1, 0.6, f.z - 0.5] }),
};
export const VIEWS = [['broadcast', 'Broadcast'], ['endzone', 'End zone'], ['overhead', 'Overhead'], ['low', 'Field level'], ['free', 'Free']];

// the cinematic camera for a shot (see game/shots.js): { pos, target, rate } or null
function shotCam(shot, positions) {
  const now = (performance.now() - shot.t0) / 1000, p = Math.min(1, now / shot.dur);
  if (shot.kind === 'throw') {
    const a = new THREE.Vector3(...sq(...shot.from)), b = new THREE.Vector3(...sq(...shot.to));
    const dirv = b.clone().sub(a).setY(0).normalize();
    const side = new THREE.Vector3(-dirv.z, 0, dirv.x);
    const ball = positions.current.__ball ? positions.current.__ball.clone() : a.clone();
    if (p < 0.62) {
      // chase cam: behind and above the ball, looking where it's going
      return { pos: ball.clone().addScaledVector(dirv, -3.6).addScaledVector(side, 1.2).setY(Math.max(1.6, ball.y + 1.6)), target: ball.clone().addScaledVector(dirv, 2.5), rate: 7 };
    }
    // low lens at the target square, the catch (or not) in frame
    return { pos: b.clone().addScaledVector(side, 3).addScaledVector(dirv, -1.4).setY(0.9), target: b.clone().setY(0.6), rate: 5 };
  }
  if (shot.kind === 'hit') {
    const c = new THREE.Vector3(...sq(...shot.at));
    const shake = Math.max(0, 1 - now / 0.6) * (shot.big ? 0.22 : 0.12);
    const j = () => (Math.random() - 0.5) * shake;
    return { pos: c.clone().add(new THREE.Vector3(2.4 + j(), 1.5 + j(), 1.3 + j())), target: c.clone().setY(0.4), rate: 12 };
  }
  if (shot.kind === 'sack') {
    // low and slow: the camera creeps in at turf level while the dust settles
    const c = new THREE.Vector3(...sq(...shot.at));
    const push = 1 - Math.min(1, now / shot.dur) * 0.45;
    return { pos: c.clone().add(new THREE.Vector3(2.6 * push, 0.5 + 0.3 * push, -1.8 * push)), target: c.clone().setY(0.35), rate: 3.2 };
  }
  if (shot.kind === 'td') {
    const c = new THREE.Vector3(...sq(...shot.at));
    const ang = 0.4 + p * Math.PI * 1.1;
    return { pos: c.clone().add(new THREE.Vector3(Math.cos(ang) * 4.2, 1.8 + p * 1.5, Math.sin(ang) * 4.2)), target: c.clone().setY(0.6), rate: 4 };
  }
  return null;
}

function Rig({ view, focus, dir, shot, positions, intro }) {
  const { camera, size, controls } = useThree();
  const target = useRef(new THREE.Vector3(0, 0, 6));
  const f = useRef(new THREE.Vector3(0, 0, 6));
  useFrame((_, dt) => {
    const sc = intro ? introCam((performance.now() - intro.t0) / 1000 - intro.startAt) : shot ? shotCam(shot, positions) : null;
    if (sc) {
      const k = 1 - Math.exp(-dt * sc.rate);
      camera.position.lerp(sc.pos, k);
      target.current.lerp(sc.target, k);
      camera.lookAt(target.current);
      controls?.target.copy(target.current);
      return;
    }
    // free camera: the mouse has it (OrbitControls); just remember where it's looking for when a preset takes over
    if (view === 'free') { if (controls) target.current.copy(controls.target); return; }
    const goal = focus();
    const kf = 1 - Math.exp(-dt * 1.6);
    if (goal) f.current.lerp(new THREE.Vector3(Math.max(-3, Math.min(3, goal.x * 0.4)), 0, goal.z), kf);
    const s = VIEW[view](f.current, dir);
    // tall screens (phones held upright): pull the lens back so the play still fits across
    const aspect = size.width / size.height;
    if (aspect < 1.2) {
      const back = Math.min(1.9, 1.2 / aspect);
      for (let i = 0; i < 3; i++) s.pos[i] = s.target[i] + (s.pos[i] - s.target[i]) * back;
    }
    const k = settings().calm ? 1 : 1 - Math.exp(-dt * 2.6);
    camera.position.lerp(new THREE.Vector3(...s.pos), k);
    target.current.lerp(new THREE.Vector3(...s.target), k);
    camera.lookAt(target.current);
    controls?.target.copy(target.current);
  });
  return null;
}

// ---------- the scene ----------
// edit: { side, spots:[{num,col,row}] } shows a formation being placed instead of that side's real positions
export function Board({ game, view, tiles, onTile, onHover, rings = {}, onPlayer, edit, focusSq, shot, intro, onFree }) {
  const s = game.state;
  const positions = useRef({});
  const unis = useMemo(() => s.teams.map((t) => uniformOf(t.id, t.uniform)), [s.teams]);
  const rows = useMemo(() => [0, 1].map((side) => artRows(s, side)), [s.teams]); // eslint-disable-line react-hooks/exhaustive-deps
  // the last move of each player, so his cube walks the same path
  const paths = {};
  for (const e of s.log) if (e.kind === 'move' && e.path) paths[e.pid] = e.path;
  const players = Object.values(s.players).map((p) => {
    if (edit && p.side === edit.side) {
      const sp = edit.spots.find((x) => x.num === p.num);
      return sp ? { ...p, col: sp.col, row: sp.row, down: false } : { ...p, col: null };
    }
    return p;
  }).filter((p) => p.col != null);
  // grabbing the camera (a real drag, not a click on a square) switches to the free camera
  const drag = useRef(null);
  useEffect(() => {
    const move = (e) => {
      const d = drag.current;
      if (!d || shot || intro) return;
      if (d.x == null) { d.x = e.clientX; d.y = e.clientY; return; }
      if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 6 && view !== 'free') { drag.current = null; onFree?.(); }
    };
    const wheel = (e) => { if (e.target?.tagName === 'CANVAS' && !shot && !intro && view !== 'free') onFree?.(); };
    window.addEventListener('pointermove', move);
    window.addEventListener('wheel', wheel, { passive: true });
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('wheel', wheel); };
  }, [shot, intro, view, onFree]);
  const lineZ = s.line - ROWS / 2;
  const showLine = s.phase !== 'setup' && s.phase !== 'over';
  const focus = () => {
    if (focusSq) { const [x, , z] = sq(...focusSq); return { x, z }; }
    if (s.ball.at === 'held') return positions.current[s.ball.pid] ?? null;
    if (s.ball.at === 'ground' || s.ball.at === 'air') { const [x, , z] = sq(s.ball.col, s.ball.row); return { x, z }; }
    return { x: (s.spot - 6) * 1, z: lineZ };
  };
  return (
    <>
      <Lights />
      <Field />
      {showLine && (
        <>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, lineZ]}>
            <planeGeometry args={[13, 0.08]} />
            <meshBasicMaterial color="#3d8bff" transparent opacity={0.85} toneMapped={false} />
          </mesh>
          <DownCube down={s.down} position={[8.2, 0, lineZ]} size={0.85} />
        </>
      )}
      {intro && <RunOut teams={[0, 1].map((side) => Object.values(s.players).filter((p) => p.side === side))} unis={unis} rows={rows} t0={intro.t0} startAt={intro.startAt} />}
      {!intro && players.map((p) => (
        <Mover key={p.pid} p={p} uniform={unis[p.side]} row={rows[p.side][p.num]} path={paths[p.pid]} positions={positions}
          ring={rings[p.pid]} onPick={onPlayer} />
      ))}
      <Ball ball={s.ball} positions={positions} slowmo={!settings().calm} snapFrom={s.log.findLast?.((e) => e.kind === 'snap')?.from} />
      {shot?.kind === 'hit' && <Burst key={shot.id} at={sq(...shot.at, 0)} colors={['#c9c9c9', '#7a5a3a', '#3f6b2a', '#ffffff']} count={shot.big ? 46 : 26} />}
      {shot?.kind === 'sack' && <Dust key={shot.id} at={sq(...shot.at, 0)} />}
      {shot?.kind === 'td' && <Burst key={shot.id} confetti at={sq(...shot.at, 0)} colors={teamColors(s.teams[shot.side].id, s.teams[shot.side].uniform).concat(['#f5e04a', '#ffffff'])} count={120} />}
      <DiceRolls log={s.log} players={s.players} offense={s.offense} home={[s.spot, s.line]}
        teamColors={s.teams.map((t) => teamColors(t.id, t.uniform))} />
      <Tiles tiles={tiles} onPick={onTile} onHover={onHover} />
      <OrbitControls makeDefault enableDamping dampingFactor={0.12} enabled={!shot && !intro} maxPolarAngle={Math.PI / 2.1} minDistance={2.5} maxDistance={45}
        onStart={() => { drag.current = { x: null, y: null }; }} onEnd={() => { drag.current = null; }} />
      <Rig view={view} focus={focus} dir={s.teams[s.offense].dir} shot={shot} positions={positions} intro={intro} />
    </>
  );
}
