import { ACTION_KEYS, INPUT_RATE, PROTOCOL_VERSION, normalizeControls, normalizeLoadout, normalizeName } from './net-protocol.js';
import { NetworkMotion } from './network-motion.js';

const loopback = host => ['localhost', '127.0.0.1', '[::1]', '::1'].includes(host);
const fallbackClock = () => globalThis.performance?.now?.() ?? Date.now();
const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));
const failure = (code, message) => Object.assign(new Error(message), { code });
const SESSION_PREFIX = 'neck-and-neck.session.v1:';

export function defaultEndpoint(location = globalThis.location) {
  return location && loopback(location.hostname) ? 'ws://127.0.0.1:8787' : null;
}

export function validateEndpoint(endpoint, location = globalThis.location) {
  const value = endpoint || defaultEndpoint(location);
  if (!value) throw failure('MISSING_ENDPOINT', 'Online play needs a running game server. Enter its secure WebSocket address.');
  let parsed;
  try { parsed = new URL(value); } catch { throw failure('INVALID_ENDPOINT', 'Enter a valid ws:// or wss:// game server address.'); }
  if (!['ws:', 'wss:'].includes(parsed.protocol) || parsed.username || parsed.password || parsed.search || parsed.hash) throw failure('INVALID_ENDPOINT', 'Use a WebSocket address without credentials, query parameters, or fragments.');
  if (location?.protocol === 'https:' && parsed.protocol === 'ws:' && !loopback(parsed.hostname)) throw failure('INSECURE_ENDPOINT', 'This HTTPS page requires a secure wss:// server connection.');
  return parsed.href;
}

/** Native WebSocket client. No service credentials are accepted or exposed.
 * connect(endpoint,{name,loadout}) resolves after welcome; subscribe receives state.
 * onMatch receives {matchId,playerId,team,localTeam,mode,roomCode}; onEvent receives
 * deduplicated game events, plus {type:'match.end',reason,winner,score,matchId}.
 * sample(dtSeconds,controls,nowMilliseconds) returns a game-like render view or null.
 * Menu pause only neutralizes this player's input; it never pauses the server.
 */
export class NetworkClient {
  constructor({ WebSocketImpl = globalThis.WebSocket, clock = fallbackClock, storage, location = globalThis.location, timers = globalThis, random = Math.random, reconnect = true, autoBind = true } = {}) {
    this.WebSocketImpl = WebSocketImpl; this.clock = clock; this.location = location; this.timers = timers; this.random = random;
    try { this.storage = storage === undefined ? globalThis.sessionStorage : storage; } catch { this.storage = null; }
    this.autoReconnect = reconnect; this._disposed = false; this._manual = false; this._generation = 0;
    this.socket = null; this._tokens = new Map(); this._sessionToken = null; this._seq = 0;
    this._listeners = new Set(); this._eventListeners = new Set(); this._matchListeners = new Set();
    this._events = new Set(); this._eventOrder = []; this._pendingEdges = []; this._latestInput = normalizeControls({});
    this._lastInputAt = -Infinity; this._paused = false; this._blurred = false;
    this._inputTimer = this._heartbeatTimer = this._reconnectTimer = this._welcomeTimer = null;
    this._attempt = 0; this._connectPending = null; this._pings = new Map(); this._pingId = 0; this._lastHeard = 0;
    this.motion = new NetworkMotion();
    this.state = { status: 'idle', connection: 'idle', endpoint: null, error: null, rtt: 0, room: null, queue: null, match: null, localPlayerId: null, localTeam: null, memberId: null };
    this.options = { name: 'Tall Friend', loadout: normalizeLoadout() };
    this._blur = () => { this._blurred = true; this.neutralize(); };
    this._focus = () => { this._blurred = false; };
    this._visibility = () => { if (globalThis.document?.hidden) this._blur(); else this._focus(); };
    this._bound = autoBind && !!globalThis.window?.addEventListener;
    if (this._bound) {
      globalThis.window.addEventListener('blur', this._blur); globalThis.window.addEventListener('focus', this._focus);
      globalThis.document?.addEventListener('visibilitychange', this._visibility);
    }
  }

