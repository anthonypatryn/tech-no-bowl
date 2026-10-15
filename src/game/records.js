// Win-loss records per team on this device (the pre-game card shows them). localStorage only, so a private window
// starts from 0-0; that's fine for a friends-only game.
const KEY = 'tb-records';
const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; } };

export function getRecord(teamId) {
  const r = read()[teamId];
  return { w: r?.w ?? 0, l: r?.l ?? 0, t: r?.t ?? 0 };
}
export const recordText = (r) => `${r.w}-${r.l}${r.t ? `-${r.t}` : ''}`;

// a finished game: winner = 0 / 1 / null (tie). Each game counts once (by its seed).
export function recordResult(teamIds, winner, seed) {
  try {
    const all = read();
    if (all._seen?.includes(seed)) return;
    teamIds.forEach((id, side) => {
      const r = (all[id] ??= { w: 0, l: 0, t: 0 });
      if (winner == null) r.t++; else if (winner === side) r.w++; else r.l++;
    });
    all._seen = [...(all._seen ?? []).slice(-200), seed];
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch { /* not saved */ }
}
