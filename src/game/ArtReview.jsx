// ?view=art — Art Review Board v1: every team x uniform as live cubes, the down marker, the field with a
// calibration grid, scoreboard and punchboards. Its job is catching bad crops and mismatches early.
// (v2, Batch 5: approve / reject / notes per asset, saved for everyone.)
import { useMemo, useState } from 'react';
import { OrbitControls, Html } from '@react-three/drei';
import { Stage } from '../three/Stage';
import { Field, Lights } from '../three/Field';
import { PlayerCube, DownCube } from '../three/Cube';
import { Chips, Toggle } from './ui';
import { TEAMS, uniformsFor, uniformOf, rosterFor, artUrl, PUNCH } from '../data/art';
import { Sprite } from './TeamPicker';

const SECTIONS = [['teams', 'Teams'], ['downs', 'Down marker'], ['field', 'Field'], ['board', 'Scoreboard & tokens'], ['checks', 'Checks']];

export default function ArtReview() {
  const [sec, setSec] = useState('teams');
  return (
    <main className="page art">
      <h1 className="page-title">Art Review Board</h1>
      <div className="art-tabs"><Chips value={sec} onChange={setSec} options={SECTIONS} /></div>
      {sec === 'teams' && <TeamsSection />}
      {sec === 'downs' && <DownsSection />}
      {sec === 'field' && <FieldSection />}
      {sec === 'board' && <BoardSection />}
      {sec === 'checks' && <ChecksSection />}
    </main>
  );
}

function TeamsSection() {
  const [team, setTeam] = useState(TEAMS[0].id);
  const [uni, setUni] = useState('home');
  const [spin, setSpin] = useState(true);
  const [down, setDown] = useState(false);
  const [labels, setLabels] = useState(true);
  const u = uniformOf(team, uni);
  const roster = rosterFor(team, u?.id);
  const t = TEAMS.find((x) => x.id === team);
  return (
    <div className="art-teams">
      <aside className="glass art-list">
        {TEAMS.map((x) => (
          <button key={x.id} className={`art-row ${x.id === team ? 'on' : ''}`} onClick={() => { setTeam(x.id); setUni('home'); }}>
            <Sprite team={x.id} uni="home" />
            <span>{x.name}</span>
            <small>{uniformsFor(x.id).length}</small>
          </button>
        ))}
      </aside>
      <section className="glass art-main">
        <header className="art-head">
          <h2 className="led">{t.name.toUpperCase()}</h2>
          <Chips small value={u?.id} onChange={setUni} options={uniformsFor(team).map((x) => [x.id, x.label])} />
        </header>
        <div className="row-controls">
          <Toggle checked={spin} onChange={setSpin}>Turntable</Toggle>
          <Toggle checked={down} onChange={setDown}>Knocked down</Toggle>
          <Toggle checked={labels} onChange={setLabels}>Labels</Toggle>
          <span className="muted">Colours: {u?.colors.map((c) => <i key={c} className="swatch" style={{ background: c }} title={c} />)}</span>
        </div>
        <Stage className="art-stage" camera={{ position: [0, 2.8, 6.2], fov: 38 }}>
          <Lights />
          <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[30, 30]} /><meshStandardMaterial color="#10161c" /></mesh>
          {roster.map((p, i) => (
            <group key={`${u.file}${p.row}`} position={[((i % 4) - 1.5) * 1.9, 0, Math.floor(i / 4) * 2.2 - 1.1]}>
              <PlayerCube uniform={u} row={p.row} size={1} spin={spin ? 0.5 : 0} down={down} />
              {labels && (
                <Html position={[0, -0.05, 0.85]} center distanceFactor={4.5} className="cube-label">
                  <b>#{p.num}</b> {p.name}{p.abilities?.length ? <><br /><span>{p.abilities.join(', ')}</span></> : null}
                </Html>
              )}
            </group>
          ))}
          <OrbitControls makeDefault enableDamping target={[0, 0.4, 0]} maxPolarAngle={Math.PI / 2.05} />
        </Stage>
        <h3>Atlas (top / front per player)</h3>
        <div className="atlas-strip">
          {roster.map((p) => (
            <figure key={p.row}>
              <Sprite team={team} uni={u.id} row={p.row} face={0} />
              <Sprite team={team} uni={u.id} row={p.row} face={1} />
              <figcaption>#{p.num}{p.num == null ? ' ?' : ''}</figcaption>
            </figure>
          ))}
        </div>
        {t.alternate && <p className="hint">Alternate lineup: {t.alternate.note}</p>}
      </section>
    </div>
  );
}

