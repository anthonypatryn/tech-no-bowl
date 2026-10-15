import { Chips, Toggle } from './ui';
import { setSettings, useSettings } from './prefs';

export default function Settings() {
  const s = useSettings();
  return (
    <main className="page settings">
      <h1 className="page-title">Settings</h1>
      <section className="glass setting-list">
        <div className="opt"><span>Text size</span>
          <Chips value={s.text} onChange={(text) => setSettings({ text })} options={[['normal', 'Normal'], ['large', 'Large'], ['larger', 'Larger']]} />
        </div>
        <div className="opt"><span>Calm motion</span>
          <Toggle checked={s.calm} onChange={(calm) => setSettings({ calm })}>Skip camera moves and cinematics</Toggle>
        </div>
        <div className="opt"><span>Field detail</span>
          <Toggle checked={s.fieldHi} onChange={(fieldHi) => setSettings({ fieldHi })}>Sharp 4K field (turn off on slow phones)</Toggle>
        </div>
        <div className="opt"><span>Play clocks</span>
          <Toggle checked={s.clocks} onChange={(clocks) => setSettings({ clocks })}>1:00 to set up and call plays, 0:30 for motion, with the rulebook penalties</Toggle>
        </div>
        <p className="hint">Sound mixer and key bindings arrive with the audio and controls batches.</p>
      </section>
    </main>
  );
}
