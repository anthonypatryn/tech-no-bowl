// Ready-made legal formations: the "auto" button in setup, the computer's starting point, and the fallback when an
// answer isn't legal. Random choices come from the game's seeded rng, so games replay exactly.
import { COLS, inBounds, key, losRows } from './board.js';
import { checkDefense, checkOffense } from './rules.js';

const shuffle = (a, rand) => { const r = [...a]; for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; } return r; };

// roster: [{ num, skill }]. Low ratings make the best hikers/linemen, high ratings the passers and runners.
export function autoOffense(roster, { line, dir, col }, rand = Math.random) {
  const { off, back } = losRows(line, dir);
  const count = roster.length;
  for (let attempt = 0; attempt < 40; attempt++) {
    const spots = [[col, off], [col - 2 + (rand() < 0.3 ? 1 : 0), off], [col + 2 - (rand() < 0.3 ? 1 : 0), off], [col, off + back]];
    const used = new Set(spots.map((q) => key(...q)));
    const pool = [];
    for (let c = 0; c < COLS; c++) {
      pool.push([c, off], [c, off], [c, off]); // line spots (wide receivers, tight ends) are the common choice
      if (Math.abs(c - col) !== 1) pool.push([c, off + back]);
    }
    for (let d = 2; d <= 3; d++) for (let dc = -1; dc <= 1; dc++) pool.push([col + dc, off + back * d]);
    for (const q of shuffle(pool, rand)) {
      if (spots.length >= count) break;
      if (!inBounds(...q) || used.has(key(...q))) continue;
      used.add(key(...q)); spots.push(q);
    }
    const bySkill = [...roster].sort((a, b) => a.skill - b.skill);
    const center = bySkill[0];
    const passer = bySkill[bySkill.length - 1];
    const rest = shuffle(bySkill.slice(1, -1), rand);
    const order = [center, ...rest.slice(0, 2), passer, ...rest.slice(2)];
    const res = order.map((p, i) => ({ num: p.num, col: spots[i][0], row: spots[i][1] }));
    if (checkOffense(res, { line, dir, col, count }).ok) return res;
  }
  return null;
}

// cover the offensive line man-for-man, then spread the rest out behind
export function autoDefense(roster, offense, { line, dir, col }, rand = Math.random) {
  const { off, def } = losRows(line, dir);
  const count = roster.length;
  const deeper = dir; // the defense's "back" is the offense's forward
  const offLos = offense.filter((p) => p.row === off).sort((a, b) => Math.abs(a.col - col) - Math.abs(b.col - col));
  for (let attempt = 0; attempt < 60; attempt++) {
    const spots = [];
    const used = new Set();
    const add = (q) => { if (inBounds(...q) && !used.has(key(...q)) && spots.length < count) { used.add(key(...q)); spots.push(q); return true; } return false; };
    // man up the line (the hiker and the nearest two first), nudging sideways now and then
    const cover = attempt > 40 ? offLos : offLos.slice(0, Math.max(3, Math.floor(rand() * (offLos.length + 1))));
    for (const o of cover) if (!add([o.col + (attempt < 40 && rand() < 0.25 ? (rand() < 0.5 ? -1 : 1) : 0), def])) add([o.col, def]);
    const pool = [];
    for (let d = 1; d <= 4; d++) for (let c = 0; c < COLS; c++) pool.push([c, def + deeper * d]);
    for (const q of shuffle(pool, rand)) { if (spots.length >= count) break; add(q); }
    const order = shuffle(roster, rand);
    const res = order.map((p, i) => ({ num: p.num, col: spots[i]?.[0], row: spots[i]?.[1] }));
    if (res.every((p) => p.col != null) && checkDefense(res, offense, { line, dir, col, count }).ok) return res;
  }
  return null;
}
