// The MFL field. World units: 1 = one square (5 yards). The play area (13 x 24 squares, end zones included)
// is centred on the origin: columns run along x, rows along z, row 0 = the blue TECHNO BOWL end zone (-z).
import { useMemo } from 'react';
import * as THREE from 'three';
import { useTexture } from '@react-three/drei';
import { FIELD, artUrl } from '../data/art';
import { settings } from '../game/prefs';

export const COLS = FIELD.cols;
export const ROWS = FIELD.rows;

// centre of square (col, row) in world space
export const sq = (col, row, y = 0) => [col - COLS / 2 + 0.5, y, row - ROWS / 2 + 0.5];

export function Field({ grid = false }) {
  const tex = useTexture(artUrl(settings().fieldHi ? 'field-4k.webp' : 'field-2k.webp'));
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 16;
  // the whole image, scaled so one square = 1 unit, shifted so the play area sits on the origin
  const w = COLS / (FIELD.x1 - FIELD.x0);
  const h = ROWS / (FIELD.y1 - FIELD.y0);
  const cx = (FIELD.x0 + FIELD.x1) / 2;
  const cy = (FIELD.y0 + FIELD.y1) / 2;
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-(cx - 0.5) * w, 0, -(0.5 - cy) * h]} receiveShadow>
        <planeGeometry args={[w, h]} />
        <meshStandardMaterial map={tex} roughness={0.95} />
      </mesh>
      {/* the stadium floor around the field */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial color="#07090c" roughness={1} />
      </mesh>
      {grid && <Grid />}
    </group>
  );
}

// calibration overlay: every square outlined, end zones tinted
function Grid() {
  const geo = useMemo(() => {
    const pts = [];
    for (let c = 0; c <= COLS; c++) pts.push(c - COLS / 2, 0.01, -ROWS / 2, c - COLS / 2, 0.01, ROWS / 2);
    for (let r = 0; r <= ROWS; r++) pts.push(-COLS / 2, 0.01, r - ROWS / 2, COLS / 2, 0.01, r - ROWS / 2);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    return g;
  }, []);
  return (
    <lineSegments geometry={geo}>
      <lineBasicMaterial color="#ff3df0" transparent opacity={0.8} />
    </lineSegments>
  );
}

export function Lights() {
  return (
    <>
      <hemisphereLight args={['#dfe9ff', '#1b2a12', 0.9]} />
      <directionalLight position={[8, 18, 6]} intensity={2.2} castShadow shadow-mapSize={settings().fieldHi ? [2048, 2048] : [1024, 1024]}
        shadow-camera-left={-16} shadow-camera-right={16} shadow-camera-top={16} shadow-camera-bottom={-16} />
    </>
  );
}
