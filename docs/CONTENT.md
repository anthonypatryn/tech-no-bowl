# Content: art, sound, music, reviews

## Art (`tools/extract_art.py`, `npm run art [teams cubes field board helmets logo]`)
The purchased print-and-play files sit in the project root (gitignored). The script turns them into web textures
under `public/art/` and writes `src/data/art.json` and `teams.json` (don't hand-edit those).
- **Uniforms:** every sheet is 8 cube nets. The middle square is the top (the number); the arms are the player
  standing. Atlases keep the top and the front, one row per player in jersey order. The team comes from the title
  printed on the sheet, so a misnamed file still lands right; duplicate sheets keep the first.
- **Helmets:** all 32 are the same 3D helmet model printed in the same frame. Each is cut out, the cleanest dark ones
  are averaged into one master silhouette (facemask holes included), and every helmet is clipped to it. That gives
  white shells and the Chefs' white facemask their true outline on any background.
- **Logo:** the rulebook-cover helmet, same cutout (`cutout()` un-mixes the page white from the edges).
- **Field:** 4K and 2K WebP; its calibration lives in `art.json` → `field` (check it on Art Review → Field).
- **Down marker:** drawn by the game (white number on solid orange), not cut from the sheet.

## Sound (`public/sfx`, `src/data/sounds.json`)
- The clip table maps each slot (crowd, whistle, grunt, hit, step, theme...) to clips: `{ file, start, len, vol, fade }`.
  One clip is picked at random each time (never the same twice running).
- **Sound editor** (`?view=sounds`): pick a slot, trim clips on the waveform, set volume and fades, play them. Save
  (with the PIN) stores overrides for everyone; "Copy for Claude" hands the table back to bake into `sounds.json`.
- Footsteps: 13 levelled clips from four grass-running recordings; each move plays one cut to the walk's length.
- From Long Shot (Pixabay, free): the dice roll, the coin landing, card snaps (calling plays), the winner's fanfare.
- The owner's picks (Pixabay): the coin flip, and the window smash used for the helmets crashing in the opening show
  (`smash`). Credits in `public/sfx/README.md`.
- The crowd bed is baked into a seamless loop when it loads (cross-faded ends, level evened out).
- Synthesized in code: whooshes (wipes, opening-show cards), 8-bit menu blips (Settings: Menu
  sounds), the big-hit crack, the sack boom, fire, the kick thud.

## Music (`public/music`, `src/data/music.json`)
- `python tools/cut_music.py "<ESPN NFL Primetime compilation>.mp3"` splits the compilation at MP3 frame boundaries
  (no re-encoding) using the track list in the script. To fix a cut, edit its start time there and re-run.
- The jukebox (♪ in the top bar and the game's tools) plays tracks on the menus, at half time and the final whistle,
  and during games if switched on (Settings → Music player). The player has play / pause / previous / next / shuffle,
  a progress line (click to jump), a volume slider (the same Music level as Settings) and the track list.

## Reviewing
- **Art Review Board** (`?view=art`): every asset gets a verdict (approve / needs fix / reject + a note, PIN needed).
  The Review tab copies the open items for Claude.
- **Moment review** (`?view=review`): every cinematic, one at a time, on a board set up for it and played through the
  real engine with sound. Replay, approve, ask for a change or reject, then the next. The end screen copies the whole
  list for Claude. A reworked moment comes back up for another look.
- **Moment Lab** (`?view=moments`): fire any cinematic freely.

## Bugs
- **Report a bug** is in the top bar's More menu and the game's pause menu (key B): what happened, what you expected, optional photos.
  It attaches the game's state (seed, score, last log lines, device).
- **Bug list** (`?view=bugs`, PIN): read, fix notes, reopen. Claude reads it with the PIN and marks fixes with a note.
