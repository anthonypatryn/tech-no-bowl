import { useEffect, useState } from 'react';
import { Button, Chips, Panel, Row, Slider, Toggle } from './ui';
import { setSettings, useSettings } from './prefs';
import { nudgeAudio, play as playSound } from './sound';
import { DEFAULT_KEYS, KEY_ACTIONS, RESERVED, keyLabel, rebind } from './keys';
import SyncPanel from './SyncPanel';

export default function Settings() {
  const s = useSettings();
  return (
    <main className="page settings">
      <h1 className="page-title">Settings</h1>
      <SyncPanel />
      <Panel className="setting-list">
        <Row label="Text size">
          <Chips value={s.text} onChange={(text) => setSettings({ text })} options={[['normal', 'Normal'], ['large', 'Large'], ['larger', 'Larger']]} />
        </Row>
        <Row label="Game speed">
          <Chips value={s.speed} onChange={(speed) => setSettings({ speed })} options={[['slow', 'Slow'], ['normal', 'Normal'], ['fast', 'Fast']]} />
        </Row>
        <Row label="Quick play">
          <Toggle checked={s.quick} onChange={(quick) => setSettings({ quick })}>Answer the small prompts for me (bench boost, who goes first, follow-ups, read and react, motion)</Toggle>
        </Row>
        <Row label="Auto-finish">
          <Toggle checked={s.autoEnd !== false} onChange={(autoEnd) => setSettings({ autoEnd })}>After a move, end his turn when he can't do anything more (no movement left, nothing to hit or throw)</Toggle>
        </Row>
        <Row label="Colour-blind mode">
          <Toggle checked={!!s.cb} onChange={(cb) => setSettings({ cb })}>Safe colours, and shapes too: full squares = you can still act, small = move only / risky</Toggle>
        </Row>
        <Row label="Calm motion">
          <Toggle checked={s.calm} onChange={(calm) => setSettings({ calm })}>Skip camera moves and cinematics</Toggle>
        </Row>
        <Row label="Follow up">
          <Chips small value={s.autoFollow ?? 'ask'} onChange={(v) => setSettings({ autoFollow: v === 'ask' ? null : v })} options={[['ask', 'Ask me'], ['always', 'Always'], ['never', 'Never']]} />
          <span className="hint">After a block works: step into the gap without being asked, or never.</span>
        </Row>
        <Row label="Odds on the field">
          <Toggle checked={s.fieldOdds !== false} onChange={(fieldOdds) => setSettings({ fieldOdds })}>Chances over the heads of the players you can hit or throw to, and + / - over the players changing a roll while you hover</Toggle>
        </Row>
        <Row label="Cinematic camera">
          <Chips small value={s.camMoves ?? 'big'} onChange={(camMoves) => setSettings({ camMoves })} options={[['big', 'Big plays'], ['all', 'Every moment'], ['off', 'Never']]} />
          <span className="hint">When the camera leaves your view for a shot. Big plays = touchdowns, long throws, kicks. Overhead and Free never move.</span>
        </Row>
        <Row label="Field detail">
          <Toggle checked={s.fieldHi} onChange={(fieldHi) => setSettings({ fieldHi })}>Sharp 4K field, crowd and big shadows (off by default on phones and tablets: it can run them out of memory)</Toggle>
        </Row>
        <Row label="Play clocks">
          <Toggle checked={s.clocks} onChange={(clocks) => setSettings({ clocks })}>1:00 to set up and to call plays, 0:30 for motion, with the rulebook penalties</Toggle>
        </Row>
        <Row label="Sound">
          <Toggle checked={!s.muted} onChange={(on) => setSettings({ muted: !on })}>Sound on</Toggle>
          <Button size="small" onClick={async () => { await nudgeAudio(); playSound('whistle'); setTimeout(() => playSound('step', { len: 0.8 }), 900); }}>Test sound</Button>
        </Row>
        <Row label="Menu sounds">
          <Toggle checked={s.menuSounds !== false} onChange={(v) => setSettings({ menuSounds: v })}>8-bit blips on buttons and menus</Toggle>
        </Row>
        <Row label="Music player" stack>
          <Toggle checked={s.musicMenus !== false} onChange={(v) => setSettings({ musicMenus: v })}>Menu music</Toggle>
          <Toggle checked={s.musicBreaks !== false} onChange={(v) => setSettings({ musicBreaks: v })}>At half time and the final whistle</Toggle>
          <Toggle checked={!!s.musicGame} onChange={(v) => setSettings({ musicGame: v })}>During games</Toggle>
          <span className="hint">The Music button (top bar, or the game's tools) picks tracks.</span>
        </Row>
        {[['fx', 'Effects'], ['crowd', 'Crowd'], ['music', 'Music']].map(([k, label]) => (
          <Row key={k} label={label}>
            <span className="vol-row"><Slider value={s.mix[k] ?? 0} onChange={(v) => setSettings({ mix: { [k]: Math.round(v * 20) / 20 } })} label={`${label} volume`} /><small>{s.mix[k] ? `${Math.round(s.mix[k] * 100)}%` : 'Off'}</small></span>
          </Row>
        ))}
      </Panel>
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
    <Panel className="setting-list keys">
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
      <div className="btns"><Button size="small" onClick={() => { setSettings({ keys: { ...DEFAULT_KEYS } }); setNote('Keys reset.'); }}>Reset to defaults</Button></div>
    </Panel>
  );
}
