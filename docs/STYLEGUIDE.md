# Style guide

The live version is `?view=styleguide` (More → Owner tools → Style guide): every token and control, rendered. This file
is the rules and the component list. Tokens live at the top of `src/index.css`; controls live in `src/game/ui.jsx`.

## Look
8-bit night game: dark see-through glass panels with a hard 2px edge and an offset shadow, LED-yellow for anything
selected, green for the main action, red for danger. Near-square corners. Press Start 2P for anything you press or scan
(titles, buttons, labels, chips, tags); Pixelify Sans for anything you read (hints, rules, ability texts, the log).

## Tokens (use these, never one-off numbers)
| Kind | Tokens | Use |
|---|---|---|
| Pixel type | `--t1` 8 · `--t2` 10 · `--t3` 12 · `--t4` 14 · `--t5` 16 · `--t6` 24 (px × text size) | t1 key labels, tiny tags · t2 small buttons, chips, labels · t3 buttons, nav · t4 big buttons, drawer titles · t5 headings, brand · t6 page titles |
| Running text | body 18px × text size; `--small` .85em, `--tiny` .75em | hints, secondary lines; the log |
| Space | `--s1` 4 · `--s2` 8 · `--s3` 12 · `--s4` 16 · `--s5` 24 · `--s6` 32; `--px` 2 (borders) | padding, gaps, margins |
| Corners | `--r1` 2px controls · `--r2` 4px panels and cards; `50%` only for round things (dots, the ball) | |
| Colour | `--bg` `--bg2` `--glass` `--glass-hi` `--line` `--text` `--muted` `--led` `--led-edge` `--ink` `--go` `--go-edge` `--mfl-red` `--mfl-blue` `--warn` `--bad` `--fire` | see the live page for what each is for |
| Display | `--d1` `--d2` `--d3` (clamp: follow the screen, not the text size) | TV moments only |
| Breakpoints | 560 phone · 760 small tablet · 860 tablet (menus) · 1100 game toolbar row; `max-height: 520px` landscape phone | media queries can't use variables: use these numbers only |

- Every pixel-font size is a token, so Settings → Text size grows labels and buttons as well as body text.
- Exceptions, on purpose: broadcast graphics (score bug, chyrons, wipes) pin the tokens to fixed px because they are
  drawn to fit; display numerals (the score, the big roll, the room code, banners) use their own sizes or `clamp()`.
- Team colours come from the team data (`--c0`, `--c1` set inline), never hard-coded.

## Components (src/game/ui.jsx)
| Component | What | Rules |
|---|---|---|
| `Button` (`.btn`) | Blocky button. `kind` primary / danger, `size` small / big, `keyAction` shows its key, class `on` = selected | One primary per screen or prompt. Danger only for leave / delete, always behind `useConfirm` |
| `Chips` (`.chips`) | A row of choices in place of a drop-down; `small` | The chosen one is LED yellow. `.chipbtn` is the same block for one-off chip buttons |
| `Toggle` | A switch in place of a checkbox, with its words beside it | |
| `Slider` | 0..1, drag / click / arrow keys, in place of a range input | Volumes (Settings, the music player) |
| `Panel` (`.glass`) | The one box | Don't hand-roll other boxes |
| `Row` (`.opt`) | Label | control grid, so labels line up; `stack` = several controls one per line | Settings-style forms |
| `Kbd` (`kbd.kh`) | A key label on a control; hidden on touch screens | Pass `a` (a rebindable action) so it shows the player's binding |
| `useConfirm` | The on-brand confirm box | Never `confirm()` / `alert()` |
| `.page` + `.page-title` | A menu page and its title | Max 1320px; `.page.settings` 860px |
| `.drawer` + `.drawer-head` / `.drawer-foot` | The in-game side panel (Rules, Players) | Escape closes; one open at a time is fine |
| `.menu-card` | A big choice on Home; `.primary` = the main one | |
| `.hint`, `.warn`, `.muted`, `.led` | Text roles | |
| Field labels: `.field-key` (yellow number-key marker), `.field-odds` (chance over a head, coloured by action), `.field-why` (+ / - helper / hurter), `.why-chip` (breakdown chips) | drei `Html` over cubes and squares, `zIndexRange={[2, 0]}` so the HUD stays on top | |
| Game: `.skill-chip` (`.live` = usable now), `.roster-tag`, `.card` (`.card-star` = ability player: gold edge, opens the card), `.player-tag`, `.why` (breakdowns), `PlayerCard` (the full card pop-up), `.pc-card` (drawer cards), `.depth-row` | | Ability = gold (`#ffb000`): card edges, the ✦ badge, the gem over a cube |