  get localPlayerId() { return this.state.localPlayerId; }
  get localTeam() { return this.state.localTeam; }
  getState() { return clone(this.state); }
  subscribe(listener) { this._listeners.add(listener); listener(this.getState()); return () => this._listeners.delete(listener); }
  onEvent(listener) { this._eventListeners.add(listener); return () => this._eventListeners.delete(listener); }
  onMatch(listener) { this._matchListeners.add(listener); return () => this._matchListeners.delete(listener); }
  _notify() { for (const listener of this._listeners) { try { listener(this.getState()); } catch {} } }
  _status(status, error = null) { this.state.status = this.state.connection = status; this.state.error = error ? { code: error.code || 'NETWORK_ERROR', message: error.message } : null; this._notify(); }
  _error(code, message) { this.state.error = { code, message }; this._notify(); return false; }
  _emit(event) { for (const listener of this._eventListeners) { try { listener(clone(event)); } catch {} } }

  _storageKey() { return `${SESSION_PREFIX}${this.state.endpoint}`; }
  _readSession() {
    const memory = this._tokens.get(this.state.endpoint);
    if (memory) return memory;
    try {
      const saved = JSON.parse(this.storage?.getItem(this._storageKey()) || 'null');
      if (saved && typeof saved.token === 'string' && saved.token.length >= 16 && saved.token.length <= 256) return { token: saved.token, seq: Number.isSafeInteger(saved.seq) && saved.seq >= 0 ? saved.seq : 0 };
    } catch {}
    return null;
  }
  _saveSession() {
    if (!this._sessionToken) return;
    const saved = { token: this._sessionToken, seq: this._seq };
    this._tokens.set(this.state.endpoint, saved);
    try { this.storage?.setItem(this._storageKey(), JSON.stringify(saved)); } catch {}
  }

  connect(endpoint, options = {}) {
    if (this._disposed) return Promise.reject(failure('DISPOSED', 'This online client has been closed.'));
    let address;
    try { address = validateEndpoint(endpoint, this.location); }
    catch (error) { this._stopConnection(); this._manual = true; this._generation++; this._status('offline', error); return Promise.reject(error); }
    if (!this.WebSocketImpl) { const error = failure('UNSUPPORTED', 'This browser does not support WebSocket online play.'); this._status('offline', error); return Promise.reject(error); }
    this._stopConnection(); this._generation++; this._manual = false; this._attempt = 0;
    this.options = { name: normalizeName(options.name ?? this.options.name), loadout: normalizeLoadout(options.loadout ?? this.options.loadout) };
    if (this.state.endpoint !== address) { this.motion.clear(); this.state.match = this.state.room = this.state.queue = null; this.state.localPlayerId = this.state.localTeam = null; }
    this.state.endpoint = address;
    const saved = this._readSession(); this._sessionToken = saved?.token || null; this._seq = saved?.seq || 0;
    const pending = new Promise((resolve, reject) => { this._connectPending = { resolve, reject }; });
    this._open(false);
    return pending;
  }

  _open(resuming) {
    const generation = this._generation;
    this._status(resuming ? 'reconnecting' : 'connecting');
    let socket;
    try { socket = new this.WebSocketImpl(this.state.endpoint); }
    catch { this._failed(failure('CONNECTION_FAILED', 'The game server could not be reached. Check its address and that it is running.')); return; }
    this.socket = socket;
    const active = () => !this._disposed && generation === this._generation && socket === this.socket;
    socket.onopen = () => {
      if (!active()) return;
      this._lastHeard = this.clock();
      this._send({ type: 'hello', version: PROTOCOL_VERSION, ...this.options, ...(this._sessionToken ? { sessionToken: this._sessionToken } : {}) }, true);
    };
    socket.onmessage = message => { if (active()) this._receive(message.data); };
    socket.onerror = () => { if (active()) this._error('CONNECTION_FAILED', 'The game server is unavailable. Check its address and that it is running.'); };
    socket.onclose = event => {
      if (!active()) return;
      this.socket = null; this._clearTimers(); this._pendingEdges = []; this._latestInput = normalizeControls({}); this.motion.neutralize();
      if (event?.code === 4001) {
        this._manual = true;
        const error = failure('SESSION_MOVED', 'Your session continued in another tab. Connect again here to take control.');
        this._connectPending?.reject(error); this._connectPending = null; this._status('offline', error); return;
      }
      this._failed(failure('CONNECTION_CLOSED', this.state.match ? 'Connection lost. Rejoining your match…' : 'The game server disconnected.'));
    };
    this._welcomeTimer = this.timers.setTimeout(() => {
      if (!active() || this.state.status === 'connected') return;
      this._stopSocket(); this._failed(failure('CONNECTION_TIMEOUT', 'The game server did not respond. Check that it is running.'));
    }, 8000);
  }

