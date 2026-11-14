import assert from 'node:assert/strict';
import { WebSocket } from 'ws';
import { createGameServer } from '../server/game-server.mjs';
import { NetworkClient } from '../src/network-client.js';

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const until = async (predicate, timeout = 4500) => {
  const end = Date.now() + timeout;
  while (!predicate()) { assert(Date.now() < end, 'Room reset timed out'); await delay(10); }
};
const server = createGameServer({ port: 0, maxRooms: 1, maxCommandsPerSecond: 100, reconnectGraceMs: 150, sessionTtlMs: 500 });
const peers = Array.from({ length: 2 }, () => new NetworkClient({ WebSocketImpl: WebSocket, storage: null, autoBind: false }));
try {
  const address = await server.start();
  await Promise.all(peers.map((client, i) => client.connect(address.url, { name: `Reset ${i}` })));
  const [a, b] = peers;
  for (let round = 0; round < 3; round++) {
    a.createRoom('1v1'); await until(() => a.getState().room?.code);
    b.joinRoom(a.getState().room.code); await until(() => a.getState().room?.members.length === 2);
    a.startMatch(); await until(() => peers.every(p => p.getState().match && p.motion.snapshots.length));
    const oldMatch = a.getState().match.matchId;
    a.sample(.016, { serve: true, swing: true, x: 1 });
    a.leaveRoom(); b.leaveRoom();
    for (const peer of peers) {
      assert.equal(peer.getState().match, null, 'Leave clears match before server acknowledgement');
      assert.equal(peer.getState().room, null);
      assert.equal(peer.localPlayerId, null);
      assert.equal(peer.motion.snapshots.length, 0);
      assert.equal(peer._pendingEdges.length, 0);
    }
    await until(() => server.metrics().rooms === 0 && server.metrics().matches === 0, 600);
    a._receive(JSON.stringify({ type: 'match.end', matchId: oldMatch, score: [0, 7], winner: 1 }));
    assert.equal(a.getState().match, null, 'Late events cannot revive an abandoned match');
  }
  // One player remains on results: their private court must still stop now.
  a.createRoom('1v1'); await until(() => a.getState().room?.code);
  b.joinRoom(a.getState().room.code); await until(() => a.getState().room?.members.length === 2);
  a.startMatch(); await until(() => peers.every(p => p.getState().match));
  a.leaveRoom();
  await until(() => b.getState().match?.ended && b.getState().room?.status === 'lobby', 600);
  assert.equal(server.metrics().rooms, 1, 'Private party survives without a running match');
  assert.equal(server.metrics().matches, 0);
  const steps = server.metrics().physicsSteps;
  const initialPose = b.sample(0, {});
  const animatedPose = b.sample(.1, {});
  assert(animatedPose.players.some((p, i) => p.y !== initialPose.players[i].y), 'Client keeps victory ragdolls moving');
  for (let i = 0; i < 40; i++) assert(Number.isFinite(b.sample(.1, {}).players[0].head.y));
  assert.equal(b.sample(0, {}).celebrationRemaining, 0);
  await delay(150);
  assert.equal(server.metrics().physicsSteps, steps, 'Results screens consume no server physics');
  b.leaveRoom(); await until(() => server.metrics().rooms === 0);
  a.joinQueue('1v1'); b.joinQueue('1v1');
  await until(() => peers.every(p => p.getState().match && !p.getState().match.ended));
  a.leaveRoom();
  await until(() => b.getState().match?.ended && !b.getState().room, 600);
  assert.equal(server.metrics().rooms, 0, 'A finished matchmaking court does not persist as an idle party');
  assert.equal(server.metrics().matches, 0);
  a.joinQueue('1v1'); b.joinQueue('1v1');
  await until(() => peers.every(p => p.getState().match && !p.getState().match.ended));
  // Simulate abrupt tab/network loss, not the explicit leave command.
  for (const peer of peers) { peer._manual = true; peer.socket.terminate(); }
  await until(() => server.metrics().rooms === 0 && server.metrics().matches === 0, 1000);
  await until(() => server.metrics().sessions === 0, 1500);
  console.log('PASS reset: repeated leave/rejoin, immediate empty-court release, temporary queue room cleanup, stale-packet isolation and disconnected-session expiry.');
} finally { peers.forEach(peer => peer.dispose()); await server.close(); }
