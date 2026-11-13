import { VolleyballGame, BALL_GRAVITY } from './physics.js';
import { ACTION_KEYS, snapshotState } from './net-protocol.js';

const clamp = (value, lo, hi) => Math.max(lo, Math.min(hi, Number.isFinite(value) ? value : lo));
const mix = (a, b, t) => a + (b - a) * t;
const angle = (a, b, t) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t;
const copy = value => value == null ? value : JSON.parse(JSON.stringify(value));
const poseKeys = ['x', 'y', 'z', 'vx', 'vz', 'jump', 'swing', 'dive', 'setBounce', 'knockback', 'tumble'];

export function validSnapshot(state) {
  const safeNumbers = value => typeof value === 'number' ? Number.isFinite(value) && Math.abs(value) <= 1e6 : value && typeof value === 'object' ? Object.entries(value).every(([key, item]) => !['__proto__', 'constructor', 'prototype'].includes(key) && safeNumbers(item)) : true;
  if (!safeNumbers(state)) return false;
  const point = p => p && ['x', 'y', 'z'].every(key => Number.isFinite(p[key]) && Math.abs(p[key]) <= 1000);
  if (!state || !['attract', 'serve', 'play', 'point', 'finished'].includes(state.phase) || !point(state.ball) || !Array.isArray(state.players) || state.players.length < 1 || state.players.length > 4) return false;
  const ids = new Set();
  return state.players.every(p => {
    if (!Number.isSafeInteger(p.id) || p.id < 0 || p.id > 3 || ids.has(p.id) || ![0, 1].includes(p.team) || !point(p) || !point(p.head) || !Array.isArray(p.neckPoints) || p.neckPoints.length !== 9 || !p.neckPoints.every(point)) return false;
    ids.add(p.id);
    return true;
  });
}

function interpolatePoint(out, a, b, t) {
  for (const key of ['x', 'y', 'z']) out[key] = mix(a[key], b[key], t);
}

/** Delayed remote poses, bounded extrapolation, and isolated local pose prediction.
 * The predictor uses the actual movement/neck solver, never ball contacts or scores.
 */
export class NetworkMotion {
  constructor({ delay = 90, extrapolation = 100, maxSnapshots = 40 } = {}) {
    this.delay = clamp(delay, 60, 150);
    this.extrapolation = clamp(extrapolation, 0, 120);
    this.maxSnapshots = clamp(maxSnapshots, 4, 60);
    this.clear();
  }

  clear() {
    this.snapshots = []; this.offset = null; this.latestSeq = -1; this.lastArrival = -Infinity;
    this.localPlayerId = null; this.localTeam = null; this.ghost = null; this.pending = {};
    this.correction = { x: 0, y: 0, z: 0 }; this.accumulator = 0; this.view = null;
    this.celebration = null;
    this.neckCorrection = Array.from({ length: 9 }, () => ({ x: 0, y: 0, z: 0 }));
  }

  setLocal(id, team) { this.localPlayerId = id; this.localTeam = team; }

  push(packet, now, rtt = 0) {
    if (!Number.isSafeInteger(packet.seq) || packet.seq <= this.latestSeq || !Number.isFinite(packet.time) || !validSnapshot(packet.state)) return false;
    const previous = this.snapshots.at(-1), reconnect = now - this.lastArrival > 300;
    // A malformed or rewound time cannot grow/reorder the interpolation buffer.
    if (previous && packet.time < previous.time) return false;
    this.latestSeq = packet.seq; this.lastArrival = now;
    const candidate = packet.time - now + clamp(rtt * .5, 0, 150);
    this.offset = this.offset == null ? candidate : this.offset + clamp(candidate - this.offset, -2, 2) * .2;
    const snapshot = { seq: packet.seq, time: packet.time, ack: packet.ack ?? 0, state: copy(packet.state) };
    this.snapshots.push(snapshot);
    if (this.snapshots.length > this.maxSnapshots) this.snapshots.splice(0, this.snapshots.length - this.maxSnapshots);
    const local = snapshot.state.players.find(p => p.id === this.localPlayerId);
    if (local) this._reconcile(local, snapshot.state, previous?.state, rtt, reconnect);
    return true;
  }

