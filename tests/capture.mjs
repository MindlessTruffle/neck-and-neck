import assert from 'node:assert/strict';
import { requestGameCapture } from '../src/capture.js';

const calls = [], doc = { pointerLockElement: null, fullscreenElement: null };
let resolveLock;
const canvas = { focus() { calls.push('focus'); }, requestPointerLock() { calls.push('lock'); return new Promise(resolve => { resolveLock = resolve; }); } };
const stage = { requestFullscreen() { calls.push('fullscreen'); return Promise.resolve(); } };
const pending = requestGameCapture({ canvas, stage, documentRef: doc });
assert.deepEqual(calls, ['focus', 'lock', 'fullscreen'], 'Lock is requested before fullscreen consumes activation, without awaiting it');
resolveLock(); await pending;
assert.equal(doc.pointerLockElement, null, 'A fulfilled request must not fabricate browser lock state');

let failures = 0;
canvas.requestPointerLock = () => Promise.reject(new Error('blocked'));
await requestGameCapture({ canvas, stage, documentRef: doc, onError: () => failures++ });
assert.equal(failures, 1);
assert.equal(doc.pointerLockElement, null);
canvas.requestPointerLock = () => { throw new Error('unavailable'); };
await requestGameCapture({ canvas, stage, documentRef: doc, onError: () => failures++ });
assert.equal(failures, 2);

calls.length = 0; doc.pointerLockElement = canvas; doc.fullscreenElement = stage;
await requestGameCapture({ canvas, stage, documentRef: doc });
assert.deepEqual(calls, ['focus'], 'Already locked/fullscreen needs no duplicate request');
doc.pointerLockElement = null; doc.fullscreenElement = null;
await requestGameCapture({ canvas, stage, documentRef: doc, coarse: true });
assert.equal(failures, 2, 'Touch play must not request pointer lock');
console.log('PASS capture: gesture request ordering, no false lock state, legacy/rejection handling, touch and already-locked states.');
