# Techno Bowl — digital

A browser version of the TECHNO BOWL tabletop football game (Bombshell Games / More Fun! League), built from the
owner's purchased print-and-play files. Structure and look follow **Long Shot** (the quality bar, especially cameras
and cinematics) and **Escape Order 66** (sound editor, kits), both siblings on the Desktop.

- Repo: github.com/anthonypatryn/tech-no-bowl (private). Vercel deploys on push to `main`. Site: tech-no-bowl.vercel.app
  (open, no password; the link is private to the owner and friends, so the real NFL TV themes are fine to ship).
- `README.md`: what it is and how to run it. `docs/ARCHITECTURE.md`: how the pieces fit. `docs/CONTENT.md`: art, sound,
  music and the review / bug workflows. `docs/PLAN.md`: batches and history. `docs/STYLEGUIDE.md`: tokens, components, nav rules (live at
  `?view=styleguide`). `docs/rules-and-rosters.md`: the
  transcribed rules and all 32 rosters.

## Status
Every planned batch is done (B0-B7) plus several play-test rounds (see `docs/PLAN.md`): all five rule modes, the
computer coach at three levels, online play (with saved games), season, tutorial, playbook, timeouts, cinematics, a
stadium, sound, music, review tools. **Now: owner play-testing, then more requests.** Work comes from the owner's
messages, the bug list (`?view=bugs`, PIN), the Art Review Board (`?view=art`) and the moment review (`?view=review`);
the owner pastes their "copy for Claude" output. The owner often asks for a plan first: give one, then build it.

### Latest round (all pushed, live)
- Touchdowns (and every play end): the engine now waits for the screen (`catchUp()` at the top of `playDown`) before
  clearing the field, so the runner is seen walking in under the TD shot; the auto replay starts after the shot.
- Players drawer is a card grid (`TeamDrawer.jsx`: `MiniCard`, `PlayerCard` pop-up); phones get it as a bottom sheet.
  Gold gem over ability players' cubes (`AbilityGem` in Board.jsx). Play cards of ability players: gold edge, the ✦
  opens the card, hover shows the tag (`InfoCtx` in GameView).
- "Why": hovering a square lists the move's cost (open squares, each opponent's zone, diagonals) and hovering a
  target / its button lists every modifier (rating, each helper / hurter, abilities, on fire); those players get blue /
  orange rings (`src/game/why.js`). Phones: the tapped square shows its cost.
- Depth chart (`tb-depth`, playbook.js `depthFor` / `saveDepth`): QB / center / receiver / line / back on offense, line /
  back on defense; every playbook set and the start-of-down layout follow it. A QB row in the formation prompt.
- Auto-finish no longer ends a turn while movement is left ("Done (skip the N left)").
- Seasons: "Continue Week N" picks up a season game you backed out of; Home shows the season in progress.
- Cards panel folds (desktop), remembered.
- Fixed: Skip replay left the board frozen on the last replay frame (`useReplay` now clears it); the KICK-OFF wipe's
  thin stripe stuck on screen (its own keyframes + a hide timer that no new log line cancels).
- The 3D canvas rebuilds itself if the browser drops the WebGL context (Stage.jsx); in dev `window.__gl` is the
  renderer (`gl.info.memory`). A 2-minute fast-forward game showed no GPU leak (textures level off at 30).
- Rules: a Glossary tab (30 terms) and the Adjustment rule.
- Clicking / tapping a cube the open question can't use opens his card (`pickPlayer` in GameView). The touchdown's
  auto replay is the whole scoring play (snap to end zone) at 0.75 speed, labelled with the scorer, on the broadcast
  camera; replays skim action more than 4 squares from the ball and rebuild the down / line it was played on.
- The depth chart opens before your first line-up of a game (the play clock waits). While moving, only target players
  catch the pointer (`pickable` on Board, `solid` on Mover); rings never do, so squares near players are easy to hit.
- Helmet thumbnails (`public/art/helmets/sm/`, `helmetUrl(id, true)`; made by extract_art.py) for grids, schedules,
  standings and the score bug. New home-screen / app icons from the helmet (`?v=2` so phones re-fetch).