function DownsSection() {
  const [down, setDown] = useState(1);
  return (
    <section className="glass">
      <div className="row-controls"><span>Down</span><Chips value={down} onChange={setDown} options={[1, 2, 3, 4].map((d) => [d, `${d}`])} /></div>
      <Stage className="art-stage short" camera={{ position: [0, 1.6, 4], fov: 35 }}>
        <Lights />
        <DownCube down={down} size={1.2} face={0} />
        <OrbitControls makeDefault enableDamping target={[0, 0.5, 0]} />
      </Stage>
      <p className="hint">The mixed cube (1/2/3/4 round its sides) turns a quarter each down. The single-number cubes are in the atlas below too.</p>
      <img className="art-img narrow" src={artUrl('cubes/downs.webp')} alt="Down marker atlas" />
    </section>
  );
}

function FieldSection() {
  const [grid, setGrid] = useState(true);
  return (
    <section className="glass">
      <div className="row-controls"><Toggle checked={grid} onChange={setGrid}>Calibration grid (13 × 24 squares)</Toggle></div>
      <Stage className="art-stage tall" camera={{ position: [0, 30, 0.01], fov: 50 }}>
        <Lights />
        <Field grid={grid} />
        <OrbitControls makeDefault enableDamping />
      </Stage>
      <p className="hint">Every magenta square should sit on the painted 5-yard lines and the sidelines. Drag to orbit, scroll to zoom.</p>
    </section>
  );
}

function BoardSection() {
  return (
    <section className="glass">
      <h3>Scoreboard</h3>
      <img className="art-img narrow" src={artUrl('scoreboard.webp')} alt="Scoreboard" />
      <h3>Turf tile</h3>
      <div className="turf-demo" style={{ backgroundImage: `url(${artUrl('turf.webp')})` }} />
      <h3>Punchboards ({PUNCH.cols} × {PUNCH.rows} tokens)</h3>
      <div className="punch-grid">
        {PUNCH.files.map((f) => (
          <figure key={f}><img className="art-img" src={artUrl(f)} alt={f} loading="lazy" /><figcaption>{f.replace('punch/', '')}</figcaption></figure>
        ))}
      </div>
    </section>
  );
}

// mechanical checks: roster vs art
function ChecksSection() {
  const rows = useMemo(() => TEAMS.map((t) => {
    const unis = uniformsFor(t.id);
    const nums = t.players.map((p) => p.num).sort((a, b) => a - b).join(',');
    const issues = [];
    if (!unis.length) issues.push('no art');
    for (const u of unis) {
      if (u.count !== 8) issues.push(`${u.label}: ${u.count} cubes`);
      if (u.nums.join(',') !== nums) issues.push(`${u.label}: numbers differ`);
    }
    if (t.players.length !== 8) issues.push(`${t.players.length} players on roster`);
    if (!t.players.some((p) => p.num === 51)) issues.push('no #51');
    return { t, unis, issues };
  }), []);
  const bad = rows.filter((r) => r.issues.length).length;
  return (
    <section className="glass">
      <p>{bad ? `${bad} team(s) need a look.` : 'All 32 teams: 8 cubes per uniform, numbers match the roster, #51 present.'}</p>
      <table className="checks">
        <thead><tr><th>Team</th><th>Uniforms</th><th>Numbers</th><th>Issues</th></tr></thead>
        <tbody>
          {rows.map(({ t, unis, issues }) => (
            <tr key={t.id} className={issues.length ? 'bad' : ''}>
              <td>{t.name}</td><td>{unis.map((u) => u.label).join(', ')}</td>
              <td>{t.players.map((p) => p.num).sort((a, b) => a - b).join(' ')}</td><td>{issues.join('; ') || '✓'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="hint">Art order is assumed to be ascending jersey numbers. The top face shows the printed number, so a mismatch is easy to spot on the Teams tab.</p>
    </section>
  );
}