  _resetGhost(local, state) {
    const game = new VolleyballGame({ mode: state.mode || '2v2' });
    const base = game.players.find(p => p.id === local.id) || game.players[0];
    const player = { ...base, ...copy(local), human: true };
    player.neckPoints = player.neckPoints.map(q => ({ vx: 0, vy: 0, vz: 0, ...q }));
    player.neck = { ...base.neck, ...local.neck };
    player._previousNeck = player.neckPoints.map(q => ({ x: q.x, y: q.y, z: q.z }));
    game.players = [player]; game.onEvent = () => {}; game.networkInputs = {};
    game.phase = state.phase; game.ball = { ...state.ball }; game.paused = false;
    this.ghost = game; this.accumulator = 0; this.pending = {};
    this.correction = { x: 0, y: 0, z: 0 };
    this.neckCorrection.forEach(q => { q.x = q.y = q.z = 0; });
  }

  _reconcile(local, state, previous, rtt, reconnect) {
    const current = this.ghost?.players[0];
    const discontinuity = !current || reconnect || previous?.phase !== state.phase || previous?.rally !== state.rally || Math.hypot(local.x - current.x, local.y - current.y, local.z - current.z) > 3.5;
    if (discontinuity) { this._resetGhost(local, state); return; }
    this.ghost.phase = state.phase; this.ghost.ball = { ...state.ball };
    const lead = clamp(rtt / 2000, 0, .1);
    const targetX = clamp(local.x + (local.vx || 0) * lead, local.team ? .7 : -8.6, local.team ? 8.6 : -.7);
    this.correction.x = clamp(targetX - current.x, -2, 2);
    this.correction.y = clamp(local.y - current.y, -1, 1);
    this.correction.z = clamp(clamp(local.z + (local.vz || 0) * lead, -4.6, 4.6) - current.z, -2, 2);
    local.neckPoints.forEach((q, index) => {
      for (const axis of ['x', 'y', 'z']) this.neckCorrection[index][axis] = index ? clamp(q[axis] + (q[`v${axis}`] || 0) * lead - current.neckPoints[index][axis] - this.correction[axis], -.5, .5) : 0;
    });
    current.ability = copy(local.ability); current.energy = local.energy ?? current.energy;
  }

  neutralize() { this.pending = {}; this.accumulator = 0; this.ghost?.clearBufferedInput(); }

  finish() {
    const state = this.snapshots.at(-1)?.state;
    if (!state || state.phase !== 'finished' || this.celebration) return;
    const game = new VolleyballGame({ mode: state.mode });
    const bases = game.players;
    Object.assign(game, copy(state));
    game.players = state.players.map(p => {
      const base = bases.find(b => b.id === p.id);
      const player = { ...base, ...copy(p) };
      player._previousNeck = player.neckPoints.map(q => ({ x: q.x, y: q.y, z: q.z }));
      return player;
    });
    game.paused = false;
    this.celebration = game;
    this.neutralize();
  }

  _predict(dt, input) {
    const game = this.ghost, p = game?.players[0];
    if (!p || !['serve', 'play'].includes(game.phase)) return;
    for (const key of ACTION_KEYS) if (input[key]) this.pending[key] = true;
    this.accumulator = Math.min(.1, this.accumulator + clamp(dt, 0, .1));
    while (this.accumulator + 1e-10 >= 1 / 120) {
      const controls = { ...input, ...this.pending };
      for (const key of ACTION_KEYS) controls[key] = !!this.pending[key];
      game.networkInputs = { [p.id]: controls };
      game._stepPlayers(1 / 120, controls);
      this.pending = {}; this.accumulator = Math.max(0, this.accumulator - 1 / 120);
    }
    const alpha = 1 - Math.exp(-clamp(dt, 0, .1) * 8);
    const shift = { x: this.correction.x * alpha, y: this.correction.y * alpha, z: this.correction.z * alpha };
    shift.x = clamp(p.x + shift.x, p.team ? .7 : -8.6, p.team ? 8.6 : -.7) - p.x;
    shift.z = clamp(p.z + shift.z, -4.6, 4.6) - p.z;
    shift.y = Math.max(-p.y, shift.y);
    for (const key of ['x', 'y', 'z']) {
      p[key] += shift[key]; p.head[key] += shift[key]; this.correction[key] -= shift[key];
      for (const q of p.neckPoints) q[key] += shift[key];
      for (const q of p._previousNeck) q[key] += shift[key];
    }
    const neckAlpha = 1 - Math.exp(-clamp(dt, 0, .1) * 6);
    this.neckCorrection.forEach((q, index) => {
      for (const axis of ['x', 'y', 'z']) {
        const adjustment = q[axis] * neckAlpha;
        p.neckPoints[index][axis] += adjustment; p._previousNeck[index][axis] += adjustment; q[axis] -= adjustment;
      }
    });
    Object.assign(p.head, p.neckPoints.at(-1));
  }

