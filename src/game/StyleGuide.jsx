// ?view=styleguide: every token and control in the kit, live, so new screens are built from these and nothing drifts.
// The written rules are in docs/STYLEGUIDE.md.
import { useState } from 'react';
import { Button, Chips, Kbd, Panel, Row, Slider, Toggle, useConfirm } from './ui';

const COLORS = [
  ['--bg', 'Page'], ['--bg2', 'Stage'], ['--glass', 'Panel'], ['--glass-hi', 'Button'], ['--line', 'Edges'],
  ['--text', 'Text'], ['--muted', 'Muted text'], ['--led', 'LED yellow: selected, titles'], ['--led-edge', 'Under yellow'],
  ['--ink', 'Text on yellow'], ['--go', 'Primary / on'], ['--go-edge', 'Under green'], ['--mfl-red', 'Danger'],
  ['--mfl-blue', 'MFL blue'], ['--warn', 'Warning text'], ['--bad', 'Error text'], ['--fire', 'Inferno'],
];
const TYPE = [['--t6', 'Page title'], ['--t5', 'Section heading, brand'], ['--t4', 'Big button, drawer title'], ['--t3', 'Button, nav'],
  ['--t2', 'Small button, chip, label'], ['--t1', 'Key label, tiny tag']];
const SPACE = ['--s1', '--s2', '--s3', '--s4', '--s5', '--s6'];

export default function StyleGuide() {
  const [chip, setChip] = useState('normal');
  const [on, setOn] = useState(true);
  const [vol, setVol] = useState(0.6);
  const [confirmIt, dialog] = useConfirm();
  return (
    <main className="page styleguide">
      <h1 className="page-title">Style guide</h1>
      <p className="hint">Every screen is built from these. Rules and the component list: docs/STYLEGUIDE.md.</p>

      <h2>Colour</h2>
      <div className="sg-swatches">
        {COLORS.map(([v, l]) => <div key={v} className="sg-swatch"><i style={{ background: `var(${v})` }} /><b>{v}</b><span>{l}</span></div>)}
      </div>

      <h2>Type</h2>
      <Panel className="sg-stack">
        {TYPE.map(([v, l]) => <div key={v} className="sg-type"><span style={{ fontFamily: 'var(--pixel)', fontSize: `var(${v})` }}>TECHNO BOWL</span><small>{v} · {l}</small></div>)}
        <div className="sg-type"><span>Pixelify Sans for running text: hints, rules, ability texts.</span><small>--body · 18px × text size</small></div>
        <div className="sg-type"><span className="hint">A hint under a control.</span><small>.hint (--small)</small></div>
        <div className="sg-type"><span className="warn">Something needs a look.</span><small>.warn</small></div>
        <div className="sg-type"><span className="led">LED 88</span><small>.led</small></div>
      </Panel>

      <h2>Space and corners</h2>
      <Panel className="sg-stack">
        {SPACE.map((v) => <div key={v} className="sg-space"><i style={{ width: `var(${v})` }} /><small>{v}</small></div>)}
        <div className="sg-space"><i className="sg-corner" style={{ borderRadius: 'var(--r1)' }} /><small>--r1 controls</small><i className="sg-corner" style={{ borderRadius: 'var(--r2)' }} /><small>--r2 panels, cards</small></div>
      </Panel>

      <h2>Buttons</h2>
      <Panel className="sg-row">
        <Button>Plain</Button><Button kind="primary">Primary</Button><Button kind="danger">Danger</Button>
        <Button size="small">Small</Button><Button size="big" kind="primary">Big</Button>
        <Button keyAction="primary">With a key</Button><Button disabled>Disabled</Button><Button className="on" size="small">On</Button>
      </Panel>
      <p className="hint">One primary button per screen or prompt. Danger only for leaving or deleting, always behind a confirm.</p>

      <h2>Choices</h2>
      <Panel>
        <Row label="Chips"><Chips value={chip} onChange={setChip} options={[['slow', 'Slow'], ['normal', 'Normal'], ['fast', 'Fast']]} /></Row>
        <Row label="Small chips"><Chips small value={chip} onChange={setChip} options={[['slow', 'Slow'], ['normal', 'Normal'], ['fast', 'Fast']]} /></Row>
        <Row label="Toggle"><Toggle checked={on} onChange={setOn}>Words go here</Toggle></Row>
        <Row label="Slider"><Slider value={vol} onChange={setVol} label="Volume" /></Row>
        <Row label="Key label"><span>Press <Kbd k="P" /> for players</span></Row>
        <Row label="Confirm"><Button onClick={() => confirmIt({ title: 'Leave this game?', body: 'It stays saved.', yes: 'Leave', danger: true })}>Open a confirm</Button></Row>
      </Panel>

      <h2>Boxes</h2>
      <div className="sg-grid">
        <Panel><h3>Panel</h3><p>The one box: dark glass, a 2px edge, a hard shadow. Use &lt;Panel&gt;.</p></Panel>
        <button className="glass menu-card"><b>Menu card</b><span>A big choice on Home.</span></button>
        <button className="glass menu-card primary"><b>Menu card: main</b><span>The one to press first.</span></button>
      </div>
      <div className="sg-row">
        <span className="skill-chip">SPIN MOVE</span><span className="skill-chip live">JUKE ✦</span>
        <span className="roster-tag ball">Ball</span><span className="roster-tag up">Up now</span><span className="roster-tag fire">On fire</span>
        <button className="chipbtn">Chip button</button><button className="chipbtn on">On</button>
      </div>
      {dialog}
    </main>
  );
}
