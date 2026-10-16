// Settings → Play on another device: make a sync code, save now, or load another device's saves with its code.
import { useEffect, useReducer, useState } from 'react';
import { Button, Panel, useConfirm } from './ui';
import { forgetSync, loadCode, makeCode, newerElsewhere, onSync, saveNow, showCode, syncAt, syncCode } from './sync';

const when = (t) => (t ? new Date(t).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'never');

export default function SyncPanel() {
  const [, bump] = useReducer((x) => x + 1, 0);
  useEffect(() => onSync(bump), []);
  const [entry, setEntry] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [newer, setNewer] = useState(null);
  const [confirmIt, dialog] = useConfirm();
  const code = syncCode();
  useEffect(() => { if (code) newerElsewhere().then(setNewer); }, [code]);
  const run = async (fn) => { setBusy(true); setMsg(''); try { await fn(); } catch (e) { setMsg(e.message); } setBusy(false); bump(); };
  const load = (c) => run(async () => {
    if (!await confirmIt({ title: 'Load the saves from that code?', body: 'This device’s season, unfinished game, stats, records, depth charts and playbook are replaced by the ones saved under the code.', yes: 'Load them', danger: true })) return;
    await loadCode(c);
    setMsg('Loaded. Reloading…');
    setTimeout(() => location.reload(), 600);
  });
  return (
    <Panel className="sync-panel">
      <h2>Play on another device</h2>
      <p className="hint">Your season, unfinished game, stats, records, depth charts and playbook can follow you: save them under a sync code here, then type the code on your other device. Settings and sound stay on each device.</p>
      {code ? (
        <>
          <div className="sync-code"><span className="muted">Your sync code</span><b className="led">{showCode(code)}</b></div>
          <p className="hint">Saved {when(syncAt())}. It saves by itself after every game and when you leave the site.</p>
          {newer && (
            <div className="sync-newer">
              <p className="warn">Another device saved under this code after this one ({when(newer)}).</p>
              <div className="btns">
                <Button kind="primary" disabled={busy} onClick={() => load(code)}>Load the newer saves</Button>
                <Button disabled={busy} onClick={() => run(async () => { await saveNow({ force: true }); setNewer(null); setMsg('This device’s saves are now the latest.'); })}>Keep this device’s</Button>
              </div>
            </div>
          )}
          <div className="btns">
            <Button disabled={busy} onClick={() => run(async () => { const r = await saveNow(); if (r.conflict) setNewer(r.at); else setMsg('Saved.'); })}>Save now</Button>
            <Button disabled={busy} onClick={() => run(async () => { await navigator.clipboard?.writeText(showCode(code)); setMsg('Code copied.'); })}>Copy the code</Button>
            <Button size="small" disabled={busy} onClick={() => run(async () => { if (await confirmIt({ title: 'Stop syncing this device?', body: 'Its saves stay here and under the code; it just stops saving to the code.', yes: 'Stop syncing' })) forgetSync(); })}>Stop syncing</Button>
          </div>
        </>
      ) : (
        <div className="btns"><Button kind="primary" disabled={busy} onClick={() => run(async () => { await makeCode(); setMsg('Done. Type this code on your other device.'); })}>Make a sync code</Button></div>
      )}
      <form className="sync-load" onSubmit={(e) => { e.preventDefault(); if (entry.trim()) load(entry); }}>
        <span className="muted">Have a code from another device?</span>
        <input className="text-in sync-input" value={entry} onChange={(e) => setEntry(e.target.value.toUpperCase())} placeholder="ABCD-EFGH" maxLength={9} autoCapitalize="characters" autoComplete="off" spellCheck={false} />
        <Button type="submit" disabled={busy || entry.replace(/[^A-Z0-9]/gi, '').length !== 8}>Load</Button>
      </form>
      {msg && <p className="hint">{msg}</p>}
      {dialog}
    </Panel>
  );
}
