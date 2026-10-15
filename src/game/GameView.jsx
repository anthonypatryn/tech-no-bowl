// The game screen: the 3D board plus everything you need to coach — the scoreboard, your cards, the play log, dice,
// and a prompt for whatever the engine is asking you right now. The engine validates every answer; this screen
// only offers what the open request lists.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Stage } from '../three/Stage';
import { Board, VIEWS } from '../three/Board';
import { Chips, Kbd, useConfirm, toggleFullscreen } from './ui';
import { useSettings } from './prefs';
import { isKey } from './keys';
import { Sprite } from './TeamPicker';
import { HUMAN, useGame } from './useGame';
import { artRows } from '../data/art';
import { skillOf, losRows, COLS } from '../engine/board.js';
import { checkDefense, checkOffense, sideRows } from '../engine/rules.js';
import { autoDefense, autoOffense } from '../engine/formations.js';
import RulesDrawer from './RulesDrawer.jsx';
import BugReport from './BugReport.jsx';
import { useGameSounds } from './useGameSounds';
import { useShot } from './shots';
import { ScoreBug, Chyrons, StatCard, Wipe } from './Broadcast';
import OpeningShow, { SHOW } from './OpeningShow';
import { lastPlay, useReplay } from './replay';
import { settings } from './prefs';

const COLORS = { move: '#2fd06b', ball: '#ffd34a', td: '#ffffff', out: '#ff6a5a', good: '#2fd06b', ok: '#f5e04a', bad: '#ff5a4a', push: '#ff9a3c', scatter: '#c77dff', motion: '#4ab8ff', place: '#4ab8ff' };
const RING = { active: '#f5e04a', block: '#ff9a3c', tackle: '#ff3b3b', handoff: '#3ce0ff', option: '#3ce0ff', selected: '#ffffff' };

export default function GameView({ match, onExit, onRematch }) {
  const game = useGame(match);
  if (!game) return <div className="game"><div className="loading">Setting up the field…</div></div>;
  return <Screen game={game} match={match} onExit={onExit} onRematch={onRematch} />;
}

