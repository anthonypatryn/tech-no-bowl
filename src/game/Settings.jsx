import { useEffect, useState } from 'react';
import { Chips, Toggle } from './ui';
import { setSettings, useSettings } from './prefs';
import { applyMute } from './sound';
import { DEFAULT_KEYS, KEY_ACTIONS, RESERVED, keyLabel, rebind } from './keys';

export default function Settings() {
  const s = useSettings();
  return (
    <main className="page settings">
      <h1 className="page-title">Settings</h1>
      <section className="glass setting-list">
        <div className="opt"><span>Text size</span>
          <Chips value={s.text} onChange={(text) => setSettings({ text })} options={[['normal', 'Normal'], ['large', 'Large'], ['larger', 'Larger']]} />
        </div>
        <div className="opt"><span>Game speed</span>
          <Chips value={s.speed} onChange={(speed) => setSettings({ speed })} options={[['slow', 'Slow'], ['normal', 'Normal'], ['fast', 'Fast']]} />
        </div>
        <div className="opt"><span>Calm motion</span>
          <Toggle checked={s.calm} onChange={(calm) => setSettings({ calm })}>Skip camera moves and cinematics</Toggle>
        </div>
        <div className="opt"><span>Field detail</span>
          <Toggle checked={s.fieldHi} onChange={(fieldHi) => setSettings({ fieldHi })}>Sharp 4K field (turn off on slow phones)</Toggle>
        </div>
        <div className="opt"><span>Play clocks</span>
          <Toggle checked={s.clocks} onChange={(clocks) => setSettings({ clocks })}>1:00 to set up and to call plays, 0:30 for motion, with the rulebook penalties</Toggle>
        </div>
        <div className="opt"><span>Sound</span>
          <Toggle checked={!s.muted} onChange={(on) => { setSettings({ muted: !on }); applyMute(); }}>Sound on</Toggle>
        </div>
        {[['fx', 'Effects'], ['crowd', 'Crowd'], ['music', 'Music']].map(([k, label]) => (
          <div className="opt" key={k}><span>{label}</span>
            <Chips small value={s.mix[k]} onChange={(v) => setSettings({ mix: { [k]: v } })} options={[[0, 'Off'], [0.25, '25%'], [0.5, '50%'], [0.75, '75%'], [1, '100%']]} />
          </div>
        ))}
      </section>
      <KeysSection keys={s.keys} />
    </main>
  );
}

function KeysSection({ keys }) {
  const [listening, setListening] = useState(null);
  const [note, setNote] = useState('');
  useEffect(() => {
    if (!listening) return;
    const grab = (e) => {
      e.preventDefault(); e.stopPropagation();
      if (RESERVED.includes(e.key)) { setNote(`${keyLabel(e.key)} can't be used.`); return; }
      const { keys: next, swapped } = rebind(keys, listening, e.key);
      setSettings({ keys: next });
      const label = (a) => KEY_ACTIONS.find(([x]) => x === a)[1];
      setNote(swapped ? `${keyLabel(e.key)} was on "${label(swapped)}": they swapped.` : '');
      setListening(null);
    };
    window.addEventListener('keydown', grab, true);
    return () => window.removeEventListener('keydown', grab, true);
  }, [listening, keys]);
  const cur = { ...DEFAULT_KEYS, ...keys };
  return (
    <section className="glass setting-list keys">
      <h2>Keys</h2>
      <p className="hint">Click a key, then press the one you want.</p>
      <div className="key-grid">
        {KEY_ACTIONS.map(([a, label]) => (
          <div key={a} className="key-row">
            <span>{label}</span>
            <button className={`btn keycap ${listening === a ? 'on' : ''}`} onClick={() => setListening(listening === a ? null : a)}>
              {listening === a ? 'Press a key…' : keyLabel(cur[a])}
            </button>
          </div>
        ))}
      </div>
      {note && <p className="warn">{note}</p>}
      <div className="btns"><button className="btn small" onClick={() => { setSettings({ keys: { ...DEFAULT_KEYS } }); setNote('Keys reset.'); }}>Reset to defaults</button></div>
    </section>
  );
}
