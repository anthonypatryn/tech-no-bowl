# Techno Bowl — digital

A browser version of the TECHNO BOWL tabletop football game (Bombshell Games / More Fun! League), built from the
owner's purchased print-and-play files. Structure and look follow **Long Shot** (the quality bar, especially cameras
and cinematics) and **Escape Order 66** (sound editor, kits), both siblings on the Desktop.

- Repo: github.com/anthonypatryn/tech-no-bowl (private). Vercel deploys on push to `main`. Site: tech-no-bowl.vercel.app
  (open, no password; the link is private to the owner and friends, so the real NFL TV themes are fine to ship).
- `README.md`: what it is and how to run it. `docs/ARCHITECTURE.md`: how the pieces fit. `docs/CONTENT.md`: art, sound,
  music and the review / bug workflows. `docs/PLAN.md`: batches and history. `docs/rules-and-rosters.md`: the
  transcribed rules and all 32 rosters.

## Status
Every planned batch is done (B0-B7, see `docs/PLAN.md`): all five rule modes, the computer coach at three levels,
online play, season, tutorial, playbook, cinematics, sound, music, review tools. **Now: owner play-testing.** Work comes
from the bug list (`?view=bugs`, PIN), the Art Review Board (`?view=art`) and the moment review (`?view=review`); the
owner pastes their "copy for Claude" output.

## Working with the owner
- Push in batches the owner can play-test. Say plainly what's verified and what isn't (e.g. "I can't hear audio here").
- **Rulebook as written, no house rules.** Disputes: check the rulebook (PDF in the project root), cite the page.
- Branded controls only: never `confirm` / `alert` / `<select>` / a raw checkbox. Use `src/game/ui.jsx` (`useConfirm`,
  `Toggle`, `Chips`, `Kbd`, `Panel`, `Row`, `Button`).
- 8-bit everywhere: Press Start 2P (`--pixel`) for titles / buttons / labels, Pixelify Sans (`--body`) for text.
  Spacing tokens `--s1`..`--s6`, the pixel `--px`. Dark see-through glass panels, keyboard labels on buttons.
- Local play is vs the computer; people play each other online. Play clocks are off by default offline.
- AI ladder in simulation: Starter beats Rookie ~85-90%, All-Pro beats Starter ~55-60% (in every mode).
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Code map
| Path | What |
|---|---|
| `src/main.jsx`, `src/App.jsx` | Entry; no router: `?view=` home / teams / game / tutorial / season / online / rules / settings / art / review / moments / sounds / bugs. Top bar with the ♪ player and full screen |
| `src/game/Home.jsx` | Title screen over a 3D fly-around (`formation.js` lines the cubes up), menu cards, Resume |
| `src/game/TeamPicker.jsx` | Head-to-head team select: helmets, ability players (`AbilityCard`), Random, `TeamGrid`, `LineupPicker` (alternates), rules mode (`MODES`, `MODE_INFO`) |
| `src/game/GameView.jsx` | The game screen: board, score bug, cards, play log (rolls open `RollDetail`), dice toast, callouts, a prompt per request type, pause menu, sound chip, end screen + highlights. `me` prop / module `ME` = the side this screen coaches |
| `src/game/useGame.js` | Builds the `Game` for a match (CPU think time, `BEATS` pacing, speed, fast-forward), resume / undo (`resumeMatch`, `canUndo`), online hosting |
| `src/game/MomentReview.jsx` | `?view=review`: each cinematic on a staged board, run through the real engine; judge, next, copy for Claude. Add a moment = one `REVIEW` entry (bump `v` when reworked) |
| `src/game/Lab.jsx` | `?view=moments`: Moment Lab, fire any cinematic freely |
| `src/game/ArtReview.jsx` | `?view=art`: Teams, Helmets, Down marker, Field, Scoreboard, Moments, Checks, Review. `Verdict`s saved to `/api/reviews` (PIN) |
| `src/game/SoundEditor.jsx` | `?view=sounds`: trim clips per slot; Save (PIN) overrides `sounds.json` for everyone via `/api/sounds` |
| `src/game/OnlinePage.jsx`, `src/net/room.js` | Online: lobby (host / join by code), `HostRoom`, `JoinClient`, `sanitize`, `RemoteGame` |
| `src/game/SeasonPage.jsx`, `season.js` | Season: schedule, standings, top-8 bracket (`tb-season`) |
| `src/game/RulesDrawer.jsx`, `src/data/rulesText.js` | Tabbed, searchable rules (drawer in game, `?view=rules`); `HELP_FOR` maps prompts to sections |
| `src/game/CoachTips.jsx` | Tutorial coach cards |
| `src/data/playbook.js` | Preset formations, saved formations / plays, "same as last" |
| `src/game/Broadcast.jsx`, `OpeningShow.jsx`, `CoinToss.jsx` | Score bug, chyrons, stat cards, wipes; the opening show; the coin flip |
| `src/game/shots.js` | Shot director: `useShot(log)` picks the cinematic (throw / hit / sack / td / onfire / skill / kick), callouts, skip |
| `src/game/replay.js` | `lastPlay(state)` rebuilds a play from the log; `useReplay` plays it back |
| `src/game/sound.js`, `useGameSounds.js` | Audio engine (one context, mixer, crowd bed, streamed theme, unlock) and the log-driven cues |
| `src/game/music.js`, `MusicPlayer.jsx` | The jukebox (24 ESPN Primetime tracks) and the ♪ player + `FullscreenButton` |
| `src/game/prefs.js`, `Settings.jsx`, `keys.js` | Per-device settings (`tb-settings`; prefs.js, not settings.js: Windows name clash), the Settings page, rebindable keys |
| `src/game/odds.js`, `records.js`, `ui.jsx` | Odds text, W-L records, the 8-bit control kit |
| `src/three/Board.jsx` | The 3D game: `Mover` cubes (walk, lunge, jump, orbit, pile), `Ball`, `Tiles`, outlines, effects (`Burst`, `Dust`, `Flames`, `Swirl`, `KickBall`, `GoalPosts`), `moveFx`, camera `Rig` + `shotCam` |
| `src/three/Cube.jsx`, `textures.js`, `Field.jsx`, `Dice.jsx`, `Stage.jsx` | Player / down cubes, atlases, the field + `sq(col,row)`, 3D dice, the canvas wrapper |
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

## Vercel env vars
`KV_REST_API_URL`, `KV_REST_API_TOKEN`, `BUG_PIN` (bugs, reviews, sound overrides; shared Upstash database, key prefix
`tech-no-bowl:`), `CF_TURN_KEY_ID`, `CF_TURN_API_TOKEN` (online relay, copied from Long Shot's `.env.local`).

## Dev checklist (before every push)
```
npx oxlint src tools
npx vite build
npm test                                   # 59 rules tests
npm run sim -- 300                         # must print errors: 0
node tools/simulate.mjs 60 1 passive       # side 0 never acts: games must still end
node tools/simulate.mjs 100 1 allpro:starter
node tools/simulate.mjs 100 1 starter:rookie
node tools/simulate.mjs 60 1 - inferno     # also: alltechno / pro / allpro (rules as the 5th argument)
```
Dev server: `.claude/launch.json` → port 5192. The project is in OneDrive, so Vite polls for file changes
(`vite.config.js`); restart it if a change doesn't show up. The dev build exposes the live game as `window.__tb`.
