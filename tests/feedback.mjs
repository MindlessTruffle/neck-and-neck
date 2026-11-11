import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createVFX } from '../src/vfx.js';
import { GameAudio } from '../src/audio.js';

const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera();
camera.position.set(-8, 4, 4);
const effects = createVFX(scene, { camera });
const root = scene.getObjectByName('AnimeSportsEffects');
const trail = root.getObjectByName('BallCometTrail');
const objects = [...root.children], materialIds = objects.map(object => object.material.uuid);
const visible = name => root.children.filter(object => object.name === name && object.visible).length;
effects.impact({ type: 'smash', x: 0, y: 3, z: 0, team: 0 });
assert.equal(visible('Effect_slash'), 1);
assert.equal(visible('Effect_spark'), 0);
assert.equal(visible('Effect_ring'), 0);
assert.equal(visible('Effect_lightning'), 0);
assert.equal(effects.cameraImpulse(), 0, 'missed swing must never shake camera');

const game = { phase: 'play', paused: false, hits: 0, rally: 0, players: [], ball: { x: 0, y: 3, z: 0, vx: 5, vy: 2, vz: 0 } };
effects.update(.4, game);
effects.impact({ type: 'hit', x: 1, y: 3, z: 0, power: 1, normal: { x: 1, y: 0, z: 0 } });
assert(effects.cameraImpulse() > 0);
assert.equal(visible('Effect_spark'), 26);
assert.equal(visible('Effect_lightning'), 3);
const trailArray = trail.geometry.attributes.position.array;
for (let i = 0; i < 12; i++) { game.ball.x += .1; effects.update(1 / 60, game); }
assert(trail.geometry.drawRange.count > 0);
assert.equal(trail.geometry.attributes.position.array, trailArray);
assert([...trailArray.slice(0, trail.geometry.drawRange.count * 3)].every(Number.isFinite));
game.paused = true; effects.update(1 / 60, game);
assert.equal(trail.geometry.drawRange.count, 0);
game.paused = false; game.ball.x = 4; effects.update(1 / 60, game);
assert.equal(trail.geometry.drawRange.count, 0, 'first resumed sample must not connect to stale trail');
game.ball.x += .1; effects.update(1 / 60, game);
assert(trail.geometry.drawRange.count > 0);
game.phase = 'point'; effects.update(1 / 60, game);
assert.equal(trail.geometry.drawRange.count, 0);
game.phase = 'play'; game.hits = 3; effects.update(1 / 60, game);
game.ball.x += .1; effects.update(1 / 60, game);
game.hits = 0; effects.update(1 / 60, game);
assert.equal(trail.geometry.drawRange.count, 0, 'same-phase match reset must clear history');
for (let i = 0; i < 100; i++) { effects.impact({ type: 'hit', power: 1 }); effects.update(.5, game); }
assert.deepEqual(root.children, objects);
assert.deepEqual(root.children.map(object => object.material.uuid), materialIds);
effects.setReducedMotion(true);
assert.equal(effects.cameraImpulse(), 0);
assert.equal(trail.geometry.drawRange.count, 0);
let geometryDisposals = 0;
trail.geometry.addEventListener('dispose', () => geometryDisposals++);
effects.dispose(); effects.dispose();
assert.equal(scene.children.length, 0);
assert.equal(geometryDisposals, 1);
console.log('PASS VFX: missed-swing feedback, actual-contact feedback, pause/point/reset trail isolation, finite reusable trail buffers, bounded GPU resources, reduced motion, idempotent disposal.');

