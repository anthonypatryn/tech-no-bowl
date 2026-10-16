// ?view=review — the moment review: every cinematic and effect, one at a time. Each moment sets up a clean board
// built for it, and when you press Play it runs through the REAL rules engine (forced dice, scripted answers) with
// the game's pacing, sounds and cameras, so it looks and sounds exactly as it would in a game. When it's over:
// replay it, approve it, reject it or say what to change, and move on. At the end, copy the lot for Claude.
import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Stage } from '../three/Stage';
import { Board } from '../three/Board';
import { Game, PlayEnd } from '../engine/game.js';
import { autoDefense, autoOffense } from '../engine/formations.js';
import { occupant } from '../engine/rules.js';
import { teamSetup, BEATS, wait } from './useGame';
import { useShot } from './shots';
import { useGameSounds } from './useGameSounds';
import { calloutFor } from './shots';
import { settings } from './prefs';

const KEY = 'tb-moment-review';
const PIN_KEY = 'tb-bug-pin';
const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; } };
const store = (v) => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* not kept */ } };

// ---------- building a scene: a real game, both teams lined up mid-field, then the actors moved into place ----------
function scene({ mode = 'techno', dice = [], line = 14 } = {}, onChange) {
  const g = new Game({ teams: [teamSetup({ team: 'bighorns', uni: 'home' }), teamSetup({ team: 'kittens', uni: 'home' })], seed: 7, mode, agents: [null, null] }, {
    onChange, pace: (e) => BEATS[e.kind]?.(e) ?? 200, delay: (ms) => wait(ms),
  });
  const s = g.state;
  Object.assign(s, { offense: 0, line, spot: 6, down: 1, phase: 'play', half: 1, pile: ['y', 'y', 'y'] });
  s.play = { startOffense: 0, line, forwardDone: false, crossed: false, passThrown: false, adjustUsed: [false, false], activations: 0 };
  s.cards = [0, 1].map((side) => ({ bench: g.roster(side).flatMap((p) => [p.num, p.num]), stack: [], discard: [] }));
  const ctx = { line, dir: -1, col: 6 };
  let rnd = 0.37; const rand = () => { rnd = (rnd * 9301 + 0.49297) % 1; return rnd; };
  const off = autoOffense(g.roster(0).map((p) => ({ num: p.num, skill: p.skill })), ctx, rand);
  for (const sp of off) Object.assign(s.players[`0:${sp.num}`], { col: sp.col, row: sp.row });
  const def = autoDefense(g.roster(1).map((p) => ({ num: p.num, skill: p.skill })), off, ctx, rand);
  for (const sp of def) Object.assign(s.players[`1:${sp.num}`], { col: sp.col, row: sp.row });
  const qb = occupant(s, 6, line + 1) ?? g.roster(0)[0];
  s.ball = { at: 'held', pid: qb.pid };
  s.play.snappedTo = qb.pid;
  const q = [...dice];
  g.d6 = () => (q.length ? q.shift() : 1 + Math.floor(Math.random() * 6));
  const free = (c, r) => c >= 0 && c <= 12 && r >= 0 && r <= 23 && !occupant(s, c, r);
  // put p on [c, r]; whoever stood there (or is in the way) steps aside to the nearest open square well clear
  const put = (p, c, r) => {
    const o = occupant(s, c, r);
    if (o && o !== p) {
      for (let d = 3; d < 12; d++) {
        const spot = [[c + d, r], [c - d, r], [c, r + d], [c, r - d], [c + d, r + d], [c - d, r - d]].find(([x, y]) => free(x, y));
        if (spot) { o.col = spot[0]; o.row = spot[1]; break; }
      }
    }
    p.col = c; p.row = r;
  };
  // nobody but the listed players within `rad` of [c, r]
  const clear = (c, r, rad, keep = []) => {
    for (const p of Object.values(s.players)) {
      if (keep.includes(p) || p.col == null || Math.max(Math.abs(p.col - c), Math.abs(p.row - r)) > rad) continue;
      for (let d = rad + 1; d < 14; d++) {
        const spot = [[c + d, p.row], [c - d, p.row], [p.col, r + d], [p.col, r - d]].find(([x, y]) => free(x, y));
        if (spot) { p.col = spot[0]; p.row = spot[1]; break; }
      }
    }
  };
  const O = g.roster(0).sort((a, b) => a.skill - b.skill), D = g.roster(1).sort((a, b) => a.skill - b.skill);
  return { g, s, qb, put, clear, O, D };
}

