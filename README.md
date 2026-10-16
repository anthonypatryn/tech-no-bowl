# TECHNO BOWL

8-bit tabletop football from the More Fun! League, in the browser. Every player is a cube on a 3D field, every play
is a stack of five cards, and the dice decide the hits. Built from the official print-and-play files and played by
the rulebook.

**Play:** https://tech-no-bowl.vercel.app

## What's in it
- **Every rule mode:** Techno (7-vs-7), All Techno (the 25 special abilities), Pro and All Pro (8-vs-8, field goals),
  and Inferno (fire tokens, On Fire, En Fuego, Fire Bomb, Bring the Heat, dirty hits, dogpiles).
- **32 teams** with their real uniforms, helmets, ability players and alternate lineups.
- **The computer coach** at three levels: Rookie, Starter, All-Pro.
- **Online:** host a room, send the 5-letter code (or the invite link), play a friend. Others can watch. Games are
  saved: the host resumes and the friend rejoins later. Quick chat and reactions.
- **Season** with standings and an 8-team playoff to the Techno Bowl. **Tutorial**, searchable **rules**, a
  **playbook** of preset formations, odds on every action, undo, a coach's suggestion, quick play, fast-forward, a **Players** drawer (key P) with every ability on both teams, a
  **depth chart** (pick your QB, line and backs), cost and modifier breakdowns on hover, odds over the players' heads,
  move-and-hit buttons, number keys for picks, Undo, and a glossary.
- **TV presentation:** a stadium, opening show, score bug, chyrons, a LIVE commentary line, cinematic cameras for big
  throws, hits, sacks, touchdowns and specials, pile-ups, exact instant replays (with a telestrator on big plays) and half-time highlights, crowd, whistles
  and real dice sounds, NFL TV themes, and a jukebox of 24 ESPN Primetime tracks with a full player.
- Works on desktop, iPad and phones; installable to the home screen; colour-blind mode; rebindable keys.

## Pages
| Link | What |
|---|---|
| `/` | Home |
| `?view=teams` | Play the computer |
| `?view=tutorial` | Guided first game |
| `?view=season` | Season and playoffs |
| `?view=online` | Play a friend |
| `?view=rules` | How to play |
| `?view=settings` | Settings (sound, music, text size, keys, motion, colour-blind mode) |
| `?view=art` | Art Review Board (verdicts need the PIN) |
| `?view=review` | Moment review: every cinematic, one at a time |
| `?view=moments` | Moment Lab: fire any cinematic |
| `?view=sounds` | Sound editor |
| `?view=bugs` | Bug list (PIN) |
| `?view=styleguide` | Style guide: every token and control |

## Run it locally
```
npm install
npm run dev          # http://localhost:5192
```
| Script | What |
|---|---|
| `npm run dev` / `build` / `preview` | Vite |
| `npm run lint` | oxlint |
| `npm test` | The rules tests (the rulebook's worked examples, every skill, field goals, Inferno) |
| `npm run sim -- 300` | 300 computer-vs-computer games with invariant checks (`node tools/simulate.mjs N seed mode rules`) |
| `npm run art` | Rebuild `public/art/` from the print-and-play files (Python: PyMuPDF, OpenCV, Pillow) |
| `python tools/cut_music.py <file>` | Cut the ESPN compilation into `public/music/` |

The print-and-play source files (PDF / JPG) live in the project root and are not committed (purchased art). The web
textures made from them under `public/art/` are.

## Deploy
Push to `main`; Vercel builds and deploys. Server-side pieces are small Vercel functions in `api/` (bug reports, art
verdicts, sound editor saves, the online relay). Environment variables: see `CLAUDE.md`.

## Docs
- `docs/ARCHITECTURE.md`: how the engine, screen, 3D board, sound and online play fit together
- `docs/CONTENT.md`: art, sound and music pipelines, and the review and bug workflows
- `docs/PLAN.md`: the build plan and what each batch delivered
- `docs/STYLEGUIDE.md`: design tokens, components, navigation, the UI audit
- `docs/rules-and-rosters.md`: the rules and all 32 rosters, transcribed
- `CLAUDE.md`: working notes for Claude (code map, rulings, hard-won rules, checklist)
