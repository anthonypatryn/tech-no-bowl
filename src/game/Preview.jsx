// Stand-in for the game screen until the rules engine lands (Batches 1-2): both teams lined up at the 20,
// the scoreboard HUD, the down-marker cube and the camera presets, so the look can be judged early.
import { useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { Stage } from '../three/Stage';
import { Field, Lights, sq } from '../three/Field';
import { DownCube } from '../three/Cube';
import { Teams } from './Home';
import { Chips, Kbd } from './ui';
import { teamById, teamColors } from '../data/art';
import { settings } from './prefs';

const VIEWS = [['broadcast', 'Broadcast'], ['endzone', 'End zone'], ['overhead', 'Overhead'], ['low', 'Field level']];
const LOS = sq(6, 17.5); // between rows 17 and 18

const SHOTS = {
  broadcast: { pos: [LOS[0] + 13, 8.5, LOS[2] - 1], target: [LOS[0], 0, LOS[2] - 1.5] },
  endzone: { pos: [LOS[0], 6, LOS[2] + 11], target: [LOS[0], 0, LOS[2] - 3] },
  overhead: { pos: [LOS[0] + 0.01, 24, LOS[2] - 2], target: [LOS[0], 0, LOS[2] - 2] },
  low: { pos: [LOS[0] + 6, 1.1, LOS[2] + 2.5], target: [LOS[0] - 1, 0.6, LOS[2] - 1] },
};

export default function Preview({ match, onExit }) {
  const [view, setView] = useState('broadcast');
  const [down, setDown] = useState(1);
  const { you, cpu } = match;
  const cycle = () => setView((v) => VIEWS[(VIEWS.findIndex(([k]) => k === v) + 1) % VIEWS.length][0]);
  return (
    <div className="game" tabIndex={-1} onKeyDown={(e) => { if (e.key === 'c' || e.key === 'C') cycle(); if (e.key === 'Escape') onExit(); }}>
      <Stage className="game-stage">
        <Lights />
        <Field />
        <Teams offense={you.team} offUni={you.uni} defense={cpu.team} defUni={cpu.uni} />
        <DownCube down={down} position={[COLS_HALF + 1.2, 0, LOS[2]]} size={0.9} />
        <Rig view={view} />
      </Stage>
      <Scoreboard home={you} away={cpu} down={down} />
      <div className="game-bar glass">
        <button className="btn" onClick={onExit}>Exit <Kbd k="Esc" /></button>
        <Chips small value={view} onChange={setView} options={VIEWS} />
        <span className="kh-wrap"><Kbd k="C" /></span>
        <span className="spacer" />
        <span className="muted">Down</span>
        <Chips small value={down} onChange={setDown} options={[1, 2, 3, 4].map((d) => [d, `${d}`])} />
      </div>
      <div className="banner glass">Field preview. The rules engine and real plays arrive in Batches 1–2.</div>
    </div>
  );
}
const COLS_HALF = 6.5;

// eases the camera towards the chosen shot (Long Shot's CameraRig idea, trimmed down for now)
function Rig({ view }) {
  const { camera } = useThree();
  const target = useRef(new THREE.Vector3(...SHOTS.broadcast.target));
  useFrame((_, dt) => {
    const s = SHOTS[view];
    const k = settings().calm ? 1 : 1 - Math.exp(-dt * 3.2);
    camera.position.lerp(new THREE.Vector3(...s.pos), k);
    target.current.lerp(new THREE.Vector3(...s.target), k);
    camera.lookAt(target.current);
  });
  return null;
}

const ORD = ['', '1ST', '2ND', '3RD', '4TH'];
function Scoreboard({ home, away, down }) {
  const h = teamById(home.team), a = teamById(away.team);
  const [hc] = teamColors(home.team, home.uni), [ac] = teamColors(away.team, away.uni);
  return (
    <div className="scoreboard">
      <div className="sb-team" style={{ '--tc': hc }}><span className="led">{h.name.toUpperCase()}</span><b className="led digits">00</b></div>
      <div className="sb-mid">
        <span className="led small">1ST HALF</span>
        <span className="cubes">{Array.from({ length: 6 }, (_, i) => <i key={i} />)}</span>
        <span className="led small">{ORD[down]} DOWN · OWN 20</span>
      </div>
      <div className="sb-team" style={{ '--tc': ac }}><b className="led digits">00</b><span className="led">{a.name.toUpperCase()}</span></div>
    </div>
  );
}
