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

### B3 · AI ×3, bug system, keybinds, phone, clocks ✅
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

### B4 · Game-day sound + in-play cinematics (the Long Shot bar) ✅
- **Sound runtime** (EO66 `sound.js` pattern: slots, random clip per play, mixer channels from Settings).
  Owner's files, in `public/_audio-src/` (gitignored), cut into clips:
  - crowd bed: a 39 s loop that swells on big plays and dips pre-snap
  - whistles: start (the snap), final (end of the half / game)
  - grunts: 28 clips, picked at random on blocks, tackles and pile-ups
  - effects: 6 hits (contact, catches, landing cubes)
  - TV themes: 5 opening tracks split from the compilation (≈0:00 / 1:36 / 2:50 / 4:03 / 4:39); each game opens with a
    random one. (Owner: private link, the real themes are fine.)
- Camera rig: Broadcast (sideline), End Zone, Overhead, Field level, Follow Ball. `C` cycles.
- **Long throw cam.** Fires on passes of 8+ squares.
  - Chase cam behind the ball's arc, slow-mo at the apex, low lens at the target square.
  - Catch, interception or scatter plays out in the shot, then cut back.
- **Big hits.** Fire on critical tackles (fumbles), sacks and critical blocks.
  - Snap zoom, hit-stop freeze, the cube tumbles with a particle burst, screen shake, grunt and crowd swell.
- Touchdown celebration: crowd roar, confetti burst, slow orbit on the scorer.
- Letterbox bars hide the HUD during shots. Calm mode skips all of it.
- **AI passing game tuned** so the computer throws (the long-throw cam needs throws).
- Moment Lab (`?view=moments`) has a button per cinematic, for tuning.

### B4b · The broadcast package (owner's wishlist)
- **Team select, Madden head-to-head style** (owner's reference screenshot):
  - split screen in each team's colours, big team logo in the middle of each half. The logos come from the art: the
    helmet/logo on the punchboards and team sheets, cropped by the art pipeline (Art Review checks them)
  - city/team name in big type at the bottom, home/away tag
  - down the outer side: only the players with special abilities (cube portrait, #, name, ability chips); tap a
    player to read what his abilities do
  - teams with alternate players who share a number (Ankhs #6, Chefs #55/#70, Reapers #4/#44): after picking the
    team, choose who suits up, with both players' abilities side by side
- **Opening show** (skippable, tap or `Space`):
  - the TV theme plays
  - head-to-head graphic: both teams' cubes spinning, names in team colours, key players and skills, MFL branding
  - tunnel run-out: each team pours out from under its end-zone stands onto the field, smoke and sparks, crowd
    swell; crane and sweep shots cut to the music. Energetic, kinetic, high quality
- **Broadcast overlays, TV style** (MFL-branded, not NFL marks):
  - score bug always on: team colours, score, half, time cubes, down, ball on, timeouts
  - lower-third chyrons when a player makes a play ("#7 MARK FAULT · 3 carries, 24 yds"), drive summary after
    each drive, halftime and final stat cards. The engine gains a stats tracker: carries, yards, passes, catches,
    tackles, sacks, fumbles
- **Transitions / wipes:** MFL-shield stinger on change of possession, after scores, at half time and for overtime.
- **Instant replays** (nice to have): the board can already replay the logged moves, so a big play re-runs from a
  replay camera with a REPLAY bug and slow motion.

### B5 · Sound editor + Art Review Board v2
- EO66 SoundEditor port (`?view=sounds`): waveform trim per slot (e.g. fine-tune the theme splits and grunt cuts),
  loudness matching, Blob uploads, PIN save.
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