// scripted coaches: act answers come from a per-player queue; everything else from `answers` (or sensible defaults)
function script(g, acts, answers = {}) {
  const def = { bonus: () => null, push: (r) => r.options[0], followUp: () => true, reverse: () => true, scatter: (r) => r.options[0], boost: () => 0, dodge: () => 0,
    fireDefend: () => 0, spin: () => true, heatCrit: () => 'fire', kick: () => true, option: () => null, readReact: () => null, first: () => 'me', adjustPartner: (r) => ({ pid: r.options[0], first: 'self' }) };
  const agent = (game, side, req) => {
    if (req.type === 'act') { const list = acts[req.pid]; const a = list?.shift(); return a ? (typeof a === 'function' ? a(req) : a) : { kind: 'end' }; }
    return (answers[req.type] ?? def[req.type] ?? (() => null))(req);
  };
  g.agents = [agent, agent];
}
// run activations; a play that ends (tackle, touchdown...) goes through the engine's end of play (the whistle, TD)
async function act(g, pid, mode = 'card') {
  try { await g.runActivation(pid, mode); } catch (e) { if (e instanceof PlayEnd) { g.s.phase = 'dead'; await g.endPlay(e); return false; } throw e; }
  return true;
}

// ---------- the moments ----------
// each: key, title, what you should see, and build(onChange) -> { game, focus, run }
export const REVIEW = [
  { key: 'throw', title: 'Long throw', expect: 'A 10-square pass: chase cam rides behind the ball, slow motion at the top of the arc, low lens at the catch.',
    build(on) {
      const { g, qb, put, clear, O } = scene({ dice: [5, 5] }, on);
      const wr = O.find((p) => p !== qb && p.skill >= 5) ?? O[O.length - 2];
      clear(qb.col + 2, qb.row - 10, 2); put(wr, qb.col + 2, qb.row - 10);
      script(g, { [qb.pid]: [{ kind: 'pass', to: [wr.col, wr.row] }] });
      return { g, focus: [qb.col, qb.row - 4], run: () => act(g, qb.pid) };
    } },
  { key: 'hit', title: 'Big hit (tackle)', expect: 'The defender lunges into the ball carrier, snap zoom with a shake and debris, the carrier tips over, whistle.',
    build(on) {
      const { g, qb, put, clear, D } = scene({ dice: [6, 4] }, on);
      const d = D[0]; clear(qb.col, qb.row, 1, [qb]); put(d, qb.col, qb.row - 1);
      script(g, { [d.pid]: [{ kind: 'tackle', pid: qb.pid }] });
      return { g, focus: [qb.col, qb.row], run: () => act(g, d.pid) };
    } },
  { key: 'block', title: 'Block', expect: 'The blocker lunges in, the defender is driven back a square, the blocker follows up into the gap.',
    build(on) {
      const { g, put, clear, O, D } = scene({ dice: [5, 4] }, on);
      const o = O[0], d = D[1]; clear(6, 9, 1); put(o, 6, 10); put(d, 6, 9);
      script(g, { [o.pid]: [{ kind: 'block', pid: d.pid }] });
      return { g, focus: [6, 9], run: () => act(g, o.pid) };
    } },
  { key: 'knock', title: 'Knocked down (critical block)', expect: 'Doubles on a block: the defender is driven back AND flattened, with the big-hit camera.',
    build(on) {
      const { g, put, clear, O, D } = scene({ dice: [5, 5] }, on);
      const o = O[0], d = D[1]; clear(6, 9, 1); put(o, 6, 10); put(d, 6, 9);
      script(g, { [o.pid]: [{ kind: 'block', pid: d.pid }] }, { followUp: () => false });
      return { g, focus: [6, 9], run: () => act(g, o.pid) };
    } },
  { key: 'sack', title: 'Sack', expect: 'A defender steps in next to the passer behind the line with his bench too thin: low slow push-in, ring of dust, boom.',
    build(on) {
      const { g, s, qb, put, clear, D } = scene({}, on);
      s.cards[0].bench = [qb.num];
      const d = D[2]; clear(qb.col + 1, qb.row - 1, 1, [qb]); put(d, qb.col + 2, qb.row - 1);
      script(g, { [d.pid]: [{ kind: 'move', to: [qb.col + 1, qb.row - 1] }] });
      return { g, focus: [qb.col, qb.row], run: () => act(g, d.pid) };
    } },
  { key: 'td', title: 'Touchdown', expect: 'The runner walks into the end zone; once he is in, TOUCHDOWN banner, orbit camera and confetti (not before he crosses).',
    build(on) {
      const { g, s, put, clear, O } = scene({}, on);
      const rb = O[O.length - 2]; clear(6, 3, 2); put(rb, 6, 4); s.ball = { at: 'held', pid: rb.pid };
      script(g, { [rb.pid]: [{ kind: 'move', to: [6, 1] }] });
      return { g, focus: [6, 3], run: () => act(g, rb.pid) };
    } },
  { key: 'onfire', title: 'ON FIRE', expect: 'INFERNO: a player is set ON FIRE: close orbit, flames burst up, ON FIRE! callout; he keeps burning after.',
    build(on) {
      const { g, qb } = scene({ mode: 'inferno' }, on);
      return { g, focus: [qb.col, qb.row], run: async () => { g.setOnFire(qb); } };
    } },
  { key: 'heat', title: 'Bring the heat', expect: 'INFERNO: a block with BRING THE HEAT; the playmaker die matches, so the defender is flattened. Fire burst, callout.',
    build(on) {
      const { g, s, put, clear, O, D } = scene({ mode: 'inferno', dice: [5, 3, 5] }, on);
      s.fire[0] = 3;
      const o = O[0], d = D[1]; clear(6, 9, 1); put(o, 6, 10); put(d, 6, 9);
      script(g, { [o.pid]: [{ kind: 'block', pid: d.pid }] }, { boost: () => ({ boost: 0, fire: 0, showboat: 0, heat: true }), followUp: () => false });
      return { g, focus: [6, 9], run: () => act(g, o.pid) };
    } },
  { key: 'stiffarm', title: 'Stiff arm', expect: 'A tackle on a STIFF ARM carrier: the playmaker die cancels a die, the tackle fails and the tackler is planted in the turf.',
    build(on) {
      const { g, qb, put, clear, D } = scene({ mode: 'alltechno', dice: [4, 2, 4] }, on);
      qb.abilities = ['STIFF ARM'];
      const d = D[0]; clear(qb.col, qb.row, 1, [qb]); put(d, qb.col, qb.row - 1);
      script(g, { [d.pid]: [{ kind: 'tackle', pid: qb.pid }] });
      return { g, focus: [qb.col, qb.row], run: () => act(g, d.pid) };
    } },
  { key: 'spin', title: 'Spin move', expect: 'A tackle on a SPIN MOVE carrier misses on a playmaker match: he spins past, the two swap squares.',
    build(on) {
      const { g, qb, put, clear, D } = scene({ mode: 'alltechno', dice: [4, 2, 4] }, on);
      qb.abilities = ['SPIN MOVE'];
      const d = D[0]; clear(qb.col, qb.row, 1, [qb]); put(d, qb.col, qb.row - 1);
      script(g, { [d.pid]: [{ kind: 'tackle', pid: qb.pid }] });
      return { g, focus: [qb.col, qb.row], run: () => act(g, d.pid) };
    } },
  { key: 'juke', title: 'Juke', expect: 'The ball carrier jukes the defender in front of him (pushed back), then keeps running upfield.',
    build(on) {
      const { g, qb, put, clear, D } = scene({ mode: 'alltechno', dice: [6, 4] }, on);
      qb.abilities = ['JUKE'];
      const d = D[1]; clear(qb.col, qb.row - 2, 2, [qb]); put(d, qb.col, qb.row - 1);
      script(g, { [qb.pid]: [{ kind: 'juke', pid: d.pid }, (r) => ({ kind: 'move', to: r.moves.filter((m) => !m.end).sort((a, b) => a.to[1] - b.to[1] || a.cost - b.cost)[0]?.to ?? [qb.col, qb.row] })] }, { followUp: () => false });
      return { g, focus: [qb.col, qb.row - 2], run: () => act(g, qb.pid) };
    } },
  { key: 'shove', title: 'Shove', expect: 'SHOVE: the defender is driven straight back 2 squares and the shover follows up 2.',
    build(on) {
      const { g, put, clear, O, D } = scene({ mode: 'alltechno', dice: [6, 4] }, on);
      const o = O[0], d = D[1]; o.abilities = ['SHOVE']; clear(6, 8, 2); put(o, 6, 10); put(d, 6, 9);
      script(g, { [o.pid]: [{ kind: 'shove', pid: d.pid }] });
      return { g, focus: [6, 8], run: () => act(g, o.pid) };
    } },
  { key: 'intercept', title: 'Interceptor', expect: 'A throw misses; the INTERCEPTOR covering the target jumps the route, holds on (sport check) and it is a turnover.',
    build(on) {
      const { g, qb, put, clear, O, D } = scene({ mode: 'alltechno', dice: [1, 2, 2, 5] }, on);
      const wr = O.find((p) => p !== qb && p.skill >= 5) ?? O[O.length - 2], d = D[D.length - 1];
      d.abilities = ['INTERCEPTOR'];
      clear(qb.col + 1, qb.row - 6, 2); put(wr, qb.col + 1, qb.row - 6); put(d, qb.col + 2, qb.row - 7);
      script(g, { [qb.pid]: [{ kind: 'pass', to: [wr.col, wr.row] }] });
      return { g, focus: [qb.col + 1, qb.row - 5], run: () => act(g, qb.pid) };
    } },
  { key: 'fuego', title: 'En fuego', expect: 'INFERNO: 3 tokens give the carrier JUKE for this turn (EN FUEGO! callout, fire), then he jukes the defender.',
    build(on) {
      const { g, s, qb, put, clear, D } = scene({ mode: 'inferno', dice: [6, 4] }, on);
      s.fire[0] = 3;
      const d = D[1]; clear(qb.col, qb.row - 2, 2, [qb]); put(d, qb.col, qb.row - 1);
      script(g, { [qb.pid]: [{ kind: 'fuego', skill: 'JUKE' }, { kind: 'juke', pid: d.pid }] }, { followUp: () => false });
      return { g, focus: [qb.col, qb.row - 1], run: () => act(g, qb.pid) };
    } },
  { key: 'firebomb', title: 'Fire bomb', expect: 'INFERNO: a throw past normal range (3 tokens): FIRE BOMB! callout, then the long-throw camera to the catch.',
    build(on) {
      const { g, s, qb, put, clear, O } = scene({ mode: 'inferno', dice: [6, 5] }, on);
      s.fire[0] = 3;
      const wr = O.find((p) => p !== qb && p.skill >= 5) ?? O[O.length - 2];
      const far = Math.min(qb.skill * 2 + 1, qb.row); // past his normal 2x range (FIRE BOMB reaches 3x)
      clear(qb.col, qb.row - far, 2); put(wr, qb.col, qb.row - far);
      script(g, { [qb.pid]: [{ kind: 'pass', to: [wr.col, wr.row] }] });
      return { g, focus: [qb.col, qb.row - 5], run: () => act(g, qb.pid) };
    } },
  { key: 'dogpile', title: 'Dogpile', expect: 'INFERNO: a tackle\'s total success becomes a dogpile: a teammate piles on the downed carrier with a dirty hit (DOGPILE! callout).',
    build(on) {
      const { g, qb, put, clear, D } = scene({ mode: 'inferno', dice: [6, 5, 5, 6] }, on);
      const d = D[0], d2 = D[1]; clear(qb.col, qb.row, 1, [qb]); put(d, qb.col, qb.row - 1); put(d2, qb.col + 1, qb.row - 1);
      script(g, { [d.pid]: [{ kind: 'tackle', pid: qb.pid }], [d2.pid]: [{ kind: 'dirty', pid: qb.pid }] }, { bonus: (r) => (r.kind === 'dogpile' && r.options.includes(d2.pid) ? d2.pid : null) });
      return { g, focus: [qb.col, qb.row], run: () => act(g, d.pid) };
    } },
  { key: 'fg', title: 'Field goal: good', expect: 'PRO: low behind the kicker, the ball end over end through the posts, confetti, FIELD GOAL! (3 dice beat the distance).',
    build(on) {
      const { g } = scene({ mode: 'pro', dice: [6, 5, 4], line: 10 }, on);
      script(g, {});
      return { g, focus: [6, 6], run: () => g.maybeKick() };
    } },
  { key: 'fgmiss', title: 'Field goal: no good', expect: 'PRO: the kick sails wide, NO GOOD!, the other team takes over.',
    build(on) {
      const { g } = scene({ mode: 'pro', dice: [1, 2, 2], line: 10 }, on);
      script(g, {});
      return { g, focus: [6, 6], run: () => g.maybeKick() };
    } },
  { key: 'dice', title: 'Dice roll', expect: 'A skill check: two dice thrown in beside the play (never through anyone), the big number, the result.',
    build(on) {
      const { g, put, clear, O, D } = scene({ dice: [3, 4] }, on);
      const o = O[0], d = D[1]; clear(6, 9, 1); put(o, 6, 10); put(d, 6, 9);
      script(g, { [o.pid]: [{ kind: 'block', pid: d.pid }] }, { followUp: () => false });
      return { g, focus: [6, 9], run: () => act(g, o.pid) };
    } },
  { key: 'scatter', title: 'Fumble and scatter', expect: 'A critical tackle knocks the ball loose: big hit, then the scatter dice in both team colours and the ball bounces away.',
    build(on) {
      const { g, qb, put, clear, D } = scene({ dice: [5, 5, 6, 2] }, on);
      const d = D[0]; clear(qb.col, qb.row, 1, [qb]); put(d, qb.col, qb.row - 1);
      script(g, { [d.pid]: [{ kind: 'tackle', pid: qb.pid }] });
      return { g, focus: [qb.col, qb.row], run: () => act(g, d.pid) };
    } },
];

