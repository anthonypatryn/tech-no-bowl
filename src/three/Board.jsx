// The live game on the 3D field: cubes that walk their paths, the ball (carried, loose or hanging in the air),
// the line of scrimmage, the down cube, clickable square highlights and the camera.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { Field, Lights, sq, ROWS, COLS } from './Field';
import { PlayerCube, DownCube, CUBE } from './Cube';
import { uniformOf, teamColors, artRows } from '../data/art';
import { DiceRolls } from './Dice';
import { Stadium, TUNNEL_Z } from './Stadium';
import { Telestrator } from './Telestrator';
import { settings } from '../game/prefs';

const SPEED = 6.5; // squares per second when walking

// ---------- players ----------
// p: { pid, side, num, col, row, down }. path: the squares of the move that brought him here (if any)
// lunge: { id, to:[c,r], side } = he throws himself at that square (a block, tackle...): out and back, with a hop.
//   side = a juke / shake: he cuts hard to one side instead.
// jump: { id, delay } = a leap (going up for a catch) after `delay` seconds
// orbit: { id, pts:[[x,z]] } = walk round someone (a spin move), turning a full circle on the way
// pile: { id, at:[x,z], level, delay, jx, jz, tilt:[rx,ry,rz] } = leap onto the pile after the whistle and stay there
function Mover({ p, uniform, row, path, positions, ring, onPick, onHover, lunge, active, colors, jump, orbit, pile, skilled, solid = true, tag = null }) {
  const g = useRef();
  const pos = useRef(null);
  const queue = useRef([]);
  const hop = useRef(0);
  const lg = useRef({ id: null, t: 1, d: new THREE.Vector3() });
  useEffect(() => {
    if (!lunge || lunge.id === lg.current.id || settings().calm) return;
    const [x, , z] = sq(lunge.to[0], lunge.to[1]);
    const d = new THREE.Vector3(x, 0, z).sub(pos.current ?? new THREE.Vector3(x, 0, z)).setY(0);
    if (d.lengthSq() > 0) d.normalize();
    if (lunge.side) { const sgn = lunge.id % 2 ? 1 : -1; d.set(-d.z * sgn, 0, d.x * sgn); } // a juke cuts sideways
    lg.current = { id: lunge.id, t: 0, d, amp: lunge.side ? 0.9 : 0.62 };
  }, [lunge?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const jp = useRef({ id: null, t0: 0 });
  useEffect(() => { if (jump && jump.id !== jp.current.id && !settings().calm) jp.current = { id: jump.id, t0: performance.now() + jump.delay * 1000 }; }, [jump?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const pl = useRef({ id: null });
  useEffect(() => {
    if (!pile) { pl.current = { id: null }; return; }
    if (pile.id !== pl.current.id && !settings().calm) pl.current = { ...pile, t0: performance.now() + pile.delay * 1000, from: null };
  }, [pile?.id, !!pile]); // eslint-disable-line react-hooks/exhaustive-deps
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
  // after the move above: a spin move swaps squares the long way round
  const sp = useRef({ id: null, t: 1 });
  useLayoutEffect(() => {
    if (!orbit || orbit.id === sp.current.id || settings().calm) return;
    sp.current = { id: orbit.id, t: 0 };
    queue.current = orbit.pts.map(([x, z]) => new THREE.Vector3(x, 0, z));
  }, [orbit?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useFrame((_, dt) => {
    if (!pos.current || !g.current) return;
    const q = queue.current;
    if (q.length) {
      const next = q[0];
      const d = pos.current.distanceTo(next);
      const step = SPEED * dt;
      if (d <= step) { pos.current.copy(next); q.shift(); hop.current = 0; } else { pos.current.lerp(next, step / d); hop.current += dt * SPEED; }
    }
    const now = performance.now();
    // the pile: once his leap starts he's off the field's grid until the next down resets everyone
    const P = pl.current;
    if (P.id && now >= P.t0) {
      const u = Math.min(1, (now - P.t0) / 560);
      P.from ??= g.current.position.clone();
      const to = new THREE.Vector3(P.at[0] + P.jx, CUBE * P.level, P.at[1] + P.jz);
      const e = u * u * (3 - 2 * u);
      g.current.position.lerpVectors(P.from, to, e);
      g.current.position.y += Math.sin(u * Math.PI) * 1.15;
      g.current.rotation.set(P.tilt[0] * e, P.tilt[1] * e, P.tilt[2] * e);
      positions.current[p.pid] = g.current.position;
      return;
    }
    let ox = 0, oz = 0, oy = 0;
    const L = lg.current;
    if (L.t < 1) {
      L.t = Math.min(1, L.t + dt / 0.7);
      // wind up a touch, burst in hard, settle back
      const k = L.t < 0.18 ? -0.25 * Math.sin((L.t / 0.18) * Math.PI / 2) : Math.sin(((L.t - 0.18) / 0.82) * Math.PI) * (1 - 0.15 * L.t);
      ox = L.d.x * k * L.amp; oz = L.d.z * k * L.amp; oy = Math.max(0, k) * 0.22;
    }
    // going up for the ball
    const J = jp.current;
    if (J.id && now >= J.t0 && now < J.t0 + 750) oy += Math.sin(((now - J.t0) / 750) * Math.PI) * 0.95;
    // the spin: a full turn while he goes round
    const S = sp.current;
    if (S.t < 1) S.t = Math.min(1, S.t + dt / 0.65);
    g.current.rotation.set(0, S.t < 1 ? S.t * Math.PI * 2 : 0, 0);
    g.current.position.set(pos.current.x + ox, (q.length ? Math.abs(Math.sin(hop.current * Math.PI)) * 0.12 : 0) + oy, pos.current.z + oz);
    positions.current[p.pid] = g.current.position;
  });
  return (
    <group ref={g} onPointerOver={onHover ? (e) => { e.stopPropagation(); onHover(p.pid); } : undefined} onPointerOut={onHover ? () => onHover(null) : undefined}>
      <PlayerCube uniform={uniform} row={row} facing={Math.PI / 2} down={p.down} label={p.artNum != null && p.artNum !== p.num ? p.num : null} labelColors={colors}
        onClick={onPick ? (e) => { e.stopPropagation(); onPick(p.pid); } : undefined} pickable={solid} />
      {active && <TurnMarker colors={colors} />}
      {skilled && !active && !p.down && <AbilityGem />}
      {tag != null && <Html position={[0, 1.3, 0]} center zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}><b className="field-key">{tag}</b></Html>}
      {ring && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} raycast={() => null}>
          <ringGeometry args={[0.5, 0.6, 32]} />
          <meshBasicMaterial color={ring} transparent opacity={0.95} toneMapped={false} />
        </mesh>
      )}
      {p.onFire && <Flames />}
    </group>
  );
}

// ---------- whose turn: a glowing diamond in his team's colours bobbing over his head (like the Sims' plumbob) ----------
function TurnMarker({ colors = ['#39ff6a', '#ffffff'] }) {
  const ref = useRef();
  useFrame(() => {
    if (!ref.current) return;
    const t = performance.now() / 1000;
    ref.current.position.y = 1.45 + Math.sin(t * 3) * 0.08;
    ref.current.rotation.y = t * 1.8;
  });
  return (
    <group ref={ref}>
      <mesh scale={[0.16, 0.3, 0.16]} raycast={() => null}>
        <octahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color={colors[0]} emissive={colors[0]} emissiveIntensity={0.9} roughness={0.25} flatShading toneMapped={false} />
      </mesh>
      {/* a trim-coloured edge so a dark team colour still reads against the night sky */}
      <mesh scale={[0.19, 0.34, 0.19]} raycast={() => null}>
        <octahedronGeometry args={[1, 0]} />
        <meshBasicMaterial color={colors[1]} wireframe toneMapped={false} />
      </mesh>
      <pointLight color={colors[0]} intensity={1.6} distance={2.2} decay={2} />
    </group>
  );
}

// a small gold gem over a player with a special ability (rules modes with abilities), so you can see who has one
function AbilityGem() {
  const ref = useRef();
  useFrame(() => { if (ref.current) { const t = performance.now() / 1000; ref.current.rotation.y = t * 1.2; ref.current.position.y = 1.08 + Math.sin(t * 2.2) * 0.03; } });
  return (
    <mesh ref={ref} scale={[0.08, 0.13, 0.08]} raycast={() => null}>
      <octahedronGeometry args={[1, 0]} />
      <meshStandardMaterial color="#ffb000" emissive="#ffb000" emissiveIntensity={0.8} roughness={0.3} flatShading toneMapped={false} />
    </mesh>
  );
}

// ---------- the fun bits, read off the log ----------
// jump: the receiver of the newest catch leaps as the ball gets there. orbit: the newest spin move goes round the
// tackler. pile: when a play ends in a tackle or a sack, the tackler and up to three more of his team (dogpilers
// first) leap on top of the downed ball carrier, one after another, and stay stacked until the next down.
const hash = (str) => { let h = 7; for (const ch of String(str)) h = (h * 31 + ch.charCodeAt(0)) % 100003; return h / 100003; };
function moveFx(s) {
  const log = s.log;
  const jump = {}, orbit = {}, pile = {};
  const lastDown = log.findLastIndex((e) => e.kind === 'down' || e.kind === 'formation');
  for (let i = log.length - 1; i > Math.max(lastDown, log.length - 10); i--) {
    const e = log[i];
    if (e.kind === 'catch' && !jump[e.pid] && e.to) {
      const passer = s.players[e.from];
      const [ax, , az] = passer?.col != null ? sq(passer.col, passer.row) : sq(...e.to);
      const [bx, , bz] = sq(...e.to);
      const d = Math.hypot(bx - ax, bz - az);
      jump[e.pid] = { id: e.id, delay: Math.max(0, (d >= 7.5 && !settings().calm ? 2.2 : 0.25 + d * 0.06) - 0.42) };
    }
    if (e.kind === 'spin' && !orbit[e.pid] && e.from && e.to) {
      const [ax, , az] = sq(...e.from), [bx, , bz] = sq(...e.to);
      const cx = (ax + bx) / 2, cz = (az + bz) / 2, vx = ax - cx, vz = az - cz;
      const pts = [];
      for (let k = 1; k <= 6; k++) {
        const th = (k / 6) * Math.PI, r = 1 + 1.1 * Math.sin(th); // round the outside of the tackler
        pts.push([cx + (vx * Math.cos(th) - vz * Math.sin(th)) * r, cz + (vx * Math.sin(th) + vz * Math.cos(th)) * r]);
      }
      orbit[e.pid] = { id: e.id, pts };
    }
  }
  // the pile
  const end = log.findLastIndex((e) => e.kind === 'tackle' || e.kind === 'sack');
  if (end > lastDown) {
    const e = log[end];
    const c = s.players[e.pid];
    if (c?.col != null) {
      const [x, , z] = sq(c.col, c.row);
      const by = s.players[e.by];
      const side = by?.side ?? 1 - c.side;
      const dogs = log.slice(end).filter((x2) => x2.kind === 'dogpile').map((x2) => x2.pid);
      const near = Object.values(s.players).filter((q) => q.side === side && !q.down && q.col != null && Math.max(Math.abs(q.col - c.col), Math.abs(q.row - c.row)) <= 2)
        .sort((a, b) => Math.hypot(a.col - c.col, a.row - c.row) - Math.hypot(b.col - c.col, b.row - c.row)).map((q) => q.pid);
      const crew = [...new Set([e.by, ...dogs, ...near].filter((pid) => pid && s.players[pid] && pid !== c.pid))].slice(0, 4);
      crew.forEach((pid, k) => {
        const h = hash(pid + e.id), h2 = hash(e.id + pid + 'z');
        pile[pid] = { id: e.id, at: [x, z], level: k + 1, delay: 0.25 + k * 0.32, jx: (h - 0.5) * 0.24, jz: (h2 - 0.5) * 0.24,
          tilt: [(h2 - 0.5) * 0.5, (h - 0.5) * 1.6, (hash(pid) - 0.5) * 0.5] };
      });
    }
  }
  return { jump, orbit, pile };
}

// ---------- ON FIRE: 8-bit flames licking up off the cube ----------
const FIRE = ['#ff2a00', '#ff6a00', '#ffb000', '#ffe14a'];
export function Flames({ n = 22, size = 1, height = 1.25 }) {
  const ref = useRef();
  const tmp = useMemo(() => new THREE.Object3D(), []);
  const col = useMemo(() => new THREE.Color(), []);
  const parts = useMemo(() => Array.from({ length: n }, (_, i) => ({ a: Math.random() * Math.PI * 2, r: 0.2 + Math.random() * 0.25, t: i / n, sp: 0.7 + Math.random() * 0.6, s: 0.08 + Math.random() * 0.07 })), [n]);
  useLayoutEffect(() => {
    parts.forEach((_, i) => ref.current?.setColorAt(i, col.set(FIRE[i % FIRE.length])));
    if (ref.current?.instanceColor) ref.current.instanceColor.needsUpdate = true;
  }, [parts, col]);
  const light = useRef();
  useFrame((_, dt) => {
    if (!ref.current) return;
    parts.forEach((q, i) => {
      q.t = (q.t + dt * q.sp) % 1;
      const k = q.t;
      tmp.position.set(Math.cos(q.a + k * 2) * q.r * (1 - k * 0.6) * size, (0.15 + k * height) * size, Math.sin(q.a + k * 2) * q.r * (1 - k * 0.6) * size);
      tmp.scale.setScalar(q.s * (1 - k) * size * 1.6);
      tmp.rotation.set(0, q.a, 0);
      tmp.updateMatrix();
      ref.current.setMatrixAt(i, tmp.matrix);
    });
    ref.current.instanceMatrix.needsUpdate = true;
    if (light.current) light.current.intensity = 2.2 + Math.sin(performance.now() / 70) * 0.6;
  });
  return (
    <group>
      <instancedMesh ref={ref} args={[null, null, n]} raycast={() => null}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial toneMapped={false} transparent opacity={0.92} />
      </instancedMesh>
      <pointLight ref={light} color="#ff7a1a" intensity={2.4} distance={2.6 * size} decay={2} position={[0, 0.9 * size, 0]} />
    </group>
  );
}

// ---------- a spin / juke / interception: a ring of streaks whipping round ----------
function Swirl({ at, color = '#ffffff' }) {
  const ref = useRef();
  const t = useRef(0);
  useFrame((_, dt) => {
    if (!ref.current) return;
    t.current += dt;
    ref.current.rotation.y += dt * 9;
    const k = Math.min(1, t.current / 1.2);
    ref.current.scale.setScalar(0.6 + k * 0.9);
    ref.current.children.forEach((m) => { m.material.opacity = Math.max(0, 0.9 - k); });
  });
  return (
    <group position={at}>
      <group ref={ref}>
        {Array.from({ length: 10 }, (_, i) => {
          const a = (i / 10) * Math.PI * 2;
          return (
            <mesh key={i} position={[Math.cos(a) * 0.75, 0.25 + (i % 3) * 0.22, Math.sin(a) * 0.75]} rotation={[0, -a, 0]} raycast={() => null}>
              <boxGeometry args={[0.05, 0.05, 0.45]} />
              <meshBasicMaterial color={color} transparent opacity={0.9} toneMapped={false} />
            </mesh>
          );
        })}
      </group>
    </group>
  );
}

// ---------- goal posts (PRO / ALL PRO): one set past each end line ----------
function GoalPosts() {
  const y = '#f2d21b';
  return [-1, 1].map((d) => (
    <group key={d} position={[0, 0, d * (ROWS / 2 + 0.35)]}>
      <mesh position={[0, 0.55, 0]}><cylinderGeometry args={[0.06, 0.06, 1.1, 10]} /><meshStandardMaterial color={y} /></mesh>
      <mesh position={[0, 1.1, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.05, 0.05, 1.9, 10]} /><meshStandardMaterial color={y} /></mesh>
      {[-0.95, 0.95].map((x) => <mesh key={x} position={[x, 2.1, 0]}><cylinderGeometry args={[0.045, 0.045, 2, 10]} /><meshStandardMaterial color={y} /></mesh>)}
    </group>
  ));
}

// ---------- a field goal: the ball end over end from the kick spot. Good: through the posts and on into the stands'
// direction, landing and bouncing. No good: wide of an upright and gone, or (at random) off the post: DOINK.
const POST_Z = ROWS / 2 + 0.35, POST_X = 0.95, BAR_Y = 1.1;
function kickPath(shot) {
  const a = new THREE.Vector3(...sq(...shot.from)).setY(0.15);
  const dz = shot.dir * POST_Z;
  const r = hash(`kick${shot.id}`);
  const doink = !shot.good && r < 0.45;
  const sideX = shot.good ? (r - 0.5) * 0.9 : (r < 0.72 ? 1 : -1) * (doink ? POST_X : POST_X + 0.7 + r * 0.8);
  const atPost = new THREE.Vector3(sideX, doink ? BAR_Y + 0.6 + r : 2.6, dz);
  return { a, atPost, doink, out: new THREE.Vector3(sideX * (doink ? 1 : 1.5), 0.12, dz + shot.dir * 7) };
}
function KickBall({ shot }) {
  const g = useRef();
  const tum = useRef();
  const path = useMemo(() => kickPath(shot), [shot]);
  const bounceBack = useMemo(() => path.atPost.clone().add(new THREE.Vector3(Math.sign(path.atPost.x || 1) * 1.6, -path.atPost.y + 0.12, -shot.dir * 2.6)), [path, shot]);
  useFrame(() => {
    if (!g.current) return;
    const t = (performance.now() - shot.t0) / 1000 - 0.5; // the kick: half a second in
    g.current.visible = t >= 0;
    if (t < 0) return;
    const { a, atPost, out, doink } = path;
    const T1 = 1.5; // kick to the posts
    const pos = g.current.position;
    let spinning = true;
    if (t < T1) {
      const u = t / T1;
      pos.lerpVectors(a, atPost, u);
      pos.y = a.y + (atPost.y - a.y) * u + Math.sin(u * Math.PI * 0.82) * 3.4;
    } else if (!doink) {
      // through (or past) and on, coming down and skipping along the ground
      const u = Math.min(1, (t - T1) / 1.1);
      pos.lerpVectors(atPost, out, u);
      pos.y = atPost.y * (1 - u) * (1 - u) + Math.abs(Math.sin(u * Math.PI * 2.2)) * 0.5 * (1 - u) + 0.12;
      spinning = u < 0.9;
    } else {
      // DOINK: off the upright, back towards the field, a couple of bounces
      const u = Math.min(1, (t - T1) / 1.2);
      pos.lerpVectors(atPost, bounceBack, u);
      pos.y = Math.max(0.12, atPost.y * (1 - u) + Math.abs(Math.sin(u * Math.PI * 2.5)) * 0.7 * (1 - u));
      spinning = u < 0.85;
    }
    if (tum.current && spinning) tum.current.rotation.x += doink && t > T1 ? -0.5 : 0.35;
    shot.ball = pos;
  });
  return (
    <group ref={g} visible={false}>
      <group ref={tum}>
        <mesh castShadow scale={[0.17, 0.17, 0.27]}><sphereGeometry args={[1, 18, 12]} /><meshStandardMaterial color="#7a3f1c" roughness={0.55} /></mesh>
      </group>
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
  // a layout effect: it must set up the flight before the next frame draws, or that frame snaps the ball straight to
  // its new holder and there's no flight left to show (the "teleporting" throw)
  useLayoutEffect(() => {
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
    const tunnelZ = side === 0 ? TUNNEL_Z - 0.3 : -(TUNNEL_Z - 0.3);
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
      {/* smoke out of the tunnels (built into the stadium's end-zone stands) */}
      {[TUNNEL_Z, -TUNNEL_Z].map((z, i) => (
        <group key={z} position={[0, 0, z]}>
          {smoke && <Burst confetti at={[0, 0, i ? 0.5 : -0.5]} colors={['#9aa0a6', '#c8ccd0', '#6f757b']} count={60} />}
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
      tmp.position.set(x, 0.015, z); tmp.rotation.set(-Math.PI / 2, 0, 0); tmp.scale.setScalar(t.size ?? 1); tmp.updateMatrix();
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

// the edge of a set of squares (a throwing range), drawn as a line round it
function Outline({ squares, color }) {
  const geo = useMemo(() => {
    const set = new Set(squares.map(([c, r]) => `${c},${r}`));
    const pts = [];
    const x0 = (c) => c - COLS / 2, z0 = (r) => r - ROWS / 2;
    for (const [c, r] of squares) {
      if (!set.has(`${c},${r - 1}`)) pts.push(x0(c), 0.03, z0(r), x0(c + 1), 0.03, z0(r));
      if (!set.has(`${c},${r + 1}`)) pts.push(x0(c), 0.03, z0(r + 1), x0(c + 1), 0.03, z0(r + 1));
      if (!set.has(`${c - 1},${r}`)) pts.push(x0(c), 0.03, z0(r), x0(c), 0.03, z0(r + 1));
      if (!set.has(`${c + 1},${r}`)) pts.push(x0(c + 1), 0.03, z0(r), x0(c + 1), 0.03, z0(r + 1));
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    return g;
  }, [squares]);
  return <lineSegments geometry={geo} raycast={() => null}><lineBasicMaterial color={color} transparent opacity={0.85} toneMapped={false} /></lineSegments>;
}

// ---------- camera ----------
const VIEW = {
  free: (f) => ({ pos: [f.x + 12.5, 9, f.z + 0.5], target: [f.x - 0.5, 0, f.z - 0.3] }), // only used if 'free' has no controls yet
  broadcast: (f) => ({ pos: [f.x + 12.5, 9, f.z + 0.5], target: [f.x - 0.5, 0, f.z - 0.3] }),
  endzone: (f, dir) => ({ pos: [f.x, 7.5, f.z - dir * 11], target: [f.x, 0, f.z + dir * 2] }),
  overhead: (f) => ({ pos: [f.x + 2.4, 25, f.z], target: [f.x, 0, f.z] }), // a slight lean from the broadcast side
  low: (f) => ({ pos: [f.x + 6, 1.2, f.z + 2.5], target: [f.x - 1, 0.6, f.z - 0.5] }),
  follow: (f) => ({ pos: [f.x + 7.5, 6, f.z + 1.5], target: [f.x - 0.3, 0, f.z - 0.2] }), // close on whoever's turn it is
};
export const VIEWS = [['broadcast', 'Broadcast'], ['follow', 'Follow'], ['endzone', 'End zone'], ['overhead', 'Overhead'], ['low', 'Field level'], ['free', 'Free']];

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
    return { pos: c.clone().add(new THREE.Vector3(3.2 + j(), 2 + j(), 1.8 + j())), target: c.clone().setY(0.4), rate: 8 };
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
  if (shot.kind === 'onfire') {
    // tight, low, circling: the flames catch
    const c = new THREE.Vector3(...sq(...shot.at));
    const ang = -0.6 + p * Math.PI * 0.9;
    return { pos: c.clone().add(new THREE.Vector3(Math.cos(ang) * 2.4, 0.9 + p * 0.8, Math.sin(ang) * 2.4)), target: c.clone().setY(0.7), rate: 5 };
  }
  if (shot.kind === 'skill') {
    // snap to a 3/4 angle and push in a little
    const c = new THREE.Vector3(...sq(...shot.at));
    const push = 1 - Math.min(1, now / shot.dur) * 0.25;
    return { pos: c.clone().add(new THREE.Vector3(3.6 * push, 2.1 * push, 2.2 * push)), target: c.clone().setY(0.5), rate: 6 };
  }
  if (shot.kind === 'kick') {
    // low behind the kicker, looking down the field at the posts, then riding up after the ball
    const a = new THREE.Vector3(...sq(...shot.from));
    const posts = new THREE.Vector3(0, 2, shot.dir * (ROWS / 2 + 0.4));
    const ball = shot.ball ? shot.ball.clone() : a.clone();
    if (now < 1.2) return { pos: a.clone().add(new THREE.Vector3(0.8, 0.8, -shot.dir * 3)), target: posts, rate: 6 };
    return { pos: ball.clone().add(new THREE.Vector3(1.6, 1.2, -shot.dir * 3.2)), target: posts.clone().lerp(ball, 0.3), rate: 4 };
  }
  return null;
}

function Rig({ view, focus, dir, shot, positions, intro, setup }) {
  const { camera, size, controls, gl } = useThree();
  const target = useRef(new THREE.Vector3(0, 0, 6));
  const f = useRef(new THREE.Vector3(0, 0, 6));
  // the cards + prompt cover the bottom of the screen (a lot of it on a phone): shift the picture up so what the camera
  // looks at sits in the middle of the part you can still see. --bottom-h is measured by GameView.
  const lift = useRef({ b: -1, t: 0 });
  useFrame(() => {
    const now = performance.now();
    if (now - lift.current.t < 300) return;
    lift.current.t = now;
    const game = gl.domElement.closest('.game');
    const cine = !game || game.classList.contains('cine');
    const raw = cine ? 0 : parseFloat(game.style.getPropertyValue('--lift-h')) || 0;
    const b = Math.round(Math.min(raw, size.height * 0.6) * 0.8);
    const k = `${b}:${size.width}x${size.height}`;
    if (k === lift.current.b) return;
    lift.current.b = k;
    if (b > 8) camera.setViewOffset(size.width, size.height + b, 0, b, size.width, size.height);
    else camera.clearViewOffset();
    camera.updateProjectionMatrix();
  });
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
    if (goal) f.current.lerp(new THREE.Vector3(view === 'follow' ? goal.x : Math.max(-3, Math.min(3, goal.x * 0.4)), 0, goal.z), kf);
    // setting a formation: pull back wide enough to see everyone on the field round the ball
    const s = setup && view !== 'free' && view !== 'overhead' ? { pos: [f.current.x + 17, 14, f.current.z + 0.5], target: [f.current.x - 0.5, 0, f.current.z] } : VIEW[view](f.current, dir);
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
// pickable: the players the pointer can land on (null = everyone); the rest let it through to the squares under them
export function Board({ game, view, tiles, onTile, onHover, onHoverPlayer, outlines = [], rings = {}, onPlayer, edit, focusSq, shot, intro, onFree, setup, pickable = null, tags = {}, camShot = true, tele = null, epoch = 'live' }) {
  const s = game.state;
  const positions = useRef({});
  const unis = useMemo(() => s.teams.map((t) => uniformOf(t.id, t.uniform)), [s.teams]);
  const rows = useMemo(() => [0, 1].map((side) => artRows(s, side)), [s.teams]); // eslint-disable-line react-hooks/exhaustive-deps
  const tcolors = useMemo(() => s.teams.map((t) => { const [a, b] = teamColors(t.id, t.uniform); return [a, b ?? '#ffffff']; }), [s.teams]);
  // the last move of each player, so his cube walks the same path
  const paths = {};
  for (const e of s.log) if ((e.kind === 'move' || e.kind === 'motion') && e.path) paths[e.pid] = e.path; // motion walks too
  // the newest contact: that player lunges at his target (a juke / shake cuts to the side)
  const lunges = {};
  for (let i = s.log.length - 1; i >= Math.max(0, s.log.length - 8); i--) {
    const e = s.log[i];
    if (e.kind === 'check' && e.tat && e.pid) { lunges[e.pid] = { id: e.id, to: e.tat, side: e.action === 'juke' || e.action === 'shake' }; break; }
  }
  const fx = useMemo(() => moveFx(s), [s.log.length, s.log.at(-1)?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  // the crowd in the stands jumps on the big moments
  const roar = useRef(0);
  const lastKind = s.log.at(-1)?.kind;
  useEffect(() => { if (['td', 'turnover', 'sack', 'catch', 'fieldgoal', 'safety', 'onfire', 'intercept'].includes(lastKind)) roar.current = 1; }, [s.log.at(-1)?.id]); // eslint-disable-line react-hooks/exhaustive-deps
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
    // Follow: the player whose turn it is (then the ball as usual)
    if (view === 'follow' && s.active?.pid && positions.current[s.active.pid]) return positions.current[s.active.pid];
    if (s.ball.at === 'held') return positions.current[s.ball.pid] ?? null;
    if (s.ball.at === 'ground' || s.ball.at === 'air') { const [x, , z] = sq(s.ball.col, s.ball.row); return { x, z }; }
    return { x: (s.spot - 6) * 1, z: lineZ };
  };
  return (
    <>
      <Lights />
      <Field />
      <Stadium colors={tcolors.map((c) => c[0])} roar={roar} crowd={settings().fieldHi} />
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
        // a new epoch (a replay starting or ending) remounts the cubes, so they appear in place instead of sliding there
        <Mover key={`${p.pid}:${epoch}`} p={p} uniform={unis[p.side]} row={rows[p.side][p.num]} path={paths[p.pid]} positions={positions}
          ring={rings[p.pid]} onPick={onPlayer} onHover={onHoverPlayer} lunge={lunges[p.pid]} active={s.active?.pid === p.pid && s.phase === 'play'} colors={tcolors[p.side]}
          jump={fx.jump[p.pid]} orbit={fx.orbit[p.pid]} pile={fx.pile[p.pid]}
          skilled={!!s.skills && (p.abilities?.some((a) => s.inferno || !a.startsWith('INFERNO')) || !!p.fuego)} solid={!pickable || pickable.has(p.pid)} tag={tags[p.pid] ?? null} />
      ))}
      <Ball key={epoch} ball={s.ball} positions={positions} slowmo={!settings().calm} snapFrom={s.log.findLast?.((e) => e.kind === 'snap')?.from} />
      {shot?.kind === 'hit' && <Burst key={shot.id} at={sq(...shot.at, 0)} colors={['#c9c9c9', '#7a5a3a', '#3f6b2a', '#ffffff']} count={shot.big ? 46 : 26} />}
      {shot?.kind === 'sack' && <Dust key={shot.id} at={sq(...shot.at, 0)} />}
      {(s.mode === 'pro' || s.mode === 'allpro') && <GoalPosts />}
      {shot?.kind === 'kick' && <KickBall key={shot.id} shot={shot} />}
      {shot?.kind === 'kick' && shot.good && <Burst key={`k${shot.id}`} confetti at={[0, 2.4, shot.dir * (ROWS / 2 + 0.4)]} colors={['#f2d21b', '#ffffff', '#ffb000']} count={70} />}
      {shot?.kind === 'onfire' && <group key={shot.id} position={sq(...shot.at, 0)}><Flames n={60} size={1.8} height={1.6} /><Burst at={[0, 0, 0]} colors={FIRE} count={40} /></group>}
      {shot?.kind === 'skill' && shot.fx === 'fire' && <group key={shot.id} position={sq(...shot.at, 0)}><Flames n={40} size={1.4} /><Burst at={[0, 0, 0]} colors={FIRE} count={36} /></group>}
      {shot?.kind === 'skill' && shot.fx === 'swirl' && <Swirl key={shot.id} at={sq(...shot.at, 0)} color="#ffe14a" />}
      {shot?.kind === 'skill' && shot.fx === 'spark' && <Burst key={shot.id} at={sq(...shot.at, 0)} colors={['#ffffff', '#ffe14a', '#c9c9c9']} count={34} />}
      {shot?.kind === 'skill' && shot.fx === 'dust' && <Dust key={shot.id} at={sq(...shot.at, 0)} />}
      {shot?.kind === 'td' && <Burst key={shot.id} confetti at={sq(...shot.at, 0)} colors={teamColors(s.teams[shot.side].id, s.teams[shot.side].uniform).concat(['#f5e04a', '#ffffff'])} count={120} />}
      <DiceRolls log={s.log} players={s.players} offense={s.offense} home={[s.spot, s.line]}
        teamColors={s.teams.map((t) => teamColors(t.id, t.uniform))} teamNames={s.teams.map((t) => t.name)} />
      <Tiles tiles={tiles} onPick={onTile} onHover={onHover} />
      {tele && <Telestrator marks={tele.marks} shown={tele.shown} />}
      {/* number keys for squares (push, scatter): press the number or click the square */}
      {tiles.filter((t) => t.label).map((t) => { const [x, , z] = sq(t.sq[0], t.sq[1]); return <Html key={`k${t.sq}`} position={[x, 0.05, z]} center zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}><b className="field-key">{t.label}</b></Html>; })}
      {outlines.map((o, i) => <Outline key={i} squares={o.squares} color={o.color} />)}
      <OrbitControls makeDefault enableDamping dampingFactor={0.12} enabled={!(shot && camShot) && !intro} maxPolarAngle={Math.PI / 2.1} minDistance={2.5} maxDistance={45}
        onStart={() => { drag.current = { x: null, y: null }; }} onEnd={() => { drag.current = null; }} />
      <Rig view={view} focus={focus} dir={s.teams[s.offense].dir} shot={camShot ? shot : null} positions={positions} intro={intro} setup={setup} />
    </>
  );
}
