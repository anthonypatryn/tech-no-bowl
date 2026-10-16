// Development tool (never imported by the app): checks touchdown replays against what really happened.
// In the dev server, in a game:  (await import('/src/dev/tdcheck.js')).start(25)   then   report()
// It answers your side like a person would (never while a replay plays, so the next line-up is open on screen as it
// is for a real player), plays games back to back (Rematch), and at every step of every touchdown replay compares
// 1) the pieces the board is given, 2) where the cubes really are on screen once a step has settled, 3) the ball, with
// the engine's recorded positions. Results are kept in localStorage ('tb-tdcheck') so a reload carries on.
const KEY = 'tb-tdcheck';
const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; } };
const save = (R) => { try { localStorage.setItem(KEY, JSON.stringify(R)); } catch { /* full */ } };

export function report() {
  const R = load() ?? { mine: [], theirs: [] };
  const bad = [...R.mine, ...R.theirs].filter((x) => x.input || x.anim || x.ball);
  return { scored: R.mine.length, against: R.theirs.length, problems: bad.length, bad };
}
export function reset() { save({ mine: [], theirs: [], log: [], games: 0 }); }

export async function start(want = 25) {
  const { makeAI } = await import('/src/engine/ai.js');
  const ai = makeAI('allpro');
  const R = load() ?? { mine: [], theirs: [], log: [], games: 0 };
  let cur = null;
  const sqOf = (v) => [Math.round(v.x + 6), Math.round(v.z + 11.5)];
  const frameAt = (play, step) => (step === 0 ? (play.from ? play.steps[play.from - 1].f : play.start) : play.steps[step - 1].f);
  const ctx = (play, step) => play.steps.slice(Math.max(0, step - 3), step + 1)
    .map((x, k) => `${Math.max(0, step - 3) + k + 1}:${x.e.kind}${x.e.pid ? ` ${x.e.pid}` : ''}${x.e.path ? ` p${x.e.path.length}` : ''}${x.e.action ? ` ${x.e.action}` : ''}`).join(' | ');
  const finish = () => {
    const c = cur; cur = null;
    const u = (a) => [...new Set(a)];
    (c.mine ? R.mine : R.theirs).push({ label: c.label, steps: c.play.steps.length, stepsSeen: c.seen.size, input: u(c.inputBad).length, anim: u(c.animBad).length,
      ball: u(c.ballBad).length, sample: [...u(c.inputBad).slice(0, 2), ...u(c.animBad).slice(0, 3), ...u(c.ballBad).slice(0, 2)], ctx: c.ctx });
    save(R);
  };
  const tick = () => {
    const g = window.__tb;
    if (!g) return;
    document.querySelector('.depth-card .btn.primary')?.click();
    document.querySelector('.show-skip')?.click();
    const replaying = !!document.querySelector('.game.replaying');
    if (!replaying) [...document.querySelectorAll('.game-tools button')].find((b) => b.textContent.includes('Normal'))?.click(); // fast-forward the live game
    const r = g.state.request;
    if (r && r.side === 0 && !replaying && !g.__answering) {
      g.__answering = true;
      setTimeout(() => { g.__answering = false; if (g.state.request?.id === r.id) { try { g.answer(ai(g, 0, r), r.id); } catch (e) { R.log.push(`answer ${e.message}`); } } }, 120);
    }
    if (g.state.phase === 'over' && !replaying && !g.__rematched) {
      const b = [...document.querySelectorAll('button')].find((x) => /Rematch|Play again/i.test(x.textContent));
      if (b) { g.__rematched = true; R.games++; save(R); setTimeout(() => b.click(), 500); }
    }
    const label = document.querySelector('.replay-label')?.textContent ?? '';
    const dbg = window.__boardDbg, rsS = window.__rsStep;
    if (!(replaying && /Touchdown/.test(label) && dbg?.replaying && rsS?.play)) { if (cur) finish(); return; }
    const play = rsS.play;
    if (!cur || cur.play !== play) {
      if (cur) finish();
      cur = { play, mine: label.includes(g.state.teams[0].name), label, inputBad: [], animBad: [], ballBad: [], lastStep: -1, lastSample: null, seen: new Set(), ctx: null };
    }
    const step = dbg.step ?? 0;
    if (step !== rsS.step) return; // the screen hasn't drawn this step yet
    cur.seen.add(step);
    const f = frameAt(play, step);
    const drawn = Object.fromEntries(dbg.players.map((p) => [p.pid, [p.col, p.row]]));
    for (const [pid, q] of Object.entries(f.p)) {
      if (q[0] == null) continue;
      const d = drawn[pid];
      if (!d || d[0] !== q[0] || d[1] !== q[1]) { cur.inputBad.push(`step ${step} ${pid}: drawn ${d ? d.join(',') : 'missing'} vs real ${q[0]},${q[1]}`); cur.ctx ??= ctx(play, step); }
    }
    if (step !== cur.lastStep) {
      if (cur.lastSample && cur.lastStep >= 0) {
        const fs = frameAt(play, cur.lastStep);
        for (const [pid, q] of Object.entries(fs.p)) {
          const v = cur.lastSample.pos[pid];
          if (q[0] == null || !v) continue;
          if (v[0] !== q[0] || v[1] !== q[1]) { cur.animBad.push(`step ${cur.lastStep} ${pid}: on screen ${v.join(',')} vs real ${q[0]},${q[1]}`); cur.ctx ??= ctx(play, cur.lastStep); }
        }
        if (fs.b.at === 'held' && cur.lastSample.ball && cur.lastSample.pos[fs.b.pid]) {
          const h = cur.lastSample.pos[fs.b.pid], bb = cur.lastSample.ball;
          if (bb[0] !== h[0] || bb[1] !== h[1]) { cur.ballBad.push(`step ${cur.lastStep}: ball at ${bb.join(',')} but ${fs.b.pid} has it at ${h.join(',')}`); cur.ctx ??= ctx(play, cur.lastStep); }
        }
      }
      cur.lastStep = step;
    }
    const pos = {};
    for (const [pid, v] of Object.entries(dbg.positions)) if (pid !== '__ball' && v) pos[pid] = sqOf(v);
    cur.lastSample = { pos, ball: dbg.positions.__ball ? sqOf(dbg.positions.__ball) : null };
  };
  clearInterval(window.__tdTimer);
  window.__tdTimer = setInterval(() => {
    try { tick(); } catch (e) { R.log.push(`tick ${e.message}`); }
    if (R.mine.length >= want && R.theirs.length >= want) clearInterval(window.__tdTimer);
  }, 25);
  return 'running';
}
