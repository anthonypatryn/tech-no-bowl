import { useEffect, useRef, useState } from 'react';
import { Chips, Toggle } from './ui';

// Report a bug (top bar): files a numbered report (BUG-1, BUG-2…) to /api/bugs.
// The owner reads them at /?view=bugs (PIN) and copies them to paste to Claude.
export const KINDS = [['Broken', 'something doesn’t work'], ['Looks wrong', 'layout, art, text'], ['Rules', 'the game did something the rules don’t say'], ['Idea', 'a wish or a change']];
export const AREAS = ['Field & players', 'Moving', 'Blocks & tackles', 'Passing & the ball', 'Cards & play calls', 'Formations', 'Computer coach', 'Scoreboard & clock', 'Camera', 'Menus & setup', 'Art', 'Something else'];

export async function bugApi(body, pin) {
  const r = await fetch('/api/bugs', {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json', ...(pin ? { 'x-bug-pin': pin } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `Server said ${r.status}`);
  return j;
}

// a photo shrunk on the device before it's sent: ≤1280px on the long side, JPEG (a phone screenshot ends up ~150–300 KB)
async function shrinkPhoto(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = url; });
    for (const [edge, q] of [[1280, 0.8], [1000, 0.7], [800, 0.6]]) {
      const k = Math.min(1, edge / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas'); c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      const d = c.toDataURL('image/jpeg', q);
      if (d.length < 850000) return d;
    }
    throw new Error('too big');
  } finally { URL.revokeObjectURL(url); }
}

// the screen as this device reports it (for layout bugs: the viewport, the visible part, the screen, the safe areas)
function deviceInfo() {
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;visibility:hidden;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';
  document.body.appendChild(probe);
  const ps = getComputedStyle(probe), safe = ['Top', 'Right', 'Bottom', 'Left'].map((k) => parseFloat(ps[`padding${k}`]) || 0).join('/');
  probe.style.cssText = 'position:fixed;visibility:hidden;height:100dvh;width:1px'; const dvh = probe.offsetHeight;
  probe.remove();
  const vv = window.visualViewport, standalone = navigator.standalone || window.matchMedia?.('(display-mode: standalone)').matches;
  return `view ${innerWidth}×${innerHeight} · visible ${vv ? `${Math.round(vv.width)}×${Math.round(vv.height)}+${Math.round(vv.offsetTop)}` : '?'} · 100dvh ${dvh} · screen ${screen.width}×${screen.height} @${devicePixelRatio}x · safe ${safe} · ${standalone ? 'home-screen app' : 'browser'}`;
}

export default function BugReport({ onClose, context }) {
  const [kind, setKind] = useState('Broken');
  const [f, setF] = useState({ area: 'Something else', who: localStorage.getItem('tb-bug-who') || '', what: '', expected: '', steps: '', always: false, blocking: false });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  const [err, setErr] = useState('');
  const [photos, setPhotos] = useState([]); // shrunk data URLs (max 2)
  const pickRef = useRef(null);
  const what = useRef(null);
  const addPhotos = async (files) => {
    setErr('');
    for (const f of [...files].filter((x) => x.type.startsWith('image/'))) {
      try { const d = await shrinkPhoto(f); setPhotos((p) => (p.length < 2 ? [...p, d] : p)); }
      catch { setErr('That picture couldn’t be added. Try a screenshot.'); }
    }
  };
  useEffect(() => { what.current?.focus(); }, []);
  useEffect(() => {
    const key = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [onClose]);
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));

  const send = async (e) => {
    e.preventDefault();
    if (!f.what.trim()) { what.current?.focus(); return; }
    setBusy(true); setErr('');
    try { localStorage.setItem('tb-bug-who', f.who); } catch { /* private window */ }
    try {
      const r = await bugApi({ action: 'bug', kind, ...f, page: location.pathname + location.search, ua: navigator.userAgent, screen: `${innerWidth}×${innerHeight}`, device: deviceInfo(), photos, game: context ?? null });
      setDone(r.no);
    } catch (ex) { setErr(ex.message); setBusy(false); }
  };

  return (
    <div className="modal" onClick={onClose}>
      <form className="modal-card glass bug-form" onClick={(e) => e.stopPropagation()} onSubmit={send} onPaste={(e) => { if (e.clipboardData?.files?.length) { e.preventDefault(); addPhotos(e.clipboardData.files); } }}>
        {done ? (
          <>
            <h2>Thanks!</h2>
            <p>Sent as <b>BUG-{done}</b>.</p>
            <div className="btns"><button type="button" className="btn primary" onClick={onClose}>Back to the game</button></div>
          </>
        ) : (
          <>
            <h2>Report a bug</h2>
            <div className="field"><span>What kind</span>
              <div className="kind-row">{KINDS.map(([k, d]) => <button type="button" key={k} className={kind === k ? 'on' : ''} onClick={() => setKind(k)}>{k}<small>{d}</small></button>)}</div>
            </div>
            <div className="field"><span>Where</span><Chips small value={f.area} onChange={(v) => setF((s) => ({ ...s, area: v }))} options={AREAS.map((a) => [a, a])} /></div>
            <label className="field"><span>Your name <small>optional</small></span><input value={f.who} onChange={set('who')} maxLength={40} /></label>
            <label className="field"><span>What happened</span><textarea ref={what} rows={3} maxLength={1500} value={f.what} onChange={set('what')} placeholder="e.g. I clicked a green square and my player didn't move" /></label>
            <label className="field"><span>What should have happened <small>optional</small></span><textarea rows={2} maxLength={800} value={f.expected} onChange={set('expected')} /></label>
            <label className="field"><span>How to make it happen again <small>optional</small></span><textarea rows={2} maxLength={800} value={f.steps} onChange={set('steps')} /></label>
            <div className="field"><span>Photos <small>optional · a screenshot helps a lot{photos.length < 2 ? ' · you can also paste one' : ''}</small></span>
              <div className="bug-photos">
                {photos.map((d, i) => (
                  <span key={i} className="bug-thumb"><img src={d} alt={`Photo ${i + 1}`} /><button type="button" aria-label={`Remove photo ${i + 1}`} onClick={() => setPhotos((p) => p.filter((_, k) => k !== i))}>✕</button></span>
                ))}
                {photos.length < 2 && <button type="button" className="btn small bug-add-photo" onClick={() => pickRef.current?.click()}>+ Add a photo</button>}
                <input ref={pickRef} type="file" accept="image/*" multiple hidden onChange={(e) => { addPhotos(e.target.files); e.target.value = ''; }} />
              </div>
            </div>
            <Toggle checked={f.always} onChange={(v) => setF((s) => ({ ...s, always: v }))}>It happens every time</Toggle>
            <Toggle checked={f.blocking} onChange={(v) => setF((s) => ({ ...s, blocking: v }))}>It’s stopping me from playing</Toggle>
            <p className="note">Sent along with it: {context ? 'the game’s seed, score, down and last few log lines, ' : ''}your device and screen size{photos.length ? `, and ${photos.length === 1 ? 'the photo' : 'both photos'}` : ''}.</p>
            {err && <p className="err">{err}</p>}
            <div className="btns"><button type="button" className="btn" onClick={onClose}>Cancel</button><button type="submit" className="btn primary" disabled={busy}>Send it</button></div>
          </>
        )}
      </form>
    </div>
  );
}
