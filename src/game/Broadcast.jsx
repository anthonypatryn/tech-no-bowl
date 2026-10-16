// The TV package over the game: score bug, lower-third chyrons, halftime / final stat cards, and the MFL-shield wipe
// between possessions, scores and halves. Everything is driven by the engine's log and box score.
import { synth } from './sound';
import { useEffect, useRef, useState } from 'react';
import { teamColors, helmetUrl, artUrl } from '../data/art';
import { yardLabel } from '../engine/board.js';

const abbr = (name) => name.replace(/[^A-Za-z]/g, '').slice(0, 4).toUpperCase();
const ORD = ['', '1ST', '2ND', '3RD', '4TH'];
const colors = (s, side) => teamColors(s.teams[side].id, s.teams[side].uniform);

// ---------- score bug ----------
export function ScoreBug({ s }) {
  const half = s.overtime ? 'OT' : s.half === 1 ? '1ST' : '2ND';
  const team = (side) => {
    const [c0, c1] = colors(s, side);
    return (
      <div className={`bug-team ${s.offense === side && s.phase !== 'setup' ? 'ball' : ''}`} style={{ '--c0': c0, '--c1': c1 }}>
        {helmetUrl(s.teams[side].id) && <img src={helmetUrl(s.teams[side].id)} alt="" className={side ? 'flip' : ''} />}
        <span className="bug-abbr">{abbr(s.teams[side].name)}</span>
        <b className="bug-score">{s.score[side]}</b>
        <span className="bug-tos">{[0, 1].map((i) => <i key={i} className={i < s.timeouts[side] ? 'on' : ''} />)}</span>
      </div>
    );
  };
  return (
    <div className="scorebug">
      <img className="bug-shield" src={artUrl('mfl-shield.webp')} alt="MFL" />
      {team(0)}
      {team(1)}
      <div className="bug-clock">
        <span>{half}</span>
        {!s.overtime && <span className="cubes">{s.pile.map((c, i) => <i key={i} className={c === 'r' ? 'red' : ''} />)}{!s.pile.length && s.phase !== 'setup' && <em>0:00</em>}</span>}
      </div>
      {s.phase !== 'setup' && <div className="bug-down">{ORD[s.down]} & GOAL <span>· {yardLabel(s.line, s.teams[s.offense].dir)}</span></div>}
    </div>
  );
}

// ---------- chyrons ----------
// a lower third for the player who just made the play, or a drive summary
function chyronFor(e, s) {
  const P = (pid) => s.players[pid];
  const box = (pid) => s.box[pid] ?? {};
  const line = (pid, text) => { const p = P(pid); return p && { side: p.side, num: p.num, name: p.name, artNum: p.artNum, text }; };
  if (e.kind === 'catch') { const b = box(e.pid); return line(e.pid, `${b.rec} catch${b.rec === 1 ? '' : 'es'} · ${b.recYds} yds`); }
  if (e.kind === 'td' && e.pid) { const b = box(e.pid); return line(e.pid, `TOUCHDOWN · ${b.tds} TD${b.tds === 1 ? '' : 's'} · ${b.rushYds ? `${b.carries} car ${b.rushYds} yds` : `${b.rec} rec ${b.recYds} yds`}`); }
  if (e.kind === 'tackle' && e.by) { const b = box(e.by); return line(e.by, `${b.tackles} tackle${b.tackles === 1 ? '' : 's'}${b.sacks ? ` · ${b.sacks} sack${b.sacks === 1 ? '' : 's'}` : ''}`); }
  if (e.kind === 'sack' && e.by) { const b = box(e.by); return line(e.by, `SACK! · ${b.sacks} sack${b.sacks === 1 ? '' : 's'}`); }
  if (e.kind === 'turnover' && e.pid) return line(e.pid, 'TURNOVER!');
  if (e.kind === 'drive') return { side: e.drive.side, drive: true, text: `DRIVE · ${e.drive.plays} play${e.drive.plays === 1 ? '' : 's'} · ${e.drive.yards} yds · ${e.drive.result}` };
  return null;
}

export function Chyrons({ s }) {
  const [shown, setShown] = useState(null);
  const queue = useRef([]);
  const seen = useRef(s.log.at(-1)?.id ?? 0);
  useEffect(() => {
    const fresh = s.log.filter((e) => e.id > seen.current);
    if (!fresh.length) return;
    seen.current = s.log.at(-1).id;
    for (const e of fresh) { const c = chyronFor(e, s); if (c) queue.current.push({ ...c, id: e.id }); }
    queue.current = queue.current.slice(-3);
  }, [s.log]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (shown) { const t = setTimeout(() => setShown(null), 3800); return () => clearTimeout(t); }
    const t = setInterval(() => { if (queue.current.length) { setShown(queue.current.shift()); } }, 300);
    return () => clearInterval(t);
  }, [shown]);
  if (!shown) return null;
  const [c0, c1] = colors(s, shown.side);
  return (
    <div className="chyron" key={shown.id} style={{ '--c0': c0, '--c1': c1 }}>
      <div className="chy-tab">{shown.drive ? abbr(s.teams[shown.side].name) : `#${shown.num}`}</div>
      <div className="chy-body">
        {!shown.drive && <b>{shown.name?.toUpperCase()}</b>}
        <span>{shown.text}</span>
      </div>
      <img src={artUrl('mfl-shield.webp')} alt="" />
    </div>
  );
}