function Screen({ game, match, onExit, onRematch }) {
  const s = game.state;
  useGameSounds(game);
  // instant replay: the last play played back on the board (automatic after a touchdown, or the Replay button)
  const [replay, setReplay] = useState(null);
  const rs = useReplay(s, replay, () => setReplay(null));
  const shown = rs ?? s;
  const lastTd = s.log.findLast?.((e) => e.kind === 'td');
  useEffect(() => {
    if (!lastTd || settings().calm) return;
    const t = setTimeout(() => setReplay(lastPlay(game.state)), 3000);
    return () => clearTimeout(t);
  }, [lastTd?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const shot = useShot(shown.log, shown.players);
  // the opening show runs first; the engine starts when it ends (calm motion skips it)
  const [intro, setIntro] = useState(() => (settings().calm ? null : { t0: performance.now(), startAt: SHOW.h2h }));
  const endIntro = useRef(null);
  endIntro.current = () => { setIntro(null); game.begin(); };
  useEffect(() => { if (!intro) game.begin(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const req = s.request && s.request.side === HUMAN ? s.request : null;
  // portrait phones: the field runs up the screen from the end-zone camera, so start there
  const [view, setView] = useState(() => (window.innerWidth < 760 && window.innerHeight > window.innerWidth ? 'endzone' : 'broadcast'));
  const nextView = () => setView((v) => VIEWS[(VIEWS.findIndex(([k]) => k === v) + 1) % VIEWS.length][0]);
  const [confirmIt, dialog] = useConfirm();
  const [hover, setHover] = useState(null);
  const [mode, setMode] = useState('move');      // act: move | pass
  const [sel, setSel] = useState(null);          // formation / motion: selected player
  const [edit, setEdit] = useState(null);        // formation being placed: [{num,col,row}]
  const [stack, setStack] = useState([]);        // play call being built
  const [motion, setMotion] = useState(null);    // { pid, to } waiting for discards
  const [discard, setDiscard] = useState([]);
  const [rules, setRules] = useState(false);
  const [bug, setBug] = useState(false);
  const reqId = req?.id;

  // fresh local state for every new question
  useEffect(() => {
    setMode('move'); setSel(null); setMotion(null); setDiscard([]); setHover(null);
    if (req?.type === 'formation') {
      const ctx = { line: req.line, dir: req.dir, col: req.col };
      setEdit(req.role === 'offense' ? autoOffense(req.roster, ctx) : autoDefense(req.roster, req.offense, ctx));
    } else setEdit(null);
    if (req?.type === 'call') setStack([]);
  }, [reqId]); // eslint-disable-line react-hooks/exhaustive-deps

  const answer = (v) => game.answer(v, reqId);
  // play clocks (Settings): 1:00 to set up and call, 0:30 for motion. Out of time = the rulebook's delay-of-game fix.
  const prefs = useSettings();
  const limit = prefs.clocks && req ? { formation: 60, call: 60, motion: 30 }[req.type] : null;
  const [left, setLeft] = useState(null);
  const [flag, setFlag] = useState('');
  const latest = useRef({});
  latest.current = { req, edit, stack };
  useEffect(() => {
    if (!limit) { setLeft(null); return; }
    const end = Date.now() + limit * 1000;
    setLeft(limit);
    const t = setInterval(() => {
      const secs = Math.ceil((end - Date.now()) / 1000);
      setLeft(Math.max(0, secs));
      if (secs > 0) return;
      clearInterval(t);
      const { req: r, edit: e, stack: st } = latest.current;
      if (!r || r.id !== reqId) return;
      setFlag(`Delay of game! ${r.type === 'formation' ? 'The other coach finishes your formation.' : r.type === 'call' ? 'The other coach fills your play with random cards.' : 'Motion is over.'}`);
      setTimeout(() => setFlag(''), 3500);
      game.answer(delayOfGame(r, e, st), r.id);
    }, 250);
    return () => clearInterval(t);
  }, [reqId, limit]); // eslint-disable-line react-hooks/exhaustive-deps
  const players = s.players;
  const P = (pid) => players[pid];
  const myRows = useMemo(() => artRows(s, HUMAN), [s.teams]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- what the board shows for the open question ----------
  const board = useMemo(() => {
    const tiles = [], rings = {};
    let onTile = null, onPlayer = null;
    if (s.active) rings[s.active.pid] = RING.active;
    if (!req) return { tiles, rings, onTile, onPlayer };
    switch (req.type) {
      case 'formation': {
        if (!edit) break;
        const { off, def, back } = losRows(req.line, req.dir);
        const rows = req.role === 'offense' ? sideRows(off, back).slice(0, 6) : sideRows(def, -back).slice(0, 7);
        const taken = new Set([...edit.map((p) => `${p.col},${p.row}`), ...(req.offense ?? []).map((p) => `${p.col},${p.row}`)]);
        if (sel != null) for (const r of rows) for (let c = 0; c < COLS; c++) if (!taken.has(`${c},${r}`)) tiles.push({ sq: [c, r], color: COLORS.place });
        if (sel != null) rings[`${HUMAN}:${sel}`] = RING.selected;
        onTile = (t) => { setEdit(edit.map((p) => (p.num === sel ? { ...p, col: t.sq[0], row: t.sq[1] } : p))); setSel(null); };
        onPlayer = (pid) => { const pl = P(pid); if (pl.side === HUMAN) setSel(pl.num === sel ? null : pl.num); };
        break;
      }
      case 'motion': {
        for (const o of req.options) rings[o.pid] = RING.option;
        if (sel) { rings[sel] = RING.selected; for (const q of req.options.find((o) => o.pid === sel)?.reach ?? []) tiles.push({ sq: q, color: COLORS.motion }); }
        if (motion) tiles.push({ sq: motion.to, color: COLORS.ball });
        onPlayer = (pid) => { if (req.options.some((o) => o.pid === pid)) { setSel(pid); setMotion(null); } };
        onTile = (t) => { if (sel) setMotion({ pid: sel, to: t.sq }); };
        break;
      }
      case 'act': {
        rings[req.pid] = RING.active;
        for (const pid of req.blocks) rings[pid] = RING.block;
        for (const pid of req.tackles) rings[pid] = RING.tackle;
        for (const pid of req.handoffs) rings[pid] = RING.handoff;
        if (mode === 'pass') {
          for (const p of req.passes) {
            const net = Math.min(3, p.bonus) - p.penalty;
            tiles.push({ sq: p.to, color: net > 0 ? COLORS.good : net === 0 ? COLORS.ok : COLORS.bad, pass: p });
          }
          onTile = (t) => answer({ kind: 'pass', to: t.sq });
        } else {
          for (const m of req.moves) tiles.push({ sq: m.to, color: COLORS[m.end] ?? COLORS.move, move: m });
          onTile = (t) => answer({ kind: 'move', to: t.sq });
        }
        onPlayer = (pid) => {
          if (mode === 'pass') { const p = req.passes.find((x) => x.target === pid); if (p) return answer({ kind: 'pass', to: p.to }); }
          if (req.tackles.includes(pid)) return answer({ kind: 'tackle', pid });
          if (req.blocks.includes(pid)) return answer({ kind: 'block', pid });
          if (req.handoffs.includes(pid)) return answer({ kind: 'handoff', pid });
        };
        break;
      }
      case 'bonus': case 'adjustPartner': {
        for (const pid of req.options) rings[pid] = RING.option;
        onPlayer = (pid) => { if (req.options.includes(pid)) answer(req.type === 'bonus' ? pid : { pid, first: 'self' }); };
        break;
      }
      case 'push': {
        for (const q of req.options) tiles.push({ sq: q, color: COLORS.push });
        onTile = (t) => answer(t.sq);
        break;
      }
      case 'followUp': tiles.push({ sq: req.to, color: COLORS.ball }); onTile = () => answer(true); break;
      case 'scatter': {
        for (const o of req.options) if (!o.out) tiles.push({ sq: o.to, color: COLORS.scatter, scatter: o });
        onTile = (t) => answer(t.scatter);
        break;
      }
      default:
    }
    return { tiles, rings, onTile, onPlayer };
  }, [req, s.active, edit, sel, mode, motion]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- keyboard ----------
  const primary = useRef(null);
  useEffect(() => {
    const key = (e) => {
      if (e.target.closest?.('input, textarea') || bug || document.querySelector('.modal')) return;
      if (isKey(e, 'camera')) nextView();
      else if (isKey(e, 'throw') && req?.type === 'act' && req.passes.length) setMode((m) => (m === 'pass' ? 'move' : 'pass'));
      else if (isKey(e, 'rules')) setRules((x) => !x);
      else if (isKey(e, 'bug')) setBug(true);
      else if (isKey(e, 'fullscreen')) toggleFullscreen();
      else if (isKey(e, 'primary') && primary.current) { e.preventDefault(); primary.current(); }
      else if (isKey(e, 'back')) { if (mode === 'pass') setMode('move'); else if (sel) setSel(null); else leave(); }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  });
  const leave = async () => { if (s.phase === 'over' || await confirmIt({ title: 'Leave this game?', body: 'The game will be lost.', yes: 'Leave', danger: true })) onExit(); };

  return (
    <div className={`game ${shot || intro || rs ? 'cine' : ''} ${intro ? 'intro' : ''} ${rs ? 'replaying' : ''}`}>
      <Stage className="game-stage">
        <Board game={rs ? { state: rs } : game} view={view} shot={shot} intro={intro} tiles={rs ? [] : board.tiles} rings={rs ? {} : board.rings} onTile={rs ? null : board.onTile} onHover={setHover} onPlayer={rs ? null : board.onPlayer}
          edit={edit && req?.type === 'formation' ? { side: HUMAN, spots: edit } : null} />
      </Stage>
      <ScoreBug s={s} />
      <Chyrons s={s} />
      <Halftime s={s} />
      <Wipe s={s} />
      <LogFeed s={s} />
      <Moment s={s} />
      <div className="game-bottom">
        <Cards s={s} rows={myRows} />
        <div className="prompt glass">
          {game.crashed ? <p className="warn">Something broke: {game.crashed.split('\n')[0]}</p>
            : req ? <>{left != null && <span className={`play-clock led ${left <= 10 ? 'low' : ''}`}>0:{String(left).padStart(2, '0')}</span>}<Prompt {...{ game, req, answer, s, P, mode, setMode, edit, setEdit, sel, stack, setStack, motion, setMotion, discard, setDiscard, primary, hover, rows: myRows }} /></>
              : <Waiting s={s} />}
          {flag && <p className="warn">{flag}</p>}
        </div>
      </div>
      <div className="game-tools">
        <button className="btn small" onClick={leave}>Exit <Kbd a="back" /></button>
        <span className="cam-chips"><Chips small value={view} onChange={setView} options={VIEWS} /></span>
        <span className="kh-wrap"><Kbd a="camera" /></span>
        <button className="btn small cam-cycle" onClick={nextView}>Camera: {VIEWS.find(([k]) => k === view)[1]}</button>
        <button className="btn small" onClick={() => setRules((r) => !r)}>Rules <Kbd a="rules" /></button>
        <button className="btn small" onClick={() => setBug(true)}>Report a bug <Kbd a="bug" /></button>
        <button className="btn small" disabled={!lastPlay(s) || !!rs} onClick={() => setReplay(lastPlay(s))}>Replay</button>
      </div>
      {rs && (
        <div className="replay-ui">
          <span className="replay-bug"><i />REPLAY</span>
          <button className="btn small" onClick={() => setReplay(null)}>Skip replay</button>
        </div>
      )}
      {bug && <BugReport onClose={() => setBug(false)} context={{
        seed: match.seed, half: s.half, down: s.down, phase: s.phase, score: s.score.join('-'), level: match.level, mode: match.mode,
        teams: `${s.teams[0].name} (you) vs ${s.teams[1].name}`, log: s.log.slice(-15).map((l) => l.text),
      }} />}
      {rules && <RulesDrawer onClose={() => setRules(false)} />}
      {intro && <OpeningShow s={s} t0={intro.t0} onDone={() => endIntro.current()} />}
      {s.phase === 'over' && <EndScreen s={s} onExit={onExit} onRematch={onRematch} match={match} />}
      {dialog}
    </div>
  );
}

// ---------- prompts ----------
function Prompt(props) {
  const { req, answer, s, P, primary } = props;
  primary.current = null;
  const name = (pid) => { const p = P(pid); return `#${p.num}`; };
  const yesNo = (q, yes = 'Yes', no = 'No', def = true) => {
    primary.current = () => answer(def);
    return (<><h3>{q}</h3><div className="btns"><button className="btn primary" onClick={() => answer(true)}>{yes}{def && <Kbd a="primary" />}</button><button className="btn" onClick={() => answer(false)}>{no}</button></div></>);
  };
  switch (req.type) {
    case 'toss':
      primary.current = () => answer('offense');
      return (<><h3>You won the toss!</h3><div className="btns"><button className="btn primary" onClick={() => answer('offense')}>Take the ball <Kbd a="primary" /></button><button className="btn" onClick={() => answer('defense')}>Defend first</button></div></>);
    case 'formation': return <FormationPrompt {...props} />;
    case 'call': return <CallPrompt {...props} />;
    case 'motion': return <MotionPrompt {...props} />;
    case 'timeout': return yesNo('Last minute of the half. Call a timeout? (It buys one more play.)', 'Timeout', 'Play on', false);
    case 'pick': {
      return (<><h3>{req.why === 'flatfooted' ? 'They are out of players: run yours one at a time.' : 'Pick your next player'}</h3>
        <CardRow nums={req.bench} rows={props.rows} s={s} onPick={(n) => answer(n)} /></>);
    }
    case 'readReact': {
      primary.current = () => answer(null);
      return (<><h3>Read and react? Swap #{req.card} for someone off the bench.</h3>
        <p className="hint">They flipped #{req.other}. Your swap can take an action, a full move or an adjustment (not a half move and an action).</p>
        <CardRow nums={req.bench} rows={props.rows} s={s} onPick={(n) => answer(n)} />
        <div className="btns"><button className="btn primary" onClick={() => answer(null)}>Keep #{req.card} <Kbd a="primary" /></button></div></>);
    }
    case 'first': {
      primary.current = () => answer('me');
      return (<><h3>You have the higher rating{skillOf(req.cards[0]) === skillOf(req.cards[1]) ? ' (won the roll)' : ''}: who goes first?</h3>
        <div className="btns"><button className="btn primary" onClick={() => answer('me')}>Me (#{req.cards[HUMAN]}) <Kbd a="primary" /></button><button className="btn" onClick={() => answer('them')}>Them (#{req.cards[1 - HUMAN]})</button></div></>);
    }
    case 'act': return <ActPrompt {...props} name={name} />;
    case 'bonus': {
      primary.current = () => answer(null);
      return (<><h3>{req.kind === 'full' ? 'Total success! Free activation: click any of your players.' : 'They only partly made it: half move for one of your players.'}</h3>
        <div className="btns"><button className="btn" onClick={() => answer(null)}>No thanks <Kbd a="primary" /></button></div></>);
    }
    case 'adjustPartner': return (<><h3>Adjustment: click the second player to move (each moves up to half)</h3></>);
    case 'boost': {
      const opts = Array.from({ length: req.max + 1 }, (_, i) => i);
      primary.current = () => answer(0);
      return (<><h3>Bench boost? +1 per #{name(req.pid).slice(1)} card from your bench</h3>
        <p className="hint">{req.label}. Already +{req.bonus} / −{req.penalty}. Spent cards can't activate him later this play.</p>
        <div className="btns">{opts.map((n) => <button key={n} className={`btn ${n === 0 ? 'primary' : ''}`} onClick={() => answer(n)}>{n === 0 ? 'No boost' : `+${n}`}{n === 0 && <Kbd a="primary" />}</button>)}</div></>);
    }
    case 'reverse': return yesNo(`The block failed! Reverse it on ${name(req.against)}?`, 'Reverse it', 'Leave it');
    case 'followUp': return yesNo(`Follow up into the gap with ${name(req.pid)}?`, 'Follow up', 'Stay');
    case 'push': return <h3>Pick where {name(req.pid)} gets pushed (orange squares)</h3>;
    case 'scatter': {
      const out = req.options.find((o) => o.out);
      return (<><h3>Your die was higher: pick where the ball goes (purple squares)</h3>
        {out && <div className="btns"><button className="btn" onClick={() => answer(out)}>Out of bounds (incomplete)</button></div>}</>);
    }
    default: return <h3>…</h3>;
  }
}

function ActPrompt({ req, answer, P, mode, setMode, primary, hover }) {
  const p = P(req.pid);
  const canAct = req.blocks.length || req.passes.length || req.tackles.length;
  primary.current = () => answer({ kind: 'end' });
  const modeName = { card: '', rr: ' (read & react)', full: ' (free activation)', half: ' (half move)', adjust: ' (adjustment)' }[req.mode];
  let tip = null;
  if (hover?.move) tip = `Move here: costs ${hover.move.cost} of ${req.left}${hover.move.end === 'ball' ? ' and grab the ball' : hover.move.end === 'td' ? ': TOUCHDOWN' : hover.move.end === 'out' ? ': out of bounds (play over)' : ''}`;
  if (hover?.pass) { const h = hover.pass; tip = `Throw ${h.dist}: ${h.bonus ? '+1 short' : 'no short bonus'}${h.penalty ? `, −${h.penalty} coverage` : ''}${h.target ? ` to #${P(h.target).num}` : ' to open grass'}`; }
  return (
    <>
      <h3>#{p.num} is up{modeName}. {req.left} movement left{req.spent ? '' : ''}.</h3>
      <p className="hint">{tip ?? (mode === 'pass' ? 'Pick a square or a teammate to throw to. Green = good odds, red = covered.'
        : `Click a green square to move.${req.tackles.length ? ' Red ring = TACKLE.' : ''}${req.blocks.length ? ' Orange ring = block.' : ''}${req.handoffs.length ? ' Cyan ring = hand-off.' : ''}${!canAct && req.spent && (req.mode === 'card' || req.mode === 'full') ? ' Moved too far to block, tackle or throw now.' : ''}`)}</p>
      <div className="btns">
        <button className="btn primary" onClick={() => answer({ kind: 'end' })}>{req.spent || req.mode === 'half' ? 'Done' : 'Do nothing'} <Kbd a="primary" /></button>
        {req.passes.length > 0 && <button className={`btn ${mode === 'pass' ? 'on' : ''}`} onClick={() => setMode(mode === 'pass' ? 'move' : 'pass')}>{mode === 'pass' ? 'Cancel throw' : 'Throw'} <Kbd a="throw" /></button>}
        {req.canStand && <button className="btn" onClick={() => answer({ kind: 'stand' })}>Stand up (3)</button>}
        {req.canAdjust && <button className="btn" onClick={() => answer({ kind: 'adjust' })}>Adjustment</button>}
      </div>
    </>
  );
}

function FormationPrompt({ req, answer, edit, setEdit, sel, primary }) {
  if (!edit) return null;
  const ctx = { line: req.line, dir: req.dir, col: req.col, count: req.roster.length };
  const res = req.role === 'offense' ? checkOffense(edit, ctx) : checkDefense(edit, req.offense, ctx);
  const reroll = () => setEdit(req.role === 'offense' ? autoOffense(req.roster, ctx) : autoDefense(req.roster, req.offense, ctx));
  if (res.ok) primary.current = () => answer(edit);
  return (
    <>
      <h3>Set your {req.role}{sel != null ? `: place #${sel}` : ''}</h3>
      <p className="hint">{sel != null ? 'Click a blue square.' : 'Click one of your players to move him, or reroll.'}</p>
      {!res.ok && <ul className="errors">{res.errors.map((e) => <li key={e}>{e}</li>)}</ul>}
      <div className="btns">
        <button className="btn primary" disabled={!res.ok} onClick={() => answer(edit)}>Ready <Kbd a="primary" /></button>
        <button className="btn" onClick={reroll}>Reroll</button>
      </div>
    </>
  );
}

function CallPrompt({ req, answer, stack, setStack, rows, s, primary }) {
  const left = [...req.bench];
  for (const n of stack) left.splice(left.indexOf(n), 1);
  const ready = stack.length === req.count;
  if (ready) primary.current = () => answer(stack);
  return (
    <>
      <h3>Call your play: {req.count} cards, in the order they'll go</h3>
      <div className="stack-row">
        {Array.from({ length: req.count }, (_, i) => (
          <button key={i} className={`card slot ${stack[i] ? '' : 'empty'}`} onClick={() => stack[i] && setStack(stack.filter((_, j) => j !== i))}>
            <small>{i + 1}</small>{stack[i] ? <CardFace num={stack[i]} rows={rows} s={s} /> : null}
          </button>
        ))}
      </div>
      <CardRow nums={left} rows={rows} s={s} onPick={(n) => stack.length < req.count && setStack([...stack, n])} />
      <div className="btns">
        <button className="btn primary" disabled={!ready} onClick={() => answer(stack)}>Call it <Kbd a="primary" /></button>
        <button className="btn" onClick={() => { const pool = [...req.bench]; const out = []; while (out.length < req.count) out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]); setStack(out); }}>Random</button>
        {stack.length > 0 && <button className="btn" onClick={() => setStack([])}>Clear</button>}
      </div>
    </>
  );
}

function MotionPrompt({ req, answer, motion, discard, setDiscard, rows, s, primary }) {
  primary.current = () => answer(null);
  const left = [...req.bench];
  for (const n of discard) left.splice(left.indexOf(n), 1);
  return (
    <>
      <h3>Motion? Costs {req.cost} bench card{req.cost > 1 ? 's' : ''}.</h3>
      <p className="hint">{motion ? `Pick ${req.cost} card${req.cost > 1 ? 's' : ''} to discard.` : 'Click a cyan-ringed player, then a blue square.'}</p>
      {motion && (
        <>
          <CardRow nums={left} rows={rows} s={s} onPick={(n) => discard.length < req.cost && setDiscard([...discard, n])} />
          {discard.length > 0 && <p className="hint">Discarding: {discard.map((n) => `#${n}`).join(', ')} <button className="btn small" onClick={() => setDiscard([])}>Clear</button></p>}
        </>
      )}
      <div className="btns">
        <button className="btn primary" onClick={() => answer(null)}>No motion <Kbd a="primary" /></button>
        {motion && <button className="btn" disabled={discard.length !== req.cost} onClick={() => answer({ ...motion, discard })}>Go in motion</button>}
      </div>
    </>
  );
}

function Waiting({ s }) {
  const t = { formation: 'Lining up…', call: 'Calling plays…', motion: 'Pre-snap…', play: 'Play is on!', dead: 'Whistle.', setup: 'Coin toss…', over: 'Final' }[s.phase] ?? '';
  return <h3 className="muted">{s.request ? 'The computer is thinking…' : t}</h3>;
}

// ---------- cards ----------
function CardFace({ num, rows, s, side = HUMAN }) {
  const t = s.teams[side];
  return (<><Sprite team={t.id} uni={t.uniform} row={rows?.[num] ?? 0} /><b className="led">{num}</b></>);
}
function CardRow({ nums, rows, s, onPick }) {
  return (
    <div className="card-row">
      {nums.map((n, i) => <button key={`${n}-${i}`} className="card" onClick={() => onPick(n)}><CardFace num={n} rows={rows} s={s} /></button>)}
    </div>
  );
}

function Cards({ s, rows }) {
  const [open, setOpen] = useState(false); // phones: the deck details fold away
  const mine = s.cards[HUMAN], theirs = s.cards[1 - HUMAN];
  const oppRows = useMemo(() => artRows(s, 1 - HUMAN), [s.teams]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className={`cards glass ${open ? 'open' : ''}`} onClick={() => setOpen(!open)}>
      <div className="faceup">
        <div className="fu"><small>You</small>{s.faceUp[HUMAN] != null ? <span className="card big"><CardFace num={s.faceUp[HUMAN]} rows={rows} s={s} /></span> : <span className="card big empty" />}</div>
        <div className="fu"><small>CPU</small>{s.faceUp[1 - HUMAN] != null ? <span className="card big"><CardFace num={s.faceUp[1 - HUMAN]} rows={oppRows} s={s} side={1 - HUMAN} /></span> : <span className="card big empty" />}</div>
      </div>
      <span className="cards-sum">Bench {mine.bench.length} · CPU {theirs.bench.length} <em>{open ? '▴' : '▾'}</em></span>
      <div className="decks">
        <div><small>Your play</small><span className="mini">{mine.stack.map((n, i) => <i key={i}>#{n}</i>)}{!mine.stack.length && <em>—</em>}</span></div>
        <div><small>Your bench ({mine.bench.length})</small><span className="mini">{group(mine.bench).map(([n, k]) => <i key={n}>#{n}{k > 1 ? '×2' : ''}</i>)}</span></div>
        <div><small>CPU</small><span className="mini"><i>play {theirs.stack.length}</i><i>bench {theirs.bench.length}</i></span></div>
      </div>
    </div>
  );
}
const group = (nums) => { const m = new Map(); for (const n of nums) m.set(n, (m.get(n) ?? 0) + 1); return [...m]; };

// ---------- scoreboard, log, moments ----------
function LogFeed({ s }) {
  const items = s.log.filter((e) => !['activate', 'formation', 'call'].includes(e.kind)).slice(-7);
  return (
    <div className="logfeed">
      {items.map((e) => <div key={e.id} className={`log-${e.kind}`}>{e.text}</div>)}
    </div>
  );
}

// dice for the latest check, and a banner for the big moments
function Moment({ s }) {
  const last = [...s.log].reverse().find((e) => ['check', 'sport', 'scatter'].includes(e.kind));
  const big = [...s.log].reverse().find((e) => ['td', 'turnover', 'safety', 'sack'].includes(e.kind));
  const [shown, setShown] = useState({});
  useEffect(() => {
    if (!last) return;
    setShown((x) => ({ ...x, dice: last.id }));
    const t = setTimeout(() => setShown((x) => (x.dice === last.id ? { ...x, dice: null } : x)), 2600);
    return () => clearTimeout(t);
  }, [last?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!big) return;
    setShown((x) => ({ ...x, big: big.id }));
    const t = setTimeout(() => setShown((x) => (x.big === big.id ? { ...x, big: null } : x)), 2400);
    return () => clearTimeout(t);
  }, [big?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const words = { td: 'TOUCHDOWN!', turnover: 'TURNOVER!', safety: 'SAFETY!', sack: 'SACKED!' };
  return (
    <>
      {last && shown.dice === last.id && (
        <div className={`dice-toast glass ${last.kind === 'check' ? last.result : last.ok === false ? 'fail' : ''}`}>
          <span className="dice">{last.dice.map((d, i) => <Die key={i} n={d} />)}</span>
          <span>{last.text}</span>
        </div>
      )}
      {big && shown.big === big.id && <div className={`banner-big ${big.kind}`}><span className="led">{words[big.kind]}</span></div>}
    </>
  );
}
const PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
function Die({ n }) {
  return <span className="die">{Array.from({ length: 9 }, (_, i) => <i key={i} className={PIPS[n]?.includes(i) ? 'on' : ''} />)}</span>;
}

function EndScreen({ s, onExit, onRematch }) {
  const [a, b] = s.score;
  const won = s.winner === HUMAN;
  return (
    <div className="modal">
      <div className="modal-card glass end-card">
        <h2 className="led big">{s.winner == null ? 'TIE GAME' : won ? 'YOU WIN!' : 'YOU LOSE'}</h2>
        <p className="final"><span>{s.teams[0].name}</span> <b className="led">{a}</b> – <b className="led">{b}</b> <span>{s.teams[1].name}</span></p>
        <StatCard s={s} title="FINAL" />
        <div className="btns"><button className="btn" onClick={onExit}>Change teams</button><button className="btn primary" onClick={onRematch}>Rematch</button></div>
      </div>
    </div>
  );
}

// what happens when the play clock runs out (rulebook p.10-11): the other coach finishes the formation (legal players
// stay, the rest are placed for you), fills the play call with random bench cards in random slots, or motion is skipped
function delayOfGame(req, edit, stack) {
  if (req.type === 'formation') {
    const ctx = { line: req.line, dir: req.dir, col: req.col, count: req.roster.length };
    const ok = edit && (req.role === 'offense' ? checkOffense(edit, ctx) : checkDefense(edit, req.offense, ctx)).ok;
    return ok ? edit : req.role === 'offense' ? autoOffense(req.roster, ctx) : autoDefense(req.roster, req.offense, ctx);
  }
  if (req.type === 'call') {
    const pool = [...req.bench];
    for (const n of stack) pool.splice(pool.indexOf(n), 1);
    const out = [...stack];
    while (out.length < req.count) out.splice(Math.floor(Math.random() * (out.length + 1)), 0, pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    return out;
  }
  return null;
}

// the halftime stat card, shown for a few seconds when the second half starts (Continue closes it sooner)
function Halftime({ s }) {
  const half = s.log.findLast?.((e) => e.kind === 'half' && e.half === 2);
  const [open, setOpen] = useState(null);
  useEffect(() => {
    if (!half) return;
    setOpen(half.id);
    const t = setTimeout(() => setOpen(null), 7000);
    return () => clearTimeout(t);
  }, [half?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!half || open !== half.id) return null;
  return <div className="halftime"><StatCard s={s} title="HALF TIME" onClose={() => setOpen(null)} /></div>;
}
