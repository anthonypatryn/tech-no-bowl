// The coin toss: a coin spins up and lands on the engine's call (heads = the home side wins), then says who won.
import { useEffect, useState } from 'react';
import { artUrl } from '../data/art';

export default function CoinToss({ s }) {
  const e = s.log.findLast?.((x) => x.kind === 'cointoss');
  const [shown, setShown] = useState(null);
  useEffect(() => {
    if (!e) return;
    setShown(e.id);
    const t = setTimeout(() => setShown(null), 3600);
    return () => clearTimeout(t);
  }, [e?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!e || shown !== e.id) return null;
  const team = s.teams[e.winner].name;
  return (
    <div className="coin-toss">
      <div className="coin-stage">
        <div className={`coin ${e.face}`}>
          <div className="coin-face heads"><img src={artUrl('mfl-shield.webp')} alt="" /></div>
          <div className="coin-face tails"><img src={artUrl('techno-logo.webp')} alt="" /></div>
        </div>
      </div>
      <div className="coin-call">
        <span className="led">{e.overtime ? 'OVERTIME TOSS' : 'COIN TOSS'}</span>
        <b className="led">{e.face.toUpperCase()}!</b>
        <span>{team} win the toss</span>
      </div>
    </div>
  );
}
