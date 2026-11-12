import assert from 'node:assert/strict';
import { VolleyballGame } from '../src/physics.js';
import { SmoothSimulation } from '../src/motion.js';

function runAt(hz) {
  const game = new VolleyballGame({ mode: '1v1' });
  game.start();
  const motion = new SmoothSimulation(game);
  for (let i = 0; i < hz * 2; i++) motion.advance(1 / hz, { z: .3, neckYaw: .6, neckPitch: .1 });
  return { game, motion };
}
const reference = runAt(120);
for (const hz of [30, 60, 90, 144, 240]) {
  const { game, motion } = runAt(hz);
  assert.ok(Math.abs(game.players[0].z - reference.game.players[0].z) < 1e-9, `${hz} Hz body drift`);
  for (const axis of ['x', 'y', 'z']) assert.ok(Math.abs(game.players[0].head[axis] - reference.game.players[0].head[axis]) < 1e-9, `${hz} Hz neck drift`);
  assert.ok(Number.isFinite(motion.renderState.players[0].head.x));
}

// Actions between simulation ticks survive exactly once, even at fast refresh rates.
let jumps = 0;
const game = new VolleyballGame({ onEvent: e => { if (e.type === 'jump' && e.player === 0) jumps++; } });
game.start();
const motion = new SmoothSimulation(game);
motion.advance(1 / 480, { jump: true });
assert.equal(jumps, 0);
for (let i = 0; i < 7; i++) motion.advance(1 / 480);
assert.equal(jumps, 1);
assert.ok(motion.renderState.players[0].y <= game.players[0].y);
assert.notEqual(motion.renderState.players[0].head, game.players[0].head);
assert.notEqual(motion.renderState.players[0].neckPoints, game.players[0].neckPoints);

// Pause clears pending inputs and accumulated time. Reset never smears teleports.
game.reset(); game.start(); motion.reset();
motion.advance(1 / 480, { jump: true });
game.paused = true; motion.advance(10);
game.paused = false; motion.advance(1 / 60);
assert.equal(jumps, 1);
game.players[0].x = -8;
motion.reset();
assert.equal(motion.renderState.players[0].x, -8);
assert.equal(motion.accumulator, 0);

// Pausing also clears actions already buffered inside physics near a landing.
game.players[0].y = .05;
game.players[0]._jumpV = -2;
motion.advance(1 / 120, { jump: true });
assert.ok(game.players[0]._jumpBuffer > 0);
game.paused = true; motion.advance(20);
game.paused = false;
for (let i = 0; i < 20; i++) motion.advance(1 / 120);
assert.equal(game.players[0].y, 0);
assert.equal(jumps, 1, 'paused recovery buffer must not launch an unsolicited jump');

// Reused render storage stays stable; rendering cannot mutate authoritative physics.
const head = motion.renderState.players[0].head;
const point = motion.renderState.players[0].neckPoints[4];
motion.advance(1 / 60, { x: 1 });
assert.equal(motion.renderState.players[0].head, head);
assert.equal(motion.renderState.players[0].neckPoints[4], point);
const physicalX = game.players[0].head.x;
motion.renderState.players[0].head.x = 100;
assert.equal(game.players[0].head.x, physicalX);
console.log('Motion checks passed: identical physics at 30/60/90/120/144/240 Hz, buffered inputs, interpolated poses, pause/reset isolation.');

const remoteEvents=[];const remote=new VolleyballGame({mode:'2v2',onEvent:e=>remoteEvents.push(e)});remote.start();remote.phase='play';remote.players.forEach(p=>p.human=true);
const remoteMotion=new SmoothSimulation(remote);
remoteMotion.advance(1/480,{players:{2:{jump:true}}});for(let i=0;i<3;i++)remoteMotion.advance(1/480);
assert.equal(remoteEvents.filter(e=>e.type==='jump'&&e.player===2).length,1,'remote edge survives a frame without a physics tick');
assert.equal(remote.players[0].y,0,'remote edge never leaks to player zero');
remote.reset();remote.start();remote.players.forEach(p=>p.human=true);remote.server=1;remoteMotion.reset();
remoteMotion.advance(1/30,{players:{2:{serve:true}}});assert.equal(remote.serveStage,'toss','remote click is consumed only once across substeps');
console.log('Motion checks passed: per-player network buffering and one-click serve isolation.');
