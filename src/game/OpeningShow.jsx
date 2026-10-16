// The opening show: the Techno Bowl logo, the two helmets smashing together, the head-to-head card with records, over
// the TV theme; then the run-out on the 3D field (Board's RunOut + camera, timed by introPlan.js): the away team out
// of its tunnel to boos, the home team to fireworks, smoke and cheers, each player's TV card along the bottom
// (headshot, ratings, abilities, his numbers); then the captains meet at midfield and the coin toss follows.
// Skippable (Space / Enter / click). Calm motion goes straight to the game.
import { crowd, play, synth } from './sound';
import { useEffect, useMemo, useState } from 'react';
import { teamColors, helmetUrl, artUrl, artRows } from '../data/art';
import { getRecord, recordText } from './records';
import { playerLine } from './stats';
import { depthFor } from '../data/playbook';
import { playerSkills } from './TeamDrawer';
import { Sprite } from './TeamPicker';
import { INTRO, introPlan, FIREWORKS, ROCKET } from '../three/introPlan';
import { Button } from './ui';

export const SHOW = { h2h: 5.4, run: INTRO.end }; // seconds
export const SHOW_LEN = SHOW.h2h + SHOW.run;

const ROLE = { offense: { Q: 'QB', C: 'C', W: 'WR', L: 'OL', B: 'RB' }, defense: { L: 'DL', B: 'DB' } };
const roleOf = (teamId, num) => { const d = depthFor(teamId); return ROLE.offense[d.offense?.[num]] ?? ROLE.defense[d.defense?.[num]] ?? null; };

