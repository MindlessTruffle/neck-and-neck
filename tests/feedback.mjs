import assert from 'node:assert/strict';
import fs from 'node:fs';
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
effects.impact({ type: 'hit', x: 1, y: 3, z: 0, power: .1, rallyHits: 1, assisted: true });
assert.equal(effects.cameraImpulse(), 0, 'gentle returns need confirmation, not camera shake');
assert.equal(visible('Effect_ring'), 2, 'gentle contacts still get clear success rings');
let callout = root.children.find(object => object.name === 'VolleyComicCallout' && object.visible);
assert.equal(callout.userData.text, 'GOOD SAVE!');
assert.equal(callout.material.map.userData.text, 'GOOD SAVE!');
const saveTexture = callout.material.map;
effects.update(.8, game);
effects.impact({ type: 'hit', x: 1, y: 3, z: 0, power: 1, rallyHits: 3, normal: { x: 1, y: 0, z: 0 } });
assert(effects.cameraImpulse() > 0);
assert.equal(visible('Effect_spark'), 26);
assert.equal(visible('Effect_lightning'), 3);
callout = root.children.find(object => object.name === 'VolleyComicCallout' && object.visible);
assert.equal(callout.userData.text, 'VOLLEY 3!');
const volleyTexture = callout.material.map;
assert.equal(trail.geometry.attributes.color.itemSize, 4, 'the comet trail fades alpha instead of turning black');
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
effects.update(1, game);
effects.impact({ type: 'hit', rallyHits: 3, power: .1 });
callout = root.children.find(object => object.name === 'VolleyComicCallout' && object.visible);
assert.equal(callout.material.map, volleyTexture, 'comic textures must be reused across impacts');
effects.update(.1, game);
assert(root.getObjectByName('RallyBallAura_1').visible, 'longer volleys gain a second ball ring');
game.paused = true; effects.update(.01, game);
assert.equal(visible('VolleyComicCallout'), 0, 'pause clears stale callouts');
assert.equal(root.getObjectByName('RallyBallAura_0').visible, false);
game.paused = false;
effects.setReducedMotion(true);
assert.equal(effects.cameraImpulse(), 0);
assert.equal(trail.geometry.drawRange.count, 0);
effects.update(1, game);
for (const action of ['set', 'spike', 'block', 'dive']) {
  effects.impact({ type: 'hit', action, rallyHits: 1, power: .15, x: 1, y: 3, z: 0 });
  assert(root.children.some(object => object.name === 'VolleyComicCallout' && object.visible && object.userData.text === `${action.toUpperCase()}!`));
  assert.equal(effects.cameraImpulse(), 0);
  effects.update(1, game);
}
effects.impact({ type: 'round', abilities: [{ player: 0, id: 'feather', x: -4, y: 3, z: 0 }] });
game.phase = 'serve'; effects.update(.1, game);
assert(root.children.some(object => object.name === 'VolleyComicCallout' && object.visible && object.userData.text === 'FEATHER FLOAT!'), 'round identity remains readable before serving');
game.phase = 'play'; effects.update(2, game);
for (const [ability, label] of [['feather', 'FEATHER FLOAT!'], ['spring', 'SPRING STEP!'], ['magnet', 'MAGNET HEAD!'], ['rocket', 'ROCKET HOOVES!'], ['shield', 'IRON CANOPY!']]) {
  effects.impact({ type: 'ability', ability, x: 1, y: 3, z: 0 });
  assert(root.children.some(object => object.name === 'VolleyComicCallout' && object.visible && object.userData.text === label));
  assert.equal(effects.cameraImpulse(), 0);
  effects.update(2, game);
}
assert.deepEqual(root.children, objects, 'new actions and all random kits must reuse the same pools');
effects.setReducedMotion(false);
game.phase = 'point'; effects.impact({ type: 'score', team: 0 });
const debris = root.getObjectByName('ScoreExplosionDebris'), debrisArray = debris.instanceMatrix.array;
assert(debris.isInstancedMesh); assert.equal(debris.count, 58); assert(debris.visible);
effects.update(.3, game);
assert([...debrisArray].every(Number.isFinite));
effects.impact({ type: 'win', team: 0 }); assert.equal(debris.count, 88);
assert.equal(debris.instanceMatrix.array, debrisArray, 'score explosion never recreates instance storage');
game.paused = true; effects.update(.01, game); assert.equal(debris.visible, false);
game.paused = false; effects.setReducedMotion(true); effects.impact({ type: 'score' }); assert.equal(debris.count, 8);
const mobileScene = new THREE.Scene(), mobileEffects = createVFX(mobileScene, { mobile: true });
mobileEffects.impact({ type: 'win' }); assert.equal(mobileScene.getObjectByName('ScoreExplosionDebris').count, 36); mobileEffects.dispose();
let geometryDisposals = 0;
let textureDisposals = 0;
saveTexture.addEventListener('dispose', () => textureDisposals++);
volleyTexture.addEventListener('dispose', () => textureDisposals++);
trail.geometry.addEventListener('dispose', () => geometryDisposals++);
effects.dispose(); effects.dispose();
assert.equal(scene.children.length, 0);
assert.equal(geometryDisposals, 1);
assert.equal(textureDisposals, 2);
console.log('PASS VFX: low-power success callouts, escalating volleys, pooled label textures, missed-swing isolation, clean pause/reset trails, bounded GPU resources and disposal.');

