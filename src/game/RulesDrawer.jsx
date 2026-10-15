// The rules, in the game (a drawer, opened at the section a prompt is about) and as a full page (?view=rules).
// One chapter at a time on tabs, plus a search across every rule.
import { useEffect, useRef, useState } from 'react';
import { RULES } from '../data/rulesText';
import { Panel } from './ui';

// the rule text with the search words lit up
function Lit({ text, words }) {
  if (!words.length) return text;
  const re = new RegExp(`(${words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
  return text.split(re).map((part, i) => (i % 2 ? <mark key={i}>{part}</mark> : part));
}

function RulesBrowser({ focus, autoFocus }) {
  const [tab, setTab] = useState(focus ?? RULES[0].id);
  const [q, setQ] = useState('');
  const body = useRef();
  useEffect(() => { if (focus) { setTab(focus); setQ(''); } }, [focus]);
  useEffect(() => { body.current?.scrollTo?.({ top: 0 }); }, [tab, q]);
  const words = q.trim().toLowerCase().split(/\s+/).filter((w) => w.length > 1);
  const hits = words.length
    ? RULES.map((sec) => ({ ...sec, items: sec.items.filter((l) => words.every((w) => `${sec.title} ${l}`.toLowerCase().includes(w))) })).filter((sec) => sec.items.length)
    : null;
  const i = RULES.findIndex((s) => s.id === tab);
  const sec = RULES[i] ?? RULES[0];
  return (
    <div className="rules-browser">
      <input className="rules-search" type="search" placeholder="Search the rules (try: tackle, sack, scatter)" value={q} autoFocus={autoFocus}
        onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Escape' && q) { e.stopPropagation(); setQ(''); } }} />
      {!hits && (
        <nav className="rules-tabs" role="tablist">
          {RULES.map((s) => <button key={s.id} role="tab" aria-selected={s.id === sec.id} className={`rules-tab ${s.id === sec.id ? 'on' : ''}`} onClick={() => setTab(s.id)}>{s.title}</button>)}
        </nav>
      )}
      <div className="rules-body" ref={body}>
        {hits ? (
          hits.length ? hits.map((h) => (
            <section key={h.id} className="rule-sec">
              <h3><button className="linkish" onClick={() => { setQ(''); setTab(h.id); }}>{h.title}</button> <small>p.{h.page}</small></h3>
              <ul>{h.items.map((l) => <li key={l}><Lit text={l} words={words} /></li>)}</ul>
            </section>
          )) : <p className="muted">Nothing matches “{q}”. Try a shorter word.</p>
        ) : (
          <section className="rule-sec">
            <h3>{sec.title} <small>rulebook p.{sec.page}</small></h3>
            <ul>{sec.items.map((l) => <li key={l}>{l}</li>)}</ul>
            <div className="rules-pager">
              {i > 0 ? <button className="btn small" onClick={() => setTab(RULES[i - 1].id)}>◀ {RULES[i - 1].title}</button> : <span />}
              {i < RULES.length - 1 && <button className="btn small" onClick={() => setTab(RULES[i + 1].id)}>{RULES[i + 1].title} ▶</button>}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

export default function RulesDrawer({ onClose, focus }) {
  useEffect(() => {
    const key = (e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    window.addEventListener('keydown', key, true);
    return () => window.removeEventListener('keydown', key, true);
  }, [onClose]);
  return (
    <aside className="rules-drawer glass" role="dialog" aria-label="Rules">
      <header><h2>Rules</h2><button className="btn small" onClick={onClose}>Close</button></header>
      <RulesBrowser focus={focus} />
    </aside>
  );
}

export function RulesPage({ go }) {
  return (
    <main className="page rules-page">
      <h1 className="page-title">How to play</h1>
      <Panel className="rules-intro">
        <p>Techno Bowl is tabletop football on a grid: every player is a cube, every play is a stack of five cards, and the dice decide the hits. These are the Techno mode rules (7-vs-7, no special abilities, no field goals).</p>
        <div className="btns"><button className="btn primary" onClick={() => go('tutorial')}>Play the tutorial</button><button className="btn" onClick={() => go('teams')}>Play a game</button></div>
      </Panel>
      <Panel><RulesBrowser /></Panel>
    </main>
  );
}