export default function OpeningShow({ s, t0, me = 0, onDone }) {
  const [now, setNow] = useState(0);
  useEffect(() => {
    let raf;
    const tick = () => {
      const t = (performance.now() - t0) / 1000;
      setNow(t);
      if (t >= SHOW_LEN) onDone(); else raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    // the sound of the show: helmets fly in (whoosh) and crash (bash); the away team is booed, the home team cheered
    // under its fireworks; a whoosh as the captains walk out
    const at = (secs, fn) => setTimeout(fn, Math.max(0, secs * 1000 - (performance.now() - t0)));
    const run = (secs, fn) => at(SHOW.h2h + secs, fn);
    const cues = [at(1.25, () => synth('whoosh')), at(2.05, () => play('smash').then((h) => { if (!h) synth('bash'); })), at(SHOW.h2h - 0.5, () => synth('whooshOut')),
      run(INTRO.away + 0.4, () => { play('boo'); crowd(1.5, 3); }), run(INTRO.away + 4.6, () => play('boo', { vol: 0.7 })),
      run(INTRO.home, () => { play('cheer'); crowd(2.4, 6); }), run(INTRO.home + 5.2, () => play('cheer', { vol: 0.8 })),
      ...FIREWORKS.flatMap(([t]) => [run(t, () => synth('launch')), run(t + ROCKET, () => synth('pop'))]),
      run(INTRO.meet + 0.2, () => synth('whoosh'))];
    const key = (e) => { if (e.key === ' ' || e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); onDone(); } };
    window.addEventListener('keydown', key);
    return () => { cancelAnimationFrame(raf); cues.forEach(clearTimeout); window.removeEventListener('keydown', key); };
  }, [t0, onDone]);
  const side = (i) => {
    const [c0, c1] = teamColors(s.teams[i].id, s.teams[i].uniform);
    return { c0, c1, name: s.teams[i].name.toUpperCase(), helmet: helmetUrl(s.teams[i].id), small: helmetUrl(s.teams[i].id, true), rec: recordText(getRecord(s.teams[i].id)) };
  };
  const a = side(0), b = side(1);
  const plan = useMemo(() => introPlan(Object.values(s.players)), [s.players]);
  const rows = useMemo(() => [artRows(s, 0), artRows(s, 1)], [s]);
  const rel = now - SHOW.h2h;
  const seg = rel < 0 ? null : rel < INTRO.home ? 1 : rel < INTRO.meet ? 0 : 'meet';
  const card = (pid, k) => <PlayerTv key={k ?? pid} s={s} p={s.players[pid]} rows={rows} mine={s.players[pid]?.side === me} />;
  return (
    <div className="show" onClick={onDone}>
      {now < SHOW.h2h && (
        <div className={`show-h2h ${now > SHOW.h2h - 0.5 ? 'out' : ''}`}>
          {/* team halves come up behind once the helmets have hit */}
          <div className="show-half s0" style={{ '--c0': a.c0, '--c1': a.c1 }} />
          <div className="show-half s1" style={{ '--c0': b.c0, '--c1': b.c1 }} />
          <img className="show-logo" src={artUrl('techno-logo.webp')} alt="Techno Bowl" />
          <div className="smash">
            {a.helmet && <img className="smash-l" src={a.helmet} alt="" />}
            {b.helmet && <img className="smash-r" src={b.helmet} alt="" />}
            <i className="smash-flash" />
            {Array.from({ length: 14 }, (_, k) => <i key={k} className="spark" style={{ '--a': `${(k / 14) * 360}deg`, '--d': `${70 + (k % 4) * 30}px` }} />)}
          </div>
          <div className="show-names">
            <div className="nm s0"><b>{a.name}</b><span>{a.rec}</span><small>HOME</small></div>
            <b className="led vs">VS</b>
            <div className="nm s1"><b>{b.name}</b><span>{b.rec}</span><small>AWAY</small></div>
          </div>
        </div>
      )}
      {(seg === 0 || seg === 1) && (() => {
        const t = seg === 0 ? a : b;
        const out = plan.order[seg].filter((q) => q.at <= rel);
        const cur = out.at(-1);
        return (
          <>
            {/* who's coming out: the team's banner, top left */}
            <div key={`bn${seg}`} className={`show-team s${seg}`} style={{ '--c0': t.c0, '--c1': t.c1 }}>
              {t.small && <img src={t.small} alt="" />}
              <div><small>{seg === 1 ? 'THE VISITORS' : 'YOUR HOME TEAM'}</small><b>{t.name}</b><span>{t.rec}</span></div>
            </div>
            {/* the player coming out now, and everyone out so far along the bottom */}
            <div className="show-tv" style={{ '--c0': t.c0, '--c1': t.c1 }}>
              {cur && card(cur.pid)}
              <div className="show-strip">
                {plan.order[seg].map((q) => {
                  const p = s.players[q.pid];
                  const shown = q.at <= rel;
                  return (
                    <span key={q.pid} className={`show-mini ${shown ? 'on' : ''} ${q === cur ? 'now' : ''}`}>
                      <Sprite team={s.teams[seg].id} uni={s.teams[seg].uniform} row={rows[seg][p.num] ?? 0} /><i>#{p.num}</i>
                    </span>
                  );
                })}
              </div>
            </div>
          </>
        );
      })()}
      {seg === 'meet' && (
        <div className="show-meet">
          <div className="show-meet-head led">CAPTAINS MEET AT MIDFIELD</div>
          <div className="show-meet-row">
            <div className="show-tv s0" style={{ '--c0': a.c0, '--c1': a.c1 }}>{card(plan.captains[0], 'c0')}</div>
            <b className="led vs">VS</b>
            <div className="show-tv s1" style={{ '--c0': b.c0, '--c1': b.c1 }}>{card(plan.captains[1], 'c1')}</div>
          </div>
        </div>
      )}
      <Button size="small" className="show-skip" onClick={(e) => { e.stopPropagation(); onDone(); }}>Skip ▸▸</Button>
    </div>
  );
}

// a player's TV card: headshot in team colours, number, name, position, ratings, abilities, and his numbers
function PlayerTv({ s, p, rows, mine }) {
  if (!p) return null;
  const t = s.teams[p.side];
  const skills = playerSkills(s, p).filter((x) => !x.startsWith('INFERNO'));
  const line = playerLine(t.id, p.num, mine);
  const role = mine ? roleOf(t.id, p.num) : null;
  return (
    <div className={`tv-card ${skills.length ? 'star' : ''}`}>
      <div className="tv-shot"><Sprite team={t.id} uni={t.uniform} row={rows[p.side][p.num] ?? 0} /><b>{p.num}</b></div>
      <div className="tv-body">
        <div className="tv-name"><b>{p.name.toUpperCase()}</b>{role && <em>{role}</em>}</div>
        <div className="tv-stats">
          <span><i>SKILL</i><b>{p.skill}</b></span>
          {line ? (
            <>
              <span><i>{line.label} G</i><b>{line.games}</b></span>
              {line.items.map(([l, v]) => <span key={l}><i>{l}</i><b>{v}</b></span>)}
            </>
          ) : <span className="tv-first"><i>{mine ? 'CAREER' : 'VS YOU'}</i><b>{mine ? 'DEBUT' : 'FIRST MEETING'}</b></span>}
        </div>
        {skills.length > 0 && <div className="tv-skills">{skills.map((x) => <em key={x}>✦ {x}</em>)}</div>}
      </div>
    </div>
  );
}
