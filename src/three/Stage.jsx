// A Canvas with the house defaults (shadows, sRGB, soft tone mapping) and a loading fallback.
import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';

export function Stage({ children, camera, className = '', style, frameloop = 'always' }) {
  return (
    <div className={`stage ${className}`} style={style}>
      <Canvas shadows dpr={[1, 2]} frameloop={frameloop} camera={{ fov: 40, near: 0.1, far: 400, position: [12, 10, 0], ...camera }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, outputColorSpace: THREE.SRGBColorSpace }}>
        <Suspense fallback={null}>{children}</Suspense>
      </Canvas>
    </div>
  );
}
