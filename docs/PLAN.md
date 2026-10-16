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

### B4b · The broadcast package (owner's wishlist) ✅
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

### B4c · Owner's polish list (after B4b) ✅
- **Football:** laces, and a visible spiral in flight.
- **Moment Lab:** add KNOCKED DOWN.
- **Big hit vs sack:** different looks and sounds.
- **Helmets:**
  - remove the white inside the helmet (the shell's interior)
  - clean up the stray white pixels on the edges
- **Pre-game cinematic** (on Take the field, before the run-out):
  - team vs team with records (W-L), which needs a saved win/loss record per team on this device
  - the helmets smash into each other
  - the Techno Bowl logo where Madden puts the NFL shield
- **Readable numbers:** the big numbers on top of the cubes always face the viewer (billboard), whatever the camera.
- **Coin toss:** an actual coin flip animation for the kick-off.
- **8-bit look everywhere:** all buttons and type in the pixel style and font.
- **UI/UX pass:**
  - reusable components
  - consistent spacing
  - check for clipped images and broken links
  - readability
  - no text orphans, nothing bleeding out of boxes
  - smooth animations
- (Already fixed in B4b: the Warriors helmet crop, and the arrows opening the lineup chooser.)

### B5 · Sound editor + Art Review Board v2 ✅
Owner's additions (do first):
- **Snaps:** the ball travels from the center (hiker) back to the receiver, instead of popping into his hands.
- **Music:** the opening TV theme fades out when the game starts (end of the opening show / skip), not at the
  first whistle.
- **Rules audit:** a full re-check of the engine against the rulebook. (The owner's first report, an uncovered
  offensive line player, turned out to be legal per pp.10-11: coverage is only required before a defender stands on
  the line unassigned. Stick with the rulebook; no house rules.) Go through every section with tests (formations, activations, checks and
  free actions, movement costs, passing, hand-offs, tackles, pressure, scatter, downs, clock).
- **Free camera:** mouse-controlled orbit / pan / zoom (OrbitControls, like Long Shot), as an extra view beside the
  presets; dragging switches to it, and picking a preset hands control back.

- EO66 SoundEditor port (`?view=sounds`): waveform trim per slot (e.g. fine-tune the theme splits and grunt cuts),
  loudness matching, Blob uploads, PIN save.
- Art Review Board v2: approve, reject or request a fix with notes per asset, stored in Redis on the bug-kit
  pattern. "Copy for Claude" exports the open notes.

### B5b · Coaching help, playbook, season (owner's request) ✅ (colour-blind shapes moved to B6)
- **Tutorial:** a guided first game (a scripted drive that teaches formation, play call, activations, checks,
  blocks, tackles and passing one step at a time), replayable from Home.
- **Rules / help section:** a full illustrated rules page (Home and in game), plus contextual "?" help on every
  prompt that explains the rule being asked about.
- **On-field help:**
  - show how far a player can run (reachable squares shaded by cost, the half-move limit marked)
  - show how far he can throw (2x skill ring, the +1 short-throw ring)
  - show where players can legally set up (green squares for each player in the formation editor; why a square is
    illegal on hover)
- **Playbook:** saved offensive and defensive formations, from built-in sets (I-form, spread, shotgun-style deep
  passer, goal line, 4-3, nickel, blitz, prevent) plus your own. Pick one and it drops in, adapting to the spot and
  your roster; you can still move anyone before confirming. Also save a 5-card play call with a formation.
- **Season:** pick a team and play a schedule against the other teams (length selectable), with a standings table,
  then a playoff bracket and a Techno Bowl final. Records feed the pre-game W-L card. Saved on the device.
- **My suggestions (owner to OK):**
  - Odds on hover: the % to succeed for a block, tackle or throw before you commit (the modifiers are already known)
  - Save and resume a game in progress (refresh-safe, like Long Shot)
  - Undo a misclick (moves only, until dice are rolled)
  - A "coach's suggestion" button (asks the All-Pro AI what it would do)
  - In-game pause menu (settings, rules, quit) and an auto-answer option for small prompts (bench boost, who goes
    first) so play flows
  - Colour-blind safe highlights (shapes as well as colours), and install-to-home-screen on phones

### B6b · Owner's play-test bugs ✅ (done inside B6)
- Camera: when a formation is being set (offense or defense), cut to a preset wide enough to see every player.
- Touchdown banner fires before the runner's cube crosses the goal line on screen: hold it until the walk lands.
- Motion prompt: once a player and a square are picked, "Go in motion" becomes the bright primary button with focus
  (Space = go), and "No motion" drops to plain.
- (Answered, no change: motion is offense then defense, then both again, rulebook p.11; defense motion doesn't
  depend on the offense moving.)

### B6 · Rule modes ✅
- **ALL TECHNO:** the 25 skills.
- **PRO / ALL PRO:** adds #51 (8v8) and field goals (3d6).
- **INFERNO:** fire tokens, ON FIRE, EN FUEGO, FIRE BOMB, BRING THE HEAT.
- Alternate lineups (Ankhs, Chefs, Reapers).

### B7 · Online ✅
- PeerJS host-authoritative rooms with 5-letter codes and a TURN relay, using the Long Shot `room.js` pattern.
- `sanitize()` hides the bench and play stack. Both coaches lock in simultaneous play calls before reveal.
- Shared timers, so the play clock becomes real. Reconnect, spectate.

### After B7 · Play-test rounds ✅
- Online relay keys on Vercel (Cloudflare TURN), bug-list fixes (iPad audio, cancelable adjustment, Follow camera,
  coin sound), the 10 play-faster helpers, colour-blind mode, Random team, team-coloured turn marker.
- Helmets clipped to one master silhouette; plain drawn down marker; footsteps on every move.
- The moment review (`?view=review`) replacing the old Moments tab flow; reworked animations from the owner's review:
  the ball's flight (no teleport), catch jumps, spin orbits, sideways jukes, end-of-play piles, field goals through /
  wide / off the post.
- Sound settings linked into one setting (sound on by default), the TV theme streamed instead of decoded, the sound
  chip; the ESPN Primetime jukebox (24 tracks); a full-screen button; dead-code sweep and these docs.

- Second play-test round: bug list and Moments links in the menu; the fumble-scatter crash; overhead numbers; real
  timeouts (rulebook p.13-14); saved online games (Resume / Rejoin, away host); real dice / coin / card / fanfare
  sounds, whooshes, the helmet bash, menu blips; the stadium with built-in tunnels; labelled dice that stay longer;
  half-time highlights, the LIVE ticker, player of the game, season leaders, online quick chat and rematch.
- Third round: the music player (progress, seek, volume slider), the online team select (ability players, lineups),
  motion walks its route.

- UI audit round: design tokens everywhere, one central nav, style guide page, the in-game Players drawer.
- Follow-up round: dice colour ownership, seamless crowd, half time after the last play, highlight reels that
  follow the play, Undo any pick, a mobile pass (landscape layout, camera lift, lighter graphics on touch), new smash
  and coin sounds.

### Next
- Owner play-testing and more requests (the owner compacts the session, then sends the next list).
- Ideas not started: a highlight reel across a season, achievements, an online spectator chat.

## Rule rulings I'll apply unless told otherwise
- A Playmaker-negated die counts as 0.
- ON FIRE ends on any fumble (the rulebook wins over the QRS).
- A field goal's distance is counted in squares.
- Banditos #44 = SHOVE + STIFF ARM.
- A failed Option or Interceptor sport check scatters the ball.
- The rest of the open items are listed in `docs/rules-and-rosters.md` §5.
