import { useCallback, useEffect, useRef, useState } from 'react';

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
export const Kbd = ({ k }) => <kbd className="kh" aria-hidden="true">{k}</kbd>;