  _failed(error) {
    if (this._connectPending) { this._connectPending.reject(error); this._connectPending = null; }
    if (this._disposed || this._manual) return;
    if (this.autoReconnect && this._sessionToken && this._attempt < 6) {
      const wait = Math.min(8000, 500 * 2 ** this._attempt++) * (1 + this.random() * .15);
      this._status('reconnecting', error);
      this._reconnectTimer = this.timers.setTimeout(() => { this._reconnectTimer = null; this._open(true); }, wait);
    } else this._status('offline', this.state.match ? failure(error.code, 'Connection lost. The server could not be reached. Reconnect from the Party Post to continue.') : error);
  }

  _send(message, handshake = false) {
    if (!this.socket || this.socket.readyState !== 1 || (!handshake && this.state.status !== 'connected')) return false;
    if ((this.socket.bufferedAmount || 0) > 65536) return this._error('CONNECTION_SLOW', 'The connection is congested. Waiting for the server…');
    try { this.socket.send(JSON.stringify(message)); return true; }
    catch { return this._error('SEND_FAILED', 'Your action could not reach the game server.'); }
  }
  _command(type, fields = {}) {
    if (!this._send({ type, ...fields })) return this._error('NOT_CONNECTED', 'Connect to a running game server first.');
    return true;
  }

