// A player is a cube: number on top, the player standing on every side (the printed pixelblock nets).
// Knocked down = tipped onto its side, just like the tabletop rule.
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { downMaterials, playerMaterials } from './textures';

export const CUBE = 0.8; // in squares

const damp = (a, b, rate, dt) => a + (b - a) * (1 - Math.exp(-rate * dt));

export function PlayerCube({ uniform, row, position = [0, 0, 0], facing = 0, down = false, spin = 0, size = CUBE, onClick }) {
  const mats = useMemo(() => playerMaterials(uniform, row), [uniform, row]);
  const ref = useRef();
  const tip = useRef(down ? 1 : 0);
  useFrame((_, dt) => {
    const g = ref.current;
    if (!g) return;
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

// down marker cube: turns a quarter per down so the current down faces `face` (default +x: the broadcast camera)
export function DownCube({ down = 1, position = [0, 0, 0], size = CUBE, face = Math.PI / 2 }) {
  const mats = useMemo(() => downMaterials(), []);
  const ref = useRef();
  useFrame((_, dt) => {
    if (!ref.current) return;
    const goal = face - (down - 1) * Math.PI / 2;
    ref.current.rotation.y = damp(ref.current.rotation.y, goal, 7, dt);
  });
  return (
    <mesh ref={ref} material={mats} position={[position[0], size / 2 + (position[1] ?? 0), position[2]]} castShadow>
      <boxGeometry args={[size, size, size]} />
    </mesh>
  );
}
