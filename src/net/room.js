// Online rooms, peer to peer (WebRTC via PeerJS's free public broker: no game server of ours, no database).
// Same pattern as Long Shot: the HOST's browser runs the Game (the engine is host-authoritative); the other coach
// connects straight to it with a 5-letter room code. Each browser gets the game state with the other coach's
// cards hidden (sanitize) and sends back answers to the questions the engine asks its side.
//
// friend -> host: { t:'hello', name, clientId }  { t:'answer', reqId, value }  { t:'pick', sel }  { t:'react', k }
// host -> friend: { t:'lobby', code, seats, setup, started, you }  { t:'state', state, you }  { t:'react', side, k }
//                 { t:'ended', reason }
// Seats: 0 = the host (home), 1 = the friend (away). Anyone else who joins watches (you = -1, both benches hidden).
// A host who reloads mid-game resumes with the same code (the game is rebuilt from both coaches' answers) and the
// friend's browser keeps retrying until it's back. Both sides ping every few seconds; quiet for 10 s = gone.
import Peer from 'peerjs';

const PREFIX = 'technobowl-';
const PING_MS = 3000, LOST_MS = 10000;
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O, 1/I/L
export const randomCode = () => Array.from({ length: 5 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join('');
export const cleanCode = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
const peerId = (code) => PREFIX + code.toLowerCase();
export const REACTIONS = ['👏', '😱', '🔥', '😂', '😤', '🏈'];

// the same id across reloads, so a refresh rejoins the same seat
export function clientId() {
  try {
    let id = localStorage.getItem('tb-client-id');
    if (!id) { id = Math.random().toString(36).slice(2, 12); localStorage.setItem('tb-client-id', id); }
    return id;
  } catch { return Math.random().toString(36).slice(2, 12); }
}

// relay (TURN) servers for networks that can't reach the host directly (phone data, strict routers): short-lived
// Cloudflare credentials from /api/turn. Without them PeerJS's defaults (direct connections) are used.
let ice = null;
export function loadIce() {
  if (typeof window === 'undefined') return Promise.resolve();
  if (ice && Date.now() - ice.at < (ice.servers ? 12 * 3600e3 : 60e3)) return ice.ready;
  const cur = { servers: null, at: Date.now() };
  cur.ready = fetch('/api/turn').then((r) => (r.ok ? r.json() : null)).then((j) => { if (j?.iceServers?.length) cur.servers = j.iceServers; }).catch(() => {});
  ice = cur;
  return cur.ready;
}
const peerOptions = () => {
  loadIce();
  return ice?.servers ? { debug: 0, config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, ...ice.servers] } } : { debug: 0 };
};

const ERRORS = {
  'peer-unavailable': 'No room with that code. Check the code, and that the host still has the game open.',
  network: 'Lost the connection to the matchmaking server. Check your internet and try again.',
  'server-error': 'The matchmaking server didn’t answer. Try again in a moment.',
};
function blockedText() {
  return 'Something in this browser is blocking online play (WebRTC), usually an ad blocker, VPN or privacy extension. Try a private window, or turn it off for this site.';
}
const errText = (e) => (e?.type === 'browser-incompatible' ? blockedText() : ERRORS[e?.type] || e?.message || String(e));

// PeerJS's JSON channel refuses messages of ~16 KB or more: big ones go in parts and the friend joins them
const PART_CHARS = 5000;
let partNo = 0;
function sendMsg(conn, msg) {
  const str = JSON.stringify(msg);
  if (str.length <= PART_CHARS) { conn.send(msg); return; }
  const id = ++partNo, n = Math.ceil(str.length / PART_CHARS);
  for (let i = 0; i < n; i++) conn.send({ t: 'part', id, i, n, s: str.slice(i * PART_CHARS, (i + 1) * PART_CHARS) });
}

class Emitter {
  constructor() { this.subs = new Set(); }
  on(fn) { this.subs.add(fn); return () => this.subs.delete(fn); }
  emit() { this.subs.forEach((fn) => fn(this)); }
}

