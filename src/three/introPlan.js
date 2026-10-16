// The opening show's run-out, one timeline for the 3D field (Board's RunOut + camera), the player cards (OpeningShow)
// and the sounds: the away team comes out first (boos), then the home team (fireworks, smoke, cheers), then the two
// captains walk to midfield for the coin toss. Times are seconds after the title card.
export const INTRO = { away: 0, home: 8.4, meet: 18.6, end: 22.6 };

// who comes out when: role players first, the ability players after, the biggest star last (he's the captain)
const star = (p) => (p.abilities?.length ?? 0) * 10 + (p.skill ?? 0);
export function introPlan(players) {
  const out = { order: { 0: [], 1: [] }, captains: {} };
  for (const side of [1, 0]) {
    const roster = players.filter((p) => p.side === side).sort((a, b) => star(a) - star(b) || a.num - b.num);
    const [t0, t1] = side === 1 ? [INTRO.away, INTRO.home] : [INTRO.home, INTRO.meet];
    const gap = (t1 - t0 - 3.4) / Math.max(1, roster.length - 1);
    // line-up spots across the 35: the first out takes the far ends, the star the middle
    const xs = roster.map((_, i) => (i - (roster.length - 1) / 2) * 1.3).sort((a, b) => Math.abs(b) - Math.abs(a) || a - b);
    out.order[side] = roster.map((p, i) => ({ pid: p.pid, num: p.num, at: t0 + 0.9 + i * gap, x: xs[i] }));
    out.captains[side] = roster.at(-1)?.pid;
  }
  return out;
}

// the home team's fireworks: launched from behind their end-zone stands. [time, x, burst height, colour index]
export const FIREWORKS = [
  [INTRO.home + 0.2, -4.5, 6.3, 0], [INTRO.home + 0.45, 4.5, 7.0, 1], [INTRO.home + 0.9, 0, 8.2, 2],
  [INTRO.home + 2.6, -2.5, 7.4, 1], [INTRO.home + 2.9, 2.5, 6.8, 0], [INTRO.home + 5.4, -5.5, 6.6, 2],
  [INTRO.home + 5.6, 5.5, 6.6, 2], [INTRO.home + 8.6, 0, 8.6, 0], [INTRO.home + 8.8, -3.5, 7.2, 1], [INTRO.home + 9.0, 3.5, 7.2, 1],
];
export const ROCKET = 0.7; // seconds from launch to burst
