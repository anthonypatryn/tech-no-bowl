// ?view=sounds — the owner's sound editor. Every sound slot with its clips; per clip: the source file's waveform with
// a draggable start and end, start / length / volume / fade, play. Save = live for everyone (the bug-list PIN);
// Copy for Claude = the JSON to bake into src/data/sounds.json.
import { useEffect, useRef, useState } from 'react';
import { Button, Chips, Panel, Row } from './ui';
import { builtinSounds, setSoundConfig, playClip, decodeFile, audioNow } from './sound';

const SLOTS = [
  ['crowd', 'Crowd bed (loops under the whole game)'],
  ['theme', 'TV themes (one at random opens each game)'],
  ['whistle', 'Whistle: the play is dead'],
  ['whistleStart', 'Whistle: half starts'],
  ['whistleFinal', 'Whistle: end of the half / game'],
  ['grunt', 'Grunts (blocks, tackles, pile-ups)'],
  ['step', 'Footsteps (every move; a random one, cut to the walk)'],
  ['dice', 'Dice roll'],
  ['coin', 'Coin flip'],
  ['coinLand', 'Coin lands'],
  ['cheer', 'Crowd cheers (home team)'],
  ['boo', 'Crowd boos (away team / home mistakes)'],
  ['card', 'Card snap (calling a play)'],
  ['fanfare', 'Victory fanfare (you win)'],
  ['hit', 'Hits (contact, knockdowns)'],
];
const FILES = ['crowd', 'themes', 'whistle-start', 'whistle-final', 'grunts', 'effects', 'steps-a', 'steps-b', 'steps-c', 'steps-d', 'dice', 'coin-flip', 'helmet-smash', 'crowd-cheer-a', 'crowd-cheer-b', 'crowd-boo', 'chip-land-a', 'deal', 'fanfare'];
const PIN_KEY = 'tb-bug-pin';
const fmt = (t) => `${Math.floor(t / 60)}:${(t % 60).toFixed(2).padStart(5, '0')}`;
const same = (a, b) => JSON.stringify(a ?? []) === JSON.stringify(b ?? []);

export default function SoundEditor() {
  const BUILTIN = builtinSounds();
  const [server, setServer] = useState(null);
  const [cfg, setCfg] = useState(null);
  const [sel, setSel] = useState(new URLSearchParams(location.search).get('slot') || 'theme');
  const [pin, setPin] = useState(() => { try { return localStorage.getItem(PIN_KEY) || ''; } catch { return ''; } });
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    fetch('/api/sounds').then((r) => r.json()).then((j) => { const s = j.sounds ?? {}; setServer(s); setCfg({ ...BUILTIN, ...s }); })
      .catch(() => { setServer({}); setCfg({ ...BUILTIN }); });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (!cfg) return <main className="page"><p className="loading">Loading…</p></main>;

  const live = { ...BUILTIN, ...server };
  const clips = cfg[sel] ?? [];
  const setClips = (list) => setCfg((c) => ({ ...c, [sel]: list }));
  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 4000); };
  const changed = SLOTS.map(([id]) => id).filter((id) => !same(cfg[id], BUILTIN[id]));
  const save = async () => {
    setBusy(true);
    const diff = Object.fromEntries(changed.map((id) => [id, cfg[id] ?? []]));
    try {
      const r = await fetch('/api/sounds', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-bug-pin': pin }, body: JSON.stringify({ sounds: diff }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || `Server said ${r.status}`);
      try { localStorage.setItem(PIN_KEY, pin); } catch { /* ignore */ }
      setServer(j.sounds); setSoundConfig(j.sounds);
      flash('Saved: live for everyone on their next game.');
    } catch (e) { flash(e.message); }
    setBusy(false);
  };
  const copy = async () => {
    const diff = Object.fromEntries(changed.map((id) => [id, cfg[id] ?? []]));
    await navigator.clipboard.writeText(`Sound editor settings for src/data/sounds.json:\n${JSON.stringify(diff, null, 1)}`);
    flash(changed.length ? `Copied ${changed.length} changed slot(s) for Claude.` : 'Nothing differs from the built-in sounds.');
  };
  return (
    <main className="page sound-editor">
      <h1 className="page-title">Sound editor</h1>
      <div className="se-layout">
        <Panel as="aside" className="se-slots">
          {SLOTS.map(([id, label]) => (
            <button key={id} className={`se-slot ${sel === id ? 'on' : ''}`} onClick={() => setSel(id)}>
              <b>{id}</b><small>{label}</small>
              {!same(cfg[id], live[id]) && <i className="se-dirty">edited</i>}
            </button>
          ))}
        </Panel>
        <section className="se-main">
          <Panel>
            <h2>{SLOTS.find(([id]) => id === sel)?.[1]}</h2>
            <p className="hint">One clip is picked at random each time this sound plays. Drag on the waveform: the left half of a drag sets the start, or drag the yellow handles.</p>
            {clips.map((c, i) => (
              <ClipEditor key={`${sel}-${i}`} clip={c} onChange={(nc) => setClips(clips.map((x, k) => (k === i ? nc : x)))}
                onRemove={() => setClips(clips.filter((_, k) => k !== i))} onDuplicate={() => setClips([...clips.slice(0, i + 1), { ...c }, ...clips.slice(i + 1)])} />
            ))}
            <div className="btns"><Button size="small" onClick={() => setClips([...clips, { file: FILES[0], start: 0, len: 2, vol: 1, fade: 0.12 }])}>+ Add clip</Button>
              {!same(cfg[sel], BUILTIN[sel]) && <Button size="small" onClick={() => setClips(BUILTIN[sel] ?? [])}>Back to built-in</Button>}</div>
          </Panel>
          <Panel className="se-save">
            <Row label="PIN"><input className="pin-input" value={pin} inputMode="numeric" autoComplete="off" onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} /></Row>
            <div className="btns">
              <Button kind="primary" disabled={busy || !pin} onClick={save}>Save for everyone</Button>
              <Button onClick={copy}>Copy for Claude</Button>
            </div>
            {msg && <p className="warn">{msg}</p>}
            <p className="hint">{changed.length ? `${changed.length} slot(s) differ from the built-in sounds.` : 'Everything matches the built-in sounds.'} New audio files: send them over and they get added to the list.</p>
          </Panel>
        </section>
      </div>
    </main>
  );
}