Never: `<select>`, a raw checkbox or range input, `confirm` / `alert`, inline font sizes, a radius above 4px on a box.

## Navigation
- One top bar on every menu page (`TopBar` in `App.jsx`): the brand (Home) on the left, the main nav in the middle
  (Play · Season · Online · Rules), the music player, full screen and **More** on the right. More holds Tutorial,
  Settings, Report a bug and the owner tools (Art review, Moment review, Moment lab, Sound editor, Bug list, Style
  guide). Under 860px the main nav folds into the same menu (the button reads **Menu**).
- The game has no top bar: its toolbar (Menu, Camera, Players, Rules, Replay, sound, music, fast-forward) and the
  pause menu (resume, how to play, sound, speed, quick play, report a bug, full screen, quit) do that job.
- The Moment review and Moment lab are full-screen 3D tools with their own Home button.

## Audit (2026-10-15) — what was found and what changed
Fixed:
- 46 different font sizes (7-20px and many ems) → the six-step pixel scale and two running-text steps. Pixel sizes
  were in px and ignored Settings → Text size; they now follow it.
- 13 corner radii (1-12px) on an 8-bit look → `--r1` / `--r2`.
- ~150 one-off padding / gap / margin numbers → the spacing tokens.
- Repeated colour literals (the yellow ink, the green and yellow edges, warn / error / fire) → named tokens.
- `.chipbtn` looked different from `Chips` → the same block. `.btn.on` only worked inside the prompt → global.
- The top bar wrapped to two or three rows (nine links plus tools) and mixed player pages with owner tools → one
  centred nav plus More; the owner tools are behind More.
- Home and the team select guessed the top bar's height (`100dvh - 58px`), so when the bar wrapped the Home menu was cut
  off → the page is a flex column and the screens fill what's left.
- Bug list and sound editor had no nav (only "Back to the game" links) → they get the top bar.
- Breakpoints 520 / 560 / 700 / 760 / 860 → 560 / 760 / 860 (+ 1100 for the game toolbar).
- Game: the toolbar stacked into a tall column at tablet widths → one row across the top below 1100px. Report a bug
  and full screen moved to the pause menu (keys B and F still work). The sound chip is just 🔊 when sound is on.
- Game: the prompt's question reserved 300px on the right for buttons that weren't there, so it wrapped a word per
  line → the corner buttons float and the text wraps round them.
- Game: the score bug squeezed to half the screen width (absolute + left 50%) and hid a score at tablet widths.
- Settings: the music switches overlapped; volumes were chip rows while the music player has a slider → stacked
  switches, sliders.

Second pass (same day):
- 141 buttons converted to `<Button>` (the rest are links, or the confirm dialog's own).
- Rules tabs are chips. Drawers end above the cards + prompt (`--bottom-h`, at least 240px tall).
- Display sizes: `--d1` names / lower thirds, `--d2` callouts / wipes / the title, `--d3` TOUCHDOWN banners.
- Online's "Back home" removed (leaving the page closes the room).
- Mobile: a phone-landscape game layout, the camera centres the picture above the HUD, the prompt's corner buttons get
  their own row on phones, the team select fits a phone, sliders are taller on touch screens.