class Parameter {
  constructor(value = 0) { this.value = value; }
  setValueAtTime(value) { this.value = value; }
  linearRampToValueAtTime(value) { this.value = value; }
  exponentialRampToValueAtTime(value) { this.value = value; }
  setTargetAtTime(value) { this.value = value; }
}
class AudioNode {
  constructor(kind) { this.kind = kind; this.gain = new Parameter(); this.frequency = new Parameter(); this.disconnected = 0; this.stopped = false; this.onended = null; }
  connect(node) { this.connected = node; }
  disconnect() { this.disconnected++; }
  start() { this.started = true; }
  stop() { this.stopped = true; }
  finish() { this.onended?.(); }
}
class MockContext {
  static contexts = [];
  constructor() { this.state = 'suspended'; this.currentTime = 0; this.sampleRate = 48000; this.destination = new AudioNode('destination'); this.nodes = []; this.buffers = 0; this.closed = 0; MockContext.contexts.push(this); }
  resume() { return new Promise((resolve, reject) => { this.resolveResume = () => { if (this.state !== 'closed') this.state = 'running'; resolve(); }; this.rejectResume = reject; }); }
  createGain() { return this.node('gain'); }
  createOscillator() { return this.node('oscillator'); }
  createBufferSource() { return this.node('source'); }
  createBiquadFilter() { return this.node('filter'); }
  createBuffer(channels, length) { this.buffers++; const samples = new Float32Array(length); return { getChannelData: () => samples }; }
  node(kind) { const node = new AudioNode(kind); this.nodes.push(node); return node; }
  close() { this.closed++; this.state = 'closed'; return Promise.resolve(); }
}
const originalContext = globalThis.AudioContext, originalInterval = globalThis.setInterval, originalClearInterval = globalThis.clearInterval;
const intervals = new Map(); let intervalId = 0;
globalThis.AudioContext = MockContext;
globalThis.setInterval = callback => { const id = ++intervalId; intervals.set(id, callback); return id; };
globalThis.clearInterval = id => intervals.delete(id);
try {
  const audio = new GameAudio(); audio.setMusic(false);
  const first = audio.unlock(), concurrent = audio.unlock();
  assert.equal(first, concurrent);
  assert.equal(MockContext.contexts.length, 1);
  const context = MockContext.contexts[0];
  audio.setMuted(true); assert.equal(audio.master.gain.value, 0); audio.setMuted(false);
  context.resolveResume(); assert.equal(await first, true);
  assert.equal(intervals.size, 1);
  await audio.unlock(); assert.equal(MockContext.contexts.length, 1); assert.equal(intervals.size, 1);
  audio.event({ type: 'smash', player: 0 });
  assert.equal(context.nodes.filter(node => node.kind === 'oscillator').length, 0, 'empty swing must not play impact bass');
  audio.event({ type: 'hit', power: 1 }); audio.event({ type: 'hit', power: .7 });
  assert.equal(context.buffers, 2, 'noise buffers must be reused, not generated on every hit');
  assert.equal(context.nodes.filter(node => node.kind === 'oscillator').length, 4);
  const voices = context.nodes.filter(node => ['oscillator', 'source'].includes(node.kind));
  for (const voice of voices) voice.finish();
  assert.equal(audio._liveNodes.size, 0);
  assert(voices.every(node => node.disconnected === 1));
  audio.dispose(); assert.equal(intervals.size, 0); assert(context.closed > 0);
  assert.equal(await audio.unlock(), false); assert.equal(MockContext.contexts.length, 1);

  const pendingAudio = new GameAudio(); pendingAudio.setMusic(false);
  const pending = pendingAudio.unlock(), pendingContext = MockContext.contexts.at(-1);
  pendingAudio.dispose(); pendingContext.resolveResume();
  assert.equal(await pending, false);
  assert.equal(pendingAudio.context, null);
  assert.equal(pendingAudio.unlocked, false);
  assert.equal(intervals.size, 0, 'late resume may not resurrect a disposed music timer');

  const retryAudio = new GameAudio(); retryAudio.setMusic(false);
  const rejected = retryAudio.unlock(), rejectedContext = MockContext.contexts.at(-1);
  rejectedContext.rejectResume(new Error('browser denied resume'));
  assert.equal(await rejected, false); assert.equal(retryAudio.context, null); assert(rejectedContext.closed > 0);
  const retried = retryAudio.unlock(), retryContext = MockContext.contexts.at(-1);
  retryContext.resolveResume(); assert.equal(await retried, true); retryAudio.dispose();
  assert.equal(intervals.size, 0);
  console.log('PASS Audio: concurrent gesture unlock uses one context, no empty-swing bass, cached noise, ended-voice disconnection, retry after browser refusal, disposal during pending resume cannot resurrect audio.');
} finally {
  globalThis.AudioContext = originalContext;
  globalThis.setInterval = originalInterval;
  globalThis.clearInterval = originalClearInterval;
}

