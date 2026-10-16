// The tutorial coach: in a tutorial game, the first time each kind of moment comes up, a coach card explains it.
import { useEffect, useRef, useState } from 'react';
import { HUMAN } from './useGame';
import { Button } from './ui';

const TIPS = {
  toss: ['Welcome to Techno Bowl!', 'You won the toss. Take the ball: you\'ll learn offense first. Every drive starts on your own 20, and you get four downs to score. No first downs!'],
  formation_offense: ['Line up', 'Your players are cubes; the number on top is the skill rating (first digit). Pick a set from the PLAYBOOK, or click a player and then a green square. When the formation is legal, press Ready.'],
  formation_defense: ['Defense lines up', 'At least 3 on the line, covering their snapper and two players next to him. The playbook sets (4-3, Nickel…) handle the rules for you.'],
  call: ['Call the play', 'Pick 5 cards. They go in order: the top card is your first player to act. Tip: put your passer (the player behind the snapper) early.'],
  motion: ['Motion', 'You can send a player in motion before the snap, but it costs bench cards. Press No motion for now.'],
  readReact: ['Read and react', 'The cards are up. On defense you may swap yours for someone off the bench. Keep it for now.'],
  first: ['Who goes first', 'The higher skill rating chooses who acts first this round. Going second lets you see what they do.'],
  act: ['Your player is up', 'Bright green squares: move there and still block, tackle or throw. Teal: move only. Rings on opponents are blocks (orange) or tackles (red); hover one to see the odds.'],
  act_pass: ['Throwing', 'Press Throw (T). The yellow outline was your full range, green the +1 short zone. Green squares are good odds, red are covered.'],
  check: ['The dice', '2 dice + modifiers: 10+ is a total success (a free activation for another of your players), 7-9 a success (they get a half move), 6 or less a failure (they get a free activation).'],
  boost: ['Bench boost', 'Spend that player\'s cards from your bench for +1 each. Careful: a spent card can\'t activate him later this play.'],
  bonus: ['Free activation', 'A big result earned a free move. Click the player who should use it, or pass.'],
  scatter: ['Loose ball!', 'Each coach rolls a die: the difference is how far it goes, and the higher die picks where. Move a player onto it to scoop it up (doubles = it gets away).'],
  td: ['TOUCHDOWN!', 'Seven points. Now the other team gets the ball on their 20, and you\'re on defense: get next to their ball carrier and tackle.'],
  pressure: ['Defensive pressure', 'A defender stepping next to the ball carrier behind the line costs the offense two random bench cards. With fewer than two left, it\'s a sack.'],
};

// tips already shown this tutorial (kept across an undo, which rebuilds the game screen)
const SEEN = new Set();

export default function CoachTips({ s, enabled, onOff, fresh = true }) {
  const seen = useRef(SEEN);
  useState(() => { if (fresh) SEEN.clear(); });
  const [tip, setTip] = useState(null);
  const req = s.request?.side === HUMAN ? s.request : null;
  const last = s.log.at(-1);
  useEffect(() => {
    if (!enabled) return;
    let k = null;
    if (req) {
      k = req.type === 'formation' ? `formation_${req.role}` : req.type === 'act' && req.passes?.length ? (seen.current.has('act') ? 'act_pass' : 'act') : req.type;
    }
    if (last && ['check', 'scatter', 'td', 'pressure'].includes(last.kind) && !seen.current.has(last.kind)) k = last.kind;
    if (k && TIPS[k] && !seen.current.has(k)) { seen.current.add(k); setTip(TIPS[k]); }
  }, [req?.id, last?.id, enabled]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!enabled || !tip) return null;
  return (
    <div className="coach-tip glass">
      <span className="coach-badge">COACH</span>
      <h3>{tip[0]}</h3>
      <p>{tip[1]}</p>
      <div className="btns"><Button kind="primary" size="small" onClick={() => setTip(null)}>Got it</Button><Button size="small" onClick={() => { setTip(null); onOff(); }}>No more tips</Button></div>
    </div>
  );
}