// what one side may see: its own bench, play call and discards; the other coach's only as counts. The details of an
// open question only if it's theirs. (-1 = a spectator: both hidden.)
export function sanitize(s, seat) {
  const hidden = (c) => ({ bench: c.bench.map(() => 0), stack: c.stack.map(() => 0), discard: c.discard.map(() => 0) });
  return {
    ...s,
    cards: s.cards.map((c, side) => (side === seat ? c : hidden(c))),
    request: s.request && s.request.side !== seat ? { type: s.request.type, side: s.request.side, id: s.request.id } : s.request,
    log: s.log.slice(-150),
  };
}

const DEFAULT_SETUP = { mode: 'techno', clocks: true, teams: [{ team: 'bighorns', uni: 'home', picks: {} }, { team: 'kittens', uni: 'home', picks: {} }] };

// ---------------------------------------------------------------- host
export class HostRoom extends Emitter {
  constructor(hostName, resume = null) {
    super();
    this.status = 'connecting';
    this.error = '';
    this.seats = [{ name: hostName, kind: 'host', connected: true }];
    if (resume?.friend) this.seats.push({ ...resume.friend, kind: 'remote', connected: false });
    this.setup = resume?.setup ?? structuredClone(DEFAULT_SETUP);
    this.started = false;
    this.game = null;
    this.conns = new Map();    // clientId -> conn (the friend)
    this.watchers = new Map(); // clientId -> { name, conn }
    this.reactions = [];
    this.wantCode = resume?.code ?? null;
    this.codeTries = 0;
    this.open(this.wantCode ?? randomCode());
    this.beat = setInterval(() => {
      const now = Date.now();
      for (const c of this.allConns()) {
        if (now - (c.lastSeen ?? now) > LOST_MS) { this.onClose(c); try { c.close(); } catch { /* gone */ } continue; }
        try { if (c.open) c.send({ t: 'ping' }); } catch { /* closed */ }
      }
    }, PING_MS);
  }

  open(code) {
    this.code = code;
    this.peer?.destroy();
    const peer = new Peer(peerId(code), peerOptions());
    this.peer = peer;
    peer.on('open', () => { this.status = 'open'; this.emit(); });
    peer.on('connection', (conn) => {
      conn.on('data', (m) => this.onMessage(conn, m));
      conn.on('close', () => this.onClose(conn));
      conn.on('error', (e) => { if (e?.type !== 'message-too-big') this.onClose(conn); });
    });
    peer.on('disconnected', () => { if (!peer.destroyed) peer.reconnect(); });
    peer.on('error', (e) => {
      if (e.type === 'unavailable-id') {
        // after a reload the old code takes a few seconds to free up
        if (this.wantCode && this.codeTries++ < 8) { setTimeout(() => this.open(this.wantCode), 2500); return; }
        if (this.wantCode) { this.error = 'Couldn’t get the old room code back: send your friend the new one.'; this.wantCode = null; }
        return this.open(randomCode());
      }
      if (e.type === 'peer-unavailable') return;
      this.error = errText(e); this.status = this.status === 'open' ? 'open' : 'error'; this.emit();
    });
  }

  get friend() { return this.seats[1] ?? null; }
  allConns() { return [...this.conns.values(), ...[...this.watchers.values()].map((w) => w.conn)]; }

