// Quick reference while you play (Techno mode). Short and in our own words; the full rules are in the rulebook.
import { useEffect } from 'react';

const SECTIONS = [
  ['Skill checks', [
    'Roll 2 dice + modifiers. 10+ = total success, 7–9 = success, 6 or less = failure. Doubles make it critical.',
    'Total success: activate another of your players for free. Success: the other coach moves one player a half move. Failure: the other coach activates anyone.',
    'Bonuses stop at +3 and penalties at −3 (Rule of 3). Bench boost: discard that player\'s cards for +1 each.',
    'Teamwork: +1 per teammate threatening the target, −1 per opponent threatening the player acting.',
  ]],
  ['Moving', [
    'Skill rating = first digit of the jersey. Move allowance = skill rating.',
    'Leaving a square costs 1; 2 per opponent threatening it; 3 per opponent if you have the ball.',
    'Every other diagonal after the first costs 1 more. No squeezing between two players on a diagonal.',
    'Activation: a full move, OR an action, OR half a move then an action.',
  ]],
  ['Actions', [
    'Block / Tackle: the lower-rated player gets the difference as a bonus (max +3). A tackle needs you next to the ball carrier.',
    'Block success pushes him back; critical knocks him down (and fumbles the ball). A failed block can be reversed.',
    'Pass: range 2 × skill, +1 within your skill rating, −1 per defender on the passer or target. Once a forward pass is made or the ball crosses the line, only lateral or backward passes.',
    'Hand-off (part of a move): automatic, unless someone is threatened. Then roll: doubles = fumble.',
    'Picking up / catching a loose ball: roll 2 dice, doubles = it gets away.',
  ]],
  ['The play', [
    'Call 5 cards in order. Each round both flip: higher rating chooses who goes first. Defense may read and react (swap the card); then the offense may too.',
    'Once per play: an adjustment moves two of your players a half move each.',
    'Defensive pressure: a defender moving next to the ball carrier behind the line costs the offense 2 random bench cards, or a sack.',
    'Four downs to score: no first downs! Touchdown 7, safety 2. Each play uses a minute; running plays use two.',
  ]],
];

export default function RulesDrawer({ onClose }) {
  useEffect(() => {
    const key = (e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    window.addEventListener('keydown', key, true);
    return () => window.removeEventListener('keydown', key, true);
  }, [onClose]);
  return (
    <aside className="rules-drawer glass" role="dialog" aria-label="Quick rules">
      <header><h2>Quick rules</h2><button className="btn small" onClick={onClose}>Close</button></header>
      {SECTIONS.map(([title, lines]) => (
        <section key={title}><h3>{title}</h3><ul>{lines.map((l) => <li key={l}>{l}</li>)}</ul></section>
      ))}
    </aside>
  );
}
