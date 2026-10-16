// The game screen: the 3D board plus everything you need to coach — the scoreboard, your cards, the play log, dice,
// and a prompt for whatever the engine is asking you right now. The engine validates every answer; this screen
// only offers what the open request lists.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Stage } from '../three/Stage';
import { Board, VIEWS } from '../three/Board';
import { Button, Chips, Kbd, useConfirm, toggleFullscreen } from './ui';
import { useSettings } from './prefs';
import { isKey } from './keys';
import { Sprite } from './TeamPicker';
import { HUMAN, useGame, canUndo, resumeMatch, clearResume, clearOnlineResume, setTurbo, isTurbo } from './useGame';
import { REACTIONS, PHRASES } from '../net/room';
import { makeAI, pKick } from '../engine/ai.js';
import { SKILLS } from '../engine/rules.js';
import { abilityText } from '../data/abilities';
import { setSettings } from './prefs';
import { artRows } from '../data/art';
import { skillOf, losRows, COLS, adjacent as adj, halfOf, key as sqKey } from '../engine/board.js';
import { moveReach } from '../engine/rules.js';
import { checkDefense, checkOffense, sideRows, distance } from '../engine/rules.js';
import { contactOdds, passOdds, odds, pct } from './odds';
import { contactMods, netModifier } from '../engine/rules.js';
import { OFFENSE_SETS, DEFENSE_SETS, buildOffense, buildDefense, savedFor, saveFormation, applySaved, deleteSaved, savePlay, rememberLast, rememberCall, lastFor } from '../data/playbook';
import { autoDefense, autoOffense } from '../engine/formations.js';
import RulesDrawer from './RulesDrawer.jsx';
import BugReport from './BugReport.jsx';
import CoachTips from './CoachTips';
import { HELP_FOR } from '../data/rulesText';
import { useGameSounds } from './useGameSounds';
import { useShot, calloutFor, delayFor, skipShot } from './shots';
import { ScoreBug, Chyrons, StatCard, Wipe } from './Broadcast';
import OpeningShow, { SHOW } from './OpeningShow';
import { lastPlay, useReplay } from './replay';
import CoinToss from './CoinToss';
import { recordResult } from './records';
import { loadSeason, reportResult } from './season';
import { crowd, stopTheme, audioState, nudgeAudio, play as playSound } from './sound';
import MusicPlayer, { FullscreenButton } from './MusicPlayer.jsx';
import { musicScene } from './music';
import { settings } from './prefs';

const BASE_COLORS = { act: '#2fd06b', moveOnly: '#1f9e8f', legal: '#2fd06b', move: '#2fd06b', ball: '#ffd34a', td: '#ffffff', out: '#ff6a5a', good: '#2fd06b', ok: '#f5e04a', bad: '#ff5a4a', push: '#ff9a3c', scatter: '#c77dff', motion: '#4ab8ff', place: '#4ab8ff' };
const BASE_RING = { active: '#f5e04a', skill: '#ffb000', block: '#ff9a3c', tackle: '#ff3b3b', handoff: '#3ce0ff', option: '#3ce0ff', selected: '#ffffff', dirty: '#c77dff', fire: '#ff5a1f' };
const BOMB = '#ff7a1a';
// colour-blind mode (Settings): the Okabe-Ito palette, and shapes as well as colours. Squares you can still act from
// (or good throws) are full size; move-only / risky ones shrink, so the meaning never rests on colour alone.
const CB_COLORS = { ...BASE_COLORS, act: '#0072b2', moveOnly: '#56b4e9', legal: '#0072b2', move: '#0072b2', good: '#0072b2', ok: '#f0e442', bad: '#d55e00', push: '#e69f00', scatter: '#cc79a7', motion: '#56b4e9', place: '#e69f00', out: '#d55e00' };
const CB_RING = { ...BASE_RING, active: '#f0e442', skill: '#f0e442', block: '#e69f00', tackle: '#d55e00', handoff: '#56b4e9', option: '#56b4e9', dirty: '#cc79a7', fire: '#d55e00' };
const CB_SIZE = { '#56b4e9': 0.6, '#f0e442': 0.72, '#d55e00': 0.45, '#e69f00': 0.6 };
// a skill he can use right now (the prompt lights its chip, the board rings him gold)
function liveSkills(req, s, p) {
  if (!req || req.type !== 'act' || !s.skills) return new Set();
  const live = new Set();
  if (req.asMove.includes('block')) live.add(p.side === s.offense ? 'RUN BLOCK' : 'BLITZ');
  if (req.asMove.includes('tackle')) live.add('DIVING TACKLE');
  if (req.jukes.length) live.add('JUKE');
  if (req.shakes.length) live.add('SHAKE');
  if (req.shoves.length) live.add('SHOVE');
  if (req.handoffs.some((pid) => { const m = s.players[pid]; return Math.max(Math.abs(m.col - p.col), Math.abs(m.row - p.row)) > 1; })) live.add('PITCH');
  if (req.passes.some((x) => x.why?.some((w) => w.includes('pocket')))) live.add('POCKET PASSER');
  if (req.passes.some((x) => x.why?.some((w) => w.includes('route')))) live.add('ROUTE PASSER');
  if (req.passes.some((x) => x.why?.some((w) => w.includes('screen')))) live.add('SCREEN PASSER');
  return live;
}

// The side this screen coaches. Offline it's always side 0; online the friend coaches side 1. Set at the top of each
// render (one game screen at a time), and every part of the screen below reads it.
let ME = HUMAN;

// remote: the friend's view of an online game (a RemoteGame fed by the host); me: which side this screen coaches
export default function GameView({ match, remote = null, me = HUMAN, onExit, onRematch, onRestart }) {
  ME = me;
  const local = useGame(remote ? null : match);
  const game = remote ?? local;
  if (!game || !game.state) return <div className="game"><div className="loading">{remote ? 'Waiting for the host…' : 'Setting up the field…'}</div></div>;
  return <Screen game={game} match={match} onExit={onExit} onRematch={onRematch} onRestart={onRestart} />;
}