### Earlier
- Dice colours: scatter / order rolls log `sides` (whose die is whose) as they're rolled; Dice.jsx uses that, never
  possession at draw time (a recovery had already flipped it). Die tags sit under the dice.
- Crowd loop baked seamless (6 s equal-power cross-fade + level riding) in `seamless()` (sound.js), random entry point.
- Half time waits for the last play on screen (`game.readyAt` from useGame's delay, and any running shot). Replays:
  the banner styles were lost in B4c (restored), "HIGHLIGHT 1 OF 3 · label", Next, Back to the game; the camera is
  `follow` during replays; end screen "Watch them all". Log entries rebuilt on resume / undo carry `old` (no coin toss
  or half-time card again).
- **Undo** any pick (prompt corner, key U) until dice roll, cards flip, the snap / kick, or the computer moves
  (`canUndo` in useGame.js).
- Mobile pass: phone-landscape game layout (`max-height: 520px`), the camera lifts the picture above the cards +
  prompt (`setViewOffset` from `--bottom-h`), prompt corner on its own row on phones, team select fits, taller sliders.
  Touch devices default to the 2K field (no crowd), 1024 shadows, DPR 1.5 (`TOUCH`, `PERF_V` in prefs.js) after a
  season start crashed the owner's browser (not reproduced on desktop: memory is the likely cause).
- Sounds: `smash` (helmet crash in the opening show), new `coin` flip. Owner tools row on Home.
- First-batch leftovers done: drawers end above the prompt, rules tabs as chips, display sizes `--d1..--d3`, 141
  buttons now `<Button>`.
- Not yet checked by the owner: the crowd loop by ear, the new sounds, phones / iPad for real, the season crash.

### Before that
- UI audit (see `docs/STYLEGUIDE.md`): every font size / space / corner / repeated colour is now a token in index.css;
  pixel text follows Settings → Text size. One central nav (`TopBar`: Play · Season · Online · Rules + More with the
  owner tools; Menu under 860px). Style guide page `?view=styleguide`. Game toolbar is one row under 1100px; Report a
  bug and full screen moved to the pause menu; prompt corner buttons float; score bug no longer squeezed.
- **Players drawer** in the game (`TeamDrawer.jsx`, key P, "Players" button): both rosters, ability players first,
  every ability spelled out, status (ball, up now, down, on fire, en fuego); tap one to ring him and aim the camera.
  Hovering a cube shows a tag with his abilities; play cards of ability players get a ✦.
- Not yet checked by the owner: the new nav and toolbar on iPad, the Players drawer in a real game.

### Previous round
- Fumble-scatter crash fixed (touch "tap again" tile kept no data; `same()` now never matches a missing square).
- Cube numbers read up the screen from the camera's own up vector (any view); overhead leans slightly.
- Timeouts by the rulebook: a Timeout button on every dead-ball prompt, sent as an answer (`{ timeout: true }`).
- Online: "Your online games" (host Resume with the same code, friend Rejoin), the friend waits for a host who's away.
- Sound: Long Shot's dice / coin / card / fanfare recordings, synthesized whooshes, helmet bash and menu blips.
- Stadium (`Stadium.jsx`), labelled dice that stay longer, half-time highlights, LIVE commentary ticker, player of the
  game, season leaders, online quick chat + rematch.
- Music player: progress line (seek, time left) and a volume slider (`Slider` in ui.jsx). Online team select shows
  ability players (tap to read) and the lineup picker. Motion logs its route and the cube walks it.
- Not yet checked by the owner: the new sounds (Claude can't hear), online resume across two real devices, motion
  walking on screen, the lineup picker with an alternates team (Ankhs / Chefs / Reapers).

## Working with the owner
- Push in batches the owner can play-test. Say plainly what's verified and what isn't (e.g. "I can't hear audio here").
- **Rulebook as written, no house rules.** Disputes: check the rulebook (PDF in the project root), cite the page.
- Branded controls only: never `confirm` / `alert` / `<select>` / a raw checkbox. Use `src/game/ui.jsx` (`useConfirm`,
  `Toggle`, `Chips`, `Slider`, `Kbd`, `Panel`, `Row`, `Button`).
- **Tokens only** in CSS: `--t1..--t6` pixel sizes, `--small` / `--tiny`, `--s1..--s6`, `--r1` / `--r2`, colour tokens.
  No one-off px for type, space or corners (see `docs/STYLEGUIDE.md`).
- 8-bit everywhere: Press Start 2P (`--pixel`) for titles / buttons / labels, Pixelify Sans (`--body`) for text.
  Spacing tokens `--s1`..`--s6`, the pixel `--px`. Dark see-through glass panels, keyboard labels on buttons.
- Local play is vs the computer; people play each other online. Play clocks are off by default offline.
- AI ladder in simulation: Starter beats Rookie ~85-90%, All-Pro beats Starter ~55-60% (in every mode).
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Code map
| Path | What |
|---|---|
| `src/main.jsx`, `src/App.jsx` | Entry; no router: `?view=` home / teams / game / tutorial / season / online / rules / settings / art / review / moments / sounds / bugs / styleguide. `TopBar` = the one nav (main links + More menu), ♪ player, full screen |
| `src/game/Home.jsx` | Title screen over a 3D fly-around (`formation.js` lines the cubes up), menu cards, Resume |
| `src/game/TeamPicker.jsx` | Head-to-head team select: helmets, ability players (`AbilityCard`), Random, `TeamGrid`, `LineupPicker` (alternates), rules mode (`MODES`, `MODE_INFO`) |
| `src/game/GameView.jsx` | The game screen: board, score bug, cards, play log (rolls open `RollDetail`), dice toast, callouts, a prompt per request type, pause menu, sound chip, end screen + highlights. `me` prop / module `ME` = the side this screen coaches |
| `src/game/useGame.js` | Builds the `Game` for a match (CPU think time, `BEATS` pacing, speed, fast-forward), resume / undo (`resumeMatch`, `canUndo`), online hosting |
| `src/game/TeamDrawer.jsx` | In-game Players drawer (card grid), `PlayerCard` pop-up, `playerSkills`, the hover `PlayerTag` |
| `src/game/why.js` | Move cost and contact-roll breakdowns with the players causing them (`moveWhy`, `contactWhy`) |
| `src/game/StyleGuide.jsx` | `?view=styleguide`: every token and control, live |
| `src/game/MomentReview.jsx` | `?view=review`: each cinematic on a staged board, run through the real engine; judge, next, copy for Claude. Add a moment = one `REVIEW` entry (bump `v` when reworked) |
| `src/game/Lab.jsx` | `?view=moments`: Moment Lab, fire any cinematic freely |
| `src/game/ArtReview.jsx` | `?view=art`: Teams, Helmets, Down marker, Field, Scoreboard, Moments, Checks, Review. `Verdict`s saved to `/api/reviews` (PIN) |
| `src/game/SoundEditor.jsx` | `?view=sounds`: trim clips per slot; Save (PIN) overrides `sounds.json` for everyone via `/api/sounds` |
| `src/game/OnlinePage.jsx`, `src/net/room.js` | Online: lobby (host / join by code, `TeamChooser` with ability cards + lineups), "Your online games" (Resume / Rejoin), `HostRoom`, `JoinClient` (waits for an away host), `sanitize`, `RemoteGame`, `REACTIONS` + `PHRASES` |
| `src/game/SeasonPage.jsx`, `season.js` | Season: schedule, standings, top-8 bracket (`tb-season`) |
| `src/game/RulesDrawer.jsx`, `src/data/rulesText.js` | Tabbed, searchable rules (drawer in game, `?view=rules`); `HELP_FOR` maps prompts to sections |
| `src/game/CoachTips.jsx` | Tutorial coach cards |
| `src/data/playbook.js` | Preset formations (follow the depth chart), saved formations / plays, "same as last", depth chart (`depthFor`) |
| `src/game/Broadcast.jsx`, `OpeningShow.jsx`, `CoinToss.jsx` | Score bug, chyrons, stat cards, wipes; the opening show; the coin flip |
| `src/game/shots.js` | Shot director: `useShot(log)` picks the cinematic (throw / hit / sack / td / onfire / skill / kick), callouts, skip |
| `src/game/replay.js` | `lastPlay(state)` rebuilds a play from the log; `useReplay` plays it back |
| `src/game/sound.js`, `useGameSounds.js` | Audio engine (one context, mixer, crowd bed, streamed theme, unlock, `synth()` whoosh / bash / blips, `menuSounds()`) and the log-driven cues |
| `src/game/music.js`, `MusicPlayer.jsx` | The jukebox (24 ESPN Primetime tracks; `position` / `seek`) and the ♪ player (progress line, volume slider, track list, when-music-plays switches) + `FullscreenButton` |
| `src/game/prefs.js`, `Settings.jsx`, `keys.js` | Per-device settings (`tb-settings`; prefs.js, not settings.js: Windows name clash), the Settings page, rebindable keys |
| `src/game/odds.js`, `records.js`, `ui.jsx` | Odds text, W-L records, the 8-bit control kit |
| `src/three/Board.jsx` | The 3D game: `Mover` cubes (walk, lunge, jump, orbit, pile), `Ball`, `Tiles`, outlines, effects (`Burst`, `Dust`, `Flames`, `Swirl`, `KickBall`, `GoalPosts`), `moveFx`, camera `Rig` + `shotCam` |
| `src/three/Stadium.jsx` | The stadium: stands (low on the broadcast side), crowd cubes that jump on big moments, tunnels in the end-zone stands (`TUNNEL_Z`), light towers |
| `src/three/Cube.jsx`, `textures.js`, `Field.jsx`, `Dice.jsx`, `Stage.jsx` | Player / down cubes (numbers face up the screen), atlases, the field + `sq(col,row)`, 3D dice (team tags, steer round players), the canvas wrapper |
| `src/engine/` | The rules engine, no UI: `board.js` geometry, `rules.js` pure rules + skills, `game.js` the `Game`, `formations.js`, `ai.js` (`makeAI`), `bot.js` (simulator coaches) |
| `src/data/art.js` (+ generated `art.json`, `teams.json`), `abilities.js`, `sounds.json`, `music.json` | Art manifest + rosters, ability texts + alternates, clip table, track list |
| `api/*.js` + `lib/*.js` | Vercel functions: bugs, reviews, sounds (Redis, PIN), turn (Cloudflare relay). Dev middleware in `vite.config.js` saves to `.data/` (PIN 1234) |
| `tools/` | `extract_art.py` (art), `cut_music.py` (music), `simulate.mjs` (simulator), `test-rules.mjs` (tests) |

## Board geometry
- 1 world unit = 1 square = 5 yards. **13 columns × 24 rows**, end zones included (rows 0-1 blue, 22-23 orange),
  centred on the origin (columns along x, rows along z). Side 0 attacks row 0. The broadcast camera is on +x.
- The ball is spotted on a line between rows (line k between row k-1 and k).

## Engine
- `Game.ask(side, req)` is the choke point; every answer is validated (`askValid`, with a fallback for bots). A
  computer coach is `fn(game, side, req)`; a person answers through `game.answer(value, reqId)`.
- Requests: setup `toss` / `formation` / `call` / `motion` / `timeout` / `kick` / `onFire`; cards `pick` /
  `readReact` / `first`; activation `act` / `bonus` / `adjustPartner` (null cancels); checks `boost` (number, or
  `{ boost, fire, showboat, heat }` in INFERNO) / `dodge` / `fireDefend` / `reverse` / `push` / `followUp` / `scatter` /
  `spin` / `option` / `heatCrit`.
- Each `act` request lists every legal choice (moves, passes, blocks, tackles, shoves, jukes, shakes, dirty hits,
  hand-offs incl. pitch, fire options); the UI only offers those. `asMove` = skills used as part of a move.
- A play ends by throwing `PlayEnd`; `endPlay` scores, moves the chains and the clock. Log entries carry data and drive
  the board, sounds, shots and replays. Pacing: `pace(entry)` adds owed time the next `ask` waits for.
- Seeded `mulberry32`: the same seed + the same answers replay a game exactly (resume, undo, online host resume).
- Modes: `MODES` in game.js (`skills`, `pro`, `fieldGoals`, `inferno`). `hasSkill(s, p, a)` in rules.js.

### Rulings (the rulebook leaves these open; change them if the owner disagrees)
- Benches are dealt fresh every down (2 cards per player). Teams don't switch ends at half time.
- A carrier knocked down by anything but a tackle fumbles. A dramatic recovery by a downed carrier ends the down.
- A scatter landing on a standing player gives him a sport check to grab it; fail (or downed) scatters again.
- Pass penalty = opponents threatening the target + the passer (+ zone defenders within 3, -3 man coverage), cap 3.
- After a turnover only lateral or backward passes. A carrier pushed into the opponent's end zone scores.
- Defensive pressure: once per defender activation, stepping from outside the carrier's threat zone to inside it.
- Dead ball: a whole cycle of cards with no movement, contact or ball handling ends the play where the carrier stands.
- Skills: a Playmaker-negated die counts 0. A failed OPTION or INTERCEPTOR sport check scatters. ZONE DEFENDER counts
  for INTERCEPTOR. POCKET PASSER: the first pass after the 5 called cards, by the snap taker who hasn't moved.
- INFERNO: ON FIRE ends on any fumble. Hurdle = 1 token for the rest of the activation. The dogpile activation may move
  (half, then the dirty hit). EN FUEGO ends when that coach activates another player.
- Field goals: squares from the hiker's square to the square past the posts, +1 (the p.20 example = 12).

## Hard-won rules (don't undo these)
- **Audio:** one shared AudioContext (`audioContext()`), unlocked on touchend / click with a silent blip, re-woken on
  later taps and on tab return. Never decode `themes.mp3` in game (~120 MB decoded; it silenced iPads): the theme and
  the jukebox stream through `<audio>` into the mixer. Mute and volume live in ONE setting (`muted`, `mix`); sound.js
  follows it via `onSettings`, so controls only call `setSettings`. Bump `SOUND_V` (prefs.js) to turn sound back on for
  everyone once.
- **Ball flights** start in a layout effect, or a frame snaps the ball to its new holder first (the "teleport").
- **Redraws** fall back to a timer when no animation frame comes (background tabs / an online host who switched away).
- **React dev double-mount:** never stop a game in an effect cleanup on unmount; stop the one a new game replaces.
- **Helmets:** every helmet is the same model in the same frame; `do_helmets` clips all 32 to one master silhouette.
- **Play ends wait for the screen**: `catchUp()` before the field is cleared. Don't clear state the screen is still
  animating; the engine runs ahead of the screen by the paced time.
- **Timeouts** are an answer (`{ timeout: true }`) to any dead-ball question (`DEAD_BALL` in game.js), so they're
  validated, saved and sent online like everything else. `same()` never matches a missing square (bad answers fail).

## Vercel env vars
`KV_REST_API_URL`, `KV_REST_API_TOKEN`, `BUG_PIN` (bugs, reviews, sound overrides; shared Upstash database, key prefix
`tech-no-bowl:`), `CF_TURN_KEY_ID`, `CF_TURN_API_TOKEN` (online relay, copied from Long Shot's `.env.local`).

## Dev checklist (before every push)
```
npx oxlint src tools
npx vite build
npm test                                   # 65 rules tests
npm run sim -- 300                         # must print errors: 0
node tools/simulate.mjs 60 1 passive       # side 0 never acts: games must still end
node tools/simulate.mjs 100 1 allpro:starter
node tools/simulate.mjs 100 1 starter:rookie
node tools/simulate.mjs 60 1 - inferno     # also: alltechno / pro / allpro (rules as the 5th argument)
```
Dev server: `.claude/launch.json` → port 5192. The project is in OneDrive, so Vite polls for file changes
(`vite.config.js`); restart it if a change doesn't show up. The dev build exposes the live game as `window.__tb`.
