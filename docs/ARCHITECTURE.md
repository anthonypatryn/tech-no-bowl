# Architecture

Plain JavaScript + React 19 + Vite, three.js through @react-three/fiber, PeerJS for online play, a few Vercel
functions. No router, no state library: the engine owns the game state and the screens render it.

```
            ┌──────────────── src/engine (no UI) ────────────────┐
answers ──▶ │ Game: async down loop · ask(side, req) · validate  │ ──▶ state + log entries
            │ rules.js (pure rules, skills) · board.js (geometry)│
            │ ai.js / bot.js (computer coaches)                  │
            └────────────────────────────────────────────────────┘
                     ▲                                 │
        useGame.js (pacing, CPU, resume, hosting)      ▼
                     │                    GameView (prompts, HUD) · Board (3D) · sounds · shots · replays
```

## The engine (`src/engine`)
- **`Game`** runs a whole game as async code. Whenever a coach must decide something it calls `ask(side, request)`
  and waits. A computer coach is a function `(game, side, req) -> answer`; a person answers through the screen with
  `game.answer(value, reqId)`. Every answer is checked against the request (`askValid`); a bot that answers badly
  twice gets a safe fallback, counted in the stats so the simulator catches it.
- **Requests list the legal choices.** An `act` request carries every move (with its cost), pass (with modifiers),
  block, tackle, skill action and fire-token option, so the UI only ever offers what the rules allow.
- **The log is the source of truth for the screen.** Each entry carries data (who, from, to, path, dice, result).
  The 3D board walks cubes along logged paths, the sound hook plays cues, the shot director picks cinematics, and
  replays play plays back, all from the log.
- **Frames for replays:** a screen game's engine also records where every player and the ball are after each log
  entry of a play (`game.frames`, outside the state). `lastPlay(state, frames)` turns a finished play into steps (log
  entry + recorded positions), so a replay is exactly what happened. An online friend's screen has no frames and
  falls back to rebuilding from the events. Big plays get the telestrator (`src/three/Telestrator.jsx`).
- **Pacing:** `pace(entry)` gives each entry screen time; the next `ask` waits for it, and so does clearing the field
  for the next down (`catchUp()`), so the end of a play is always seen. The simulator passes no pace and runs flat out.
- **Determinism:** dice come from a seeded `mulberry32`. The same seed plus the same answers rebuild the same game,
  which powers resume, undo and an online host reloading mid-game.
- **Modes** are flags (`skills`, `pro`, `fieldGoals`, `inferno`); `hasSkill(state, player, name)` gates abilities.

## The game screen (`src/game`)
- **`useGame(match)`** builds the `Game`: the human is side 0, the computer side 1 with "thinking" delays; online, both
  sides are people and side 1's answers arrive over the network. It saves the answer trail for Resume and powers Undo.
- **`GameView`** renders the HUD and one prompt per request type, from the open request. It never changes game state
  itself; it calls `game.answer`. It can coach either side (`me`), which is how the online friend's screen works.
- **Helpers that save clicks:** one-click move-and-tackle, auto-finish, coach's suggestion (the All-Pro AI run on a
  copy of the dice), quick play, fast-forward, same-as-last.

## The 3D board (`src/three`)
- **`Board`** draws the field, cubes (`Mover`), the ball, highlight tiles (one instanced mesh, clicks through one
  invisible plane), throw-range outlines, effects and the camera rig.
- **Animation comes from the log:** walks follow logged paths; a contact check makes the actor lunge; `moveFx` adds
  catch jumps, spin-move orbits and the end-of-play pile; the ball flies between holders.
- **Cameras:** presets (Broadcast, Follow, End zone, Overhead, Field level) and Free (mouse orbit). During a
  cinematic (`useShot`) the rig flies a scripted shot and the HUD letterboxes, when Settings → Cinematic camera allows
  it (`movesCamera`: big plays by default; Overhead and Free never move). The picture is lifted above the cards +
  prompt by `--lift-h`, measured only when a new question comes up.
- **The stadium** (`Stadium.jsx`): block stands (low on the broadcast side so they never block the camera), a crowd of
  cubes that jumps on big moments, tunnels built into the end-zone stands, light towers.
- **Cube numbers** turn in quarter steps so their top points up the screen, using the camera's own up vector (so
  straight-down views work too).

## Sound and music
- **One AudioContext** with a master gain and a compressor. Clips come from `src/data/sounds.json` (cut from
  `public/sfx/*.mp3`), chosen at random per slot, and are played by log cues in `useGameSounds`.
- The crowd is a looping bed with swells. The TV theme and the jukebox stream through `<audio>` elements into the
  mixer (big files are never decoded whole).
- **Settings own the truth:** `muted` and the `mix` levels live in one setting; the engine follows changes.
- Browsers start audio only after a tap: the first tap unlocks it, and later taps re-wake it if the system suspended it.

## Online (`src/net/room.js`)
- **Peer to peer** over WebRTC (PeerJS's free broker; Cloudflare TURN relay credentials from `/api/turn` for strict
  networks). Room codes are 5 letters.
- **Host-authoritative:** the host's browser runs the `Game`. The friend gets the state through `sanitize` (the
  host's bench, play call and private questions hidden) and sends answers back. Spectators see both benches hidden.
- Big state messages are split into parts (PeerJS refuses ~16 KB+). Pings every 3 s; quiet for 10 s means gone. The
  friend retries for about 90 s; a host who reloads gets the same code back and rebuilds the game from the trail.
- The friend's screen runs on `RemoteGame`, a stand-in that looks enough like `Game` for `GameView`.
- **Saved games:** the host's game (match + answer trail + room) and the friend's room code are kept on each device
  ("Your online games"). The host resumes with the same code (the game is rebuilt from the trail); a friend waiting
  on an away host keeps retrying, so either can come back first.
- **Timeouts** are answers (`{ timeout: true }`) to any dead-ball question, so they travel online like everything else.

## Server pieces (`api/`, `lib/`)
Tiny Vercel functions: bug reports, Art Review verdicts and sound-editor overrides (Upstash Redis via REST, writes
need the PIN), and the TURN relay. `vite.config.js` mounts the same handlers in dev, saving to `.data/`.

## Testing
- `npm test`: the rulebook's worked examples and scenario tests with forced dice (every skill, field goals, Inferno).
- `tools/simulate.mjs`: thousands of computer-vs-computer games per run with invariant checks (no two players on a
  square, cards add up, fire tokens 0-3, legal scores), in every rule mode, plus AI-level ladders.