const VERDICT = { ok: 'Approved', fix: 'Needs a change', reject: 'Rejected' };

export default function MomentReview({ go }) {
  const [verdicts, setVerdicts] = useState(load);
  const [i, setI] = useState(() => { const v = load(); const k = REVIEW.findIndex((m) => !v[m.key]); return k < 0 ? REVIEW.length : k; });
  const [take, retake] = useReducer((x) => x + 1, 0);
  const [phase, setPhase] = useState('ready'); // ready | playing | done
  const [note, setNote] = useState('');
  const [, bump] = useReducer((x) => x + 1, 0);
  const m = REVIEW[i];
  const built = useMemo(() => (m ? m.build(() => bump()) : null), [i, take]); // eslint-disable-line react-hooks/exhaustive-deps
  const game = built?.g;
  const s = game?.state;
  const shot = useShot(s?.log ?? [], s?.players ?? {}, { full: true }); // always the full-length cut here
  if (import.meta.env.DEV) window.__rv = { s, phase }; // poke at it while developing
  useEffect(() => { setPhase('ready'); setNote(verdicts[m?.key]?.note ?? ''); }, [i, take]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { if (game) game.stopped = true; }, [game]);

  // the end of a moment: the script has run, no shot is on screen and nothing new has been logged for a while
  const lastLog = useRef(0);
  const ran = useRef(false);
  useEffect(() => { lastLog.current = performance.now(); }, [s?.log.length]);
  useEffect(() => {
    if (phase !== 'playing') return undefined;
    const t = setInterval(() => {
      if (ran.current && !shotRef.current && performance.now() - lastLog.current > 2200) setPhase('done');
    }, 250);
    return () => clearInterval(t);
  }, [phase]);
  const shotRef = useRef(null);
  shotRef.current = shot;

  const play = async () => {
    if (phase === 'playing') return;
    if (phase === 'done') { retake(); setTimeout(() => startRef.current(), 600); return; }
    startRef.current();
  };
  const startRef = useRef(null);
  startRef.current = async () => {
    setPhase('playing'); ran.current = false; lastLog.current = performance.now();
    try { await built.run(); } catch (e) { console.error(e); }
    ran.current = true;
  };

  const judge = (status) => {
    const v = { ...verdicts, [m.key]: { status, note: note.trim(), at: Date.now() } };
    setVerdicts(v); store(v);
    // also onto the Art Review Board's list (with the PIN, if one is saved on this device)
    const pin = (() => { try { return localStorage.getItem(PIN_KEY) || ''; } catch { return ''; } })();
    if (pin) fetch('/api/reviews', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-bug-pin': pin }, body: JSON.stringify({ key: `moment:${m.key}`, status, note: note.trim() }) }).catch(() => {});
    setI((x) => x + 1);
  };

  const summary = () => `Moment review:\n${REVIEW.map((r) => { const v = verdicts[r.key]; return `- ${r.title} [${v ? VERDICT[v.status] : 'not reviewed'}]${v?.note ? `: ${v.note}` : ''}`; }).join('\n')}`;
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard?.writeText(summary()); setCopied(true); setTimeout(() => setCopied(false), 1800); };

  // ---------- the end: the whole list, copy it ----------
  if (!m) {
    const counts = Object.values(verdicts).reduce((a, v) => ({ ...a, [v.status]: (a[v.status] ?? 0) + 1 }), {});
    return (
      <main className="page review-done">
        <h1 className="page-title">{REVIEW.every((r) => verdicts[r.key]) ? 'Moment review: done' : `Moment review: ${REVIEW.filter((r) => verdicts[r.key]).length} of ${REVIEW.length} looked at`}</h1>
        <p>{counts.ok ?? 0} approved · {counts.fix ?? 0} need a change · {counts.reject ?? 0} rejected</p>
        <table className="checks">
          <tbody>{REVIEW.map((r, k) => { const v = verdicts[r.key]; return <tr key={r.key} className={v?.status === 'ok' ? '' : 'bad'}><td>{r.title}</td><td>{v ? VERDICT[v.status] : '—'}</td><td>{v?.note}</td><td><button className="btn small" onClick={() => setI(k)}>Look again</button></td></tr>; })}</tbody>
        </table>
        <div className="btns">
          <button className="btn primary big" onClick={copy}>{copied ? 'Copied! Paste it to Claude' : 'Copy the review for Claude'}</button>
          <button className="btn" onClick={() => setI(0)}>Start over from the first</button>
          <button className="btn" onClick={() => { setVerdicts({}); store({}); setI(0); }}>Clear all verdicts</button>
          <button className="btn" onClick={() => go('home')}>Home</button>
        </div>
      </main>
    );
  }

  const v = verdicts[m.key];
  return (
    <div className={`game review ${shot ? 'cine' : ''}`}>
      <Stage className="game-stage">
        <Board game={{ state: s }} view="broadcast" focusSq={built.focus} tiles={[]} shot={shot} />
      </Stage>
      <Sounds game={game} />
      <Callout s={s} />
      <div className="review-top glass">
        <span className="led">MOMENT {i + 1} / {REVIEW.length}</span>
        <b>{m.title}</b>
        <span className="review-dots">{REVIEW.map((r, k) => <i key={r.key} className={`${k === i ? 'on' : ''} ${verdicts[r.key]?.status ?? ''}`} onClick={() => setI(k)} title={r.title} />)}</span>
      </div>
      {phase !== 'playing' && (
        <div className="review-panel glass">
          <p className="review-expect"><b>What should happen:</b> {m.expect}</p>
          {phase === 'ready' && <button className="btn primary big" onClick={play}>▶ Play</button>}
          {phase === 'done' && (
            <>
              <div className="btns">
                <button className="btn big" onClick={play}>↻ Replay</button>
                <button className="btn primary big v-ok" onClick={() => judge('ok')}>✓ Approve</button>
              </div>
              <textarea className="review-note" rows={2} placeholder="What should change? (needed for Needs a change / Reject)" value={note} onChange={(e) => setNote(e.target.value)} />
              <div className="btns">
                <button className="btn v-fix" disabled={!note.trim()} onClick={() => judge('fix')}>✎ Needs a change</button>
                <button className="btn v-reject" onClick={() => judge('reject')}>✗ Reject</button>
              </div>
            </>
          )}
          {v && <p className="hint">Last verdict: {VERDICT[v.status]}{v.note ? ` — ${v.note}` : ''}</p>}
          <div className="btns review-nav">
            <button className="btn small" disabled={i === 0} onClick={() => setI(i - 1)}>◀ Previous</button>
            <button className="btn small" onClick={() => setI(i + 1)}>Skip ▶</button>
            <button className="btn small" onClick={() => setI(REVIEW.length)}>See the list</button>
          </div>
          {settings().calm && <p className="warn">Calm motion is on in Settings, so the cinematics are switched off. Turn it off to review them.</p>}
        </div>
      )}
    </div>
  );
}

// sounds for the moment's game (no opening theme)
function Sounds({ game }) { useGameSounds(game, { theme: false }); return null; }

function Callout({ s }) {
  const call = [...s.log].slice(-5).reverse().find((e) => calloutFor(e));
  const [on, setOn] = useState(null);
  useEffect(() => {
    if (!call) return undefined;
    setOn(call.id);
    const t = setTimeout(() => setOn(null), 1900);
    return () => clearTimeout(t);
  }, [call?.id]);
  return call && on === call.id ? <div className={`callout ${['onfire', 'heat', 'fuego', 'firebomb'].includes(call.kind) ? 'hot' : ''}`} key={call.id}><span>{calloutFor(call)}</span></div> : null;
}
