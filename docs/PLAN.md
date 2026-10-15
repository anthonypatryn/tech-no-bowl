# TECHNO BOWL — digital build plan

Source material: rulebook, QRS, team guide (transcribed in `docs/rules-and-rosters.md`),
32 teams × base + alt uniforms as cube-net "pixelblock" PDFs, field, scoreboard, punchboards, down-marker cubes.
Template: Long Shot (look, 3D/R3F, camera rig, cinematics) + Escape Order 66 (sound editor, password gate).

## What the art tells us about the board

- **Field** = 13 columns × 24 rows of 5-yard squares (20 field rows + 2 end-zone rows each end).
  The source is 4667×8170 px, roughly 315 px per square.
- **Players are cubes.** The top face carries the jersey number on the team colour. The 4 sides show the
  standing player with the head toward the top. Knocked down = the cube tips onto its side, exactly as the
  rulebook describes for blocks.
- **Down marker** is also a cube (faces 1-4), and the score and clock use the scoreboard art plus the LED digit tiles.
- **Look:** a tabletop diorama. A real 3D field with chunky cubes, a broadcast camera by default, LED-style HUD.
  The 2D punchboard tokens are used for menus, team picker, bench cards and the bench-boost card stand.

## Stack (same as Long Shot)

- Vite + React 19 + R3F/drei, plain JS, oxlint, PeerJS, Upstash Redis for the `/api/*` endpoints, deployed on Vercel.
- Deterministic `Game` engine: seeded RNG, `ask/answer` choke point, data-carrying log lines that the UI
  animates from, and replay trail for resume and undo.
- `tools/extract_art.py` turns the source PDFs and JPGs into web textures (WebP atlases, one per team per uniform).
  The raw source art stays gitignored. The repo is private and the site is open (no password gate).

## Batches (each one = a push + Vercel deploy you can play-test)

### B0 · Foundation ✅
- Wire this folder to `github.com/anthonypatryn/tech-no-bowl` and link it to Vercel.
- Scaffold from the Long Shot template.
- Add `CLAUDE.md` with a code map, a dev launch config and the pre-commit checklist.
- Art pipeline:
  - Auto-detect the cube crosses in each PDF, then crop the top face and side faces per player.
  - Build atlases.
  - Downscale the field to 4K and 2K textures.
  - Slice the scoreboard and the LED digits.
- **Art Review Board v1** (`?view=art`): every team × uniform as a spinning cube, plus the field, markers and tokens.
  Its purpose is to catch bad crops early.
- Pages exist only as stubs (Home, Team Picker, Settings).

### B1 · Rules engine, TECHNO mode (7v7, no skills) — headless ✅
- Grid geometry:
  - Distance with the every-other-diagonal penalty.
  - Threat zones.
  - Move costs of 1 / 2 / 3 per threatening player.
  - No crossing a diagonal that has players on both sides.
- Skill check:
  - 2d6 with the ±3 cap.
  - Results: total success / partial / fail / criticals.
  - Teamwork and bench boost.
- Sport check.
- Actions: move, move-and-X, block (push, crit knockdown, reverse), tackle, pass (range = 2 × skill, open-square
  passes in flight, scatter), hand-off, loose-ball grab, stand up.
- Activation chaining: a total success gives one of your players a full activation; a partial gives the opponent a
  half-move; a failure gives the opponent a full activation.
- Coaching:
  - Formation legality for offense and defense.
  - Hike depth.
  - 5-card play call, then single cards.
  - Read-and-react.
  - Motion ×2 (discarding 1 card, then 2).
  - One adjustment per play.
  - Defensive pressure / sacks.
  - Downs (no first downs), scoring, spotting at the hashes.
  - Time cubes and timeouts, overtime.
- `tools/simulate.mjs`: thousands of random legal games, which must finish with `errors: 0`. Unit tests on the
  rulebook's worked examples.

### B2 · Playable vs AI (local is vs AI only; human-vs-human waits for online) ✅
- Rookie AI arrives here so there's an opponent from the first playable build.
- 3D field, cube players, ball, dice.
- Move overlays: reachable squares with their costs, threat heat, pass range rings (+1 zone shaded).
- Bench / controller-card UI.
- Play-call stack builder (the AI's stack stays hidden).
- Formation placement with live legality hints.
- Scoreboard HUD, down-marker cube.
- **Navs:** Home → Mode/Teams (base or alt uniform) → Formation → Play.
- Settings and Rules drawer (QRS on tap), end screen, resume.

### B3 · AI ×3, bug system, keybinds, phone, clocks
- AI levels (names are placeholders): **Rookie**, **Starter**, **All-Pro**.
  - Rookie: legal and greedy, with slips.
  - Starter: heuristic formations, play calls and read-and-react.
  - All-Pro: rolls outcomes ahead with expected value, manages the clock, sets up +3 chains.
  - `simulate.mjs` checks that each level beats the one below it.
- **Bug system:** a port of the Long Shot/EO66 kit (`/api/bugs`, PIN-gated list, "Copy for Claude").
- **Keybinds:** a real rebinding UI. This is new, since the older games hardcode their keys. Bindings are stored
  in prefs, there's a conflict check, and keys show as labels on buttons.
- Phone layout.
- Play clocks: off by default, with a Settings toggle for the 1:00 setup/play-call and 0:30 motion clocks and their penalties.

### B4 · Cinematics (the Long Shot bar)
- Camera rig presets: Broadcast (sideline), End Zone, Overhead, Follow Ball, Free. Press `C` to cycle.
- **Long throw cam.** It fires on passes of 8 or more squares, or deep balls.
  - Cut to a chase cam behind the ball's arc.
  - Slow-mo at the apex, then a low lens at the target square.
  - The catch, interception or scatter plays out in the shot, then cut back.
- **Big hits.** These fire on critical tackles (fumbles), sacks from defensive pressure, and critical blocks.
  - Snap zoom, hit-stop freeze, the cube tumbles with a particle burst and screen shake.
- Touchdown celebration and a drive intro crane shot (there are no kickoffs in Techno Bowl).
- Letterbox bars hide the HUD. Calm mode skips all of it.
- Moment Lab (`?view=moments`) has a button that fires each cinematic, for tuning.

### B5 · Audio editor + Art Review Board v2
- Sound slots: hike, hit, crunch, catch, crowd, TD horn, whistle, dice, UI, and so on.
- EO66 SoundEditor port: waveform trim, loudness matching, Blob uploads, PIN save.
- Art Review Board v2: approve, reject or request a fix with notes per asset, stored in Redis on the bug-kit
  pattern. "Copy for Claude" exports the open notes.

### B6 · Rule modes
- **ALL TECHNO:** the 25 skills.
- **PRO / ALL PRO:** adds #51 (8v8) and field goals (3d6).
- **INFERNO:** fire tokens, ON FIRE, EN FUEGO, FIRE BOMB, BRING THE HEAT.
- Alternate lineups (Ankhs, Chefs, Reapers).

### B7 · Online
- PeerJS host-authoritative rooms with 5-letter codes and a TURN relay, using the Long Shot `room.js` pattern.
- `sanitize()` hides the bench and play stack. Both coaches lock in simultaneous play calls before reveal.
- Shared timers, so the play clock becomes real. Reconnect, spectate.

## Rule rulings I'll apply unless told otherwise
- A Playmaker-negated die counts as 0.
- ON FIRE ends on any fumble (the rulebook wins over the QRS).
- A field goal's distance is counted in squares.
- Banditos #44 = SHOVE + STIFF ARM.
- A failed Option or Interceptor sport check scatters the ball.
- The rest of the open items are listed in `docs/rules-and-rosters.md` §5.