  sample(dt, input, now, { paused = false, connected = true } = {}) {
    if (this.celebration) {
      // Cosmetic only: never run contacts, scoring, AI, or network inputs.
      this.celebration.advanceCelebration(dt);
      const out = snapshotState(this.celebration);
      for (const player of out.players) player.human = player.id === this.localPlayerId;
      out.localPlayerId = this.localPlayerId; out.localTeam = this.localTeam; out.network = true;
      this.view = out;
      return out;
    }
    const latest = this.snapshots.at(-1);
    if (!latest) return null;
    const target = now + this.offset - this.delay;
    let a = this.snapshots[0], b = a;
    for (const packet of this.snapshots) { if (packet.time <= target) a = packet; if (packet.time >= target) { b = packet; break; } b = packet; }
    const compatible = a.state.phase === b.state.phase && a.state.rally === b.state.rally;
    const t = compatible && b.time > a.time ? clamp((target - a.time) / (b.time - a.time), 0, 1) : 1;
    const source = compatible ? b.state : latest.state;
    const out = copy(source);
    const ahead = b === latest && target > latest.time ? clamp((target - latest.time) / 1000, 0, this.extrapolation / 1000) : 0;
    for (const player of out.players) {
      const old = a.state.players.find(p => p.id === player.id) || player;
      if (compatible && Math.hypot(old.x - player.x, old.y - player.y, old.z - player.z) < 5) {
        for (const key of poseKeys) if (Number.isFinite(old[key]) && Number.isFinite(player[key])) player[key] = mix(old[key], player[key], t);
        player.bodyYaw = angle(old.bodyYaw || 0, player.bodyYaw || 0, t);
        interpolatePoint(player.head, old.head, player.head, t);
        player.neckPoints.forEach((q, index) => interpolatePoint(q, old.neckPoints[index], q, t));
      }
      if (ahead && ['serve', 'play'].includes(source.phase)) {
        player.x += (player.vx || 0) * ahead; player.z += (player.vz || 0) * ahead;
        for (const q of player.neckPoints) for (const axis of ['x', 'y', 'z']) q[axis] += clamp(q[`v${axis}`] || 0, -28, 28) * ahead;
        Object.assign(player.head, player.neckPoints.at(-1));
      }
      player.human = player.id === this.localPlayerId;
    }
    if (compatible && Math.hypot(a.state.ball.x - out.ball.x, a.state.ball.y - out.ball.y, a.state.ball.z - out.ball.z) < 7) interpolatePoint(out.ball, a.state.ball, out.ball, t);
    if (ahead && source.phase === 'play') {
      out.ball.x += (out.ball.vx || 0) * ahead; out.ball.z += (out.ball.vz || 0) * ahead;
      out.ball.y = Math.max(.34, out.ball.y + (out.ball.vy || 0) * ahead - BALL_GRAVITY * ahead * ahead * .5);
      out.ball.vy = (out.ball.vy || 0) - BALL_GRAVITY * ahead;
    }
    if (connected && !paused && now - this.lastArrival <= 250) this._predict(dt, input);
    const local = out.players.find(p => p.id === this.localPlayerId), predicted = this.ghost?.players[0];
    if (local && predicted && ['serve', 'play'].includes(latest.state.phase)) {
      for (const key of poseKeys) local[key] = predicted[key];
      local.head = copy(predicted.head); local.neck = copy(predicted.neck); local.neckPoints = copy(predicted.neckPoints);
      local.action = predicted.action;
    }
    // Discrete game rules and score follow the newest authoritative packet.
    for (const key of ['phase', 'score', 'touches', 'round', 'rally', 'hits', 'rallyHits', 'message', 'server', 'serveStage', 'serveCharge', 'serveQuality', 'lastAction', 'celebrationRemaining']) out[key] = copy(latest.state[key]);
    out.paused = false; out.localPlayerId = this.localPlayerId; out.localTeam = this.localTeam; out.network = true;
    this.view = out;
    return out;
  }
}
