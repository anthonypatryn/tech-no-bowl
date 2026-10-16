// A Canvas with the house defaults (shadows, sRGB, soft tone mapping) and a loading fallback.
import { Component, Suspense, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { TOUCH } from '../game/prefs';

export function Stage({ children, camera, className = '', style, frameloop = 'always' }) {
  // the browser can drop the 3D context (low memory, a GPU reset): build a fresh canvas instead of a blank white field
  const [gen, setGen] = useState(0);
  const created = ({ gl, scene }) => {
    if (import.meta.env.DEV) { window.__gl = gl; window.__scene = scene; } // renderer stats and the scene while developing (gl.info.memory)
    gl.domElement.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      console.warn('3D context lost: rebuilding the scene');
      setTimeout(() => setGen((n) => n + 1), 400);
    }, { once: true });
  };
  return (
    <div className={`stage ${className}`} style={style}>
      <Canvas key={gen} onCreated={created} shadows dpr={[1, TOUCH ? 1.5 : 2]} frameloop={frameloop} camera={{ fov: 40, near: 0.1, far: 400, position: [12, 10, 0], ...camera }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, outputColorSpace: THREE.SRGBColorSpace }}>
        <SceneGuard><Suspense fallback={null}>{children}</Suspense></SceneGuard>
      </Canvas>
    </div>
  );
}

// a 3D glitch must never take the whole screen (and the game) down with it: drop the broken frame and try again
class SceneGuard extends Component {
  constructor(props) { super(props); this.state = { err: 0 }; }
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(e) {
    console.error('3D scene error (recovered):', e);
    setTimeout(() => this.setState((st) => ({ failed: false, err: st.err + 1 })), 50);
  }
  render() { return this.state.failed ? null : <group key={this.state.err}>{this.props.children}</group>; }
}
