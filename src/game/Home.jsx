import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Stage } from '../three/Stage';
import { Field, Lights, sq } from '../three/Field';
import { PlayerCube } from '../three/Cube';
import { TEAMS, uniformOf, artUrl } from '../data/art';
import { lineUp } from './formation';
import { settings } from './prefs';

// Home: a slow fly-around of two random teams lined up at the 20, with the menu over it.
export default function Home({ go }) {
  const [a, b] = useMemo(() => {
    const i = Math.floor(Math.random() * TEAMS.length);
    const j = (i + 1 + Math.floor(Math.random() * (TEAMS.length - 1))) % TEAMS.length;
    return [TEAMS[i].id, TEAMS[j].id];
  }, []);
  return (
    <main className="home">
      <Stage className="home-stage" camera={{ position: [14, 6, 10] }}>
        <Lights />
        <Field />
        <Teams offense={a} defense={b} />
        <Orbit />
      </Stage>
      <div className="home-menu">
        <img className="home-logo" src={artUrl('techno-logo.webp')} alt="" />
        <h1 className="led big">TECHNO BOWL</h1>
        <p className="tagline">8-bit tabletop football from the More Fun! League</p>
        <div className="menu-cards">
          <button className="menu-card glass primary" onClick={() => go('teams')}>
            <b>Play vs Computer</b><span>Pick your team, your uniform and the opponent</span>
          </button>
          <button className="menu-card glass" disabled title="Arrives in a later batch">
            <b>Play Online</b><span>Coming soon</span>
          </button>
          <button className="menu-card glass" onClick={() => go('art')}>
            <b>Art Review Board</b><span>Every team, uniform and token</span>
          </button>
          <button className="menu-card glass" onClick={() => go('settings')}>
            <b>Settings</b><span>Text size, motion, field detail</span>
          </button>
        </div>
      </div>
    </main>
  );
}

export function Teams({ offense, defense, offUni, defUni, pro }) {
  const off = useMemo(() => lineUp(offense, offUni, 'offense', { pro }), [offense, offUni, pro]);
  const def = useMemo(() => lineUp(defense, defUni, 'defense', { pro }), [defense, defUni, pro]);
  const uo = uniformOf(offense, offUni);
  const ud = uniformOf(defense, defUni);
  return (
    <group>
      {off.map((p) => <PlayerCube key={`o${p.num}`} uniform={uo} row={p.row} position={sq(...p.sq)} facing={Math.PI / 2} />)}
      {def.map((p) => <PlayerCube key={`d${p.num}`} uniform={ud} row={p.row} position={sq(...p.sq)} facing={Math.PI / 2} />)}
    </group>
  );
}

function Orbit() {
  const t = useRef(0);
  useFrame(({ camera }, dt) => {
    if (!settings().calm) t.current += dt * 0.06;
    const a = t.current + 0.6;
    const target = sq(6, 17);
    camera.position.set(target[0] + Math.cos(a) * 15, 6.5, target[2] + Math.sin(a) * 15);
    camera.lookAt(target[0], 0, target[2]);
  });
  return null;
}