  _receive(data) {
    if (typeof data !== 'string' || data.length > 131072) return;
    let packet;
    try { packet = JSON.parse(data); } catch { return this._error('INVALID_MESSAGE', 'The server sent an unreadable message.'); }
    if (!packet || typeof packet.type !== 'string') return;
    this._lastHeard = this.clock();
    switch (packet.type) {
      case 'welcome': {
        if (packet.version !== PROTOCOL_VERSION || typeof packet.id !== 'string' || typeof packet.sessionToken !== 'string' || packet.sessionToken.length < 16 || packet.sessionToken.length > 256) { const error = failure('PROTOCOL_MISMATCH', 'This server uses an incompatible game protocol.'); this._stopConnection(false); this._connectPending?.reject(error); this._connectPending = null; this._status('offline', error); return; }
        this.timers.clearTimeout(this._welcomeTimer); this._welcomeTimer = null;
        if (this.state.match && !this.state.match.ended && (!packet.resumed || packet.matchId === null)) this._finishUnavailableMatch();
        if (!packet.resumed) { this.motion.clear(); this._events.clear(); this._eventOrder = []; this._seq = 0; this.state.match = this.state.room = this.state.queue = null; this.state.localPlayerId = this.state.localTeam = null; }
        this._sessionToken = packet.sessionToken; this.state.memberId = packet.id; this._saveSession(); this._attempt = 0;
        this._status('connected');
        this._connectPending?.resolve(this.getState()); this._connectPending = null;
        this._startTimers();
        break;
      }
      case 'room': this.state.room = clone(packet.room); this._notify(); break;
      case 'queue': this.state.queue = { status: packet.status, mode: packet.mode, partySize: packet.partySize }; this._notify(); break;
      case 'match': {
        if (typeof packet.matchId !== 'string' || !Number.isSafeInteger(packet.playerId) || ![0, 1].includes(packet.localTeam ?? packet.team)) return;
        const fresh = this.state.match?.matchId !== packet.matchId;
        if (fresh) { this.motion.clear(); this._events.clear(); this._eventOrder = []; this._pendingEdges = []; this._latestInput = normalizeControls({}); }
        const match = { matchId: packet.matchId, playerId: packet.playerId, team: packet.team, localTeam: packet.localTeam ?? packet.team, mode: packet.mode, roomCode: packet.roomCode };
        this.state.match = match; this.state.localPlayerId = packet.playerId; this.state.localTeam = match.localTeam;
        this.motion.setLocal(packet.playerId, match.localTeam); this._notify();
        for (const listener of this._matchListeners) { try { listener({ ...clone(match), resumed: !fresh }); } catch {} }
        break;
      }
      case 'snapshot':
        if (packet.matchId !== this.state.match?.matchId) return;
        if (this.motion.push(packet, this.clock(), this.state.rtt)) {
          if (Number.isSafeInteger(packet.ack)) this._seq = Math.max(this._seq, packet.ack);
          this._saveSession();
        }
        break;
      case 'events':
        if (packet.matchId !== this.state.match?.matchId || !Array.isArray(packet.events)) return;
        for (const event of packet.events.slice(0, 128)) {
          if (!event || typeof event.type !== 'string' || !Number.isSafeInteger(event.id)) continue;
          const key = `${packet.matchId}:${event.id}`;
          if (this._events.has(key)) continue;
          this._rememberEvent(key); this._emit(event);
        }
        break;
      case 'match.end': {
        if (packet.matchId !== this.state.match?.matchId || this._events.has(`end:${packet.matchId}`)) return;
        this._rememberEvent(`end:${packet.matchId}`);
        this.state.match = { ...this.state.match, ended: true, reason: packet.reason, winner: packet.winner, score: clone(packet.score) };
        this.neutralize(); this._notify(); this._emit({ ...packet, type: 'match.end' });
        break;
      }
      case 'pong': {
        const sent = this._pings.get(packet.id);
        if (sent === undefined) return;
        this._pings.delete(packet.id);
        const rtt = Math.max(0, Math.min(5000, this.clock() - sent));
        this.state.rtt = this.state.rtt ? this.state.rtt * .7 + rtt * .3 : rtt;
        this._notify(); break;
      }
      case 'error': {
        const code = typeof packet.code === 'string' ? packet.code : 'SERVER_ERROR', message = typeof packet.message === 'string' ? packet.message.slice(0, 240) : 'The server could not complete that action.';
        if (this.state.status === 'connecting' || this.state.status === 'reconnecting') {
          const error = failure(code, message); this._stopConnection(false); this._connectPending?.reject(error); this._connectPending = null; this._status('offline', error);
        } else this._error(code, message);
        break;
      }
      default: break;
    }
  }

  _rememberEvent(key) {
    this._events.add(key); this._eventOrder.push(key);
    if (this._eventOrder.length > 512) this._events.delete(this._eventOrder.shift());
  }
  _finishUnavailableMatch() {
    const matchId = this.state.match.matchId, score = clone(this.motion.snapshots.at(-1)?.state.score || [0, 0]);
    this.state.match = { ...this.state.match, ended: true, reason: 'reconnect-expired', winner: null, score };
    this._emit({ type: 'match.end', matchId, reason: 'reconnect-expired', winner: null, score, message: 'That match ended while you were disconnected. Its final result is unavailable.' });
  }
  _startTimers() {
    this._clearTimers();
    this._inputTimer = this.timers.setInterval(() => this._flushInput(), 1000 / INPUT_RATE);
    this._heartbeatTimer = this.timers.setInterval(() => {
      if (this.clock() - this._lastHeard > 20000) { try { this.socket?.close(4000, 'Heartbeat timeout'); } catch {} return; }
      const id = ++this._pingId, clientTime = this.clock(); this._pings.set(id, clientTime);
      if (this._pings.size > 8) this._pings.delete(this._pings.keys().next().value);
      this._send({ type: 'ping', id, clientTime });
    }, 5000);
  }
  _clearTimers() {
    for (const key of ['_inputTimer', '_heartbeatTimer']) { if (this[key] != null) this.timers.clearInterval(this[key]); this[key] = null; }
    for (const key of ['_reconnectTimer', '_welcomeTimer']) { if (this[key] != null) this.timers.clearTimeout(this[key]); this[key] = null; }
    this._pings.clear();
  }