function Screen({ game, match, onExit, onRematch, onRestart }) {
  const s = game.state;
  const net = match.online?.room ?? game.client ?? null; // online: the host's room or the friend's connection
  const online = !!net;
  const spectating = !!game.client?.spectating;
  const oppName = online ? (ME === 0 ? (net.friend?.name ?? 'Them') : (net.lobby?.seats?.[0]?.name ?? 'Them')) : 'CPU';
  useGameSounds(game, { theme: !match.skipIntro });
  // the jukebox steps aside for the game (unless Music during games is on); half time and the final whistle get a track
  useEffect(() => { musicScene('game'); }, []);
  const halfAt = s.log.findLast?.((e) => e.kind === 'half' && e.half === 2)?.id;
  useEffect(() => { if (!halfAt) return undefined; musicScene('break'); const t = setTimeout(() => musicScene('game'), 25000); return () => clearTimeout(t); }, [halfAt]);
  useEffect(() => { if (s.phase === 'over') musicScene('break'); }, [s.phase]);
  useEffect(() => {
    if (s.phase !== 'over') return;
    if (online) { if (net?.code) clearOnlineResume(net.code); return; }
    recordResult([s.teams[0].id, s.teams[1].id], s.winner, match.seed);
    clearResume();
    // a season game: report it (once) and move the season on
    const season = loadSeason();
    if (match.season && season && !(season.reported ?? []).includes(match.seed)) {
      const mine = Object.fromEntries(Object.entries(s.box).filter(([pid]) => s.players[pid]?.side === ME).map(([pid, b]) => [s.players[pid].num, { ...b, name: s.players[pid].name }]));
      reportResult({ ...season, reported: [...(season.reported ?? []), match.seed] }, s.score[ME], s.score[1 - ME], mine);
    }
  }, [s.phase]); // eslint-disable-line react-hooks/exhaustive-deps
  // instant replay: the last play played back on the board (automatic after a touchdown, or the Replay button)
  const [replay, setReplay] = useState(null);
  // replays can queue up (the half-time highlights play one after another)
  const replayQueue = useRef([]);
  const rs = useReplay(s, replay, () => setReplay(replayQueue.current.length ? replayQueue.current.shift() : null));
  const watchAll = (plays) => { if (!plays.length) return; replayQueue.current = plays.slice(1); setReplay(plays[0]); };
  const shown = rs ?? s;
  const lastTd = s.log.findLast?.((e) => e.kind === 'td');
  useEffect(() => {
    if (!lastTd || settings().calm) return;
    const t = setTimeout(() => setReplay(lastPlay(game.state)), 3000);
    return () => clearTimeout(t);
  }, [lastTd?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const shot = useShot(shown.log, shown.players);
  // the opening show runs first; the engine starts when it ends (calm motion skips it)
  const [intro, setIntro] = useState(() => (settings().calm || match.skipIntro ? null : { t0: performance.now(), startAt: SHOW.h2h }));
  const endIntro = useRef(null);
  endIntro.current = () => { setIntro(null); stopTheme(1.8); crowd(1, 0.2); game.begin(); };
  useEffect(() => { if (!intro) { stopTheme(1.8); game.begin(); } }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const req = !spectating && s.request && s.request.side === ME ? s.request : null;
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
  const [tips, setTips] = useState(!!match.tutorial);
  const [paused, setPaused] = useState(false);
  const [turbo, setTurboState] = useState(isTurbo);
  const toggleTurbo = () => { setTurbo(!isTurbo()); setTurboState(isTurbo()); };
  useEffect(() => () => setTurbo(false), []); // leaving the game: back to normal speed
  const queued = useRef(null);   // one-click: { pid, kind, target } to do once he's arrived
  const [tap, setTap] = useState(null); // phones: the square tapped once, waiting for a second tap
  const coarse = useMemo(() => window.matchMedia?.('(pointer: coarse)').matches, []);
  const [detail, setDetail] = useState(null); // a log line opened for its full roll breakdown
  const [minPrompt, setMinPrompt] = useState(false);
  const highlights = useRef([]);
  const [suggest, setSuggest] = useState(null);
  useEffect(() => { setSuggest(null); }, [req?.id]);
  // the coach's suggestion: what the All-Pro AI would do here (on a copy of the dice, so the game's own luck is untouched)
  const askCoach = () => {
    const ghost = Object.create(game, { random: { value: Math.random } });
    const v = makeAI('allpro')(ghost, ME, req);
    if (req.type === 'formation') { setEdit(v); return; }
    if (req.type === 'call') { setStack(v); return; }
    setSuggest(v);
  };
  // quick play: the small prompts answer themselves
  const prefsNow = useSettings();
  useEffect(() => {
    if (!prefsNow.quick || !req) return;
    const auto = { boost: 0, first: 'me', followUp: true, readReact: null, motion: null }[req.type];
    if (auto === undefined) return;
    const t = setTimeout(() => game.answer(auto, req.id), 250);
    return () => clearTimeout(t);
  }, [req?.id, prefsNow.quick]); // eslint-disable-line react-hooks/exhaustive-deps
  // undo: rebuild the game from your answers so far, minus the last one (the dice replay exactly)
  const undoable = !online && canUndo(game);
  const undo = () => { if (undoable) onRestart(resumeMatch({ match, trail: game.trail }, 1)); };  const reqId = req?.id;
  // a new formation to set: drop the free camera so the wide setup shot can take over
  useEffect(() => { if (req?.type === 'formation' && view === 'free') setView('broadcast'); }, [reqId]); // eslint-disable-line react-hooks/exhaustive-deps

  // fresh local state for every new question
  useEffect(() => {
    setMode('move'); setSel(null); setMotion(null); setDiscard([]); setHover(null); setTap(null);
    // one-click: he's arrived next to his target: do the tackle / block now
    const q = queued.current;
    queued.current = null;
    if (q && req?.type === 'act' && req.pid === q.pid) {
      const list = q.kind === 'tackle' ? req.tackles : req.blocks;
      if (list.includes(q.target)) { game.answer({ kind: q.kind, pid: q.target }, req.id); return; }
    }
    if (req?.type === 'formation') {
      const ctx = { line: req.line, dir: req.dir, col: req.col };
      setEdit(req.role === 'offense' ? autoOffense(req.roster, ctx) : autoDefense(req.roster, req.offense, ctx));
    } else setEdit(null);
    if (req?.type === 'call') setStack([]);
  }, [reqId]); // eslint-disable-line react-hooks/exhaustive-deps

  const answer = (v) => game.answer(v, reqId);
  // play clocks (Settings): 1:00 to set up and call, 0:30 for motion. Out of time = the rulebook's delay-of-game fix.
  const prefs = useSettings();
  const clocksOn = online ? (match.clocks ?? net.setup?.clocks ?? net.lobby?.setup?.clocks) : prefs.clocks;
  const limit = clocksOn && req ? { formation: 60, call: 60, motion: 30 }[req.type] : null;
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
  const myRows = useMemo(() => artRows(s, ME), [s.teams]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- what the board shows for the open question ----------
  const board = useMemo(() => {
    const cb = !!prefsNow.cb;
    const COLORS = cb ? CB_COLORS : BASE_COLORS, RING = cb ? CB_RING : BASE_RING;
    const tiles = [], rings = {}, reach = {};
    const carrierPid = s.ball.at === 'held' ? s.ball.pid : null;
    let onTile = null, onPlayer = null;
    if (s.active) rings[s.active.pid] = RING.active;
    if (!req) return { tiles, rings, onTile, onPlayer, outlines: [] };
    switch (req.type) {
      case 'formation': {
        if (!edit) break;
        const { off, def, back } = losRows(req.line, req.dir);
        const rows = req.role === 'offense' ? sideRows(off, back).slice(0, 6) : sideRows(def, -back).slice(0, 7);
        const taken = new Set([...edit.map((p) => `${p.col},${p.row}`), ...(req.offense ?? []).map((p) => `${p.col},${p.row}`)]);
        if (sel != null) {
          // every open square on our side: green if putting him there makes the formation legal, blue if not (yet), with why
          const ctx = { line: req.line, dir: req.dir, col: req.col, count: req.roster.length };
          for (const r of rows) for (let c = 0; c < COLS; c++) {
            if (taken.has(`${c},${r}`)) continue;
            const trial = edit.map((p) => (p.num === sel ? { ...p, col: c, row: r } : p));
            const res = req.role === 'offense' ? checkOffense(trial, ctx) : checkDefense(trial, req.offense, ctx);
            tiles.push({ sq: [c, r], color: res.ok ? COLORS.legal : COLORS.place, setup: res });
          }
        }
        if (sel != null) rings[`${ME}:${sel}`] = RING.selected;
        onTile = (t) => { setEdit(edit.map((p) => (p.num === sel ? { ...p, col: t.sq[0], row: t.sq[1] } : p))); setSel(null); };
        onPlayer = (pid) => { const pl = P(pid); if (pl.side === ME) setSel(pl.num === sel ? null : pl.num); };
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
        rings[req.pid] = liveSkills(req, s, P(req.pid)).size || req.jukes.length ? RING.skill : RING.active;
        for (const pid of req.dirty) rings[pid] = RING.dirty;
        for (const pid of req.blocks) rings[pid] = RING.block;
        for (const pid of req.tackles) rings[pid] = RING.tackle;
        for (const pid of req.handoffs) rings[pid] = RING.handoff;
        if (mode === 'pass') {
          for (const p of req.passes) {
            const net = Math.min(3, p.bonus) - p.penalty;
            tiles.push({ sq: p.to, color: p.bomb ? BOMB : net > 0 ? COLORS.good : net === 0 ? COLORS.ok : COLORS.bad, pass: p });
          }
          onTile = (t) => answer({ kind: 'pass', to: t.sq, bomb: !!t.pass?.bomb });
        } else {
          // bright green: he can still block / tackle / throw after moving there; teal: move only
          const me = P(req.pid);
          const actAfter = (m) => (req.mode === 'card' || req.mode === 'full') && req.spent + m.cost <= Math.ceil(me.skill / 2);
          for (const m of req.moves) tiles.push({ sq: m.to, color: COLORS[m.end] ?? (actAfter(m) ? COLORS.act : COLORS.moveOnly), move: m, actAfter: actAfter(m) });
          onTile = (t) => answer({ kind: 'move', to: t.sq });
          // one click on someone he can reach and still hit: step next to him (cheapest square) and do it
          for (const o of Object.values(s.players)) {
            if (o.side === me.side || o.down || o.col == null || req.blocks.includes(o.pid)) continue;
            const kind = carrierPid === o.pid ? 'tackle' : 'block';
            const best = req.moves.filter((m) => !m.end && actAfter(m) && adj(m.to, [o.col, o.row])).sort((a, b) => a.cost - b.cost)[0];
            if (best) { reach[o.pid] = { to: best.to, kind }; if (kind === 'tackle') rings[o.pid] = RING.tackle; }
          }
        }
        onPlayer = (pid) => {
          if (mode === 'pass') { const p = req.passes.find((x) => x.target === pid); if (p) return answer({ kind: 'pass', to: p.to }); }
          if (req.tackles.includes(pid)) return answer({ kind: 'tackle', pid });
          if (req.blocks.includes(pid)) return answer({ kind: 'block', pid });
          if (req.handoffs.includes(pid)) return answer({ kind: 'handoff', pid });
          if (reach[pid]) { queued.current = { pid: req.pid, kind: reach[pid].kind, target: pid }; return answer({ kind: 'move', to: reach[pid].to }); }
        };
        break;
      }
      case 'bonus': case 'adjustPartner': {
        for (const pid of req.options) rings[pid] = RING.option;
        onPlayer = (pid) => { if (req.options.includes(pid)) answer(req.type === 'bonus' ? pid : { pid, first: 'self' }); };
        break;
      }
      case 'option': {
        rings[req.pid] = RING.skill;
        for (const pid of req.targets) rings[pid] = RING.handoff;
        onPlayer = (pid) => { if (req.targets.includes(pid)) answer(pid); };
        break;
      }
      case 'onFire': {
        for (const pid of req.options) rings[pid] = RING.fire;
        onPlayer = (pid) => { if (req.options.includes(pid) && !req.anySkill.includes(pid)) answer({ pid }); };
        break;
      }
      case 'spin': case 'heatCrit': case 'dodge': rings[req.pid] = RING.skill; break;
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
    if (suggest?.to) tiles.push({ sq: suggest.to, color: '#ffd700' });
    if (suggest?.pid) rings[suggest.pid] = '#ffd700';
    // a passer who can still throw: outlines for his full range and the +1 short zone
    let outlines = [];
    if (req?.type === 'act' && req.passes.length && mode !== 'pass') {
      const me = P(req.pid), at = [me.col, me.row];
      const within = (r) => { const out = []; for (let c = 0; c < COLS; c++) for (let rr = 0; rr < 24; rr++) if (distance(at, [c, rr]) <= r) out.push([c, rr]); return out; };
      outlines = [{ squares: within(me.skill * 2), color: '#f5e04a' }, { squares: within(me.skill), color: '#2fd06b' }];
    }
    if (cb) for (const t of tiles) t.size = CB_SIZE[t.color] ?? 1;
    // phones: a tap picks the square (gold), a second tap on it confirms, so a fat finger never moves anyone
    if (coarse && onTile) {
      const commit = onTile;
      onTile = (t) => { if (tap && tap[0] === t.sq[0] && tap[1] === t.sq[1]) commit(t); else setTap(t.sq); };
      if (tap) { const real = tiles.find((t) => t.sq[0] === tap[0] && t.sq[1] === tap[1]); tiles.push({ ...real, sq: tap, color: '#ffd700' }); }
    }
    return { tiles, rings, onTile, onPlayer, outlines, reach };
  }, [req, s.active, edit, sel, mode, motion, suggest, prefsNow.cb, tap]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- danger preview: hovering a square with the ball, who could reach him there and still tackle ----------
  const threatReach = useMemo(() => {
    if (req?.type !== 'act' || s.ball.at !== 'held' || s.ball.pid !== req.pid) return null;
    return Object.values(s.players).filter((o) => o.side !== ME && !o.down && o.col != null).map((o) => {
      const sqs = new Set([sqKey(o.col, o.row)]);
      for (const m of moveReach(s, o, halfOf(o.skill)).values()) sqs.add(sqKey(...m.to));
      return { pid: o.pid, sqs };
    });
  }, [req?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const danger = useMemo(() => {
    if (!threatReach || !hover?.move) return [];
    const [c, r] = hover.move.to;
    const near = []; for (let dc = -1; dc <= 1; dc++) for (let dr = -1; dr <= 1; dr++) if (dc || dr) near.push(sqKey(c + dc, r + dr));
    return threatReach.filter((t) => near.some((k) => t.sqs.has(k))).map((t) => t.pid);
  }, [threatReach, hover]);
  const rings = useMemo(() => (danger.length ? { ...board.rings, ...Object.fromEntries(danger.map((pid) => [pid, '#ff2b2b'])) } : board.rings), [board.rings, danger]);

  // ---------- auto-finish: he's moved and has nothing left to do but walk: end his turn ----------
  useEffect(() => {
    if (!prefsNow.autoEnd || req?.type !== 'act' || !req.spent || req.canStand) return undefined;
    const any = req.tackles.length + req.blocks.length + req.passes.length + req.handoffs.length + req.jukes.length + req.shakes.length + req.dirty.length;
    if (any || req.moves.some((m) => m.end === 'ball' || m.end === 'td') || (req.fire?.tokens ?? 0) > 0) return undefined;
    const t = setTimeout(() => game.answer({ kind: 'end' }, req.id), 450);
    return () => clearTimeout(t);
  }, [req?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- highlights for the end-of-game recap: each finished play, scored ----------
  const lastEnd = s.log.findLast?.((e) => ['whistle', 'td', 'safety'].includes(e.kind));
  useEffect(() => {
    if (!lastEnd) return;
    const play = lastPlay(s);
    if (!play || highlights.current.some((h) => h.play.id === play.id)) return;
    const ev = play.events;
    let score = 0, label = '';
    const td = ev.find((e) => e.kind === 'td'), to = ev.find((e) => e.kind === 'turnover'), big = ev.find((e) => e.kind === 'catch' && e.yds >= 20), sack = ev.find((e) => e.kind === 'sack');
    if (td) { score = 10; label = `TOUCHDOWN ${s.teams[td.side].name}`; }
    else if (to) { score = 8; label = `TURNOVER: ${s.teams[to.side].name} take it`; }
    else if (big) { score = 6; label = `${big.yds}-yard catch`; }
    else if (sack) { score = 5; label = 'SACK'; }
    if (score) highlights.current = [...highlights.current, { play, score, label, half: s.half }];
  }, [lastEnd?.id]); // eslint-disable-line react-hooks/exhaustive-deps

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
      else if (isKey(e, 'turbo')) toggleTurbo();
      else if (isKey(e, 'skip') && (shot || rs)) { e.preventDefault(); if (rs) setReplay(null); else skipShot(); }
      else if (isKey(e, 'primary') && primary.current) { e.preventDefault(); primary.current(); }
      else if (isKey(e, 'back')) { if (mode === 'pass') setMode('move'); else if (sel) setSel(null); else setPaused((x) => !x); }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  });
  const leave = async () => { if (s.phase === 'over' || await confirmIt({ title: 'Leave this game?', body: 'It stays saved: Resume it from Home.', yes: 'Leave', danger: true })) onExit(); };

  return (
    <div className={`game ${shot || intro || rs ? 'cine' : ''} ${intro ? 'intro' : ''} ${rs ? 'replaying' : ''}`}>
      <Stage className="game-stage">
        <Board game={rs ? { state: rs } : game} view={view} setup={!rs && ['formation', 'call', 'motion'].includes(s.phase)} onFree={() => setView('free')} shot={shot} intro={intro} tiles={rs ? [] : board.tiles} rings={rs ? {} : rings} onTile={rs ? null : board.onTile} onHover={setHover} onHoverPlayer={(pid) => setHover(pid ? { pid } : null)} outlines={rs ? [] : board.outlines} onPlayer={rs ? null : board.onPlayer}
          edit={edit && req?.type === 'formation' ? { side: ME, spots: edit } : null} />
      </Stage>
      <ScoreBug s={s} />
      <Chyrons s={s} />
      <Ticker s={s} />
      <Halftime s={s} highlights={highlights.current} onWatch={watchAll} />
      <Wipe s={s} />
      <CoinToss s={s} />
      <CoachTips s={s} enabled={tips && !intro} fresh={!match.skipIntro} onOff={() => setTips(false)} />
      <LogFeed s={s} canUndo={undoable} onUndo={undo} online={online} onOpen={setDetail} />
      <Moment s={s} />
      {shot && !intro && <button className="btn small skip-shot" onClick={skipShot}>Skip ▸ <Kbd a="skip" /></button>}
      {detail && <RollDetail e={detail} onClose={() => setDetail(null)} />}
      <div className="game-bottom">
        <Cards s={s} rows={myRows} opp={oppName} />
        <div className={`prompt glass ${minPrompt ? 'min' : ''}`}>
          <button className="btn small prompt-min" onClick={() => setMinPrompt((x) => !x)} aria-label="Fold the prompt">{minPrompt ? '▴' : '▾'}</button>
          {req && ['act', 'formation', 'call'].includes(req.type) && <button className="btn small coach-q" onClick={askCoach} title="What would the coach do?">Suggest</button>}
          {suggest && <p className="suggest">Coach: {describe(suggest, P)}</p>}
          {req && ['formation', 'call', 'motion', 'kick', 'onFire'].includes(req.type) && !s.overtime && s.pile.length >= 1 && (
            <button className="btn small timeout-btn" disabled={!s.timeouts[ME]} onClick={() => answer({ timeout: true })} title="Stop the clock: adds one more play to the half (rulebook p.13)">
              ⏱ Timeout ({s.timeouts[ME]} left)
            </button>
          )}
          {req && HELP_FOR[req.type] && <button className="btn small help-q" title="What's this rule?" onClick={() => setRules(HELP_FOR[req.type])}>?</button>}
          {game.crashed ? <p className="warn">Something broke: {game.crashed.split('\n')[0]}</p>
            : req ? <>{left != null && <span className={`play-clock led ${left <= 10 ? 'low' : ''}`}>0:{String(left).padStart(2, '0')}</span>}<Prompt {...{ game, req, answer, s, P, mode, setMode, edit, setEdit, sel, stack, setStack, motion, setMotion, discard, setDiscard, primary, hover, rows: myRows, askCoach, reach: board.reach, danger, tap }} /></>
              : <Waiting s={s} online={online} spectating={spectating} />}
          {flag && <p className="warn">{flag}</p>}
        </div>
      </div>
      <div className="game-tools">
        <button className="btn small" onClick={() => setPaused(true)}>Menu <Kbd a="back" /></button>
        <span className="cam-chips"><Chips small value={view} onChange={setView} options={VIEWS.map(([k, l], i) => [k, i === 0 ? <>{l} <Kbd a="camera" /></> : l])} /></span>
        <button className="btn small cam-cycle" onClick={nextView}>Camera: {VIEWS.find(([k]) => k === view)[1]}</button>
        <button className="btn small" onClick={() => setRules((r) => !r)}>Rules <Kbd a="rules" /></button>
        <button className="btn small" onClick={() => setBug(true)}>Report a bug <Kbd a="bug" /></button>
        <button className="btn small" disabled={!lastPlay(s) || !!rs} onClick={() => setReplay(lastPlay(s))}>Replay</button>
        <SoundChip />
        <MusicPlayer small />
        <FullscreenButton />
        <button className={`btn small ${turbo ? 'on' : ''}`} onClick={toggleTurbo} title="Fast-forward: everything runs 4x">⏩ {turbo ? 'Fast' : 'Normal'} <Kbd a="turbo" /></button>
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
      {paused && (
        <div className="modal" onClick={() => setPaused(false)}>
          <div className="modal-card glass pause-card" onClick={(e) => e.stopPropagation()}>
            <h2 className="led">PAUSED</h2>
            <div className="pause-list">
              <button className="btn primary" onClick={() => setPaused(false)}>Resume</button>
              <button className="btn" onClick={() => { setPaused(false); setRules(true); }}>How to play</button>
              <button className="btn" onClick={() => setSettings({ muted: !settings().muted })}>Sound: {prefsNow.muted ? 'OFF (turn on)' : 'ON (turn off)'}</button>
              <Chips small value={prefsNow.speed} onChange={(speed) => setSettings({ speed })} options={[['slow', 'Slow'], ['normal', 'Normal'], ['fast', 'Fast']]} />
              <button className="btn" onClick={() => setSettings({ quick: !prefsNow.quick })}>Quick play: {prefsNow.quick ? 'on' : 'off'}</button>
              <button className="btn danger" onClick={() => { setPaused(false); leave(); }}>Quit game</button>
            </div>
            <p className="hint">Your game is saved as you play: quit any time and pick it up from Home.</p>
          </div>
        </div>
      )}
      {rules && <RulesDrawer onClose={() => setRules(false)} focus={typeof rules === 'string' ? rules : null} />}
      {intro && <OpeningShow s={s} t0={intro.t0} onDone={() => endIntro.current()} />}
      {s.inferno && <FireHud s={s} opp={oppName} />}
      {online && <OnlineBar net={net} host={!!match.online} />}
      {s.phase === 'over' && !rs && <EndScreen s={s} onExit={onExit} onRematch={onRematch} match={match} online={online} highlights={highlights.current} onWatch={setReplay} />}
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
    return (<><h3>{q}</h3><div className="btns"><Button kind={def ? 'primary' : undefined} keyAction={def ? 'primary' : undefined} onClick={() => answer(true)}>{yes}</Button><Button kind={def ? undefined : 'primary'} keyAction={def ? undefined : 'primary'} onClick={() => answer(false)}>{no}</Button></div></>);
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
      return (<><h3>{req.only ? `QB READ: swap #${req.card} for your ball carrier #${req.only[0]}?` : `Read and react? Swap #${req.card} for someone off the bench.`}</h3>
        <p className="hint">They flipped #{req.other}. Your swap can take an action, a full move or an adjustment (not a half move and an action).</p>
        <CardRow nums={req.only ?? req.bench} rows={props.rows} s={s} onPick={(n) => answer(n)} />
        <div className="btns"><button className="btn primary" onClick={() => answer(null)}>Keep #{req.card} <Kbd a="primary" /></button></div></>);
    }
    case 'first': {
      primary.current = () => answer('me');
      return (<><h3>You have the higher rating{skillOf(req.cards[0]) === skillOf(req.cards[1]) ? ' (won the roll)' : ''}: who goes first?</h3>
        <div className="btns"><button className="btn primary" onClick={() => answer('me')}>Me (#{req.cards[ME]}) <Kbd a="primary" /></button><button className="btn" onClick={() => answer('them')}>Them (#{req.cards[1 - ME]})</button></div></>);
    }
    case 'act': return <ActPrompt key={req.id} {...props} name={name} />;
    case 'bonus': {
      primary.current = () => answer(null);
      return (<><h3>{req.kind === 'dogpile' ? 'DOGPILE! Pick a player to put a dirty hit on a downed opponent.' : req.kind === 'full' ? `Total success! Free activation: click any of your players.${req.party ? ' BLOCK PARTY: +2 if he blocks.' : ''}` : 'They only partly made it: half move for one of your players.'}</h3>
        <div className="btns"><button className="btn" onClick={() => answer(null)}>No thanks <Kbd a="primary" /></button></div></>);
    }
    case 'adjustPartner':
      primary.current = () => answer(null);
      return (<><h3>Adjustment: click the second player to move (each moves up to half)</h3>
        <p className="hint">Changed your mind? Nothing has moved yet.</p>
        <div className="btns"><button className="btn" onClick={() => answer(null)}>Cancel the adjustment <Kbd a="primary" /></button></div></>);
    case 'boost': return <BoostPrompt key={req.id} {...props} name={name} />;
    case 'kick': {
      const p = pKick(req.dist);
      const def = req.down === 4 && p >= 0.4;
      return yesNo(`Field goal? Roll 3 dice: ${req.dist}+ is good (${pct(p)}). ${req.down === 4 ? '4th down.' : `${['', '1st', '2nd', '3rd'][req.down]} down.`}`, 'Kick it', 'Run a play', def);
    }
    case 'dodge': {
      primary.current = () => answer(0);
      return (<><h3>DODGE! Spend #{P(req.pid).num}'s cards: -1 each on {req.label.toLowerCase()}</h3>
        <div className="btns">{Array.from({ length: req.max + 1 }, (_, n) => <button key={n} className={`btn ${n === 0 ? 'primary' : ''}`} onClick={() => answer(n)}>{n === 0 ? 'No' : `-${n}`}{n === 0 && <Kbd a="primary" />}</button>)}</div></>);
    }
    case 'fireDefend': {
      primary.current = () => answer(0);
      return (<><h3>Burn fire tokens against it? -1 each</h3><p className="hint">{req.label}.</p>
        <div className="btns">{Array.from({ length: req.max + 1 }, (_, n) => <button key={n} className={`btn ${n === 0 ? 'primary' : ''}`} onClick={() => answer(n)}>{n === 0 ? 'Keep them' : `-${n} 🔥`}{n === 0 && <Kbd a="primary" />}</button>)}</div></>);
    }
    case 'spin': return yesNo(`SPIN MOVE! #${P(req.pid).num} can spin past #${P(req.with).num}: swap squares?`, 'Spin past', 'Stay put');
    case 'heatCrit': {
      primary.current = () => answer('fire');
      return (<><h3>BRING THE HEAT, double match! Your pick:</h3>
        <div className="btns"><button className="btn primary" onClick={() => answer('fire')}>Set #{P(req.pid).num} ON FIRE <Kbd a="primary" /></button><button className="btn" onClick={() => answer('tokens')}>Take 3 fire tokens</button></div></>);
    }
    case 'option': {
      primary.current = () => answer(null);
      return (<><h3>OPTION! A defender closes on #{P(req.pid).num}: pitch it?</h3>
        <p className="hint">Needs a sport check (doubles = fumble). Click a cyan-ringed teammate or a button.</p>
        <div className="btns">{req.targets.map((pid) => <button key={pid} className="btn act-hand" onClick={() => answer(pid)}>Pitch to #{P(pid).num}</button>)}
          <button className="btn primary" onClick={() => answer(null)}>Keep it <Kbd a="primary" /></button></div></>);
    }
    case 'onFire': return <OnFirePrompt key={req.id} {...props} />;
    case 'reverse': return yesNo(req.crit ? `Critical failure! ${name(req.against)} goes down. Push him back too?` : `The block failed! Reverse it on ${name(req.against)}?`, req.crit ? 'Push him' : 'Reverse it', req.crit ? 'Just knock him down' : 'Leave it');
    case 'followUp': return yesNo(`Follow up${req.steps === 2 ? ' 2 squares' : ' into the gap'} with ${name(req.pid)}?`, 'Follow up', 'Stay');
    case 'push': return <h3>Pick where {name(req.pid)} gets pushed (orange squares)</h3>;
    case 'scatter': {
      const out = req.options.find((o) => o.out);
      return (<><h3>Your die was higher: pick where the ball goes (purple squares)</h3>
        {out && <div className="btns"><button className="btn" onClick={() => answer(out)}>Out of bounds (incomplete)</button></div>}</>);
    }
    default: return <h3>…</h3>;
  }
}

function ActPrompt({ req, answer, P, mode, setMode, primary, hover, s, reach, danger, tap }) {
  const p = P(req.pid);
  const [fuego, setFuego] = useState(false);
  const canAct = req.blocks.length || req.passes.length || req.tackles.length || req.dirty.length;
  const live = liveSkills(req, s, p);
  const mine = s.skills ? [...(p.abilities ?? []).filter((a) => !a.startsWith('INFERNO')), ...(p.fuego ? [p.fuego] : []), ...(p.onFire && p.fireSkill ? [p.fireSkill] : [])] : [];
  const blockWord = req.asMove.includes('block') ? (p.side === s.offense ? 'Run block' : 'Blitz') : 'Block';
  primary.current = () => answer({ kind: 'end' });
  const modeName = { card: '', rr: ' (read & react)', full: ' (free activation)', half: ' (half move)', adjust: ' (adjustment)' }[req.mode];
  let tip = null;
  // nothing to hit yet: say how to get there
  const carrier = s.ball.at === 'held' ? P(s.ball.pid) : null;
  const canStillAct = (req.mode === 'card' || req.mode === 'full' || req.mode === 'rr') && !req.tackles.length && !req.blocks.length;
  if (canStillAct && carrier && carrier.side !== p.side) tip = 'Move next to their ball carrier: from a bright green square you can still tackle, and a Tackle button appears. Or block whoever is in the way.';
  if (canStillAct && carrier && carrier.side === p.side && carrier.pid !== p.pid) tip = 'Get open downfield for a throw, or move next to a defender near your ball carrier and block him (a Block button appears).';
  if (hover?.move) tip = `Move here: costs ${hover.move.cost} of ${req.left}${hover.move.end === 'ball' ? ' and grab the ball' : hover.move.end === 'td' ? ': TOUCHDOWN' : hover.move.end === 'out' ? ': out of bounds (play over)' : ''}`;
  if (hover?.move) tip += hover.actAfter ? ' · can still act' : (req.mode === 'card' || req.mode === 'full') ? ' · move only (too far to act after)' : '';
  if (hover?.move && danger?.length) tip += ` · ⚠ ${danger.length} of them can get to you there next turn (red rings)`;
  if (hover?.pid && reach?.[hover.pid]) tip = `${contactOdds(s, p, P(hover.pid), reach[hover.pid].kind === 'tackle' ? 'Tackle' : 'Block', reach[hover.pid].kind)} · click him: step next to him and ${reach[hover.pid].kind} in one go`;
  if (tap) tip = 'Tap the gold square again to move there.';
  if (hover?.pass) tip = passOdds(hover.pass);
  if (hover?.pid) {
    const t = P(hover.pid);
    if (req.tackles.includes(hover.pid)) tip = contactOdds(s, p, t, 'Tackle');
    else if (req.blocks.includes(hover.pid)) tip = contactOdds(s, p, t, 'Block');
    else if (req.handoffs.includes(hover.pid)) tip = `Hand-off with #${t.num}: automatic unless someone threatens one of you (then doubles = fumble).`;
    else if (mode === 'pass') { const ps = req.passes.find((x) => x.target === hover.pid); if (ps) tip = passOdds(ps); }
  }
  if (hover?.pid && req.jukes.includes(hover.pid)) tip = contactOdds(s, p, P(hover.pid), 'Juke', 'juke');
  if (hover?.pid && req.dirty.includes(hover.pid)) tip = contactOdds(s, p, P(hover.pid), 'Dirty hit', 'dirty');
  if (hover?.pass?.why?.length) tip += ` (${hover.pass.why.join(', ')})`;
  if (hover?.pass?.bomb) tip = `FIRE BOMB (3 tokens): ${tip}`;
  return (
    <>
      <h3>#{p.num} is up{modeName}{p.onFire ? ' 🔥 ON FIRE' : ''}. {req.left} movement left.</h3>
      {mine.length > 0 && (
        <div className="skill-chips">
          {mine.map((a) => <span key={a} className={`skill-chip ${live.has(a) ? 'live' : ''}`} title={abilityText(a)}>{a}{live.has(a) ? ' ✦' : ''}</span>)}
        </div>
      )}
      <p className="hint">{tip ?? (mode === 'pass' ? 'Pick a square or a teammate to throw to. Green = good odds, red = covered.'
        : `Bright green = move and still act, teal = move only.${req.passes.length ? ' Yellow outline = throwing range, green = +1 short zone.' : ''} Hover a target for the odds.${req.tackles.length ? ' Red ring = TACKLE.' : ''}${req.blocks.length ? ' Orange ring = block.' : ''}${req.handoffs.length ? ' Cyan ring = hand-off.' : ''}${!canAct && req.spent && (req.mode === 'card' || req.mode === 'full') ? ' Moved too far to block, tackle or throw now.' : ''}`)}</p>
      {/* every action open to him right now, as its own button (with the odds); or click the ringed player */}
      {(req.tackles.length > 0 || req.blocks.length > 0 || req.handoffs.length > 0 || req.passes.length > 0 || req.canStand || req.dirty.length > 0 || req.jukes.length > 0 || req.shakes.length > 0) && (
        <div className="act-btns">
          {req.tackles.map((pid) => <button key={`t${pid}`} className="btn act-tackle" onClick={() => answer({ kind: 'tackle', pid })}>{req.asMove.includes('tackle') ? 'Diving tackle' : 'Tackle'} #{P(pid).num} <span className="odds">{chance(s, p, P(pid), 'tackle')}</span></button>)}
          {req.blocks.filter((pid) => !req.tackles.includes(pid)).map((pid) => <button key={`b${pid}`} className="btn act-block" onClick={() => answer({ kind: 'block', pid })}>{blockWord} #{P(pid).num} <span className="odds">{chance(s, p, P(pid))}</span></button>)}
          {req.shoves.map((pid) => <button key={`s${pid}`} className="btn act-skill" onClick={() => answer({ kind: 'shove', pid })}>Shove #{P(pid).num} <span className="odds">{chance(s, p, P(pid), 'shove')}</span></button>)}
          {req.jukes.map((pid) => <button key={`j${pid}`} className="btn act-skill" onClick={() => answer({ kind: 'juke', pid })}>Juke #{P(pid).num} <span className="odds">{chance(s, p, P(pid), 'juke')}</span></button>)}
          {req.shakes.map((pid) => <button key={`k${pid}`} className="btn act-skill" onClick={() => answer({ kind: 'shake', pid })}>Shake #{P(pid).num} <span className="odds">{chance(s, p, P(pid), 'shake')}</span></button>)}
          {req.dirty.map((pid) => <button key={`d${pid}`} className="btn act-dirty" onClick={() => answer({ kind: 'dirty', pid })}>Dirty hit #{P(pid).num} <span className="odds">{chance(s, p, P(pid), 'dirty')}</span></button>)}
          {req.handoffs.map((pid) => { const far = Math.max(Math.abs(P(pid).col - p.col), Math.abs(P(pid).row - p.row)) > 1; return <button key={`h${pid}`} className="btn act-hand" onClick={() => answer({ kind: 'handoff', pid })}>{s.ball.pid === p.pid ? `${far ? 'Pitch' : 'Hand off'} to #${P(pid).num}` : `Take ${far ? 'the pitch' : 'hand-off'} from #${P(pid).num}`}</button>; })}
          {req.passes.length > 0 && <button className={`btn ${mode === 'pass' ? 'on' : 'primary'}`} onClick={() => setMode(mode === 'pass' ? 'move' : 'pass')}>{mode === 'pass' ? 'Cancel throw' : 'Throw'} <Kbd a="throw" /></button>}
          {req.canStand && <button className="btn primary" onClick={() => answer({ kind: 'stand' })}>Stand up (costs 3)</button>}
        </div>
      )}
      <div className="btns">
        <button className="btn" onClick={() => answer({ kind: 'end' })}>{req.spent || req.mode === 'half' ? 'Done' : 'Do nothing'} <Kbd a="primary" /></button>
        {req.canAdjust && <button className="btn" onClick={() => answer({ kind: 'adjust' })}>Adjustment</button>}
      </div>
      {req.fire && req.fire.tokens > 0 && (
        <div className="fire-row">
          <span className="pb-label">🔥 {req.fire.tokens}</span>
          {req.fire.canBuy && Array.from({ length: req.fire.tokens }, (_, i) => i + 1).map((n) => <button key={n} className="chipbtn fire" onClick={() => answer({ kind: 'buy', n })}>+{n} move</button>)}
          {req.fire.canHurdle && <button className="chipbtn fire" onClick={() => answer({ kind: 'hurdle' })}>Hurdle (1)</button>}
          {req.fire.canFuego && <button className={`chipbtn fire ${fuego ? 'on' : ''}`} onClick={() => setFuego(!fuego)}>EN FUEGO (3)</button>}
          {req.passes.some((x) => x.bomb) && <span className="hint">Orange squares = FIRE BOMB (3 tokens)</span>}
        </div>
      )}
      {fuego && <div className="playbook fuego-list">{SKILLS.map((k) => <button key={k} className="chipbtn" title={abilityText(k)} onClick={() => answer({ kind: 'fuego', skill: k })}>{k}</button>)}</div>}
    </>
  );
}

// a skill check is coming: bench boost, plus CATCH cards and (INFERNO) fire tokens, showboating, BRING THE HEAT
function BoostPrompt({ req, answer, P, primary, name }) {
  const [v, setV] = useState({ boost: 0, fire: 0, showboat: 0, heat: false });
  const f = req.fire;
  const room = Math.max(0, (f?.room ?? req.max) - v.boost);
  const tokensLeft = f ? f.tokens - (v.heat ? 3 : 0) : 0;
  const go = () => answer(f ? v : v.boost);
  primary.current = go;
  const set = (k, n) => setV((x) => ({ ...x, [k]: n }));
  return (
    <>
      <h3>{req.label}</h3>
      <p className="hint">Already +{req.bonus} / −{req.penalty} (bonuses and penalties each stop at 3). Spent cards can't activate that player later this play.</p>
      {req.max > 0 && (
        <div className="boost-row"><span className="pb-label">Bench boost</span>
          {Array.from({ length: req.max + 1 }, (_, n) => <button key={n} className={`chipbtn ${v.boost === n ? 'on' : ''}`} disabled={f && n + v.fire > f.room} onClick={() => set('boost', n)}>{n ? `+${n}` : 'none'}</button>)}
          <span className="hint">{name(req.pid)} cards{req.catchFrom ? ` and CATCH: #${P(req.catchFrom).num}'s` : ''}</span>
        </div>
      )}
      {f && f.tokens > 0 && (
        <div className="boost-row"><span className="pb-label">🔥 Tokens</span>
          {Array.from({ length: Math.min(tokensLeft, room) + 1 }, (_, n) => <button key={n} className={`chipbtn fire ${v.fire === n ? 'on' : ''}`} onClick={() => set('fire', n)}>{n ? `+${n}` : 'none'}</button>)}
          {f.heat && <button className={`chipbtn fire ${v.heat ? 'on' : ''}`} disabled={!v.heat && f.tokens - v.fire < 3} onClick={() => set('heat', !v.heat)}>BRING THE HEAT (3)</button>}
        </div>
      )}
      {f && f.showboat > 0 && (
        <div className="boost-row"><span className="pb-label">Showboat</span>
          {Array.from({ length: f.showboat + 1 }, (_, n) => <button key={n} className={`chipbtn ${v.showboat === n ? 'on' : ''}`} onClick={() => set('showboat', n)}>{n ? `-${n}` : 'none'}</button>)}
          <span className="hint">extra penalty now, that many tokens if it works</span>
        </div>
      )}
      <div className="btns"><button className="btn primary" onClick={go}>Roll <Kbd a="primary" /></button></div>
    </>
  );
}

// INFERNO: before the snap, 3 tokens set a player ON FIRE
function OnFirePrompt({ req, answer, P, primary }) {
  const [pick, setPick] = useState(null);
  primary.current = () => answer(null);
  return (
    <>
      <h3>🔥 {req.tokens} fire tokens: set a player ON FIRE? (+3 on every check until he's stopped)</h3>
      <div className="btns">
        {req.options.map((pid) => <button key={pid} className={`btn ${pick === pid ? 'on' : ''}`} onClick={() => (req.anySkill.includes(pid) ? setPick(pid) : answer({ pid }))}>#{P(pid).num}</button>)}
        <button className="btn primary" onClick={() => answer(null)}>Not now <Kbd a="primary" /></button>
      </div>
      {pick && <><p className="hint">#{P(pick).num} gets any one skill while he's on fire:</p><div className="playbook">{SKILLS.map((k) => <button key={k} className="chipbtn" onClick={() => answer({ pid: pick, skill: k })}>{k}</button>)}</div></>}
    </>
  );
}

function FormationPrompt({ req, answer, edit, setEdit, sel, primary, hover, s }) {
  const [saving, setSaving] = useState(null);
  const [, bump] = useState(0);
  if (!edit) return null;
  const ctx = { line: req.line, dir: req.dir, col: req.col, count: req.roster.length };
  const teamId = s.teams[ME].id;
  const mine = savedFor(teamId)[req.role];
  const sets = req.role === 'offense' ? OFFENSE_SETS : DEFENSE_SETS;
  const useSet = (set) => setEdit(req.role === 'offense' ? buildOffense(set, req.roster, ctx) : buildDefense(set, req.roster, req.offense, ctx));
  const res = req.role === 'offense' ? checkOffense(edit, ctx) : checkDefense(edit, req.offense, ctx);
  const reroll = () => setEdit(req.role === 'offense' ? autoOffense(req.roster, ctx) : autoDefense(req.roster, req.offense, ctx));
  const last = lastFor(teamId, req.role);
  const lastSpots = last && last.spots.length === req.roster.length ? applySaved(last, req.role, ctx) : null;
  const lastOk = lastSpots && lastSpots.length === req.roster.length && (req.role === 'offense' ? checkOffense(lastSpots, ctx) : checkDefense(lastSpots, req.offense, ctx)).ok;
  const ready = () => { rememberLast(teamId, req.role, edit, ctx); answer(edit); };
  if (res.ok) primary.current = ready;
  return (
    <>
      <h3>Set your {req.role}{sel != null ? `: place #${sel}` : ''}</h3>
      <p className="hint">{sel != null ? (hover?.setup ? (hover.setup.ok ? 'Legal: the formation is ready with him here.' : `Here: ${hover.setup.errors[0]}`) : 'Green squares make the formation legal; blue are allowed but something else is still missing. Hover for why.') : 'Click one of your players to move him, pick a set from the playbook, or reroll.'}</p>
      <div className="playbook">
        <span className="pb-label">Playbook</span>
        {sets.map((set) => <button key={set.id} className="chipbtn" onClick={() => useSet(set)}>{set.name}</button>)}
        {mine.map((m) => (
          <span key={m.name} className="pb-mine">
            <button className="chipbtn mine" onClick={() => setEdit(applySaved(m, req.role, ctx))}>★ {m.name}</button>
            <button className="chipbtn x" title="Delete from your playbook" onClick={() => { deleteSaved(teamId, req.role, m.name); bump((x) => x + 1); }}>×</button>
          </span>
        ))}
      </div>
      {!res.ok && <ul className="errors">{res.errors.map((e) => <li key={e}>{e}</li>)}</ul>}
      <div className="btns">
        <button className="btn primary" disabled={!res.ok} onClick={ready}>Ready <Kbd a="primary" /></button>
        {lastOk && <button className="btn" onClick={() => setEdit(lastSpots)}>Same as last down</button>}
        <button className="btn" onClick={reroll}>Reroll</button>
        {saving == null
          ? <button className="btn" disabled={!res.ok} onClick={() => setSaving(`My ${req.role === 'offense' ? 'set' : 'D'} ${mine.length + 1}`)}>Save to playbook</button>
          : <span className="pb-save"><input value={saving} maxLength={20} onChange={(e) => setSaving(e.target.value)} autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') { saveFormation(teamId, req.role, saving.trim() || 'Mine', edit, ctx); setSaving(null); } e.stopPropagation(); }} />
            <button className="btn small primary" onClick={() => { saveFormation(teamId, req.role, saving.trim() || 'Mine', edit, ctx); setSaving(null); }}>Save</button></span>}
      </div>
    </>
  );
}

function CallPrompt({ req, answer, stack, setStack, rows, s, primary, askCoach }) {
  const teamId = s.teams[ME].id;
  const last = lastFor(teamId, 'call');
  const lastOk = last && last.length === req.count && (() => { const pool = [...req.bench]; return last.every((n) => { const i = pool.indexOf(n); if (i < 0) return false; pool.splice(i, 1); return true; }); })();
  const call = (st) => { rememberCall(teamId, st); answer(st); };
  const plays = savedFor(teamId).plays.filter((p) => { const pool = [...req.bench]; return p.call.every((n) => { const i = pool.indexOf(n); if (i < 0) return false; pool.splice(i, 1); return true; }); });
  const left = [...req.bench];
  for (const n of stack) left.splice(left.indexOf(n), 1);
  const ready = stack.length === req.count;
  if (ready) primary.current = () => call(stack);
  return (
    <>
      <h3>Call your play: {req.count} cards, in the order they'll go</h3>
      {plays.length > 0 && (
        <div className="playbook"><span className="pb-label">Plays</span>{plays.map((p) => <button key={p.name} className="chipbtn mine" onClick={() => setStack([...p.call])}>★ {p.call.map((n) => `#${n}`).join(' ')}</button>)}</div>
      )}
      <div className="stack-row">
        {Array.from({ length: req.count }, (_, i) => (
          <button key={i} className={`card slot ${stack[i] ? '' : 'empty'}`} onClick={() => stack[i] && setStack(stack.filter((_, j) => j !== i))}>
            <small>{i + 1}</small>{stack[i] ? <CardFace num={stack[i]} rows={rows} s={s} /> : null}
          </button>
        ))}
      </div>
      <CardRow nums={left} rows={rows} s={s} onPick={(n) => { if (stack.length < req.count) { setStack([...stack, n]); playSound('card'); } }} />
      <div className="btns">
        <button className="btn primary" disabled={!ready} onClick={() => call(stack)}>Call it <Kbd a="primary" /></button>
        <button className="btn" onClick={askCoach} title="The All-Pro coach's five, in order">Coach's call</button>
        {lastOk && <button className="btn" onClick={() => setStack([...last])}>Same as last</button>}
        <button className="btn" onClick={() => { const pool = [...req.bench]; const out = []; while (out.length < req.count) out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]); setStack(out); }}>Random</button>
        {ready && <button className="btn" onClick={() => savePlay(teamId, `Play ${stack.map((n) => n).join('-')}`, stack)}>Save play</button>}
        {stack.length > 0 && <button className="btn" onClick={() => setStack([])}>Clear</button>}
      </div>
    </>
  );
}

function MotionPrompt({ req, answer, motion, discard, setDiscard, rows, s, primary }) {
  // once a player and a square are picked, Space sends him (when the cards are chosen); otherwise Space = no motion
  primary.current = motion ? (discard.length === req.cost ? () => answer({ ...motion, discard }) : null) : () => answer(null);
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
        {motion
          ? <><button className="btn primary pulse" disabled={discard.length !== req.cost} onClick={() => answer({ ...motion, discard })}>Go in motion {discard.length === req.cost && <Kbd a="primary" />}</button>
            <button className="btn" onClick={() => answer(null)}>No motion</button></>
          : <button className="btn primary" onClick={() => answer(null)}>No motion <Kbd a="primary" /></button>}
      </div>
    </>
  );
}

function Waiting({ s, online, spectating }) {
  const t = { formation: 'Lining up…', call: 'Calling plays…', motion: 'Pre-snap…', play: 'Play is on!', dead: 'Whistle.', setup: 'Coin toss…', over: 'Final' }[s.phase] ?? '';
  if (spectating) return <h3 className="muted">Watching. {t}</h3>;
  return <h3 className="muted">{s.request ? (online ? 'Your opponent is deciding…' : 'The computer is thinking…') : t}</h3>;
}

// online: the connection, the other coach's status (the host can hand a dropped friend's side to the computer), and
// quick reactions both ways
function OnlineBar({ net, host }) {
  const [, bump] = useState(0);
  const [chat, setChat] = useState(false);
  useEffect(() => net.on(() => bump((x) => x + 1)), [net]);
  const f = host ? net.friend : null;
  const recent = (net.reactions ?? []).filter((r) => Date.now() - r.at < 3500);
  useEffect(() => { if (!recent.length) return undefined; const t = setTimeout(() => bump((x) => x + 1), 3600); return () => clearTimeout(t); });
  return (
    <>
      <div className="online-bar glass">
        <span className={`dot ${host ? (f?.connected ? 'on' : 'off') : net.status === 'game' ? 'on' : 'off'}`} />
        <span>{host ? (f ? `${f.name}${f.connected ? '' : ' (disconnected)'}${f.cpu ? ' · computer covering' : ''}` : 'No opponent') : net.status === 'reconnecting' ? 'Reconnecting to the host…' : `Room ${net.code}`}</span>
        {host && f && !f.connected && !f.cpu && <button className="btn small" onClick={() => net.takeOver()}>Let the computer play</button>}
        <span className="reacts">{REACTIONS.map((e, k) => <button key={k} className="chipbtn" onClick={() => (host ? net.react(0, k) : net.react(k))}>{e}</button>)}</span>
        <span className="jukebox"><button className="chipbtn" onClick={() => setChat(!chat)} title="Quick chat">💬</button>
          {chat && <span className="chat-menu glass">{PHRASES.map((p, i) => <button key={p} className="chipbtn" onClick={() => { const k = REACTIONS.length + i; if (host) net.react(0, k); else net.react(k); setChat(false); }}>{p}</button>)}</span>}</span>
      </div>
      <div className="react-float">{recent.map((r) => <span key={r.id} className={`rf side${r.side} ${r.k >= REACTIONS.length ? 'phrase' : ''}`}>{r.k < REACTIONS.length ? REACTIONS[r.k] : PHRASES[r.k - REACTIONS.length]}</span>)}</div>
      {!host && net.status === 'reconnecting' && (
        <div className="reconnect">
          {net.away
            ? <span className="away"><b className="led">THE HOST IS AWAY</b><br />The game is saved on their side. You'll be back in as soon as they resume it (Online → Your online games). You can close this and Rejoin later too.</span>
            : <span className="led">RECONNECTING…</span>}
        </div>
      )}
      {!host && net.status === 'ended' && <div className="reconnect"><span>{net.error || 'The room closed.'}</span></div>}
    </>
  );
}

// ---------- cards ----------
function CardFace({ num, rows, s, side = ME }) {
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

function Cards({ s, rows, opp = 'CPU' }) {
  const [open, setOpen] = useState(false); // phones: the deck details fold away
  const mine = s.cards[ME], theirs = s.cards[1 - ME];
  const oppRows = useMemo(() => artRows(s, 1 - ME), [s.teams]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className={`cards glass ${open ? 'open' : ''}`} onClick={() => setOpen(!open)}>
      <div className="faceup">
        <div className="fu"><small>You</small>{s.faceUp[ME] != null ? <span className="card big"><CardFace num={s.faceUp[ME]} rows={rows} s={s} /></span> : <span className="card big empty" />}</div>
        <div className="fu"><small>{opp}</small>{s.faceUp[1 - ME] != null ? <span className="card big"><CardFace num={s.faceUp[1 - ME]} rows={oppRows} s={s} side={1 - ME} /></span> : <span className="card big empty" />}</div>
      </div>
      <span className="cards-sum">Bench {mine.bench.length} · {opp} {theirs.bench.length} <em>{open ? '▴' : '▾'}</em></span>
      <div className="decks">
        <div><small>Your play</small><span className="mini">{mine.stack.map((n, i) => <i key={i}>#{n}</i>)}{!mine.stack.length && <em>—</em>}</span></div>
        <div><small>Your bench ({mine.bench.length})</small><span className="mini">{group(mine.bench).map(([n, k]) => <i key={n}>#{n}{k > 1 ? '×2' : ''}</i>)}</span></div>
        <div><small>{opp}</small><span className="mini"><i>play {theirs.stack.length}</i><i>bench {theirs.bench.length}</i></span></div>
      </div>
    </div>
  );
}
const group = (nums) => { const m = new Map(); for (const n of nums) m.set(n, (m.get(n) ?? 0) + 1); return [...m]; };

// ---------- scoreboard, log, moments ----------
function LogFeed({ s, canUndo, onUndo, online, onOpen }) {
  const [open, setOpen] = useState(false); // the whole log, scrollable
  const [hidden, setHidden] = useState(() => { try { return localStorage.getItem('tb-log-hidden') === '1'; } catch { return false; } });
  const hide = (h) => { setHidden(h); setOpen(false); try { localStorage.setItem('tb-log-hidden', h ? '1' : '0'); } catch { /* not kept */ } };
  const all = s.log.filter((e) => !['activate', 'formation', 'call'].includes(e.kind));
  const items = hidden ? [] : all.slice(open ? -60 : -7);
  const list = useRef();
  useEffect(() => { if (open && list.current) list.current.scrollTop = list.current.scrollHeight; }, [open, all.length]);
  return (
    <div className={`logfeed ${open ? 'open' : ''}`}>
      <div className="log-head">
        {!hidden && <button className="btn small" onClick={() => setOpen((x) => !x)}>{open ? 'Less' : 'Full log'}</button>}
        <button className="btn small" onClick={() => hide(!hidden)}>{hidden ? 'Show log' : 'Hide log'}</button>
        {!online && <button className="btn small" disabled={!canUndo} onClick={onUndo} title="Take back your last move (only before any dice are rolled)">Undo move</button>}
      </div>
      <div className="log-list" ref={list}>
        {items.map((e) => {
          const roll = ['check', 'sport', 'scatter', 'dice', 'kick'].includes(e.kind);
          return <div key={e.id} className={`log-${e.kind} ${roll ? 'rollable' : ''}`} onClick={roll ? () => onOpen(e) : undefined} title={roll ? 'Why? Click for the full roll' : undefined}>{roll ? '🎲 ' : ''}{e.text}</div>;
        })}
      </div>
    </div>
  );
}

// the number that matters on a roll, big
function rollNumber(e) {
  if (e.kind === 'check' || e.kind === 'kick') return e.total;
  if (e.kind === 'scatter') return Math.abs(e.dice[0] - e.dice[1]);
  return e.dice[0] + e.dice[1];
}

// dice for the latest check, and a banner for the big moments
function Moment({ s }) {
  const last = [...s.log].reverse().find((e) => ['check', 'sport', 'scatter', 'kick'].includes(e.kind));
  const big = [...s.log].reverse().find((e) => ['td', 'turnover', 'safety', 'sack'].includes(e.kind));
  const call = [...s.log].slice(-6).reverse().find((e) => calloutFor(e));
  const [shown, setShown] = useState({});
  useEffect(() => {
    if (!call) return;
    setShown((x) => ({ ...x, call: call.id }));
    const t = setTimeout(() => setShown((x) => (x.call === call.id ? { ...x, call: null } : x)), 1900);
    return () => clearTimeout(t);
  }, [call?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!last) return;
    setShown((x) => ({ ...x, dice: last.id }));
    const t = setTimeout(() => setShown((x) => (x.dice === last.id ? { ...x, dice: null } : x)), 3600);
    return () => clearTimeout(t);
  }, [last?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!big) return;
    // a touchdown waits until the runner is in the end zone on screen
    const wait = settings().calm ? 0 : delayFor(s.log, s.log.indexOf(big)) * 1000;
    let t2;
    const t1 = setTimeout(() => {
      setShown((x) => ({ ...x, big: big.id }));
      t2 = setTimeout(() => setShown((x) => (x.big === big.id ? { ...x, big: null } : x)), 2400);
    }, wait);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [big?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const words = { td: 'TOUCHDOWN!', turnover: 'TURNOVER!', safety: 'SAFETY!', sack: 'SACKED!' };
  return (
    <>
      {last && shown.dice === last.id && (
        <div className={`dice-toast glass ${last.kind === 'check' ? last.result : last.kind === 'kick' ? (last.good ? 'total' : 'fail') : last.ok === false ? 'fail' : ''}`}>
          <b className="roll-big led" key={last.id}>{rollNumber(last)}</b>
          <span className="dice">{last.dice.map((d, i) => <Die key={i} n={d} />)}</span>
          <span>{last.text}</span>
        </div>
      )}
      {big && shown.big === big.id && <div className={`banner-big ${big.kind}`}><span className="led">{words[big.kind]}</span></div>}
      {call && shown.call === call.id && !(big && shown.big === big.id) && <div className={`callout ${['onfire', 'heat', 'fuego', 'firebomb'].includes(call.kind) ? 'hot' : ''}`} key={call.id}><span>{calloutFor(call)}</span></div>}
    </>
  );
}
const PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
function Die({ n }) {
  return <span className="die">{Array.from({ length: 9 }, (_, i) => <i key={i} className={PIPS[n]?.includes(i) ? 'on' : ''} />)}</span>;
}

// INFERNO: each coach's fire tokens (max 3) and who's on fire
function FireHud({ s, opp = 'CPU' }) {
  return (
    <div className="fire-hud glass">
      {[ME, 1 - ME].map((side) => (
        <div key={side} className="fire-side">
          <small>{side === ME ? 'You' : opp}</small>
          <span className="flames">{[0, 1, 2].map((i) => <i key={i} className={i < s.fire[side] ? 'on' : ''}>🔥</i>)}</span>
          <span className="lit">{Object.values(s.players).filter((p) => p.side === side && p.onFire).map((p) => <b key={p.pid}>#{p.num}</b>)}</span>
        </div>
      ))}
    </div>
  );
}

function EndScreen({ s, onExit, onRematch, match, online, highlights = [], onWatch }) {
  const [a, b] = s.score;
  const won = s.winner === ME;
  const top = [...highlights].sort((x, y) => y.score - x.score || x.play.id - y.play.id).slice(0, 3);
  useEffect(() => { if (won) setTimeout(() => playSound('fanfare'), 600); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [copied, setCopied] = useState(false);
  const share = () => {
    const best = Object.entries(s.box).map(([pid, b]) => ({ p: s.players[pid], b, v: b.tds * 6 + (b.rushYds + b.recYds + b.passYds) / 10 + b.tackles + b.sacks * 2 }))
      .filter((x) => x.p).sort((x, y) => y.v - x.v).slice(0, 2)
      .map(({ p, b }) => `${s.teams[p.side].name} #${p.num}: ${b.tds ? `${b.tds} TD, ` : ''}${b.rushYds + b.recYds + b.passYds} yds${b.tackles ? `, ${b.tackles} tkl` : ''}`);
    const text = `TECHNO BOWL FINAL\n${s.teams[0].name} ${a} - ${b} ${s.teams[1].name}\n${best.join('\n')}\n${location.origin}`;
    navigator.clipboard?.writeText(text);
    setCopied(true); setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="modal">
      <div className="modal-card glass end-card">
        <h2 className="led big">{s.winner == null ? 'TIE GAME' : won ? 'YOU WIN!' : 'YOU LOSE'}</h2>
        <p className="final"><span>{s.teams[0].name}</span> <b className="led">{a}</b> – <b className="led">{b}</b> <span>{s.teams[1].name}</span></p>
        <StatCard s={s} title="FINAL" />
        <PlayerOfTheGame s={s} />
        {top.length > 0 && (
          <div className="recap">
            <h3>Highlights</h3>
            {top.map((h, i) => <button key={h.play.id} className="btn small" onClick={() => onWatch(h.play)}>▶ {i + 1}. {h.label}</button>)}
          </div>
        )}
        <div className="btns"><button className="btn small" onClick={share}>{copied ? 'Copied!' : 'Copy the result to share'}</button></div>
        <div className="btns">{online
          ? (match?.online
            ? <><button className="btn" onClick={onExit}>Back to the lobby</button><button className="btn primary" onClick={onRematch}>Rematch</button></>
            : <><span className="hint">The host can start a rematch.</span><button className="btn" onClick={onExit}>Leave</button></>)
          : match?.season
          ? <button className="btn primary" onClick={onExit}>Back to the season</button>
          : <><button className="btn" onClick={onExit}>Change teams</button><button className="btn primary" onClick={onRematch}>Rematch</button></>}</div>
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
// the half-time show: the stat card, and the first half's best plays to watch (the jukebox plays a track meanwhile)
function Halftime({ s, highlights = [], onWatch }) {
  const half = s.log.findLast?.((e) => e.kind === 'half' && e.half === 2);
  const [open, setOpen] = useState(null);
  const top = highlights.filter((h) => h.half === 1).sort((x, y) => y.score - x.score).slice(0, 3).sort((x, y) => x.play.id - y.play.id);
  useEffect(() => {
    if (!half) return;
    setOpen(half.id);
    const t = setTimeout(() => setOpen(null), top.length ? 12000 : 7000);
    return () => clearTimeout(t);
  }, [half?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!half || open !== half.id) return null;
  return (
    <div className="halftime">
      <StatCard s={s} title="HALF TIME" onClose={() => setOpen(null)} />
      {top.length > 0 && (
        <div className="half-hl glass">
          <b className="led">FIRST-HALF HIGHLIGHTS</b>
          {top.map((h) => <span key={h.play.id}>{h.label}</span>)}
          <button className="btn primary" onClick={() => { setOpen(null); onWatch(top.map((h) => h.play)); }}>▶ Watch them</button>
        </div>
      )}
    </div>
  );
}

// the chance a block / tackle succeeds, for its button
function chance(s, actor, target, action = 'block') {
  const m = contactMods(s, actor, target, action);
  return pct(odds(netModifier(m.bonus, m.penalty)).success);
}

// the coach's suggestion in words
function describe(v, P) {
  if (!v) return 'do nothing';
  switch (v.kind) {
    case 'move': return `move to the gold square (${v.to[0] + 1}, ${v.to[1] + 1})`;
    case 'tackle': return `tackle #${P(v.pid).num}`;
    case 'shove': return `shove #${P(v.pid).num}`;
    case 'juke': return `juke #${P(v.pid).num}`;
    case 'shake': return `shake #${P(v.pid).num}`;
    case 'dirty': return `dirty hit on #${P(v.pid).num}`;
    case 'buy': return `buy ${v.n} movement with fire tokens`;
    case 'block': return `block #${P(v.pid).num}`;
    case 'handoff': return `hand off with #${P(v.pid).num}`;
    case 'pass': return 'throw to the gold square';
    case 'stand': return 'stand up';
    case 'adjust': return 'make an adjustment';
    default: return 'do nothing and keep your shape';
  }
}

// a roll opened from the play log: every number that went into it
function RollDetail({ e, onClose }) {
  useEffect(() => {
    const k = (ev) => { if (ev.key === 'Escape') { ev.stopPropagation(); onClose(); } };
    window.addEventListener('keydown', k, true);
    return () => window.removeEventListener('keydown', k, true);
  }, [onClose]);
  const sign = (n) => (n > 0 ? `+${n}` : `${n}`);
  const rows = [];
  if (e.kind === 'check') {
    rows.push(['Dice', `${e.dice[0]} + ${e.dice[1]}${e.pm ? ` (playmaker die ${e.pm}${e.matches ? `: ${e.matches} match${e.matches > 1 ? 'es' : ''}` : ''})` : ''}`]);
    rows.push(['Bonuses', `${sign(e.bonus)} (rating, teamwork, abilities${e.action === 'pass' ? ', range' : ''})`]);
    if (e.why?.length) rows.push(['Throw', e.why.join(', ')]);
    if (e.boost) rows.push(['Bench boost', sign(e.boost)]);
    if (e.fire) rows.push(['Fire tokens', sign(e.fire)]);
    rows.push(['Penalties', `-${e.penalty} (their teamwork / coverage${e.penalty && e.action !== 'pass' ? ', dodge' : ''})`]);
    if (e.showboat) rows.push(['Showboat', `-${e.showboat}`]);
    if (e.against) rows.push(['Their fire tokens', `-${e.against}`]);
    rows.push(['Net (Rule of 3)', sign(e.net)]);
    rows.push(['Total', `${e.total}: ${e.result === 'total' ? 'TOTAL SUCCESS (10+)' : e.result === 'partial' ? 'success (7-9)' : 'failure (6 or less)'}${e.crit ? ', CRITICAL (doubles)' : ''}`]);
  } else if (e.kind === 'sport') {
    rows.push(['Dice', `${e.dice[0]} and ${e.dice[1]}`], ['Sport check', e.ok ? 'no doubles: success' : 'doubles: failure']);
  } else if (e.kind === 'scatter') {
    rows.push(['Dice', `${e.dice[0]} - ${e.dice[1]}`], ['Distance', `${Math.abs(e.dice[0] - e.dice[1])} squares (the higher die picks the way; equal = dramatic recovery)`]);
  } else if (e.kind === 'kick') {
    rows.push(['Dice', e.dice.join(' + ')], ['Needed', `${e.dist} or more`], ['Result', `${e.total}: ${e.good ? 'GOOD' : 'no good'}`]);
  } else rows.push(['Dice', e.dice.join(' - ')]);
  return (
    <div className="modal" onClick={onClose}>
      <div className="modal-card glass roll-detail" onClick={(ev) => ev.stopPropagation()}>
        <h3>{e.label ?? e.text}</h3>
        <table className="checks"><tbody>{rows.map(([k, v]) => <tr key={k}><td>{k}</td><td>{v}</td></tr>)}</tbody></table>
        <div className="btns"><button className="btn primary" onClick={onClose}>Got it</button></div>
      </div>
    </div>
  );
}

// whether you can hear the game: muted, waiting for the browser to allow audio, or on. One click fixes either.
function SoundChip() {
  const [st, setSt] = useState(audioState);
  useEffect(() => { const t = setInterval(() => setSt(audioState()), 1000); return () => clearInterval(t); }, []);
  const fix = async () => {
    if (st === 'muted') { const m = settings().mix ?? {}; setSettings({ muted: false, ...(!m.fx && !m.crowd && !m.music ? { mix: { fx: 1, crowd: 0.75, music: 0.75 } } : {}) }); }
    await nudgeAudio();
    setSt(audioState());
    playSound('whistle', { vol: 0.6 });
  };
  const label = { on: '🔊 Sound', muted: '🔇 Muted: click to unmute', off: '🔈 Click to turn sound on' }[st];
  return <button className={`btn small sound-chip ${st}`} onClick={fix} title="Sound check">{label}</button>;
}

// ---------- the commentary ticker: a broadcast line for the big moments ----------
const CALLS = {
  td: ['TOUCHDOWN! HE IS GONE!', 'SIX! ...PLUS ONE! TOUCHDOWN!', 'NOBODY IS CATCHING HIM!', 'INTO THE END ZONE!'],
  turnover: ['TURNOVER! THE BALL CHANGES HANDS!', 'THEY TAKE IT AWAY!', 'WHAT A CHANGE OF FORTUNE!'],
  sack: ['BURIED IN THE BACKFIELD!', 'SACKED! NOWHERE TO GO!', 'THE POCKET COLLAPSES!'],
  catch: ['WHAT A GRAB!', 'HE HAULS IT IN!', 'RIGHT ON THE NUMBERS!'],
  stiffarm: ['WHAT A STIFF ARM!', 'GET OFF ME! STIFF ARM!'],
  spin: ['A SPIN MOVE! HE IS FREE!', 'SPUN RIGHT AROUND HIM!'],
  heat: ['BRINGING THE HEAT!', 'THAT ONE LEFT A MARK!'],
  intercept: ['HE JUMPS THE ROUTE!', 'READ IT ALL THE WAY!'],
  fieldgoal: ['IT IS GOOD!', 'RIGHT DOWN THE MIDDLE!'],
  safety: ['SAFETY! TWO POINTS!', 'TRAPPED IN HIS OWN END ZONE!'],
  onfire: ['HE IS ON FIRE!', 'SOMEBODY CALL THE FIRE DEPARTMENT!'],
  fumble: ['FUMBLE! THE BALL IS LOOSE!', 'IT IS ON THE GROUND!'],
  dogpile: ['DOGPILE! EVERYBODY IN!'],
};
function callFor(e) {
  if (!e) return null;
  if (e.kind === 'catch' && !(e.yds >= 20)) return null;
  if (e.kind === 'turnover' && e.downs) return 'TURNOVER ON DOWNS!';
  if (e.kind === 'kick' && !e.good) return 'NO GOOD! WIDE!';
  const list = CALLS[e.kind];
  return list ? list[e.id % list.length] : null;
}
function Ticker({ s }) {
  const call = [...s.log].slice(-4).reverse().find((e) => callFor(e));
  const [on, setOn] = useState(null);
  useEffect(() => {
    if (!call) return undefined;
    const wait = call.kind === 'td' ? delayFor(s.log, s.log.indexOf(call)) * 1000 : 0; // the touchdown call waits for the runner
    let t2;
    const t1 = setTimeout(() => { setOn(call.id); t2 = setTimeout(() => setOn(null), 3200); }, wait);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [call?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!call || on !== call.id) return null;
  return <div className="ticker" key={call.id}><span className="ticker-tag">LIVE</span><span>{callFor(call)}</span></div>;
}

// ---------- player of the game, from the box score ----------
function PlayerOfTheGame({ s }) {
  let best = null, bv = -Infinity;
  for (const [pid, b] of Object.entries(s.box)) {
    const p = s.players[pid];
    if (!p) continue;
    const v = b.tds * 6 + (b.rushYds + b.recYds) / 8 + b.passYds / 12 + b.tackles * 1.5 + b.sacks * 3 - b.fumbles * 2 + (s.winner === p.side ? 2 : 0);
    if (v > bv) { bv = v; best = { p, b }; }
  }
  if (!best || bv <= 0) return null;
  const { p, b } = best;
  const bits = [b.tds && `${b.tds} TD`, b.rushYds && `${b.rushYds} rush yds`, b.recYds && `${b.rec} catches, ${b.recYds} yds`, b.passYds && `${b.comp}/${b.att}, ${b.passYds} pass yds`, b.tackles && `${b.tackles} tackles`, b.sacks && `${b.sacks} sacks`].filter(Boolean);
  return (
    <div className="potg">
      <span className="led">PLAYER OF THE GAME</span>
      <b>#{p.num} {p.name ?? ''}</b>
      <small>{s.teams[p.side].name} · {bits.join(' · ') || 'all over the field'}</small>
    </div>
  );
}
