// The ♪ jukebox button and its panel: now playing, play / pause / previous / next / shuffle, the track list, and the
// three "when does music play" switches. Lives in the top bar and the game's tool row.
import { useEffect, useReducer, useState } from 'react';
import { TRACKS, nowPlaying, onMusic, playTrack, toggle, next, prev } from './music';
import { setSettings, useSettings } from './prefs';
import { Toggle } from './ui';

export default function MusicPlayer({ small }) {
  const [open, setOpen] = useState(false);
  const [, bump] = useReducer((x) => x + 1, 0);
  useEffect(() => onMusic(bump), []);
  const s = useSettings();
  const { track, index, playing } = nowPlaying();
  return (
    <span className="jukebox">
      <button className={`btn small ${playing ? 'on' : ''}`} onClick={() => setOpen(!open)} title="Music">♪{small ? '' : ` ${playing && track ? track.title : 'Music'}`}</button>
      {open && (
        <div className="jukebox-panel glass" onClick={(e) => e.stopPropagation()}>
          <div className="jb-now">
            <b>{track ? track.title : 'ESPN NFL Primetime'}</b>
            <small>{track?.by ?? (track ? 'Unknown composer' : `${TRACKS.length} tracks`)}</small>
          </div>
          <div className="btns jb-ctl">
            <button className="btn small" onClick={prev} aria-label="Previous">⏮</button>
            <button className="btn small primary" onClick={toggle}>{playing ? '⏸ Pause' : '▶ Play'}</button>
            <button className="btn small" onClick={next} aria-label="Next">⏭</button>
            <button className={`btn small ${s.musicShuffle !== false ? 'on' : ''}`} onClick={() => setSettings({ musicShuffle: s.musicShuffle === false })} title="Shuffle">🔀</button>
          </div>
          <ol className="jb-list">
            {TRACKS.map((t, i) => (
              <li key={t.id} className={i === index ? 'on' : ''} onClick={() => playTrack(i)}>
                <span>{t.title}</span><small>{Math.floor(t.len / 60)}:{String(Math.round(t.len % 60)).padStart(2, '0')}</small>
              </li>
            ))}
          </ol>
          <div className="jb-switches">
            <Toggle checked={s.musicMenus !== false} onChange={(v) => setSettings({ musicMenus: v })}>Menu music</Toggle>
            <Toggle checked={s.musicBreaks !== false} onChange={(v) => setSettings({ musicBreaks: v })}>At half time and the final whistle</Toggle>
            <Toggle checked={!!s.musicGame} onChange={(v) => setSettings({ musicGame: v })}>During games</Toggle>
          </div>
          <p className="hint">The Music level and the mute are in Settings (they apply here too).</p>
          <div className="btns"><button className="btn small" onClick={() => setOpen(false)}>Close</button></div>
        </div>
      )}
    </span>
  );
}

// full screen (computers: the browser's own full screen; F does it too)
export function FullscreenButton() {
  const can = typeof document !== 'undefined' && (document.fullscreenEnabled || document.webkitFullscreenEnabled);
  const [on, setOn] = useState(() => !!document.fullscreenElement);
  useEffect(() => {
    const f = () => setOn(!!(document.fullscreenElement || document.webkitFullscreenElement));
    document.addEventListener('fullscreenchange', f); document.addEventListener('webkitfullscreenchange', f);
    return () => { document.removeEventListener('fullscreenchange', f); document.removeEventListener('webkitfullscreenchange', f); };
  }, []);
  if (!can) return null;
  const go = () => {
    const d = document.documentElement;
    if (document.fullscreenElement || document.webkitFullscreenElement) (document.exitFullscreen ?? document.webkitExitFullscreen)?.call(document);
    else (d.requestFullscreen ?? d.webkitRequestFullscreen)?.call(d)?.catch?.(() => {});
  };
  return <button className="btn small fs-btn" onClick={go} title="Full screen (F)">{on ? '⤓ Exit full screen' : '⛶ Full screen'}</button>;
}