  _flushInput(force = false) {
    if (!this.state.match || this.state.match.ended || this.state.status !== 'connected') return false;
    const now = this.clock();
    if (!force && now - this._lastInputAt + 1e-6 < 1000 / INPUT_RATE) return false;
    const inactive = this._paused || this._blurred;
    const edge = inactive ? null : this._pendingEdges[0];
    const controls = { ...this._latestInput };
    for (const key of ACTION_KEYS) controls[key] = !inactive && !!edge?.[key];
    if (inactive) { controls.x = 0; controls.z = 0; }
    const seq = this._seq + 1;
    if (!this._send({ type: 'input', seq, controls })) return false;
    this._seq = seq; this._lastInputAt = now;
    if (edge) this._pendingEdges.shift();
    this._saveSession(); return true;
  }

  sample(dt, input = {}, now = this.clock()) {
    const controls = normalizeControls(input) || normalizeControls({});
    const inactive = this._paused || this._blurred;
    if (!inactive) {
      this._latestInput = { ...controls };
      const edges = Object.fromEntries(ACTION_KEYS.filter(key => controls[key]).map(key => [key, true]));
      if (Object.keys(edges).length && this.state.status === 'connected' && !this.state.match?.ended) {
        if (this._pendingEdges.length < 128) this._pendingEdges.push(edges);
        else this._error('INPUT_OVERFLOW', 'Too many actions arrived at once. Release the controls and try again.');
      }
    }
    this._flushInput();
    return this.motion.sample(dt, inactive ? normalizeControls({}) : controls, now, { paused: inactive, connected: this.state.status === 'connected' });
  }

  setPaused(value) { const next = !!value; if (next && !this._paused) this.neutralize(); this._paused = next; }
  neutralize() {
    this._latestInput = { ...this._latestInput, x: 0, z: 0 };
    for (const key of ACTION_KEYS) this._latestInput[key] = false;
    this._pendingEdges = []; this.motion.neutralize(); this._flushInput(true);
  }
  setName(name) { this.options.name = normalizeName(name); return this.state.status === 'connected' ? this._command('profile.update', this.options) : true; }
  setLoadout(loadout) { this.options.loadout = normalizeLoadout(loadout); return this.state.status === 'connected' ? this._command('profile.update', this.options) : true; }
  createRoom(mode = '2v2') { return this._command('room.create', { mode }); }
  joinRoom(code) { return this._command('room.join', { code: String(code || '').trim().toUpperCase().slice(0, 12) }); }
  setMode(mode) { return this._command('room.mode', { mode }); }
  setTeam(team) { return this._command('room.team', { team }); }
  startMatch() { return this._command('room.start'); }
  leaveRoom() { this.neutralize(); return this._command('room.leave'); }
  joinQueue(mode = '1v1') { return this._command('queue.join', { mode }); }
  cancelQueue() { return this._command('queue.cancel'); }

  _stopSocket() {
    const socket = this.socket; this.socket = null;
    if (!socket) return;
    socket.onopen = socket.onmessage = socket.onclose = socket.onerror = null;
    try { socket.close(1000, 'Client closed'); } catch {}
  }
  _stopConnection(reject = true) {
    this._clearTimers(); this._stopSocket(); this._pendingEdges = []; this._latestInput = normalizeControls({}); this.motion.neutralize();
    if (reject && this._connectPending) { this._connectPending.reject(failure('CANCELLED', 'Connection cancelled.')); this._connectPending = null; }
  }
  disconnect() { this.neutralize(); this._manual = true; this._generation++; this._stopConnection(); this._status('closed'); }
  dispose() {
    if (this._disposed) return;
    this.disconnect(); this._disposed = true; this.motion.clear(); this._tokens.clear(); this._sessionToken = null;
    this._listeners.clear(); this._eventListeners.clear(); this._matchListeners.clear(); this._events.clear(); this._eventOrder = [];
    if (this._bound) { globalThis.window.removeEventListener('blur', this._blur); globalThis.window.removeEventListener('focus', this._focus); globalThis.document?.removeEventListener('visibilitychange', this._visibility); }
  }
}
