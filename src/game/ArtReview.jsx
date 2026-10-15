// ?view=art — Art Review Board: every team x uniform as live cubes, the helmets, the down marker, the field with a
// calibration grid, scoreboard, logos and punchboards. Each asset gets a verdict (approve / needs fix / reject + a
// note), saved for everyone with the bug-list PIN; the Review tab lists them and copies the open notes for Claude.
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { OrbitControls, Html } from '@react-three/drei';
import { Stage } from '../three/Stage';
import { Field, Lights } from '../three/Field';
import { PlayerCube, DownCube } from '../three/Cube';
import { Chips, Toggle } from './ui';
import { TEAMS, uniformsFor, uniformOf, rosterFor, artUrl, helmetUrl, teamById, PUNCH } from '../data/art';
import { Button } from './ui';
import { Sprite } from './TeamPicker';

const SECTIONS = [['teams', 'Teams'], ['helmets', 'Helmets'], ['downs', 'Down marker'], ['field', 'Field'], ['board', 'Scoreboard & tokens'], ['checks', 'Checks'], ['review', 'Review']];
const PIN_KEY = 'tb-bug-pin';
const VERDICTS = [['ok', '✓ Approve'], ['fix', '✎ Needs fix'], ['reject', '✗ Reject']];

// ---------- verdicts: loaded once, shared by every Verdict on the page ----------
const Reviews = createContext(null);
function useReviewStore() {
  const [reviews, setReviews] = useState({});
  const [pin, setPinState] = useState(() => { try { return localStorage.getItem(PIN_KEY) || ''; } catch { return ''; } });
  const [err, setErr] = useState('');
  useEffect(() => { fetch('/api/reviews').then((r) => r.json()).then((j) => setReviews(j.reviews ?? {})).catch(() => {}); }, []);
  const setPin = (p) => { setPinState(p); try { localStorage.setItem(PIN_KEY, p); } catch { /* ignore */ } };
  const save = async (key, status, note) => {
    setErr('');
    try {
      const r = await fetch('/api/reviews', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-bug-pin': pin }, body: JSON.stringify({ key, status, note }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || `Server said ${r.status}`);
      setReviews(j.reviews);
      return true;
    } catch (e) { setErr(e.message); return false; }
  };
  return { reviews, pin, setPin, save, err };
}

// one asset's verdict: status chips + a note, saved with the PIN
function Verdict({ id, label }) {
  const st = useContext(Reviews);
  const cur = st.reviews[id];
  const [note, setNote] = useState(cur?.note ?? '');
  const [busy, setBusy] = useState(false);
  useEffect(() => { setNote(st.reviews[id]?.note ?? ''); }, [id, st.reviews]);
  const set = async (status) => { setBusy(true); await st.save(id, status, note); setBusy(false); };
  return (
    <div className={`verdict ${cur?.status ?? ''}`}>
      <span className="verdict-label">{label ?? id}</span>
      <div className="verdict-btns">
        {VERDICTS.map(([k, l]) => <button key={k} className={`chipbtn ${cur?.status === k ? 'on' : ''} v-${k}`} disabled={busy || !st.pin} onClick={() => set(k)}>{l}</button>)}
        {cur && <button className="chipbtn" disabled={busy || !st.pin} onClick={() => set(null)}>Clear</button>}
      </div>
      <input className="verdict-note" placeholder={st.pin ? 'Note: what to fix' : 'PIN needed'} value={note} disabled={!st.pin}
        onChange={(e) => setNote(e.target.value)} onBlur={() => { if (cur && note !== cur.note) st.save(id, cur.status, note); }} />
    </div>
  );
}

function PinBar() {
  const st = useContext(Reviews);
  const counts = VERDICTS.map(([k]) => Object.values(st.reviews).filter((r) => r.status === k).length);
  return (
    <div className="pin-bar glass">
      <label><span>Reviewer PIN</span><input className="pin-input" value={st.pin} inputMode="numeric" autoComplete="off" onChange={(e) => st.setPin(e.target.value.replace(/\D/g, ''))} /></label>
      <span className="hint">✓ {counts[0]} · ✎ {counts[1]} · ✗ {counts[2]}</span>
      {st.err && <span className="warn">{st.err}</span>}
    </div>
  );
}

export default function ArtReview() {
  const [sec, setSec] = useState('teams');
  const store = useReviewStore();
  return (
    <Reviews.Provider value={store}>
    <main className="page art">
      <h1 className="page-title">Art Review Board</h1>
      <PinBar />
      <div className="art-tabs"><Chips value={sec} onChange={setSec} options={SECTIONS} /></div>
      {sec === 'helmets' && <HelmetsSection />}
      {sec === 'review' && <ReviewSection />}
      {sec === 'teams' && <TeamsSection />}
      {sec === 'downs' && <DownsSection />}
      {sec === 'field' && <FieldSection />}
      {sec === 'board' && <BoardSection />}
      {sec === 'checks' && <ChecksSection />}
    </main>
    </Reviews.Provider>
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
        <Verdict id={`cube:${team}:${u.id}`} label={`${t.name} · ${u.label} uniform`} />
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
      <Verdict id="downs" label="Down marker cubes" />
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
      <Verdict id="field" label="Field + calibration" />
    </section>
  );
}

function BoardSection() {
  return (
    <section className="glass">
      <h3>Scoreboard</h3>
      <img className="art-img narrow" src={artUrl('scoreboard.webp')} alt="Scoreboard" />
      <Verdict id="scoreboard" label="Scoreboard" />
      <h3>Logos</h3>
      <div className="logo-row">
        <figure><img src={artUrl('mfl-shield.webp')} alt="MFL shield" /><figcaption>MFL shield (score bug, wipes, coin heads)</figcaption></figure>
        <figure><img src={artUrl('techno-logo.webp')} alt="Techno Bowl logo" /><figcaption>Techno Bowl helmet (pre-game, coin tails)</figcaption></figure>
      </div>
      <Verdict id="logo:mfl" label="MFL shield" />
      <Verdict id="logo:techno" label="Techno Bowl logo" />
      <h3>Turf tile</h3>
      <div className="turf-demo" style={{ backgroundImage: `url(${artUrl('turf.webp')})` }} />
      <Verdict id="turf" label="Turf tile" />
      <h3>Punchboards ({PUNCH.cols} × {PUNCH.rows} tokens)</h3>
      <div className="punch-grid">
        {PUNCH.files.map((f) => (
          <figure key={f}><img className="art-img" src={artUrl(f)} alt={f} loading="lazy" /><figcaption>{f.replace('punch/', '')}</figcaption><Verdict id={f} label={f.replace('punch/', 'Punchboard ')} /></figure>
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

function HelmetsSection() {
  const [bg, setBg] = useState('team');
  return (
    <section className="glass">
      <div className="row-controls"><span>Backdrop</span><Chips small value={bg} onChange={setBg} options={[['team', 'Team colour'], ['dark', 'Dark'], ['light', 'Light'], ['check', 'Checker']]} /></div>
      <p className="hint">Look for white left inside the facemask and white fringe on the edges. The checker backdrop shows any leftover background.</p>
      <div className="helmet-grid">
        {TEAMS.map((t) => (
          <figure key={t.id} className={`helmet-tile bg-${bg}`} style={{ '--c0': uniformOf(t.id, 'home')?.colors[0] }}>
            {helmetUrl(t.id) && <img src={helmetUrl(t.id)} alt={`${t.name} helmet`} loading="lazy" />}
            <Verdict id={`helmet:${t.id}`} label={t.name} />
          </figure>
        ))}
      </div>
    </section>
  );
}

// every verdict on one page, the open ones first; Copy gives Claude the fix list
function ReviewSection() {
  const st = useContext(Reviews);
  const [msg, setMsg] = useState('');
  const rows = Object.entries(st.reviews).sort(([, a], [, b]) => (a.status === 'ok') - (b.status === 'ok') || b.at - a.at);
  const open = rows.filter(([, r]) => r.status !== 'ok');
  const name = (key) => {
    const [kind, a, b] = key.split(':');
    if (kind === 'cube') return `${teamById(a)?.name ?? a} cubes (${b})`;
    if (kind === 'helmet') return `${teamById(a)?.name ?? a} helmet`;
    return key;
  };
  const copy = async () => {
    await navigator.clipboard.writeText(`Art Review Board, open items:\n${open.map(([k, r]) => `- ${name(k)} [${r.status === 'fix' ? 'needs fix' : 'rejected'}]: ${r.note || '(no note)'}`).join('\n')}`);
    setMsg(`Copied ${open.length} item(s).`); setTimeout(() => setMsg(''), 2500);
  };
  return (
    <section className="glass">
      <div className="row-controls"><Button kind="primary" disabled={!open.length} onClick={copy}>Copy open items for Claude ({open.length})</Button>{msg && <span className="hint">{msg}</span>}</div>
      {!rows.length && <p className="hint">No verdicts yet. Approve, flag or reject assets on the other tabs.</p>}
      <table className="checks">
        <thead><tr><th>Asset</th><th>Verdict</th><th>Note</th><th>When</th></tr></thead>
        <tbody>{rows.map(([k, r]) => <tr key={k} className={r.status === 'ok' ? '' : 'bad'}><td>{name(k)}</td><td>{VERDICTS.find(([v]) => v === r.status)?.[1]}</td><td>{r.note}</td><td>{new Date(r.at).toLocaleString()}</td></tr>)}</tbody>
      </table>
    </section>
  );
}
