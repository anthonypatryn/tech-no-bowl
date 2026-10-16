// Board geometry. Squares are [col, row]: 13 columns x 24 rows, rows 0-1 and 22-23 are the end zones.
// A team's `dir` is the way it attacks: -1 = towards row 0 (side 0), +1 = towards row 23 (side 1).
// The ball is spotted on a LINE between rows: line k sits between row k-1 and row k (k = 0..24).

export const COLS = 13;
export const ROWS = 24;
export const START_LINE = { '-1': 18, '1': 6 }; // each team's own 20-yard line

export const key = (c, r) => `${c},${r}`;
export const inBounds = (c, r) => c >= 0 && c < COLS && r >= 0 && r < ROWS;
export const same = (a, b) => a[0] === b[0] && a[1] === b[1];
export const DIRS = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];
export const neighbours = ([c, r]) => DIRS.map(([dc, dr]) => [c + dc, r + dr]);
export const adjacent = (a, b) => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1])) === 1;

// every measurement in the game: squares counted, +1 for every other diagonal after the first
export function distance(a, b) {
  const dx = Math.abs(a[0] - b[0]), dy = Math.abs(a[1] - b[1]);
  return Math.max(dx, dy) + Math.floor(Math.min(dx, dy) / 2);
}
// cost of one step: straight 1; a diagonal is 1, +1 when it is the 2nd, 4th, 6th... diagonal (parity = diagonals so far % 2)
export const stepExtra = (dc, dr, parity) => (dc && dr && parity === 1 ? 1 : 0);

export const skillOf = (num) => (num < 10 ? num : Math.floor(num / 10));
export const halfOf = (n) => Math.ceil(n / 2);

export const inOppEndZone = (dir, row) => (dir < 0 ? row <= 1 : row >= ROWS - 2);
export const inOwnEndZone = (dir, row) => (dir < 0 ? row >= ROWS - 2 : row <= 1);

// for a line k and the offense's direction: the offense's line-of-scrimmage row, the defense's, and "backwards"
export function losRows(line, dir) {
  const off = dir < 0 ? line : line - 1;
  return { off, def: off + dir, back: -dir };
}
// is a row behind the line of scrimmage (on the offense's own side)?
export const behindLine = (row, line, dir) => (dir < 0 ? row >= line : row <= line - 1);
// tackled in square row `row` while attacking in `dir`: the next line is the front edge of that square
export const lineAfterTackle = (row, dir) => (dir < 0 ? row : row + 1);
// across the field: near the sidelines the ball comes in to the hash marks, otherwise it goes in the middle
export const spotCol = (col) => (col <= 3 ? 4 : col >= 9 ? 8 : 6);
// is `to` closer to the end zone the attacker is heading for than `from`? (passes: forward or not)
export const isForward = (from, to, dir) => (dir < 0 ? to[1] < from[1] : to[1] > from[1]);

// the line as a yard figure for the scoreboard ("OWN 20", "OPP 15", "50")
export function yardLabel(line, dir) {
  const own = dir < 0 ? (ROWS - 2 - line) * 5 : (line - 2) * 5; // yards from own goal line
  if (own === 50) return '50';
  return own < 50 ? `OWN ${own}` : `OPP ${100 - own}`;
}