  onMessage(conn, m) {
    if (!m || typeof m !== 'object') return;
    conn.lastSeen = Date.now();
    if (m.t === 'pong') return;
    if (m.t === 'hello') {
      const id = String(m.clientId || '').slice(0, 20), name = String(m.name || 'Friend').trim().slice(0, 14) || 'Friend';
      conn.clientId = id;
      const f = this.friend;
      if (f && f.clientId !== id && (f.connected || this.started)) {
        // the seat is taken (or the game is on with someone else in it): watch instead
        if (!(this.started && !f.connected && f.name.toLowerCase() === name.toLowerCase())) { this.addWatcher(conn, id, name); return; }
        f.clientId = id; // same name, new browser: their seat back
      }
      if (!f) this.seats.push({ name: name.toLowerCase() === this.seats[0].name.toLowerCase() ? `${name} 2` : name, kind: 'remote', clientId: id, connected: true });
      else Object.assign(f, { connected: true, clientId: id, ...(this.started ? {} : { name }) });
      if (this.friend.cpu) { this.friend.cpu = false; this.game?.setAgent(1, null); } // back: the computer gives the seat back
      this.conns.get(id)?.close?.();
      this.conns.set(id, conn);
      this.broadcastLobby();
      if (this.started && this.game) this.sendState(conn, 1);
      this.emit();
      return;
    }
    if (m.t === 'pick' && !this.started && conn.clientId === this.friend?.clientId && m.sel?.team) {
      this.setup.teams[1] = { team: String(m.sel.team), uni: String(m.sel.uni || 'home'), picks: m.sel.picks && typeof m.sel.picks === 'object' ? m.sel.picks : {} };
      this.broadcastLobby(); this.emit(); return;
    }
    if (m.t === 'react') { this.react(conn.clientId === this.friend?.clientId ? 1 : -1, m.k); return; }
    if (m.t === 'answer' && this.started && this.game && conn.clientId === this.friend?.clientId) {
      if (this.game.state.request?.side === 1 && !this.friend.cpu) this.game.answer(m.value, m.reqId);
    }
  }

  onClose(conn) {
    if (this.watchers.get(conn.clientId)?.conn === conn) { this.watchers.delete(conn.clientId); this.emit(); return; }
    if (this.conns.get(conn.clientId) !== conn) return;
    this.conns.delete(conn.clientId);
    if (this.friend) this.friend.connected = false;
    if (!this.started) this.seats.splice(1, 1); // left the lobby: free the seat
    this.broadcastLobby(); this.emit();
  }

  addWatcher(conn, id, name) {
    this.watchers.get(id)?.conn?.close?.();
    this.watchers.set(id, { name, conn });
    const send = () => { this.sendLobbyTo(conn, -1); if (this.game) this.sendState(conn, -1); };
    if (conn.open) send(); else conn.on('open', send);
    this.emit();
  }

  // lobby
  pick(sel) { if (!this.started) { this.setup.teams[0] = sel; this.broadcastLobby(); this.emit(); } }
  setRules(patch) { if (!this.started) { Object.assign(this.setup, patch); this.broadcastLobby(); this.emit(); } }
  rename(name) { this.seats[0].name = name; this.broadcastLobby(); this.emit(); }
  kick() {
    const f = this.friend;
    if (!f || this.started) return;
    const c = this.conns.get(f.clientId);
    this.conns.delete(f.clientId);
    this.seats.splice(1, 1);
    if (c) { try { c.send({ t: 'ended', reason: 'The host removed you from the room.' }); } catch { /* gone */ } setTimeout(() => c.close(), 300); }
    this.broadcastLobby(); this.emit();
  }

  // the Game the host's screen runs: every change goes to the friend and the watchers (once per ~frame)
  attach(game) {
    this.game = game; this.started = true;
    const orig = game.onChange;
    let queued = false;
    game.onChange = (s) => {
      orig(s);
      if (queued) return;
      queued = true;
      setTimeout(() => { queued = false; this.pushState(); }, 30);
    };
    if (this.friend && !this.friend.connected) this.takeOver();
    this.broadcastLobby(); this.pushState(); this.emit();
  }
  pushState() {
    if (!this.game) return;
    const c = this.friend && this.conns.get(this.friend.clientId);
    if (c?.open) this.sendState(c, 1);
    for (const w of this.watchers.values()) if (w.conn.open) this.sendState(w.conn, -1);
  }
  sendState(conn, seat) { try { sendMsg(conn, { t: 'state', state: sanitize(this.game.state, seat), you: seat }); } catch { /* closed */ } }

  // the friend dropped: the computer coaches their side until they're back (the 'hello' hands it back)
  takeOver(agent) { if (!this.game || !this.friend) return; this.friend.cpu = true; this.game.setAgent(1, agent ?? this.cpuAgent); this.broadcastLobby(); this.emit(); }