function ClipEditor({ clip, onChange, onRemove, onDuplicate }) {
  const canvas = useRef(null);
  const [buf, setBuf] = useState(null);
  const [view, setView] = useState(null); // [from, to] seconds shown (zoom)
  const [playing, setPlaying] = useState(null);
  const [head, setHead] = useState(null);
  const dragging = useRef(null);
  useEffect(() => { let live = true; decodeFile(clip.file).then((b) => { if (live) { setBuf(b); setView(null); } }); return () => { live = false; }; }, [clip.file]);
  const dur = buf?.duration ?? 1;
  const [v0, v1] = view ?? [0, dur];
  const end = clip.start + clip.len;
  useEffect(() => {
    const cv = canvas.current;
    if (!cv || !buf) return;
    const g = cv.getContext('2d'), W = cv.width, H = cv.height, d = buf.getChannelData(0), sr = buf.sampleRate;
    g.fillStyle = '#0b0f14'; g.fillRect(0, 0, W, H);
    const x = (t) => ((t - v0) / (v1 - v0)) * W;
    g.fillStyle = 'rgba(245, 224, 74, .14)'; g.fillRect(x(clip.start), 0, x(end) - x(clip.start), H);
    g.fillStyle = '#5fb6ff';
    for (let px = 0; px < W; px++) {
      const a = Math.floor((v0 + (px / W) * (v1 - v0)) * sr), b = Math.floor((v0 + ((px + 1) / W) * (v1 - v0)) * sr);
      let mx = 0; for (let i = a; i < b; i += Math.max(1, Math.floor((b - a) / 200))) mx = Math.max(mx, Math.abs(d[i] || 0));
      g.fillRect(px, H / 2 - mx * H * 0.48, 1, Math.max(1, mx * H * 0.96));
    }
    g.fillStyle = '#f5e04a'; g.fillRect(x(clip.start) - 1, 0, 3, H); g.fillRect(x(end) - 1, 0, 3, H);
    if (head != null) { g.fillStyle = '#fff'; g.fillRect(x(head), 0, 2, H); }
  }, [buf, clip.start, clip.len, v0, v1, head, end]);
  const tAt = (e) => { const r = canvas.current.getBoundingClientRect(); return v0 + ((e.clientX - r.left) / r.width) * (v1 - v0); };
  const down = (e) => {
    const t = tAt(e);
    const near = (a) => Math.abs(a - t) < (v1 - v0) * 0.02;
    dragging.current = near(clip.start) ? 'start' : near(end) ? 'end' : t < (clip.start + end) / 2 ? 'start' : 'end';
    move(e);
  };
  const move = (e) => {
    if (!dragging.current) return;
    const t = Math.max(0, Math.min(dur, tAt(e)));
    if (dragging.current === 'start') onChange({ ...clip, start: +Math.min(t, end - 0.05).toFixed(2), len: +(end - Math.min(t, end - 0.05)).toFixed(2) });
    else onChange({ ...clip, len: +Math.max(0.05, t - clip.start).toFixed(2) });
  };
  const play = async () => {
    if (playing) { playing.stop(0.05); setPlaying(null); setHead(null); return; }
    const p = await playClip(clip, 1);
    if (!p) return;
    setPlaying(p);
    const t0 = audioNow();
    const tick = () => {
      const t = audioNow() - t0;
      if (t > clip.len) { setPlaying(null); setHead(null); return; }
      setHead(clip.start + t); requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
  const num = (k, step, min, max) => (
    <label className="se-num"><span>{k}</span>
      <input type="number" step={step} min={min} max={max} value={clip[k] ?? 0} onChange={(e) => onChange({ ...clip, [k]: Number(e.target.value) })} />
    </label>
  );
  return (
    <div className="se-clip">
      <div className="se-clip-head">
        <Chips small value={clip.file} onChange={(f) => onChange({ ...clip, file: f })} options={FILES.map((f) => [f, f])} />
        {clip.name && <b className="led small">{clip.name}</b>}
      </div>
      <canvas ref={canvas} width={900} height={90} className="se-wave" onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); down(e); }}
        onPointerMove={move} onPointerUp={() => { dragging.current = null; }} />
      <div className="se-zoom">
        <Button size="small" onClick={() => setView([Math.max(0, clip.start - 1), Math.min(dur, end + 1)])}>Zoom to clip</Button>
        <Button size="small" onClick={() => setView(null)}>Whole file</Button>
        <span className="hint">{fmt(clip.start)} → {fmt(end)} ({clip.len.toFixed(2)} s of {fmt(dur)})</span>
      </div>
      <div className="se-fields">
        {num('start', 0.01, 0, dur)}{num('len', 0.01, 0.05, dur)}{num('vol', 0.05, 0, 3)}{num('fade', 0.05, 0, 5)}
        <Button kind="primary" size="small" onClick={play}>{playing ? 'Stop' : 'Play'}</Button>
        <Button size="small" onClick={onDuplicate}>Duplicate</Button>
        <Button size="small" kind="danger" onClick={onRemove}>Delete</Button>
      </div>
    </div>
  );
}
