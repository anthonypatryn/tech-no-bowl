// The stadium round the field, built of blocks to match the cubes: tall stands along the far sideline, low ones on
// the broadcast side (the camera sits up over them), end-zone stands with the players' tunnels built in, a crowd of
// little cubes in both teams' colours that bobs (and jumps when the crowd roars), light towers at the corners.
// World units: the field art covers x ±7.4, z ±13; the tunnels open at z ±14.6 (the run-out comes out of them).
import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const CONCRETE = '#2a2f38', SEAT = '#1b1f27', TRIM = '#3a414d';
export const TUNNEL_Z = 14.6;

// a stand: `tiers` steps rising away from the field. dir: which way is "away" (unit vector on the ground)
function tiersOf({ x0, x1, z0, z1, tiers, rise = 0.5, depth = 0.85, away }) {
  const out = [];
  for (let k = 0; k < tiers; k++) {
    const h = (k + 1) * rise, off = k * depth;
    if (away[0]) out.push({ pos: [away[0] > 0 ? x0 + off + depth / 2 : x0 - off - depth / 2, h / 2, (z0 + z1) / 2], size: [depth, h, Math.abs(z1 - z0)], top: h, k });
    else out.push({ pos: [(x0 + x1) / 2, h / 2, away[1] > 0 ? z0 + off + depth / 2 : z0 - off - depth / 2], size: [Math.abs(x1 - x0), h, depth], top: h, k });
  }
  return out;
}

function Crowd({ seats, colors, roar }) {
  const ref = useRef();
  const tmp = useMemo(() => new THREE.Object3D(), []);
  const col = useMemo(() => new THREE.Color(), []);
  useLayoutEffect(() => {
    seats.forEach((s, i) => ref.current?.setColorAt(i, col.set(colors[s.c % colors.length])));
    if (ref.current?.instanceColor) ref.current.instanceColor.needsUpdate = true;
  }, [seats, colors, col]);
  useFrame(() => {
    if (!ref.current) return;
    const t = performance.now() / 1000;
    if (roar) roar.current *= 0.985; // a roar dies down
    const cheer = roar?.current ?? 0;
    seats.forEach((s, i) => {
      const hop = Math.max(0, Math.sin(t * (2 + s.r * 3) + s.r * 20)) * (0.05 + cheer * 0.22);
      tmp.position.set(s.x, s.y + 0.16 + hop, s.z);
      tmp.scale.set(0.26, 0.32, 0.26);
      tmp.updateMatrix();
      ref.current.setMatrixAt(i, tmp.matrix);
    });
    ref.current.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[null, null, seats.length]} raycast={() => null}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial roughness={0.8} />
    </instancedMesh>
  );
}

export function Stadium({ colors = ['#c62828', '#1565c0'], roar, crowd = true }) {
  const stands = useMemo(() => [
    // the far sideline: tall
    ...tiersOf({ x0: -8.4, z0: -13.6, z1: 13.6, tiers: 7, away: [-1, 0] }),
    // the broadcast side: low (the camera looks over it)
    ...tiersOf({ x0: 8.4, z0: -13.6, z1: 13.6, tiers: 3, away: [1, 0] }),
    // the end zones, either side of the tunnel
    ...[1, -1].flatMap((d) => [[-9.2, -1.7], [1.7, 9.2]].flatMap(([a, b]) => tiersOf({ x0: a, x1: b, z0: d * TUNNEL_Z, tiers: 5, away: [0, d] }))),
  ], []);
  // a seat on top of each tier, every ~0.55 along it
  const seats = useMemo(() => {
    const out = [];
    let n = 0;
    for (const s of stands) {
      const along = s.size[0] > s.size[2] ? 0 : 2, len = s.size[along];
      const count = Math.floor(len / 0.55);
      for (let i = 0; i < count; i++) {
        const u = (i + 0.5) / count - 0.5;
        const p = [...s.pos];
        p[along] += u * len;
        const r = ((n++ * 9301 + 49297) % 233280) / 233280;
        out.push({ x: p[0] + (r - 0.5) * 0.1, y: s.top, z: p[2] + (r - 0.5) * 0.1, c: Math.floor(r * 7), r });
      }
    }
    return out;
  }, [stands]);
  const crowdColors = useMemo(() => [colors[0], colors[1], colors[0], colors[1], '#d9d9d9', '#f2d21b', '#3b3f47'], [colors]);
  return (
    <group>
      {stands.map((s, i) => (
        <mesh key={i} position={s.pos} castShadow receiveShadow raycast={() => null}>
          <boxGeometry args={s.size} />
          <meshStandardMaterial color={s.k % 2 ? SEAT : CONCRETE} roughness={0.95} />
        </mesh>
      ))}
      {/* the wall round the field, with team-colour panels */}
      {[[-8.15, 0, 0.12, 27.2], [8.15, 0, 0.12, 27.2]].map(([x, , w, l], i) => (
        <mesh key={`w${i}`} position={[x, 0.3, 0]} raycast={() => null}><boxGeometry args={[w, 0.6, l]} /><meshStandardMaterial color={i ? colors[1] : colors[0]} roughness={0.7} /></mesh>
      ))}
      {[1, -1].map((d) => (
        <group key={d} position={[0, 0, d * TUNNEL_Z]}>
          {/* the tunnel: a dark mouth in the stands, framed, under a lintel */}
          <mesh position={[0, 1.05, d * 0.9]} raycast={() => null}><boxGeometry args={[3.2, 2.1, 1.8]} /><meshStandardMaterial color="#05060a" /></mesh>
          {[-1.75, 1.75].map((x) => <mesh key={x} position={[x, 1.2, d * 0.1]} raycast={() => null}><boxGeometry args={[0.3, 2.4, 0.3]} /><meshStandardMaterial color={TRIM} /></mesh>)}
          <mesh position={[0, 2.45, d * 0.6]} raycast={() => null}><boxGeometry args={[3.8, 0.5, 1.4]} /><meshStandardMaterial color={d > 0 ? colors[0] : colors[1]} roughness={0.6} /></mesh>
          {/* the stand above the tunnel */}
          <mesh position={[0, 2.85, d * 3.2]} raycast={() => null}><boxGeometry args={[3.4, 0.6, 3.8]} /><meshStandardMaterial color={CONCRETE} /></mesh>
        </group>
      ))}
      {/* light towers */}
      {[[-14.5, -16], [-14.5, 16], [12.5, -16], [12.5, 16]].map(([x, z]) => (
        <group key={`${x}${z}`} position={[x, 0, z]}>
          <mesh position={[0, 4.5, 0]} raycast={() => null}><boxGeometry args={[0.25, 9, 0.25]} /><meshStandardMaterial color="#5b6270" /></mesh>
          <mesh position={[0, 9.2, 0]} rotation={[0, Math.atan2(-x, -z), 0]} raycast={() => null}><boxGeometry args={[1.8, 0.9, 0.2]} /><meshStandardMaterial color="#fffbe6" emissive="#fff3c4" emissiveIntensity={1.6} toneMapped={false} /></mesh>
        </group>
      ))}
      {crowd && <Crowd seats={seats} colors={crowdColors} roar={roar} />}
    </group>
  );
}