  react(side, k) {
    k = Number(k);
    if (!(k >= 0 && k < REACTIONS.length)) return;
    this.reactions = [...this.reactions.slice(-9), { id: Math.random(), side, k, at: Date.now() }];
    for (const c of this.allConns()) { try { if (c.open) c.send({ t: 'react', side, k }); } catch { /* closed */ } }
    this.emit();
  }

  // game over / host left the game: back to the lobby (the friend stays connected)
  backToLobby() {
    this.game = null; this.started = false;
    if (this.friend && !this.friend.connected) this.seats.splice(1, 1);
    if (this.friend) this.friend.cpu = false;
    this.broadcastLobby(); this.emit();
  }

  snapshot() { return { code: this.code, setup: this.setup, friend: this.friend ? { name: this.friend.name, clientId: this.friend.clientId } : null }; }
  lobbySeats() { return this.seats.map(({ name, kind, connected, cpu }) => ({ name, kind, connected, cpu: !!cpu })); }
  sendLobbyTo(c, you) {
    try { if (c?.open) sendMsg(c, { t: 'lobby', code: this.code, seats: this.lobbySeats(), setup: this.setup, watchers: this.watchers.size, started: this.started, you }); } catch { /* closed */ }
  }
  broadcastLobby() {
    if (this.friend) this.sendLobbyTo(this.conns.get(this.friend.clientId), 1);
    for (const w of this.watchers.values()) this.sendLobbyTo(w.conn, -1);
  }
  close() {
    clearInterval(this.beat);
    for (const c of this.allConns()) { try { c.send({ t: 'ended', reason: 'The host closed the room.' }); } catch { /* gone */ } }
    setTimeout(() => this.peer?.destroy(), 300);
  }
}

// ---------------------------------------------------------------- friend
export class JoinClient extends Emitter {
  constructor(code, name) {
    super();
    this.code = cleanCode(code);
    this.name = name;
    this.id = clientId();
    this.status = 'connecting'; // connecting -> lobby | game -> (reconnecting) ... | ended | error
    this.error = '';
    this.lobby = null;
    this.state = null;
    this.you = null;
    this.reactions = [];
    this.retries = 0;
    this.peer = new Peer(peerOptions());
    this.peer.on('open', () => this.connect());
    this.peer.on('disconnected', () => { if (!this.peer.destroyed) this.peer.reconnect(); });
    this.peer.on('error', (e) => {
      if (e.type === 'peer-unavailable' && this.status === 'reconnecting') return this.retry();
      if ((this.state || this.lobby) && ['network', 'server-error', 'socket-error', 'socket-closed', 'disconnected', 'peer-unavailable'].includes(e.type)) {
        this.status = 'reconnecting'; this.emit(); return this.retry();
      }
      this.fail(errText(e));
    });
    this.onVisible = () => {
      if (document.visibilityState !== 'visible' || ['ended', 'error'].includes(this.status)) return;
      if (this.conn?.open && Date.now() - this.lastSeen < PING_MS * 2) return;
      this.retries = 0; this.status = 'reconnecting'; this.emit();
      clearTimeout(this.retryT);
      if (this.peer.destroyed) return;
      if (this.peer.disconnected) this.peer.reconnect(); else this.connect();
    };
    document.addEventListener('visibilitychange', this.onVisible);
  }