// Browser-like canvas creation must paint real text instead of using the Node fallback.
const previousDocument = globalThis.document;
const paintedLabels = [];
try {
  globalThis.document = { createElement: type => {
    assert.equal(type, 'canvas');
    return { width: 0, height: 0, getContext: () => ({ translate() {}, rotate() {}, strokeText() {}, fillText: text => paintedLabels.push(text) }) };
  } };
  const paintedScene = new THREE.Scene(), paintedEffects = createVFX(paintedScene, { camera });
  const sprite = paintedScene.getObjectByName('VolleyComicCallout');
  assert(sprite.material.map.isCanvasTexture);
  for (const text of ['NICE!', 'SET!', 'SPIKE!', 'BLOCK!', 'DIVE!', 'FEATHER FLOAT!', 'ROCKET HOOVES!']) assert(paintedLabels.includes(text));
  paintedEffects.dispose();
} finally { globalThis.document = previousDocument; }

class Parameter {
  constructor(value = 0) { this.value = value; }
  setValueAtTime(value) { this.value = value; }
  linearRampToValueAtTime(value) { this.value = value; }
  exponentialRampToValueAtTime(value) { this.value = value; }
  setTargetAtTime(value) { this.value = value; }
  cancelScheduledValues() {}
}
class AudioNode {
  constructor(kind) { this.kind = kind; this.gain = new Parameter(); this.frequency = new Parameter(); this.playbackRate = new Parameter(1); this.disconnected = 0; this.stopped = false; this.onended = null; }
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
  async decodeAudioData(bytes) { this.decodes = (this.decodes || 0) + 1; const marker = new Uint8Array(bytes)[0]; if (marker === 255) throw new Error('unsupported codec'); return { duration: marker === 1 ? 41.14 : .2, marker }; }
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
  audio.event({ type: 'hit', power: .1, rallyHits: 1, assisted: true });
  const firstNote = context.nodes.filter(node => node.kind === 'oscillator').at(-1).frequency.value;
  audio.event({ type: 'hit', power: .3, rallyHits: 2 });
  const secondNote = context.nodes.filter(node => node.kind === 'oscillator').at(-1).frequency.value;
  assert(secondNote > firstNote, 'success notes rise with the volley count');
  assert.equal(context.buffers, 2, 'noise buffers must be reused, not generated on every hit');
  assert.equal(context.nodes.filter(node => node.kind === 'oscillator').length, 6);
  const voices = context.nodes.filter(node => ['oscillator', 'source'].includes(node.kind));
  for (const voice of voices) voice.finish();
  assert.equal(audio._liveNodes.size, 0);
  assert(voices.every(node => node.disconnected === 1));
  for (let i = 0; i < 300; i++) audio.event({ type: 'hit', power: 1, rallyHits: i + 1 });
  assert(audio._liveNodes.size <= 64, 'procedural feedback has a strict node ceiling even during a large event burst');
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
  // Real local stock buffers are cached, looped and independently muted.
  const requests = [];
  const fakeFetch = async (url, { signal }) => {
    requests.push({ url, signal });
    return { ok: true, arrayBuffer: async () => new Uint8Array([url.includes('music-') || url.includes('adventure') ? 1 : 0]).buffer };
  };
  const stockAudio = new GameAudio({ fetcher: fakeFetch, resolveAsset: path => path });
  const stockUnlocked = stockAudio.unlock(), stockContext = MockContext.contexts.at(-1);
  stockContext.resolveResume(); await stockUnlocked; await stockAudio._assetsReady;
  assert.equal(requests.length, 13, 'twelve generated samples and one scene loop load once');
  assert.equal(stockAudio._stockMusicSource.loop, true);
  const loop = stockAudio._stockMusicSource;
  assert.equal(loop.buffer.duration, 41.14);
  await stockAudio.unlock(); stockAudio.setMusic(false);
  assert.equal(stockAudio.musicBus.gain.value, 0);
  assert.equal(stockAudio.master.gain.value, .48, 'music switch does not mute SFX');
  stockAudio.setMusic(true); stockAudio.setMuted(true);
  assert.equal(stockAudio.master.gain.value, 0); stockAudio.setMuted(false);
  assert.equal(stockAudio._stockMusicSource, loop);
  assert.equal(requests.length, 13, 'resuming and toggling music do not refetch assets');
  await stockAudio.setScene('shop');
  const shopLoop = stockAudio._stockMusicSource;
  assert.notEqual(shopLoop, loop); assert(loop.stopped, 'previous music fades and receives a bounded stop');
  assert.equal(stockAudio._musicVoice.scene, 'shop');
  await stockAudio.setScene('abilities'); await stockAudio.setScene('match'); await stockAudio.setScene('results');
  assert.equal(stockAudio._musicVoice.scene, 'results');
  assert.equal(stockAudio.musicStatus, 'ready');
  const loadedScenes = requests.length;
  await stockAudio.setScene('shop');
  assert.equal(requests.length, loadedScenes, 'returning to a scene reuses decoded music');
  assert.equal(await stockAudio.setScene('invalid'), false);
  stockAudio.event('menu');
  assert(stockContext.nodes.some(node => node.kind === 'source' && node.buffer === stockAudio._stockBuffers.get('click')));
  stockAudio.event({ type: 'hit', action: 'spike', power: .2, rallyHits: 2 });
  assert(stockContext.nodes.some(node => node.kind === 'source' && node.buffer === stockAudio._stockBuffers.get('spike')));
  stockAudio.event({ type: 'dive' });
  assert(stockContext.nodes.some(node => node.kind === 'source' && node.buffer === stockAudio._stockBuffers.get('dive')));
  stockAudio.event({ type: 'ability', ability: 'magnet' });
  assert(stockContext.nodes.some(node => node.kind === 'source' && node.buffer === stockAudio._stockBuffers.get('ability')));
  stockAudio.event('score'); stockAudio.event('win');
  assert.equal(stockContext.nodes.filter(node => node.kind === 'source' && node.buffer === stockAudio._stockBuffers.get('point')).length, 1, 'winning point must not double the stock jingle');
  stockAudio.dispose(); assert(requests.every(request => request.signal.aborted)); assert.equal(intervals.size, 0);
  assert.equal(stockAudio._assetsReady, null, 'dispose releases decoded buffers retained by readiness promises');

