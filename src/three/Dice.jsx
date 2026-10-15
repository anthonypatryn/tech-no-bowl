// Real dice on the field: every roll in the game (skill checks, sport checks, scatter, who-goes-first) is thrown in
// from the camera's side next to the player rolling, bounces, and settles on the faces the engine rolled.
// The result is decided by the engine; the toss just lands on it.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { sq } from './Field';
import { settings } from '../game/prefs';

// faces: +y 1, -y 6, +x 2, -x 5, +z 3, -z 4 (opposites add to 7)
const FACES = [
  { v: 1, n: [0, 1, 0], u: [0, 0, -1] }, { v: 6, n: [0, -1, 0], u: [0, 0, 1] },
  { v: 2, n: [1, 0, 0], u: [0, 1, 0] }, { v: 5, n: [-1, 0, 0], u: [0, 1, 0] },
  { v: 3, n: [0, 0, 1], u: [0, 1, 0] }, { v: 4, n: [0, 0, -1], u: [0, 1, 0] },
].map((f) => ({ ...f, n: new THREE.Vector3(...f.n), u: new THREE.Vector3(...f.u) }));
const PIPS = { 1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]], 5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]] };

const texCache = new Map();
function pipTexture(v, pip) {
  const k = `${v}${pip}`;
  if (texCache.has(k)) return texCache.get(k);
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = pip;
  for (const [x, y] of PIPS[v]) { g.beginPath(); g.arc(64 + x * 32, 64 + y * 32, 13, 0, Math.PI * 2); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  texCache.set(k, t);
  return t;
}

const Y = new THREE.Vector3(0, 1, 0);
// the rotation that leaves face f on top, upright towards the camera (+x), turned by `yaw`
function restingQuat(f, yaw) {
  const local = new THREE.Matrix4().makeBasis(new THREE.Vector3().crossVectors(f.u, f.n), f.u, f.n);
  const world = new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 0, -1), new THREE.Vector3(-1, 0, 0), Y);
  return new THREE.Quaternion().setFromRotationMatrix(world.multiply(local.transpose())).premultiply(new THREE.Quaternion().setFromAxisAngle(Y, yaw));
}

function Die({ value, body = '#f4f0e6', pip = '#c21d24', at, from, delay = 0, size = 0.62 }) {
  const ref = useRef();
  const st = useMemo(() => {
    const f = FACES.find((x) => x.v === value) ?? FACES[0];
    return {
      target: restingQuat(f, (Math.random() - 0.5) * 0.8),
      axis: new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.4, Math.random() - 0.5).normalize(),
      spin: Math.PI * (6 + Math.random() * 3), dur: 1.0 + Math.random() * 0.25, t: -delay,
    };
  }, [value, delay]);
  useFrame((_, dt) => {
    const o = ref.current;
    if (!o) return;
    st.t = settings().calm ? 1 : Math.min(1, st.t + dt / st.dur);
    const t = Math.max(0, st.t);
    const slide = 1 - Math.pow(1 - t, 2.6), turn = 1 - Math.pow(1 - t, 3.2);
    o.quaternion.copy(st.target).premultiply(new THREE.Quaternion().setFromAxisAngle(st.axis, st.spin * (1 - turn)));
    o.position.set(from[0] + (at[0] - from[0]) * slide, size / 2 + 1.3 * Math.exp(-4 * t) * Math.abs(Math.sin(Math.PI * 3.2 * Math.pow(t, 0.75))), from[2] + (at[2] - from[2]) * slide);
    o.visible = st.t >= 0;
  });
  return (
    <group ref={ref}>
      <RoundedBox args={[size, size, size]} radius={size * 0.16} smoothness={4} castShadow>
        <meshStandardMaterial color={body} roughness={0.35} />
      </RoundedBox>
      {FACES.map((f) => {
        const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3().crossVectors(f.u, f.n), f.u, f.n));
        return (
          <mesh key={f.v} position={f.n.clone().multiplyScalar(size / 2 + 0.002)} quaternion={q}>
            <planeGeometry args={[size * 0.86, size * 0.86]} />
            <meshStandardMaterial map={pipTexture(f.v, pip)} transparent roughness={0.4} polygonOffset polygonOffsetFactor={-1} />
          </mesh>
        );
      })}
    </group>
  );
}

const ROLL_KINDS = ['check', 'sport', 'scatter', 'dice'];
const SHOW_MS = 2600;

// watches the log and throws the dice for the newest roll, beside whoever rolled
export function DiceRolls({ log, players, teamColors, offense, home }) {
  const last = useMemo(() => [...log].reverse().find((e) => ROLL_KINDS.includes(e.kind) && e.dice), [log]);
  const [roll, setRoll] = useState(null);
  useEffect(() => {
    if (!last) return;
    const p = last.pid ? players[last.pid] : null;
    const spot = last.kind === 'scatter' ? last.from : p ? [p.col, p.row] : home; // who-goes-first: at the ball
    const [x, , z] = spot ? sq(spot[0], spot[1]) : [0, 0, 0];
    // land just towards the camera (+x side) of the action, a die-width apart; thrown in from further out
    const at = [x + 1.1, 0, z];
    const colors = last.kind === 'scatter' || last.kind === 'dice'
      ? [offense, 1 - offense].map((side) => ({ body: teamColors[side][0], pip: teamColors[side][1] })).slice(0, last.dice.length)
      : last.kind === 'sport' ? [{ body: '#f4f0e6', pip: '#1b1b1b' }, { body: '#f4f0e6', pip: '#1b1b1b' }] : [{}, {}];
    setRoll({ id: last.id, at, dice: last.dice, colors: last.dice.map((_, i) => colors[i] ?? {}) });
    const t = setTimeout(() => setRoll((r) => (r?.id === last.id ? null : r)), SHOW_MS);
    return () => clearTimeout(t);
  }, [last?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!roll) return null;
  return (
    <group key={roll.id}>
      {roll.dice.map((v, i) => {
        const at = [roll.at[0] + (i % 2) * 0.3, 0, roll.at[2] + (i - (roll.dice.length - 1) / 2) * 0.85];
        const from = [at[0] + 3.2, 0, at[2] + (Math.random() - 0.5) * 1.5];
        return <Die key={i} value={v} at={at} from={from} delay={i * 0.06} {...roll.colors[i]} />;
      })}
    </group>
  );
}
