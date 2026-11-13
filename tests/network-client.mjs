import assert from 'node:assert/strict';
import { WebSocket } from 'ws';
import { NetworkClient, defaultEndpoint, validateEndpoint } from '../src/network-client.js';
import { NetworkMotion, validSnapshot } from '../src/network-motion.js';
import { VolleyballGame } from '../src/physics.js';
import { snapshotState } from '../src/net-protocol.js';
import { createGameServer } from '../server/game-server.mjs';

class Timers {
  constructor() { this.now = 0; this.id = 0; this.jobs = new Map(); }
  setTimeout = (fn, delay) => this.add(fn, delay, false);
  clearTimeout = id => this.jobs.delete(id);
  setInterval = (fn, delay) => this.add(fn, delay, true);
  clearInterval = id => this.jobs.delete(id);
  add(fn, delay, interval) { const id = ++this.id; this.jobs.set(id, { fn, at: this.now + delay, delay, interval }); return id; }
  advance(ms) {
    const end = this.now + ms;
    for (;;) {
      const next = [...this.jobs].filter(([, job]) => job.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
      if (!next) break;
      const [id, job] = next; this.now = job.at;
      if (job.interval) job.at += job.delay; else this.jobs.delete(id);
      job.fn();
    }
    this.now = end;
  }
}
class Socket {
  static instances = [];
  constructor(url) { this.url = url; this.readyState = 0; this.bufferedAmount = 0; this.sent = []; Socket.instances.push(this); }
  open() { this.readyState = 1; this.onopen?.(); }
  send(text) { assert.equal(this.readyState, 1); this.sent.push(JSON.parse(text)); }
  receive(packet) { this.onmessage?.({ data: JSON.stringify(packet) }); }
  close(code = 1000) { this.readyState = 3; this.onclose?.({ code }); }
}
const epoch = 1700000000000, session = 'test-session-token-0123456789012345';
const store = { data: new Map(), getItem(key) { return this.data.get(key) || null; }, setItem(key, value) { this.data.set(key, value); } };
function state() { const game = new VolleyballGame({ mode: '1v1' }); game.start(); game.phase = 'play'; game.players.forEach(p => { p.human = true; }); return snapshotState(game); }
function snapshot(seq, time, game = state(), ack = 0) { return { type: 'snapshot', matchId: 'match-1', seq, time: epoch + time, ack, state: game }; }
function match(socket) { socket.receive({ type: 'match', matchId: 'match-1', playerId: 1, team: 1, localTeam: 1, mode: '1v1', roomCode: 'ABCDEF' }); }
async function connected({ timers = new Timers(), storage = store, ...options } = {}) {
  const client = new NetworkClient({ WebSocketImpl: Socket, timers, clock: () => timers.now, storage, autoBind: false, random: () => 0, ...options });
  const pending = client.connect('ws://127.0.0.1:8787', { name: '  Twig\u0000 Friend  ', loadout: { ability: 'spring' } });
  const socket = Socket.instances.at(-1); socket.open(); socket.receive({ type: 'welcome', version: 1, id: 'member-1', sessionToken: session, resumed: false });
  await pending; return { client, socket, timers };
}

assert.equal(defaultEndpoint({ hostname: 'localhost' }), 'ws://127.0.0.1:8787');
assert.equal(defaultEndpoint({ hostname: 'example.com' }), null);
assert.throws(() => validateEndpoint(null, { hostname: 'example.com', protocol: 'https:' }), { code: 'MISSING_ENDPOINT' });
assert.throws(() => validateEndpoint('ws://game.example', { protocol: 'https:' }), { code: 'INSECURE_ENDPOINT' });
for (const endpoint of ['https://game.example', 'ws://user:password@game.example', 'wss://game.example?token=not-allowed', 'wss://game.example/#fragment']) assert.throws(() => validateEndpoint(endpoint));
assert.equal(validateEndpoint('wss://game.example/socket', { protocol: 'https:' }), 'wss://game.example/socket');

const { client, socket, timers } = await connected();
assert.equal(client.getState().connection, 'connected'); assert.equal(socket.sent[0].name, 'Twig Friend');
assert(!JSON.stringify(client.getState()).includes(session)); assert(!socket.url.includes(session));
let notices = 0; const unsubscribe = client.subscribe(() => notices++);
let matches = 0; client.onMatch(() => matches++); const events = []; client.onEvent(event => events.push(event));
client.createRoom('1v1'); client.joinRoom(' ab12 '); client.setMode('2v2'); client.setTeam(1); client.startMatch(); client.joinQueue('2v2'); client.cancelQueue();
client.setName('Willow'); client.setLoadout({ ability: 'shield' });
assert(socket.sent.some(packet => packet.type === 'room.join' && packet.code === 'AB12'));
assert(socket.sent.some(packet => packet.type === 'profile.update' && packet.loadout.ability === 'shield'));
socket.receive({ type: 'room', room: { code: 'AB12', members: [{ id: 'member-1', name: 'Willow' }] } });
assert.equal(client.getState().room.code, 'AB12'); const external = client.getState(); external.room.code = 'mutated'; assert.equal(client.getState().room.code, 'AB12');
match(socket); assert.equal(matches, 1); assert.equal(client.localPlayerId, 1); assert.equal(client.localTeam, 1);
socket.receive(snapshot(1, 0));
const originalSnapshot = JSON.stringify(client.motion.snapshots[0]);
const originalX = client.motion.snapshots[0].state.players[1].x;
for (let frame = 0; frame < 35; frame++) {
  timers.advance(1000 / 240);
  client.sample(1 / 240, { x: -1, neckYaw: 2.1, neckPitch: .4, swing: [2, 3, 4].includes(frame) });
}
for (let frame = 0; frame < 40; frame++) { timers.advance(1000 / 240); client.sample(1 / 240, { x: -1, neckYaw: 2.1 }); }
const inputs = socket.sent.filter(packet => packet.type === 'input');
assert.equal(inputs.filter(packet => packet.controls.swing).length, 3, 'every high-refresh edge is delivered once, even repeated edges of the same action');
assert.equal(client._pendingEdges.length, 0);
assert(inputs.length <= 11, 'movement transport is limited to30Hz');
assert(inputs.every((packet, index) => !index || packet.seq > inputs[index - 1].seq));
const predicted = client.sample(1 / 240, {}).players.find(p => p.id === 1);
assert(predicted.x < originalX, 'local movement begins before another server snapshot');
assert(Math.abs(predicted.neck.yaw - 2.1) < 1e-12, 'neck target responds independently without waiting for the server');
assert.equal(client.motion.ghost.players[0]._swingBuffer, 0, 'one action must not repeat across prediction substeps');
assert.equal(JSON.stringify(client.motion.snapshots[0]), originalSnapshot, 'prediction cannot mutate server-owned state');
assert.equal(client.sample(0, {}).players.filter(p => p.human).length, 1);
assert.deepEqual(client.sample(0, {}).players.map(p => p.id), [0, 1]);
assert(JSON.stringify(predicted).includes('neckPoints'));
client.setPaused(true); assert.equal(socket.sent.at(-1).controls.x, 0); assert.equal(socket.sent.at(-1).controls.swing, false);
client.sample(.01, { x: 1, swing: true }); assert.equal(client._pendingEdges.length, 0); client.setPaused(false);
client._blur(); assert.equal(socket.sent.at(-1).controls.x, 0); client._focus();
socket.receive({ type: 'events', matchId: 'match-1', events: [{ id: 3, type: 'hit' }, { id: 2, type: 'jump' }, { id: 3, type: 'hit' }] });
assert.equal(events.length, 2, 'events deduplicate while preserving unseen reordered events');
socket.receive({ type: 'error', code: 'ROOM_FULL', message: 'That court is full.' }); assert.equal(client.getState().error.code, 'ROOM_FULL');
timers.advance(5000);
const ping = socket.sent.find(packet => packet.type === 'ping'); assert(ping);
timers.advance(40); socket.receive({ type: 'pong', id: ping.id, clientTime: ping.clientTime, serverTime: epoch + timers.now });
assert(client.getState().rtt >= 40);

// Resume carries the session only in JSON and resumes an increasing input sequence.
const lastSeq = client._seq; socket.close(); assert.equal(client.getState().connection, 'reconnecting');
timers.advance(500); const replacement = Socket.instances.at(-1); assert.notEqual(replacement, socket); replacement.open();
assert.equal(replacement.sent[0].sessionToken, session); assert(!replacement.url.includes(session));
replacement.receive({ type: 'welcome', version: 1, id: 'member-1', sessionToken: session, resumed: true }); match(replacement);
assert.equal(matches, 2, 'resume notifies the app so it can return from a lobby or local pause without rebuilding its renderer');
replacement.receive(snapshot(20, timers.now, state(), lastSeq)); timers.advance(40); client.sample(.016, { x: -1 });
const resumedInput = replacement.sent.find(packet => packet.type === 'input'); assert(resumedInput.seq > lastSeq); assert.equal(resumedInput.controls.swing, false);
replacement.receive({ type: 'match.end', matchId: 'match-1', reason: 'forfeit', winner: 1, score: [0, 7] });
assert.equal(events.at(-1).type, 'match.end'); assert.equal(client.getState().match.ended, true);
assert(client.sample(.016, {}), 'final view remains available for results/celebration');
unsubscribe(); assert(notices > 3); client.dispose(); client.dispose(); assert.equal(timers.jobs.size, 0); assert.equal(client.socket, null); assert.equal(client.motion.snapshots.length, 0);
assert.equal(client._listeners.size, 0);

const expired = await connected({ storage: null }); match(expired.socket); expired.socket.receive(snapshot(1, 0));
const expiredEvents = []; expired.client.onEvent(event => expiredEvents.push(event));
expired.socket.close(); expired.timers.advance(500);
const expiredSocket = Socket.instances.at(-1); expiredSocket.open(); expiredSocket.receive({ type: 'welcome', version: 1, id: 'member-1', sessionToken: session, resumed: true, matchId: null });
assert.equal(expiredEvents[0].reason, 'reconnect-expired'); assert.equal(expiredEvents[0].winner, null);
assert.equal(expired.client.getState().match.ended, true); expired.client.dispose(); assert.equal(expired.timers.jobs.size, 0);
const restarted = await connected({ storage: null });
match(restarted.socket);restarted.socket.close();restarted.timers.advance(500);
const staleSocket=Socket.instances.at(-1);staleSocket.open();
staleSocket.receive({type:'error',code:'SESSION_EXPIRED',message:'Session expired'});
const freshSocket=Socket.instances.at(-1);assert.notEqual(freshSocket,staleSocket);freshSocket.open();
assert.equal(freshSocket.sent[0].sessionToken,undefined);
freshSocket.receive({type:'welcome',version:1,id:'new-member',sessionToken:session+'fresh',resumed:false});
assert.equal(restarted.client.getState().connection,'connected');assert.equal(restarted.client.getState().room,null);
assert.equal(restarted.client.getState().match,null);restarted.client.dispose();
const moved = await connected({ storage: null }); moved.socket.close(4001);
assert.equal(moved.client.getState().error.code, 'SESSION_MOVED'); moved.timers.advance(10000);
assert.equal(moved.timers.jobs.size, 0, 'a session moved to another tab cannot enter a reconnect tug of war'); moved.client.dispose();

// Choosing Leave while offline cancels reconnection and discards resume state.
const exitStore = { data: new Map(), getItem(key) { return this.data.get(key); }, setItem(key, value) { this.data.set(key, value); } };
const exiting = await connected({ storage: exitStore }); match(exiting.socket); exiting.socket.receive(snapshot(1, 0));
exiting.socket.close(); assert.equal(exiting.client.getState().connection, 'reconnecting');
exiting.client.leaveRoom();
assert.equal(exiting.client.getState().match, null);
assert.equal(exiting.client.getState().room, null);
assert.equal(exiting.client.motion.snapshots.length, 0);
assert.equal(exiting.timers.jobs.size, 0);
const reconnectExit = exiting.client.connect('ws://127.0.0.1:8787');
const exitSocket = Socket.instances.at(-1); exitSocket.open();
assert.equal(exitSocket.sent[0].sessionToken, undefined, 'An intentional exit cannot resurrect its old match');
exitSocket.receive({ type: 'welcome', version: 1, id: 'fresh-player', sessionToken: session + '-fresh', resumed: false });
await reconnectExit; exiting.client.disconnect();
assert.equal(exitSocket.sent.at(-1).type, 'room.leave', 'Connected disconnect explicitly releases its room before closing');
exiting.client.dispose();

// Deterministic delayed interpolation, finite extrapolation and a bounded buffer.
const motion = new NetworkMotion(); motion.setLocal(1, 1);
const firstState = state(), secondState = structuredClone(firstState);
firstState.players[0].vx = secondState.players[0].vx = 2;
secondState.players[0].x += .1; secondState.players[0].head.x += .1; secondState.players[0].neckPoints.forEach(q => { q.x += .1; });
assert(motion.push(snapshot(1, 0, firstState), 0)); assert(motion.push(snapshot(2, 50, secondState), 50));
const middle = motion.sample(0, {}, 115); assert(Math.abs(middle.players[0].x - (firstState.players[0].x + .05)) < 1e-6);
assert.equal(motion.push(snapshot(1, 25), 120), false, 'out-of-order snapshots are ignored');
assert.equal(motion.push(snapshot(3, 40), 120), false, 'rewound timestamps are ignored');
const farFuture = motion.sample(0, {}, 100000);
assert(Math.abs(farFuture.players[0].x - secondState.players[0].x) <= .201, 'extrapolation cannot run beyond100ms');
for (let index = 3; index < 180; index++) motion.push(snapshot(index, index * 50), index * 50 + (index % 3) * 10);
assert.equal(motion.snapshots.length, 40);
const bad = state(); bad.players[0].neckPoints[4].x = Infinity; assert.equal(validSnapshot(bad), false);
const invalidVelocity = state(); invalidVelocity.ball.vx = 1e200; assert.equal(validSnapshot(invalidVelocity), false);
for (let index = 0; index < 120; index++) {
  const view = motion.sample(1 / 240, { x: index % 2 ? 1 : -1, neckYaw: index * .1, neckPitch: .4, extension: .9, jump: index === 10 }, 9000 + index * 1000 / 240);
  assert(view.players.every(p => Number.isFinite(p.x) && Number.isFinite(p.head.y) && p.neckPoints.every(q => ['x', 'y', 'z'].every(axis => Number.isFinite(q[axis])))));
}
const frozen = motion.sample(.1, { x: 1 }, 1e6).players[1].x;
assert.equal(motion.sample(.1, { x: 1 }, 1e6 + 1000).players[1].x, frozen, 'local prediction stops when snapshots go stale');

const timeoutTimers = new Timers(), timeoutClient = new NetworkClient({ WebSocketImpl: Socket, clock: () => timeoutTimers.now, timers: timeoutTimers, autoBind: false, storage: null });
const timeout = timeoutClient.connect('ws://127.0.0.1:8787').then(() => false, error => error.code);
timeoutTimers.advance(8000); assert.equal(await timeout, 'CONNECTION_TIMEOUT'); assert.equal(timeoutClient.getState().connection, 'offline'); timeoutClient.dispose(); assert.equal(timeoutTimers.jobs.size, 0);
console.log('PASS Network client: secure endpoints, honest offline state, room/profile commands,30Hz buffered edges, delayed interpolation, finite local neck prediction, bounded buffers, event deduplication, reconnect tokens/sequence, RTT and complete shutdown.');

// Real WebSocket integration proves the public API speaks the authoritative server.
const server = createGameServer({ port: 0 }); const address = await server.start();
const a = new NetworkClient({ WebSocketImpl: WebSocket, autoBind: false, storage: null }), b = new NetworkClient({ WebSocketImpl: WebSocket, autoBind: false, storage: null });
const until = async predicate => { const deadline = Date.now() + 4000; while (!predicate()) { if (Date.now() > deadline) throw new Error('Timed out waiting for server state'); await new Promise(resolve => setTimeout(resolve, 10)); } };
try {
  await Promise.all([a.connect(address.url, { name: 'Twig' }), b.connect(address.url, { name: 'Willow' })]);
  assert(a.createRoom('1v1')); await until(() => a.getState().room?.code);
  const code = a.getState().room.code; assert(b.joinRoom(code)); await until(() => a.getState().room?.members.length === 2);
  a.setLoadout({ ability: 'spring' }); await until(() => a.getState().room?.members.find(member => member.id === a.getState().memberId)?.loadout.ability === 'spring');
  assert(a.startMatch()); await until(() => a.getState().match && b.getState().match && a.motion.snapshots.length && b.motion.snapshots.length);
  assert.equal(a.localTeam, 0); assert.equal(b.localTeam, 1); assert.notEqual(a.localPlayerId, b.localPlayerId);
  const before = a.sample(0, {}).players.find(p => p.human).x;
  a.sample(.016, { x: 1, serve: true });
  await until(() => a.motion.snapshots.at(-1)?.state.serveStage === 'toss');
  for (let frame = 0; frame < 12; frame++) { a.sample(1 / 60, { x: 1 }); b.sample(1 / 60, {}); await new Promise(resolve => setTimeout(resolve, 16)); }
  assert(a.motion.snapshots.at(-1).state.players[0].x > before, 'the server, not only prediction, applies movement');
  assert(a.motion.snapshots.at(-1).ack >= 1);
  assert.equal(b.sample(0, {}).players.find(p => p.human).id, b.localPlayerId);
  const identity = a.localPlayerId, priorSnapshot = a.motion.latestSeq;
  a.socket.close(); await until(() => a.getState().status === 'connected' && a.motion.latestSeq > priorSnapshot);
  assert.equal(a.localPlayerId, identity, 'a real reconnect preserves the assigned physical giraffe');
  a.sample(.016, { x: 1 });
  const finalEvents = []; a.onEvent(event => finalEvents.push(event)); b.leaveRoom();
  await until(() => finalEvents.some(event => event.type === 'match.end'));
  assert.equal(a.getState().match.ended, true); assert.equal(finalEvents.at(-1).reason, 'left');
  assert(a.sample(.016, {}), 'final authoritative celebration remains renderable after match.end');
  assert(server.metrics().physicsSteps > 0);
} finally { a.dispose(); b.dispose(); await server.close(); }
console.log('PASS Native WebSocket integration: two browser clients create/join room, update equipped power, start opposed teams, receive authoritative snapshots, toss and move with acknowledgements.');