  // Fast menu changes may finish downloading out of order. Only the latest wins.
  const sceneDownloads = [];
  const switching = new GameAudio({ resolveAsset: path => path, fetcher: (url, options) => url.includes('music-') ? new Promise(resolve => sceneDownloads.push({ url, resolve })) : fakeFetch(url, options) });
  switching.setMusic(false);
  const switchUnlock = switching.unlock(), switchContext = MockContext.contexts.at(-1);
  switchContext.resolveResume(); await switchUnlock; await switching._assetsReady;
  const oldScene = switching.setScene('shop'), newScene = switching.setScene('abilities');
  sceneDownloads[1].resolve({ ok: true, arrayBuffer: async () => new Uint8Array([2]).buffer }); await newScene;
  const activeLoop = switching._stockMusicSource;
  sceneDownloads[0].resolve({ ok: true, arrayBuffer: async () => new Uint8Array([1]).buffer }); await oldScene;
  assert.equal(switching._stockMusicSource, activeLoop); assert.equal(switching._musicVoice.scene, 'abilities');
  switching.dispose(); assert.equal(switching.musicStatus, 'disposed'); assert.equal(intervals.size, 0);

  // Unsupported Ogg falls back to the bundled MP3, not a remote request.
  const codecRequests = [];
  const codecAudio = new GameAudio({ resolveAsset: path => path, fetcher: async url => { codecRequests.push(url); return { ok: !url.includes('elevenlabs'), arrayBuffer: async () => new Uint8Array([url.endsWith('.ogg') ? 255 : url.endsWith('.mp3') ? 1 : 0]).buffer }; } });
  const codecUnlocked = codecAudio.unlock(), codecContext = MockContext.contexts.at(-1);
  codecContext.resolveResume(); await codecUnlocked; await codecAudio._assetsReady;
  assert(codecRequests.includes('audio/adventure-stage1.mp3'));
  assert(codecAudio._stockMusicSource?.loop); codecAudio.dispose();

