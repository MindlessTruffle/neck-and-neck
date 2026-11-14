import * as THREE from 'three';
import { createWorld } from '../src/art.js';
import { VolleyballGame } from '../src/physics.js';
import { GameAudio } from '../src/audio.js';

const canvas = document.querySelector('#game');
const controls = ['point', 'match', 'swing', 'freeze', 'reset'].map(id => document.getElementById(id));
const [pointButton, matchButton, swingButton, freezeButton, resetButton] = controls;
const freezeDelay = document.querySelector('#freeze-delay');
const freezeDelayValue = document.querySelector('#freeze-delay-value');
const status = {
  assets: document.querySelector('#assets'), event: document.querySelector('#event'),
  timer: document.querySelector('#timer'), map: document.querySelector('#map'),
  ragdoll: document.querySelector('#ragdoll'), error: document.querySelector('#error'),
};
const STEP = 1 / 120;
let world, game, audio, frame = 0, resizeObserver, previous = 0, accumulator = 0;
let time = 0, eventTime = null, autoFreezeAt = null, eventLabel = 'ready', frozen = false, disposed = false;

function setError(error) {
  status.error.style.display = 'block';
  status.error.textContent = error?.stack || String(error);
  status.assets.textContent = 'error';
  controls.forEach(button => { button.disabled = true; });
}

function updateStatus() {
  const snapshot = world?.getDebugSnapshot?.();
  status.event.textContent = `${eventLabel}${frozen ? ' · frozen' : ''}`;
  status.timer.textContent = eventTime === null ? '—' : `${Math.max(0, time - eventTime).toFixed(2)} s`;
  status.map.textContent = snapshot?.mapMotion?.active ? `${snapshot.mapMotion.final ? 'final' : 'point'} · ${snapshot.mapMotion.time.toFixed(2)} s` : 'idle';
  document.querySelector('#render-metrics').textContent=`${snapshot?.mapId}: ${snapshot?.drawCalls} draws / ${snapshot?.triangles} triangles / ${Math.round(snapshot?.performance.averageFps||0)} FPS`;
  const launched = game?.players?.filter(player => player._knockTime > 0).length || 0;
  status.ragdoll.textContent = launched ? `${launched}/4 airborne` : 'idle';
}

function onGameEvent(event) {
  audio?.event(event);
  world?.impact(event);
  if (event.type === 'score' || event.type === 'win') {
    eventLabel = event.type === 'win' ? 'match explosion' : 'point explosion';
    eventTime = time;
    autoFreezeAt = Number(freezeDelay.value);
    frozen = false;
    freezeButton.textContent = 'Freeze effect';
  } else if (event.type === 'action' || event.type === 'smash') {
    eventLabel = 'swing / bump';
    eventTime = time;
    autoFreezeAt = null;
  }
  updateStatus();
}

function resetMatch() {
  frozen = false;
  freezeButton.textContent = 'Freeze effect';
  eventLabel = 'ready'; eventTime = null; autoFreezeAt = null; accumulator = 0;
  game.reset({ mode: '2v2', difficulty: 'club' });
  game.mapId=document.querySelector('#biome').value;
  game.start();
  world.setMenuScene(false);
  world.setCamera({ yaw: 0, pitch: 0, distance: 7.2, snap: true });
  world.update(0, game, time);
  world.renderer.render(world.scene, world.camera);
  updateStatus();
}

async function launchPoint(final = false) {
  await audio.unlock();
  if (game.phase === 'attract' || game.phase === 'finished') resetMatch();
  if (final) game.score = [6, 0];
  game._point(0, 'visual harness');
  updateStatus();
}

async function launchSwing() {
  await audio.unlock();
  if (game.phase === 'attract' || game.phase === 'finished') resetMatch();
  const player = game.players.find(candidate => candidate.human) || game.players[0];
  game._swing(player, 'bump');
  updateStatus();
}

function toggleFreeze() {
  frozen = !frozen;
  freezeButton.textContent = frozen ? 'Resume effect' : 'Freeze effect';
  updateStatus();
}

function resize() {
  const width = Math.max(1, canvas.clientWidth), height = Math.max(1, canvas.clientHeight);
  world?.resize(width, height);
}

function animate(now) {
  if (disposed) return;
  frame = requestAnimationFrame(animate);
  const dt = Math.min(.05, Math.max(0, (now - previous) / 1000)); previous = now;
  if (!frozen && world && game) {
    time += dt;
    accumulator = Math.min(accumulator + dt, STEP * 12);
    while (accumulator >= STEP) { game.update(STEP, {}); accumulator -= STEP; }
    world.update(dt, game, time);
    if (eventTime !== null && autoFreezeAt !== null && time - eventTime >= autoFreezeAt) {
      frozen = true; autoFreezeAt = null; freezeButton.textContent = 'Resume effect';
    }
  }
  if(world&&document.querySelector('#overview').checked){world.camera.position.set(-38,31,38);world.camera.lookAt(0,1,0);world.scene.getObjectByName('PaintedSkyDome').position.copy(world.camera.position);}
  world?.renderer.render(world.scene, world.camera);
  if (Math.floor(now / 100) !== Math.floor((now - dt * 1000) / 100)) updateStatus();
}

async function start() {
  audio = new GameAudio();
  world = createWorld({ canvas, reducedMotion: false, onProgress: progress => { status.assets.textContent = `${Math.round(progress * 100)}%`; } });
  game = new VolleyballGame({ mode: '2v2', difficulty: 'club', onEvent: onGameEvent });
  world.setMenuScene(false);
  resize();
  resizeObserver = new ResizeObserver(resize); resizeObserver.observe(canvas);
  await world.ready;
  if (disposed) return;
  resetMatch();
  status.assets.textContent = 'ready';
  controls.forEach(button => { button.disabled = false; });
  freezeDelay.disabled = false;
  previous = performance.now();
  frame = requestAnimationFrame(animate);
}

document.querySelector('#biome').addEventListener('change',()=>{if(world&&game)resetMatch();});
pointButton.addEventListener('click', () => launchPoint(false));
matchButton.addEventListener('click', () => launchPoint(true));
swingButton.addEventListener('click', launchSwing);
freezeButton.addEventListener('click', toggleFreeze);
resetButton.addEventListener('click', resetMatch);
freezeDelay.addEventListener('input', () => { freezeDelayValue.textContent = `${Number(freezeDelay.value).toFixed(2)} s`; });
window.addEventListener('resize', resize);
window.addEventListener('pagehide', () => {
  disposed = true;
  cancelAnimationFrame(frame);
  resizeObserver?.disconnect();
  window.removeEventListener('resize', resize);
  world?.dispose(); audio?.dispose();
}, { once: true });

start().catch(setError);

canvas.addEventListener('click',event=>{
 const ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2(event.clientX/canvas.clientWidth*2-1,1-event.clientY/canvas.clientHeight*2),world.camera);
 const hits=ray.intersectObjects(world.scene.children,true).filter(h=>{for(let o=h.object;o;o=o.parent)if(!o.visible)return false;return true;});
 document.querySelector('#inspection').textContent=hits.slice(0,4).map(h=>`${h.object.name}: ${h.object.material?.name||''} at ${h.point.toArray().map(n=>n.toFixed(1))}`).join(' | ');
});