// ---------- stat card (half time, final) ----------
export function teamTotals(s, side) {
  const t = { rush: 0, pass: 0, comp: 0, att: 0, tackles: 0, sacks: 0, tds: 0, fumbles: 0 };
  for (const [pid, b] of Object.entries(s.box)) {
    if (s.players[pid]?.side !== side) continue;
    t.rush += b.rushYds; t.pass += b.passYds; t.comp += b.comp; t.att += b.att; t.tackles += b.tackles; t.sacks += b.sacks; t.tds += b.tds; t.fumbles += b.fumbles;
  }
  return t;
}
function leader(s, side, key) {
  let best = null;
  for (const [pid, b] of Object.entries(s.box)) if (s.players[pid]?.side === side && b[key] > (best?.v ?? 0)) best = { p: s.players[pid], v: b[key] };
  return best;
}
export function StatCard({ s, title, onClose }) {
  const a = teamTotals(s, 0), b = teamTotals(s, 1);
  const rows = [['Rushing yds', a.rush, b.rush], ['Passing yds', a.pass, b.pass], ['Comp / att', `${a.comp}/${a.att}`, `${b.comp}/${b.att}`], ['Tackles', a.tackles, b.tackles], ['Sacks', a.sacks, b.sacks], ['Fumbles', a.fumbles, b.fumbles]];
  const lead = [['rushYds', 'RUSH'], ['recYds', 'REC'], ['tackles', 'TKL']];
  const [c0] = colors(s, 0), [d0] = colors(s, 1);
  return (
    <div className="statcard glass" style={{ '--c0': c0, '--d0': d0 }}>
      <header><img src={artUrl('mfl-shield.webp')} alt="" /><h2 className="led">{title}</h2></header>
      <div className="stat-teams">
        <div><b>{s.teams[0].name}</b><span className="led">{s.score[0]}</span></div>
        <div><span className="led">{s.score[1]}</span><b>{s.teams[1].name}</b></div>
      </div>
      <table>
        <tbody>{rows.map(([k, x, y]) => <tr key={k}><td>{x}</td><th>{k}</th><td>{y}</td></tr>)}</tbody>
      </table>
      <div className="stat-leaders">
        {[0, 1].map((side) => (
          <ul key={side}>{lead.map(([key, l]) => { const L = leader(s, side, key); return <li key={key}><i>{l}</i>{L ? `#${L.p.num} ${L.p.name} · ${L.v}` : '—'}</li>; })}</ul>
        ))}
      </div>
      {onClose && <div className="btns"><button className="btn primary" onClick={onClose}>Continue</button></div>}
    </div>
  );
}

// ---------- the wipe ----------
// a sweep of both teams' colours with the shield, on: change of possession, touchdown, safety, half time, overtime
const WIPE_ON = { turnover: 'TURNOVER', td: 'TOUCHDOWN', safety: 'SAFETY', half: null };
export function Wipe({ s }) {
  const [w, setW] = useState(null);
  const last = s.log.at(-1);
  useEffect(() => {
    if (!last || !(last.kind in WIPE_ON)) return;
    const word = last.kind === 'half' ? (last.half === 3 ? 'OVERTIME' : last.half === 2 ? 'SECOND HALF' : 'KICK-OFF') : WIPE_ON[last.kind];
    const side = last.side ?? s.offense;
    setW({ id: last.id, word, side });
    synth('whoosh'); setTimeout(() => synth('whooshOut'), 1250);
    const t = setTimeout(() => setW((x) => (x?.id === last.id ? null : x)), 1700);
    return () => clearTimeout(t);
  }, [last?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!w) return null;
  const [c0, c1] = colors(s, w.side);
  const [d0] = colors(s, 1 - w.side);
  return (
    <div className="wipe" key={w.id} style={{ '--c0': c0, '--c1': c1, '--d0': d0 }}>
      <i className="w1" /><i className="w2" /><i className="w3" />
      <div className="wipe-mid"><img src={artUrl('mfl-shield.webp')} alt="" /><span className="led">{w.word}</span></div>
    </div>
  );
}
