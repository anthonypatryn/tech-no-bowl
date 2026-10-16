// The opening show: the Techno Bowl logo, the two helmets smashing together, the head-to-head card with records, over
// the TV theme; then the tunnel run-out on the 3D field (Board's RunOut + intro camera); then KICK-OFF.
// Skippable (Space / Enter / click). Calm motion goes straight to the game.
import { synth } from './sound';
import { useEffect, useState } from 'react';
import { teamColors, helmetUrl, artUrl } from '../data/art';
import { getRecord, recordText } from './records';

export const SHOW = { h2h: 5.4, run: 7.6, kick: 1.6 }; // seconds
export const SHOW_LEN = SHOW.h2h + SHOW.run + SHOW.kick;

export default function OpeningShow({ s, t0, onDone }) {
  const [now, setNow] = useState(0);
  useEffect(() => {
    let raf;
    const tick = () => {
      const t = (performance.now() - t0) / 1000;
      setNow(t);
      if (t >= SHOW_LEN) onDone(); else raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    // the sound of the show: the helmets fly in (whoosh), crash (bash), the card leaves, the kick-off card
    const at = (secs, fn) => setTimeout(fn, Math.max(0, secs * 1000 - (performance.now() - t0)));
    const cues = [at(1.25, () => synth('whoosh')), at(2.05, () => synth('bash')), at(SHOW.h2h - 0.5, () => synth('whooshOut')), at(SHOW.h2h + SHOW.run, () => synth('whoosh'))];
    const key = (e) => { if (e.key === ' ' || e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); onDone(); } };
    window.addEventListener('keydown', key);
    return () => { cancelAnimationFrame(raf); cues.forEach(clearTimeout); window.removeEventListener('keydown', key); };
  }, [t0, onDone]);
  const side = (i) => {
    const [c0, c1] = teamColors(s.teams[i].id, s.teams[i].uniform);
    return { c0, c1, name: s.teams[i].name.toUpperCase(), helmet: helmetUrl(s.teams[i].id), rec: recordText(getRecord(s.teams[i].id)) };
  };
  const a = side(0), b = side(1);
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
      {now >= SHOW.h2h && now < SHOW.h2h + SHOW.run && <div className="show-lower led">TAKING THE FIELD</div>}
      {now >= SHOW.h2h + SHOW.run && <div className="show-kick"><span className="led">KICK-OFF!</span></div>}
      <button className="btn small show-skip" onClick={(e) => { e.stopPropagation(); onDone(); }}>Skip ▸▸</button>
    </div>
  );
}
