// The live game on the 3D field: cubes that walk their paths, the ball (carried, loose or hanging in the air),
// the line of scrimmage, the down cube, clickable square highlights and the camera.
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { Field, Lights, sq, ROWS, COLS } from './Field';
import { PlayerCube, DownCube, CUBE } from './Cube';
import { uniformOf, rosterFor, teamColors } from '../data/art';
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
function Ball({ ball, positions, slowmo }) {
  const g = useRef();
  const from = useRef(null), to = useRef(new THREE.Vector3()), t = useRef(1), arc = useRef(0), long = useRef(false);
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
    from.current = g.current.position.clone();
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
      g.current.position.lerpVectors(from.current, goal, k);
      g.current.position.y += Math.sin(k * Math.PI) * arc.current;
      g.current.rotation.z += dt * 12;
    } else {
      g.current.position.copy(goal);
      if (ball.at === 'air') g.current.position.y += Math.sin(performance.now() / 300) * 0.08;
    }
    positions.current.__ball = g.current.position;
  });
  const target = ball.at === 'air' ? sq(ball.col, ball.row) : null;
  return (
    <>
      <group ref={g}>
        <mesh castShadow scale={[0.17, 0.17, 0.27]}>
          <sphereGeometry args={[1, 20, 14]} />
          <meshStandardMaterial color="#7a3f1c" roughness={0.6} />
        </mesh>
        <mesh scale={[0.175, 0.175, 0.04]} position={[0, 0, 0.12]}><sphereGeometry args={[1, 16, 8]} /><meshStandardMaterial color="#f2efe6" /></mesh>
        <mesh scale={[0.175, 0.175, 0.04]} position={[0, 0, -0.12]}><sphereGeometry args={[1, 16, 8]} /><meshStandardMaterial color="#f2efe6" /></mesh>
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
  broadcast: (f) => ({ pos: [f.x + 12.5, 9, f.z + 0.5], target: [f.x - 0.5, 0, f.z - 0.3] }),
  endzone: (f, dir) => ({ pos: [f.x, 7.5, f.z - dir * 11], target: [f.x, 0, f.z + dir * 2] }),
  overhead: (f) => ({ pos: [f.x + 0.01, 25, f.z], target: [f.x, 0, f.z] }),
  low: (f) => ({ pos: [f.x + 6, 1.2, f.z + 2.5], target: [f.x - 1, 0.6, f.z - 0.5] }),
};
export const VIEWS = [['broadcast', 'Broadcast'], ['endzone', 'End zone'], ['overhead', 'Overhead'], ['low', 'Field level']];

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
  if (shot.kind === 'td') {
    const c = new THREE.Vector3(...sq(...shot.at));
    const ang = 0.4 + p * Math.PI * 1.1;
    return { pos: c.clone().add(new THREE.Vector3(Math.cos(ang) * 4.2, 1.8 + p * 1.5, Math.sin(ang) * 4.2)), target: c.clone().setY(0.6), rate: 4 };
  }
  return null;
}

function Rig({ view, focus, dir, shot, positions }) {
  const { camera, size } = useThree();
  const target = useRef(new THREE.Vector3(0, 0, 6));
  const f = useRef(new THREE.Vector3(0, 0, 6));
  useFrame((_, dt) => {
    const sc = shot ? shotCam(shot, positions) : null;
    if (sc) {
      const k = 1 - Math.exp(-dt * sc.rate);
      camera.position.lerp(sc.pos, k);
      target.current.lerp(sc.target, k);
      camera.lookAt(target.current);
      return;
    }
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
  });
  return null;
}

// ---------- the scene ----------
// edit: { side, spots:[{num,col,row}] } shows a formation being placed instead of that side's real positions
export function Board({ game, view, tiles, onTile, onHover, rings = {}, onPlayer, edit, focusSq, shot }) {
  const s = game.state;
  const positions = useRef({});
  const unis = useMemo(() => s.teams.map((t) => uniformOf(t.id, t.uniform)), [s.teams]);
  const rows = useMemo(() => s.teams.map((t) => Object.fromEntries(rosterFor(t.id, t.uniform).map((p) => [p.num, p.row]))), [s.teams]);
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
      {players.map((p) => (
        <Mover key={p.pid} p={p} uniform={unis[p.side]} row={rows[p.side][p.num]} path={paths[p.pid]} positions={positions}
          ring={rings[p.pid]} onPick={onPlayer} />
      ))}
      <Ball ball={s.ball} positions={positions} slowmo={!settings().calm} />
      {shot?.kind === 'hit' && <Burst key={shot.id} at={sq(...shot.at, 0)} colors={['#c9c9c9', '#7a5a3a', '#3f6b2a', '#ffffff']} count={shot.big ? 46 : 26} />}
      {shot?.kind === 'td' && <Burst key={shot.id} confetti at={sq(...shot.at, 0)} colors={teamColors(s.teams[shot.side].id, s.teams[shot.side].uniform).concat(['#f5e04a', '#ffffff'])} count={120} />}
      <DiceRolls log={s.log} players={s.players} offense={s.offense} home={[s.spot, s.line]}
        teamColors={s.teams.map((t) => teamColors(t.id, t.uniform))} />
      <Tiles tiles={tiles} onPick={onTile} onHover={onHover} />
      <Rig view={view} focus={focus} dir={s.teams[s.offense].dir} shot={shot} positions={positions} />
    </>
  );
}