  // Disposal cannot resurrect a stock loop even when a fetch ignores abort.
  const pendingDownloads = [];
  const lateAudio = new GameAudio({ resolveAsset: path => path, fetcher: (url, options) => new Promise(resolve => pendingDownloads.push({ url, options, resolve })) });
  const lateUnlocked = lateAudio.unlock(), lateContext = MockContext.contexts.at(-1);
  lateContext.resolveResume(); await lateUnlocked;
  const lateReady = lateAudio._assetsReady;
  assert.equal(pendingDownloads.length, 13); lateAudio.dispose();
  for (const download of pendingDownloads) download.resolve({ ok: true, arrayBuffer: async () => new Uint8Array([1]).buffer });
  await lateReady;
  assert(pendingDownloads.every(download => download.options.signal.aborted));
  assert.equal(lateContext.decodes || 0, 0);
  assert.equal(lateAudio._stockMusicSource, null);
  assert.equal(lateAudio._stockBuffers.size, 0);
  assert.equal(intervals.size, 0);

  // A decode already in progress also checks disposal before installing its buffer.
  const decodingAudio = new GameAudio({ resolveAsset: path => path, fetcher: fakeFetch });
  const decodingUnlocked = decodingAudio.unlock(), decodingContext = MockContext.contexts.at(-1), decodeResolvers = [];
  decodingContext.decodeAudioData = () => new Promise(resolve => decodeResolvers.push(resolve));
  decodingContext.resolveResume(); await decodingUnlocked;
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(decodeResolvers.length, 13);
  const decodingReady = decodingAudio._assetsReady; decodingAudio.dispose();
  for (const resolve of decodeResolvers) resolve({ duration: 41.14 });
  await decodingReady;
  assert.equal(decodingAudio._stockBuffers.size, 0);
  assert.equal(decodingAudio._stockMusicSource, null);
  assert.equal(intervals.size, 0);

