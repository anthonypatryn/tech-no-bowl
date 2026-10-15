// The opening show: head-to-head graphic over the TV theme, then the tunnel run-out on the 3D field (Board's
// RunOut + intro camera), then KICK-OFF. Skippable (Space / Enter / click). Calm motion goes straight to the game.
import { useEffect, useState } from 'react';
import { teamColors, helmetUrl, artUrl } from '../data/art';

export const SHOW = { h2h: 4.4, run: 7.6, kick: 1.6 }; // seconds
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
    const key = (e) => { if (e.key === ' ' || e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); onDone(); } };
    window.addEventListener('keydown', key);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('keydown', key); };
  }, [t0, onDone]);
  const half = (side) => {
    const [c0, c1] = teamColors(s.teams[side].id, s.teams[side].uniform);
    return (
      <div className={`show-half s${side}`} style={{ '--c0': c0, '--c1': c1 }}>
        {helmetUrl(s.teams[side].id) && <img src={helmetUrl(s.teams[side].id)} alt="" />}
        <h2>{s.teams[side].name.toUpperCase()}</h2>
        <small>{side === 0 ? 'HOME' : 'AWAY'}</small>
      </div>
    );
  };
  return (
    <div className="show" onClick={onDone}>
      {now < SHOW.h2h && (
        <div className={`show-h2h ${now > SHOW.h2h - 0.5 ? 'out' : ''}`}>
          {half(0)}
          {half(1)}
          <div className="show-vs">
            <img src={artUrl('mfl-shield.webp')} alt="MFL" />
            <span className="led">MFL GAME DAY</span>
            <b className="led">VS</b>
          </div>
        </div>
      )}
      {now >= SHOW.h2h && now < SHOW.h2h + SHOW.run && <div className="show-lower led">TAKING THE FIELD</div>}
      {now >= SHOW.h2h + SHOW.run && <div className="show-kick"><span className="led">KICK-OFF!</span></div>}
      <button className="btn small show-skip" onClick={(e) => { e.stopPropagation(); onDone(); }}>Skip ▸▸</button>
    </div>
  );
}
