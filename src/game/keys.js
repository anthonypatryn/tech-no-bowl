// Rebindable keys. Every keyboard action in the game is listed here once; bindings live in settings (prefs.keys),
// so they follow the player on this device. Settings → Keys rebinds them.
import { settings } from './prefs';

export const KEY_ACTIONS = [
  ['primary', 'Main button (done, confirm, keep)', ' '],
  ['throw', 'Throw mode on / off', 't'],
  ['camera', 'Next camera', 'c'],
  ['rules', 'Quick rules', 'r'],
  ['bug', 'Report a bug', 'b'],
  ['fullscreen', 'Full screen', 'f'],
  ['back', 'Back / cancel / leave', 'Escape'],
  ['turbo', 'Fast-forward on / off', 'g'],
  ['skip', 'Skip a cinematic', 'Enter'],
];
export const DEFAULT_KEYS = Object.fromEntries(KEY_ACTIONS.map(([a, , k]) => [a, k]));

export const keyFor = (action) => settings().keys?.[action] ?? DEFAULT_KEYS[action];
const norm = (k) => (k.length === 1 ? k.toLowerCase() : k);
// does this keydown trigger the action? (modifier combos are left to the browser)
export const isKey = (e, action) => !e.ctrlKey && !e.metaKey && !e.altKey && norm(e.key) === norm(keyFor(action));

const NAMES = { ' ': 'Space', Escape: 'Esc', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Enter: 'Enter', Tab: 'Tab', Backspace: 'Bksp' };
export const keyLabel = (k) => NAMES[k] ?? (k.length === 1 ? k.toUpperCase() : k);
export const labelFor = (action) => keyLabel(keyFor(action));

// keys that can't be rebound (the browser or the screen reader needs them)
export const RESERVED = ['Tab', 'F5', 'F11', 'F12', 'Meta', 'Control', 'Alt', 'Shift', 'CapsLock'];

// bind `key` to `action`; if another action had it, they swap
export function rebind(current, action, key) {
  const next = { ...DEFAULT_KEYS, ...current };
  const clash = Object.keys(next).find((a) => a !== action && norm(next[a]) === norm(key));
  if (clash) next[clash] = next[action];
  next[action] = key;
  return { keys: next, swapped: clash ?? null };
}