  // Failed local downloads leave procedural music and SFX available.
  const offlineAudio = new GameAudio({ resolveAsset: path => path, fetcher: async () => { throw new Error('offline'); } });
  const offlineUnlocked = offlineAudio.unlock(), offlineContext = MockContext.contexts.at(-1);
  offlineContext.resolveResume(); await offlineUnlocked; await offlineAudio._assetsReady;
  assert.equal(offlineAudio._stockMusicSource, null);
  const oscillatorCount = offlineContext.nodes.filter(node => node.kind === 'oscillator').length;
  offlineAudio.event('menu');
  assert(offlineContext.nodes.filter(node => node.kind === 'oscillator').length > oscillatorCount);
  offlineAudio.dispose(); assert.equal(intervals.size, 0);
  console.log('PASS Audio: concurrent gesture unlock uses one context, no empty-swing bass, cached noise, ended-voice disconnection, retry after browser refusal, disposal during pending resume cannot resurrect audio.');
  console.log('PASS Stock audio: local decoded music loop, reusable action samples, separate music/mute, MP3 fallback, point-jingle deduplication, abort safety and procedural offline fallback.');
} finally {
  globalThis.AudioContext = originalContext;
  globalThis.setInterval = originalInterval;
  globalThis.clearInterval = originalClearInterval;
}

const audioFolder = new URL('../public/audio/', import.meta.url);
const audioFiles = fs.readdirSync(audioFolder, { withFileTypes: true }).filter(entry => entry.isFile());
assert(audioFiles.reduce((bytes, entry) => bytes + fs.statSync(new URL(entry.name, audioFolder)).size, 0) < 4 * 1024 * 1024);
for (const name of ['click', 'bump', 'set', 'spike', 'block', 'dive', 'point', 'ability']) {
  const bytes = fs.readFileSync(new URL(`${name}.wav`, audioFolder));
  assert.equal(bytes.toString('ascii', 0, 4), 'RIFF'); assert.equal(bytes.toString('ascii', 8, 12), 'WAVE');
}
assert.equal(fs.readFileSync(new URL('adventure-stage1.ogg', audioFolder)).toString('ascii', 0, 4), 'OggS');
for (const license of ['Juhani-Junkala-CC0.txt', 'Kenney-Impact-CC0.txt', 'Kenney-Interface-CC0.txt', 'Kenney-Jingles-CC0.txt']) assert(fs.readFileSync(new URL(`licenses/${license}`, audioFolder), 'utf8').includes('CC0'));
console.log('PASS Bundled audio: eight browser-compatible WAV samples, Ogg/MP3 music, included CC0 license files, total audio under 4 MiB.');
const generatedFolder = new URL('elevenlabs/', audioFolder), manifest = JSON.parse(fs.readFileSync(new URL('manifest.json', generatedFolder), 'utf8'));
assert.equal(manifest.length, 17);
assert.equal(new Set(manifest.map(entry => entry.file)).size, 17);
assert.equal(manifest.filter(entry => entry.type === 'music').length, 5);
assert.equal(manifest.filter(entry => entry.type === 'sfx').length, 12);
let generatedBytes = 0;
for (const entry of manifest) {
  assert.equal(entry.provider, 'ElevenLabs');
  assert(/^(music|sfx)-[a-z]+\.mp3$/.test(entry.file));
  const bytes = fs.readFileSync(new URL(entry.file, generatedFolder)); generatedBytes += bytes.length;
  assert.equal(bytes.length, entry.bytes); assert(bytes.length > 8000);
  assert(bytes.toString('ascii', 0, 3) === 'ID3' || (bytes[0] === 255 && (bytes[1] & 224) === 224), 'valid MP3 container');
}
assert(generatedBytes < 3 * 1024 * 1024);
assert(fs.readFileSync(new URL('../CREDITS.md', import.meta.url), 'utf8').includes('not labelled CC0'));
console.log('PASS Generated audio: five distinct music scenes, twelve original SFX, authenticated generation manifest, valid local MP3 files under 3 MiB.');

