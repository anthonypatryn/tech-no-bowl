// ?view=online — play a friend. One coach hosts (their browser runs the game), the other joins with the 5-letter code
// or the invite link (?view=online&join=CODE). In the lobby each coach picks a team; the host picks the rules and
// whether the play clocks run, then kicks it off. Anyone joining a full room watches.
import { useEffect, useMemo, useReducer, useState } from 'react';
import { HostRoom, JoinClient, RemoteGame, cleanCode, loadIce } from '../net/room';
import { Button, Chips, Panel, Row, Toggle } from './ui';
import { TEAMS, teamById, uniformsFor, teamColors, helmetUrl } from '../data/art';
import { altSlots } from '../data/abilities';
import { MODES, MODE_INFO, TeamGrid, LineupPicker } from './TeamPicker';
import { onlineGames, forgetOnlineGame } from './useGame';
import GameView from './GameView.jsx';

const nameKey = 'tb-name';
const savedName = () => { try { return localStorage.getItem(nameKey) || 'Coach'; } catch { return 'Coach'; } };

export default function OnlinePage({ go }) {
  const [name, setName] = useState(savedName);
  const [code, setCode] = useState(() => cleanCode(new URLSearchParams(location.search).get('join')));
  const [room, setRoom] = useState(null); // HostRoom (we host) | JoinClient (we joined)
  const [match, setMatch] = useState(null); // the host's running game
  const [, bump] = useReducer((x) => x + 1, 0);
  const [saved, setSaved] = useState(onlineGames);
  useEffect(() => { loadIce(); }, []);
  useEffect(() => (room ? room.on(bump) : undefined), [room]);
  useEffect(() => () => room?.close(), [room]);
  useEffect(() => { try { localStorage.setItem(nameKey, name); } catch { /* not kept */ } }, [name]);
  const isHost = room instanceof HostRoom;
  const remote = useMemo(() => (room instanceof JoinClient ? new RemoteGame(room) : null), [room]);
  const friendMatch = useMemo(() => ({ mode: room?.lobby?.setup?.mode ?? 'techno', seed: 0 }), [room?.lobby?.setup?.mode, room?.status === 'game']); // eslint-disable-line react-hooks/exhaustive-deps

  const leave = () => { room?.close(); setRoom(null); setMatch(null); };
  const host = () => setRoom(new HostRoom(name.trim() || 'Coach'));
  const join = () => { if (cleanCode(code).length === 5) setRoom(new JoinClient(code, name.trim() || 'Coach')); };
  // a saved game: the host reopens the same room code and rebuilds the game from its answers; the friend rejoins
  const resumeGame = (g) => {
    if (g.role === 'friend') { setRoom(new JoinClient(g.code, g.name || name.trim() || 'Coach')); return; }
    const r = new HostRoom(name.trim() || 'Coach', g.room);
    setRoom(r);
    setMatch({ ...g.match, replay: g.trail, skipIntro: true, key: Date.now(), online: { room: r } });
  };

  // ---------- in a game ----------
  if (isHost && match) {
    return <div className="online-game"><GameView key={match.key ?? match.seed} match={match} onExit={() => { room.backToLobby(); setMatch(null); }} onRematch={() => {}} /></div>;
  }
  if (remote && room.status !== 'lobby' && room.state) {
    return <div className="online-game"><GameView key={`r${room.lobby?.started}`} match={friendMatch} remote={remote} me={room.you === 1 ? 1 : 0} onExit={leave} /></div>;
  }

  // ---------- lobby ----------
  return (
    <main className="page online">
      <h1 className="page-title">Play online</h1>
      {!room && (
        <>
          <Panel>
            <Row label="Your name"><input className="text-in" value={name} maxLength={14} onChange={(e) => setName(e.target.value)} /></Row>
          </Panel>
          {saved.length > 0 && (
            <Panel className="saved-games">
              <h3>Your online games</h3>
              <p className="hint">Unfinished games are saved. The host resumes (same room code) and the other coach rejoins; either can go first.</p>
              {saved.map((g) => (
                <div key={g.role + g.code} className="saved-game">
                  <span><b className="led">{g.code}</b> {g.teams ? `${g.teams[0]} ${g.score?.[0] ?? 0} - ${g.score?.[1] ?? 0} ${g.teams[1]}` : ''}{g.half ? ` · ${g.half === 1 ? '1st' : '2nd'} half` : ''}</span>
                  <small className="muted">{g.role === 'host' ? `You hosted${g.opp ? ` · vs ${g.opp}` : ''}` : `You joined${g.opp ? ` ${g.opp}'s room` : ''}`} · {new Date(g.at).toLocaleString()}</small>
                  <span className="btns">
                    <button className="btn small primary" onClick={() => resumeGame(g)}>{g.role === 'host' ? 'Resume' : 'Rejoin'}</button>
                    <button className="btn small" onClick={() => { forgetOnlineGame(g.code, g.role); setSaved(onlineGames()); }}>Forget</button>
                  </span>
                </div>
              ))}
            </Panel>
          )}
          <div className="online-grid">
            <Panel>
              <h3>Host a game</h3>
              <p className="hint">You get a 5-letter code to send to your friend. Your browser runs the game, so keep this tab open.</p>
              <Button kind="primary" size="big" onClick={host}>Create a room</Button>
            </Panel>
            <Panel>
              <h3>Join a friend</h3>
              <Row label="Room code"><input className="text-in code-in" value={code} maxLength={5} placeholder="ABCDE" onChange={(e) => setCode(cleanCode(e.target.value))} onKeyDown={(e) => e.key === 'Enter' && join()} /></Row>
              <Button kind="primary" size="big" disabled={code.length !== 5} onClick={join}>Join</Button>
            </Panel>
          </div>
        </>
      )}
      {room && isHost && <HostLobby room={room} onStart={(m) => setMatch(m)} onLeave={leave} />}
      {room && !isHost && <JoinLobby client={room} onLeave={leave} />}
      <p className="hint">Can't connect? Phone data and some home routers block direct links; it can take a few tries. Ad blockers and VPN extensions can block online play too.</p>
      <div className="btns"><button className="btn" onClick={() => { leave(); go('home'); }}>Back home</button></div>
    </main>
  );
}

function CodeBox({ code }) {
  const [copied, setCopied] = useState(false);
  const link = `${location.origin}${location.pathname}?view=online&join=${code}`;
  return (
    <div className="code-box">
      <span className="led big-code">{code}</span>
      <button className="btn small" onClick={() => { navigator.clipboard?.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>{copied ? 'Copied!' : 'Copy invite link'}</button>
    </div>
  );
}

function TeamChooser({ sel, onChange, disabled }) {
  const [grid, setGrid] = useState(false);
  const [lineup, setLineup] = useState(false);
  const t = teamById(sel.team);
  const [c0] = teamColors(sel.team, sel.uni);
  const i = TEAMS.findIndex((x) => x.id === sel.team);
  const pick = (id) => onChange({ team: id, uni: 'home', picks: {} });
  return (
    <div className="team-chooser" style={{ '--c0': c0 }}>
      {helmetUrl(sel.team) && <img src={helmetUrl(sel.team)} alt="" />}
      <b className="led">{t.name.toUpperCase()}</b>
      {!disabled && (
        <>
          <div className="btns">
            <button className="btn small" onClick={() => pick(TEAMS[(i - 1 + TEAMS.length) % TEAMS.length].id)}>◀</button>
            <button className="btn small" onClick={() => setGrid(true)}>All teams</button>
            <button className="btn small" onClick={() => pick(TEAMS[(i + 1) % TEAMS.length].id)}>▶</button>
            <button className="btn small" onClick={() => pick(TEAMS[Math.floor(Math.random() * TEAMS.length)].id)}>Random</button>
          </div>
          <Chips small value={sel.uni} onChange={(uni) => onChange({ ...sel, uni })} options={uniformsFor(sel.team).map((u) => [u.id, u.label])} />
          {altSlots(t).length > 0 && <button className="btn small" onClick={() => setLineup(true)}>Lineup{Object.values(sel.picks ?? {}).includes('alt') ? ' (alternate)' : ''}</button>}
        </>
      )}
      {disabled && <small className="muted">{uniformsFor(sel.team).find((u) => u.id === sel.uni)?.label}</small>}
      {grid && <TeamGrid current={sel.team} onPick={(id) => { pick(id); setGrid(false); }} onClose={() => setGrid(false)} />}
      {lineup && <LineupPicker sel={sel} set={onChange} onClose={() => setLineup(false)} />}
    </div>
  );
}

function HostLobby({ room, onStart, onLeave }) {
  const { setup } = room;
  const f = room.friend;
  const clash = setup.teams[0].team === setup.teams[1].team && setup.teams[0].uni === setup.teams[1].uni;
  const start = () => onStart({ you: setup.teams[0], cpu: setup.teams[1], mode: setup.mode, clocks: setup.clocks, level: 'starter', seed: Date.now(), online: { room } });
  return (
    <>
      <Panel className="lobby-head">
        {room.status === 'connecting' && <p>Opening a room…</p>}
        {room.status === 'error' && <p className="warn">{room.error}</p>}
        {room.status === 'open' && <><p>Send your friend this code (or the link):</p><CodeBox code={room.code} /></>}
        {room.error && room.status === 'open' && <p className="warn">{room.error}</p>}
      </Panel>
      <div className="online-grid">
        <Panel>
          <h3>{room.seats[0].name} (you, home)</h3>
          <TeamChooser sel={setup.teams[0]} onChange={(sel) => room.pick(sel)} />
        </Panel>
        <Panel>
          <h3>{f ? `${f.name} (away)` : 'Waiting for your friend…'}{f && !f.connected ? ' · disconnected' : ''}</h3>
          {f ? <TeamChooser sel={setup.teams[1]} disabled /> : <p className="hint">They pick their own team once they're in.</p>}
          {f && <button className="btn small" onClick={() => room.kick()}>Remove</button>}
          {room.watchers.size > 0 && <p className="hint">{room.watchers.size} watching</p>}
        </Panel>
      </div>
      <Panel>
        <Row label="Rules"><Chips small value={setup.mode} onChange={(mode) => room.setRules({ mode })} options={MODES} /><span className="hint"> {MODE_INFO[setup.mode]}</span></Row>
        <Row label="Play clocks"><Toggle checked={setup.clocks} onChange={(clocks) => room.setRules({ clocks })}>1:00 to set up and call, 0:30 for motion (out of time = delay of game)</Toggle></Row>
        {clash && <p className="warn">Same team, same uniform: one of you change uniforms.</p>}
        <div className="btns">
          <Button kind="primary" size="big" disabled={!f?.connected || clash} onClick={start}>Kick off</Button>
          <button className="btn" onClick={onLeave}>Close the room</button>
        </div>
      </Panel>
    </>
  );
}

function JoinLobby({ client, onLeave }) {
  const L = client.lobby;
  const [mine, setMine] = useState(null);
  const sel = mine ?? L?.setup?.teams?.[1];
  const choose = (s) => { setMine(s); client.pick(s); };
  if (client.status === 'error' || client.status === 'ended') {
    return <Panel><p className="warn">{client.error}</p><div className="btns">{client.status === 'error' && <button className="btn primary" onClick={() => client.rejoin()}>Try again</button>}<button className="btn" onClick={onLeave}>Back</button></div></Panel>;
  }
  if (!L) return <Panel><p>{client.status === 'reconnecting' ? 'Reconnecting…' : `Connecting to room ${client.code}…`}</p><div className="btns"><button className="btn" onClick={onLeave}>Cancel</button></div></Panel>;
  const watching = client.spectating;
  return (
    <>
      <Panel className="lobby-head"><p>Room <b className="led">{L.code}</b>{watching ? ': the seats are full, so you are watching.' : `: ${L.seats[0]?.name} is hosting. They'll kick off when you're both ready.`}</p></Panel>
      <div className="online-grid">
        <Panel><h3>{L.seats[0]?.name} (home)</h3><TeamChooser sel={L.setup.teams[0]} disabled /></Panel>
        <Panel><h3>{watching ? `${L.seats[1]?.name ?? '…'} (away)` : 'You (away)'}</h3>{sel && <TeamChooser sel={sel} onChange={choose} disabled={watching} />}</Panel>
      </div>
      <Panel>
        <Row label="Rules"><b>{MODES.find(([k]) => k === L.setup.mode)?.[1]}</b><span className="hint"> {MODE_INFO[L.setup.mode]}</span></Row>
        <Row label="Play clocks"><b>{L.setup.clocks ? 'On' : 'Off'}</b></Row>
        <div className="btns"><button className="btn" onClick={onLeave}>Leave</button></div>
      </Panel>
    </>
  );
}