  connect() {
    const conn = this.peer.connect(peerId(this.code), { reliable: true, serialization: 'json' });
    this.conn = conn;
    this.attemptAt = Date.now();
    conn.on('open', () => { this.retries = 0; this.lastSeen = Date.now(); conn.send({ t: 'hello', name: this.name, clientId: this.id }); });
    clearInterval(this.beat);
    this.beat = setInterval(() => {
      if (this.conn === conn && !conn.open && this.status === 'reconnecting' && Date.now() - this.attemptAt > 6000) {
        try { conn.close(); } catch { /* never opened */ }
        this.attemptAt = Date.now(); this.retry(); return;
      }
      if (this.conn !== conn || !conn.open || ['ended', 'error', 'reconnecting'].includes(this.status)) return;
      if (Date.now() - this.lastSeen > LOST_MS) { this.status = 'reconnecting'; this.emit(); try { conn.close(); } catch { /* gone */ } this.retry(); }
    }, PING_MS);
    conn.on('data', (m) => this.onMessage(m));
    conn.on('close', () => { if (this.conn === conn && !['ended', 'error'].includes(this.status)) { this.status = 'reconnecting'; this.emit(); this.retry(); } });
  }
  retry() {
    if (!document.hidden && this.retries++ > 45) return this.fail('Lost the connection to the host.');
    if (this.peer.disconnected && !this.peer.destroyed) { try { this.peer.reconnect(); } catch { /* below */ } }
    clearTimeout(this.retryT);
    this.retryT = setTimeout(() => { if (!this.peer.destroyed) this.connect(); }, 2000);
  }

  onMessage(m) {
    if (!m || typeof m !== 'object') return;
    this.lastSeen = Date.now();
    if (m.t === 'part') {
      if (this.parts?.id !== m.id) this.parts = { id: m.id, got: [] };
      this.parts.got[m.i] = m.s;
      if (this.parts.got.filter((x) => x != null).length === m.n) { const whole = this.parts.got.join(''); this.parts = null; try { this.onMessage(JSON.parse(whole)); } catch { /* the next update fixes it */ } }
      return;
    }
    if (m.t === 'ping') { try { this.conn?.send({ t: 'pong' }); } catch { /* closed */ } return; }
    if (m.t === 'lobby') {
      this.lobby = m; this.you = m.you;
      if (!m.started) { this.state = null; this.status = 'lobby'; } else if (this.state) this.status = 'game';
    } else if (m.t === 'state') {
      this.state = m.state; this.you = m.you; this.status = 'game';
    } else if (m.t === 'react') {
      this.reactions = [...this.reactions.slice(-9), { id: Math.random(), side: m.side, k: m.k, at: Date.now() }];
    } else if (m.t === 'ended') {
      this.status = 'ended'; this.error = m.reason || 'The room closed.';
      this.peer.destroy();
    }
    this.emit();
  }

  answer(value) {
    const reqId = this.state?.request?.id;
    try { this.conn?.send({ t: 'answer', reqId, value }); } catch { /* reconnecting */ }
    if (this.state?.request) { this.state = { ...this.state, request: null }; this.emit(); } // no double answers
  }
  pick(sel) { try { this.conn?.send({ t: 'pick', sel }); } catch { /* reconnecting */ } }
  react(k) { try { this.conn?.send({ t: 'react', k }); } catch { /* reconnecting */ } }
  get spectating() { return this.you === -1; }
  fail(msg) { this.status = 'error'; this.error = msg; this.emit(); }
  rejoin() {
    if (this.peer.destroyed) return;
    clearTimeout(this.retryT); this.retries = 0; this.status = 'reconnecting'; this.error = ''; this.emit();
    if (this.peer.disconnected) this.peer.reconnect(); else this.connect();
  }
  close() { clearTimeout(this.retryT); clearInterval(this.beat); document.removeEventListener('visibilitychange', this.onVisible); this.status = 'ended'; this.peer?.destroy(); }
}

// The friend's side of a game: looks enough like the engine's Game for the game screen (state, answer, and the
// helpers the coach's Suggest reads), but every answer goes to the host.
export class RemoteGame {
  constructor(client) { this.client = client; this.trail = []; this.crashed = null; this.remote = true; this.random = Math.random; }
  get state() { return this.client.state; }
  answer(v) { this.client.answer(v); }
  begin() {}
  roster(side) { return Object.values(this.state.players).filter((p) => p.side === side); }
  dir(side) { return this.state.teams[side].dir; }
  team(side) { return this.state.teams[side]; }
  get stats() { return { downs: this.state.log.filter((e) => e.kind === 'down').length }; }
  shuffle(a) { const r = [...a]; for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; } return r; }
}
