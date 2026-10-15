// A player is a cube: number on top, the player standing on every side (the printed pixelblock nets).
// Knocked down = tipped onto its side, just like the tabletop rule.
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { downMaterials, playerMaterials } from './textures';

export const CUBE = 0.8; // in squares

const damp = (a, b, rate, dt) => a + (b - a) * (1 - Math.exp(-rate * dt));

export function PlayerCube({ uniform, row, position = [0, 0, 0], facing = 0, down = false, spin = 0, size = CUBE, onClick }) {
  const mats = useMemo(() => playerMaterials(uniform, row), [uniform, row]);
  const ref = useRef();
  const tip = useRef(down ? 1 : 0);
  const quarter = useRef(0);
  const local = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ camera }, dt) => {
    const g = ref.current;
    if (!g) return;
    // keep the number readable: turn the top face in quarter steps so it's upright from the camera
    local.copy(camera.position);
    g.worldToLocal(local);
    const q = ((Math.round(Math.atan2(-local.x, local.z) / (Math.PI / 2)) % 4) + 4) % 4;
    if (q !== quarter.current) { quarter.current = q; mats[2].map.rotation = -q * (Math.PI / 2); }
    tip.current = damp(tip.current, down ? 1 : 0, 9, dt);
    const t = tip.current;
    // tip over the front-bottom edge: rotate about x, keeping the cube resting on the turf
    g.rotation.x = t * Math.PI / 2;
    g.position.y = size / 2 + Math.sin(t * Math.PI) * size * 0.2;
    if (spin) g.parent.rotation.y += spin * dt;
  });
  return (
    <group position={position} rotation={[0, facing, 0]}>
      <mesh ref={ref} material={mats} castShadow receiveShadow onClick={onClick} position={[0, size / 2, 0]}>
        <boxGeometry args={[size, size, size]} />
      </mesh>
    </group>
  );
}

// down marker cube: the current down on every side. A new down gives it a quarter turn, and the number changes as
// it turns (once it's past halfway), like flipping the marker on the sideline.
export function DownCube({ down = 1, position = [0, 0, 0], size = CUBE }) {
  const sets = useMemo(() => downMaterials(), []);
  const ref = useRef();
  const st = useRef({ down, shown: down, goal: 0 });
  if (st.current.down !== down) { st.current.down = down; st.current.goal -= Math.PI / 2; }
  useFrame((_, dt) => {
    const m = ref.current;
    if (!m) return;
    const c = st.current;
    m.rotation.y = damp(m.rotation.y, c.goal, 7, dt);
    if (c.shown !== c.down && Math.abs(c.goal - m.rotation.y) < Math.PI / 4) c.shown = c.down;
    const want = sets[Math.min(3, Math.max(0, c.shown - 1))];
    if (m.material !== want) m.material = want;
  });
  const mats = sets[Math.min(3, Math.max(0, down - 1))];
  return (
    <mesh ref={ref} material={mats} position={[position[0], size / 2 + (position[1] ?? 0), position[2]]} castShadow>
      <boxGeometry args={[size, size, size]} />
    </mesh>
  );
}
