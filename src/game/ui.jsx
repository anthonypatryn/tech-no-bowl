import { useCallback, useEffect, useRef, useState } from 'react';
import { labelFor } from './keys';

// On-brand replacements for the browser's own UI: no confirm()/alert() boxes, no native drop-downs or
// checkboxes anywhere in the game. (Same kit as Long Shot / Escape Order 66.)

// const [confirmIt, dialog] = useConfirm();  …  if (await confirmIt({ title, body, yes, no, danger })) …;  render {dialog}
export function useConfirm() {
  const [ask, setAsk] = useState(null);
  const resolver = useRef(null);
  const confirmIt = useCallback((opts) => new Promise((resolve) => { resolver.current = resolve; setAsk(opts); }), []);
  const done = (v) => { resolver.current?.(v); resolver.current = null; setAsk(null); };
  const dialog = ask ? <ConfirmDialog {...ask} onYes={() => done(true)} onNo={() => done(false)} /> : null;
  return [confirmIt, dialog];
}

function ConfirmDialog({ title, body, yes = 'Yes', no = 'Cancel', danger, onYes, onNo }) {
  const yesRef = useRef(null);
  useEffect(() => {
    yesRef.current?.focus();
    const key = (e) => { if (e.key === 'Escape') { e.stopPropagation(); onNo(); } };
    window.addEventListener('keydown', key, true);
    return () => window.removeEventListener('keydown', key, true);
  }, [onNo]);
  return (
    <div className="modal" onClick={onNo}>
      <div className="modal-card glass" role="alertdialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <h2>{title}</h2>
        {body && <p>{body}</p>}
        <div className="btns"><button className="btn" onClick={onNo}>{no}</button><button ref={yesRef} className={`btn ${danger ? 'danger' : 'primary'}`} onClick={onYes}>{yes}</button></div>
      </div>
    </div>
  );
}

// a switch in place of a checkbox
export function Toggle({ checked, onChange, children, label }) {
  return (
    <button type="button" role="switch" aria-checked={!!checked} aria-label={label} className={`toggle ${checked ? 'on' : ''}`} onClick={() => onChange(!checked)}>
      <span className="toggle-track"><span className="toggle-knob" /></span>{children && <span className="toggle-text">{children}</span>}
    </button>
  );
}

// an 8-bit slider (0..1): click or drag along it, or arrow keys. In place of a raw <input type=range>.
export function Slider({ value, onChange, label, step = 0.05 }) {
  const set = (e, el) => {
    const r = el.getBoundingClientRect();
    onChange(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)));
  };
  return (
    <div className="slider" role="slider" tabIndex={0} aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value * 100)}
      onPointerDown={(e) => { const el = e.currentTarget; el.setPointerCapture(e.pointerId); set(e, el); }}
      onPointerMove={(e) => { if (e.buttons) set(e, e.currentTarget); }}
      onKeyDown={(e) => { if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); onChange(Math.min(1, value + step)); } if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); onChange(Math.max(0, value - step)); } }}>
      <span className="slider-fill" style={{ width: `${value * 100}%` }} />
      <span className="slider-knob" style={{ left: `${value * 100}%` }} />
    </div>
  );
}

// a row of chips in place of a drop-down: options = [value, label, disabled?][]
export function Chips({ value, onChange, options, small }) {
  return (
    <div className={`chips ${small ? 'small' : ''}`} role="radiogroup">
      {options.map(([v, l, off]) => (
        <button type="button" key={v} role="radio" aria-checked={value === v} disabled={off} className={value === v ? 'on' : ''} onClick={() => onChange(v)}>{l}</button>
      ))}
    </div>
  );
}

// desktop full screen. F toggles it; Esc leaves (browser)
const fsEl = () => document.fullscreenElement ?? document.webkitFullscreenElement;
export function toggleFullscreen() {
  const d = document.documentElement;
  if (fsEl()) (document.exitFullscreen ?? document.webkitExitFullscreen)?.call(document);
  else (d.requestFullscreen ?? d.webkitRequestFullscreen)?.call(d)?.catch?.(() => {});
}

// a small keyboard-key label next to a control (computers only: hidden on touch screens by CSS)
// a = a rebindable action from keys.js (shows whatever key it's bound to), k = a fixed label
export const Kbd = ({ k, a }) => <kbd className="kh" aria-hidden="true">{a ? labelFor(a) : k}</kbd>;

// ---------- building blocks (use these instead of hand-rolled markup, so spacing and look stay consistent) ----------
// Panel: the dark pixel-edged box. as = the element ('section', 'aside', 'div'…)
export function Panel({ as: As = 'section', className = '', children, ...rest }) {
  return <As className={`glass ${className}`} {...rest}>{children}</As>;
}
// Row: a label and its control, on the shared label | control grid. stack = several controls, one per line
export function Row({ label, stack, children }) {
  return <div className="opt"><span>{label}</span><div className={`opt-ctl ${stack ? 'stack' : ''}`}>{children}</div></div>;
}
// Button: kind = primary | danger | (plain); size = small | big; keyAction = a rebindable key to show on it
export function Button({ kind, size, keyAction, className = '', children, ...rest }) {
  return (
    <button type="button" className={`btn ${kind ?? ''} ${size ?? ''} ${className}`} {...rest}>
      {children}{keyAction && <Kbd a={keyAction} />}
    </button>
  );
}
