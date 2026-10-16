import { useEffect, useState } from 'react';
import { bugApi } from './BugReport';
import { Toggle, useConfirm } from './ui';

// /?view=bugs — the owner's list of bug reports: enter the PIN, copy reports for Claude, mark them fixed.
export function bugText(b) {
  const g = b.game;
  return [
    `BUG-${b.no} · ${b.kind} · ${b.area || 'Something else'}${b.blocking ? ' · BLOCKING' : ''}${b.always ? ' · every time' : ''}`,
    `What happened: ${b.what}`,
    b.expected && `Expected: ${b.expected}`,
    b.steps && `Steps: ${b.steps}`,
    g && `Game: seed ${g.seed} · ${g.teams} · ${g.mode} vs ${g.level} · half ${g.half}, down ${g.down}, ${g.phase} · score ${g.score}`,
    g?.log?.length && `Last log lines:\n  ${g.log.join('\n  ')}`,
    `From ${b.who || 'someone'} · ${new Date(b.at).toLocaleString()} · ${b.page}`,
    `Device: ${b.screen} · ${b.ua}`,
    b.device && `Screen: ${b.device}`,
    b.photos && `Photos: ${b.photos} (on the bug list; Claude can fetch them with the PIN)`,
  ].filter(Boolean).join('\n');
}

// a report's photos, fetched with the PIN when the report is shown; tap one to see it big
function BugPhotos({ no, n, pin }) {
  const [urls, setUrls] = useState([]);
  const [big, setBig] = useState(null);
  useEffect(() => {
    let live = true;
    Promise.all(Array.from({ length: n }, (_, i) => bugApi({ action: 'photo', no, i }, pin).then((r) => r.url).catch(() => null)))
      .then((u) => { if (live) setUrls(u); });
    return () => { live = false; };
  }, [no, n, pin]);
  return (
    <div className="bug-photos">
      {urls.map((u, i) => (u ? <button key={i} type="button" className="bug-thumb" onClick={() => setBig(u)}><img src={u} alt={`BUG-${no} photo ${i + 1}`} /></button> : <span key={i} className="note">Photo {i + 1} is gone.</span>))}
      {big && <div className="lightbox" onClick={() => setBig(null)}><img className="bug-big" src={big} alt="" /></div>}
    </div>
  );
}

const PIN_KEY = 'tb-bug-pin';
const LOCAL = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
const savedPin = () => { try { return localStorage.getItem(PIN_KEY) || ''; } catch { return ''; } };

export default function BugList() {
  const [pin, setPin] = useState(savedPin());
  const [bugs, setBugs] = useState(null);
  const [err, setErr] = useState('');
  const [picked, setPicked] = useState([]);
  const [msg, setMsg] = useState('');
  const [showFixed, setShowFixed] = useState(false);
  const [confirmIt, confirmDialog] = useConfirm();

  const load = async (p = pin) => {
    setErr('');
    try { const r = await bugApi(null, p); setBugs(r.bugs); try { localStorage.setItem(PIN_KEY, p); } catch { /* ignore */ } }
    catch (e) { setErr(e.message); setBugs(null); setPin(''); try { localStorage.removeItem(PIN_KEY); } catch { /* ignore */ } }
  };
  useEffect(() => { if (pin) load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 2200); };
  const copy = async (list) => { await navigator.clipboard.writeText(list.map(bugText).join('\n\n---\n\n')); flash(`Copied ${list.length === 1 ? `BUG-${list[0].no}` : `${list.length} reports`}.`); };
  const act = async (action, nos) => { try { await bugApi({ action, nos }, pin); setPicked([]); await load(); } catch (e) { setErr(e.message); } };

  if (!bugs) {
    return (
      <div className="page">
        <form className="glass bug-form narrow-card" onSubmit={(e) => { e.preventDefault(); load(); }}>
          <h2>Bug reports</h2>
          <label className="field"><span>PIN</span><input className="pin-input" type="text" inputMode="numeric" name="tb-bug-pin-entry" autoComplete="off" data-lpignore="true" data-1p-ignore spellCheck={false} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} autoFocus /></label>
          {LOCAL && <p className="note">This is the local test copy on this computer: it has its own bug list (PIN 1234). Your real bug reports are on the live site.</p>}
          {err && <p className="err">{err}</p>}
          <div className="btns"><button className="btn primary" type="submit">Open</button></div>
        </form>
      </div>
    );
  }
  const open = bugs.filter((b) => b.status !== 'fixed'), fixed = bugs.filter((b) => b.status === 'fixed');
  const pickedBugs = open.filter((b) => picked.includes(b.no));
  const row = (b) => (
    <li key={b.no} className={`bug ${b.blocking ? 'blocking' : ''} ${b.status}`}>
      <div className="bug-top">
        {b.status !== 'fixed' && <Toggle checked={picked.includes(b.no)} onChange={() => setPicked((p) => (p.includes(b.no) ? p.filter((x) => x !== b.no) : [...p, b.no]))} label={`Pick BUG-${b.no}`} />}
        <b>BUG-{b.no}</b><span className="bug-kind">{b.kind}</span><span>{b.area}</span>
        {b.blocking && <span className="bug-flag">Blocking</span>}
        <small>{b.who || 'someone'} · {new Date(b.at).toLocaleString()}</small>
      </div>
      <p className="bug-what">{b.what}</p>
      {b.expected && <p><i>Expected:</i> {b.expected}</p>}
      {b.steps && <p><i>Steps:</i> {b.steps}</p>}
      {b.photos > 0 && <BugPhotos no={b.no} n={b.photos} pin={pin} />}
      {b.device && <p className="note bug-device">{b.device}</p>}
      {b.status === 'fixed' && b.fixNote && <p className="bug-fix">Fixed: {b.fixNote}</p>}
      <div className="btns">
        <button className="btn primary" onClick={() => copy([b])}>Copy for Claude</button>
        {b.status === 'fixed' ? <button className="btn" onClick={() => act('reopen', [b.no])}>Reopen</button> : <button className="btn" onClick={() => act('fix', [b.no])}>Mark fixed</button>}
        <button className="btn" onClick={async () => { if (await confirmIt({ title: `Delete BUG-${b.no}?`, body: 'This can’t be undone.', yes: 'Delete', danger: true })) act('remove', [b.no]); }}>Delete</button>
      </div>
    </li>
  );
  return (
    <div className="page buglist">
      <header className="bug-head">
        <h1 className="page-title">Bug reports · {open.length} open</h1>
        <div className="btns"><button className="btn" onClick={() => load()}>Refresh</button></div>
      </header>
      <main>
        <div className="btns bug-bulk">
          <button className="btn primary" disabled={!open.length} onClick={() => copy(open)}>Copy all open ({open.length})</button>
          <button className="btn" disabled={!pickedBugs.length} onClick={() => copy(pickedBugs)}>Copy {pickedBugs.length} picked</button>
          <button className="btn" disabled={!pickedBugs.length} onClick={() => act('fix', picked)}>Mark {pickedBugs.length} fixed</button>
          {msg && <span className="bug-msg">{msg}</span>}
        </div>
        {err && <p className="err">{err}</p>}
        {!open.length && <p>No open bugs.</p>}
        <ul className="bugs">{open.map(row)}</ul>
        {fixed.length > 0 && <button className="btn small" onClick={() => setShowFixed(!showFixed)}>{showFixed ? 'Hide' : 'Show'} {fixed.length} fixed</button>}
        {showFixed && <ul className="bugs">{fixed.map(row)}</ul>}
      </main>
      {confirmDialog}
    </div>
  );
}
