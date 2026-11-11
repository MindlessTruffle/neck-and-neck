import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createWorld } from './art.js';
import { VolleyballGame } from './physics.js';
import { SmoothSimulation } from './motion.js';
import { requestGameCapture } from './capture.js';
import { GameAudio } from './audio.js';
import { GameMenu } from './game-menu.jsx';
import './style.css';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function App() {
  const canvas = useRef(null);
  const stage = useRef(null);
  const reticle = useRef(null);
  const runtime = useRef({ game: null, world: null, audio: null, motion: null, keys: new Set(), edges: {}, started: false });
  const neckAim = useRef({ yaw: 0, pitch: .15, extension: .35 });
  const cameraAim = useRef({ yaw: 0, pitch: 0, distance: 7.2 });
  const interaction = useRef({ mouseDown: false, cameraDrag: false, hadLock: false, explicitUnlock: false, touches: new Map(), walk: { x: 0, z: 0 }, lastTap: 0 });
  const menuRef = useRef('lobby');
  const panel = useRef(null);
  const [menu, setMenu] = useState('lobby');
  const [mode, setMode] = useState('2v2');
  const [difficulty, setDifficulty] = useState('club');
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [muted, setMuted] = useState(false);
  const [music, setMusic] = useState(true);
  const [result, setResult] = useState(null);
  const [mouseFocused, setMouseFocused] = useState(false);
  const [captureFailed, setCaptureFailed] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const clearInput = () => {
    runtime.current.keys.clear();
    runtime.current.edges = {};
    runtime.current.motion?.reset();
    interaction.current.mouseDown = false;
    interaction.current.cameraDrag = false;
    setMouseFocused(false);
    interaction.current.touches.clear();
    interaction.current.walk = { x: 0, z: 0 };
  };

  const showMenu = next => {
    menuRef.current = next;
    setMenu(next);
    clearInput();
    if (runtime.current.game) runtime.current.game.paused = Boolean(next);
    if (next && document.pointerLockElement) document.exitPointerLock();
  };

  const captureMouse = () => {
    requestGameCapture({
      canvas: canvas.current, stage: stage.current,
      coarse: window.matchMedia('(pointer: coarse)').matches,
      onError: error => {
        const locked = document.pointerLockElement === canvas.current;
        if (!locked && canvas.current) canvas.current.dataset.captureError = error?.message || 'Pointer capture was refused.';
        setCaptureFailed(!locked); setMouseFocused(locked);
      },
    });
  };

  const toggleMouseFocus = () => {
    if (document.pointerLockElement === canvas.current) {
      interaction.current.explicitUnlock = true;
      document.exitPointerLock();
    } else captureMouse();
  };

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    else stage.current?.requestFullscreen?.().catch(() => {});
  };

  const immersiveFocus = () => {
    captureMouse();
  };

  useEffect(() => {
    const audio = new GameAudio();
    runtime.current.audio = audio;
    let frame, observer, cleanup, disposed = false;
    try {
      const world = createWorld({ canvas: canvas.current });
      const game = new VolleyballGame({ mode, difficulty, onEvent: event => {
        if (!runtime.current.started) return;
        audio.event(event);
        world.impact?.(event);
        if (event.type === 'hit' && event.player === 0 && reticle.current) {
          reticle.current.getAnimations().forEach(animation => animation.cancel());
          reticle.current.animate([
            { transform: 'translate(-50%, -50%) scale(1.65)', filter: 'drop-shadow(0 0 8px #ffed9b)' },
            { transform: 'translate(-50%, -50%) scale(1)', filter: 'drop-shadow(0 2px 1px #28241f)' },
          ], { duration: 320, easing: 'ease-out' });
        }
        if (event.type === 'win') {
          setResult({ score: [...event.score], winner: event.team });
          showMenu('finished');
        }
      } });
      runtime.current.world = world;
      runtime.current.game = game;
      game.paused = true;
      const motion = new SmoothSimulation(game);
      runtime.current.motion = motion;
      const resize = () => world.resize(window.innerWidth, window.innerHeight);
      observer = new ResizeObserver(resize);
      observer.observe(canvas.current.parentElement);
      resize();
      let last = performance.now(), telemetryAt = 0, fpsAt = last, frameCount = 0;
      const loop = now => {
        if (disposed) return;
        const dt = Math.max(0, Math.min((now - last) / 1000, .1));
        last = now;
        const { keys, edges } = runtime.current;
        const aim = neckAim.current;
        const view = cameraAim.current;
        let renderGame;
        if (!menuRef.current) {
          view.yaw += (Number(keys.has('KeyL')) - Number(keys.has('KeyJ'))) * dt * 1.6;
          aim.extension = clamp(aim.extension + (Number(keys.has('KeyE')) - Number(keys.has('KeyQ'))) * dt * .65, 0, 1);
          const forward = Number(keys.has('KeyW') || keys.has('ArrowUp')) - Number(keys.has('KeyS') || keys.has('ArrowDown')) - interaction.current.walk.z;
          const strafe = Number(keys.has('KeyD') || keys.has('ArrowRight')) - Number(keys.has('KeyA') || keys.has('ArrowLeft')) + interaction.current.walk.x;
          renderGame = motion.advance(dt, {
            x: forward * Math.cos(view.yaw) - strafe * Math.sin(view.yaw),
            z: forward * Math.sin(view.yaw) + strafe * Math.cos(view.yaw),
            neckYaw: aim.yaw,
            neckPitch: aim.pitch,
            extension: aim.extension,
            ...edges,
          });
        } else renderGame = motion.reset();
        runtime.current.edges = {};
        world.setCamera?.(view);
        world.update(Math.min(dt, .05), renderGame, now / 1000);
        world.renderer.render(world.scene, world.camera);
        frameCount++;
        if (now - fpsAt > 1000) {
          canvas.current.dataset.fps = String(Math.round(frameCount * 1000 / (now - fpsAt)));
          frameCount = 0; fpsAt = now;
        }
        if (now - telemetryAt > 100) {
          telemetryAt = now;
          canvas.current.dataset.neckAim = `${aim.yaw.toFixed(3)},${aim.pitch.toFixed(3)},${aim.extension.toFixed(3)}`;
          canvas.current.dataset.cameraAim = `${view.yaw.toFixed(3)},${view.pitch.toFixed(3)},${view.distance.toFixed(2)}`;
          canvas.current.dataset.phase = game.phase;
          canvas.current.dataset.cameraHeight = world.camera.position.y.toFixed(2);
          canvas.current.dataset.volley = String(game.rallyHits);
          canvas.current.dataset.ballSpeed = Math.hypot(game.ball.vx, game.ball.vy, game.ball.vz).toFixed(2);
          canvas.current.dataset.physicsHz = '120';
          canvas.current.dataset.renderStats = JSON.stringify({ calls: world.renderer.info.render.calls, triangles: world.renderer.info.render.triangles });
          canvas.current.dataset.head = [game.players[0].head.x, game.players[0].head.y, game.players[0].head.z].map(value => value.toFixed(3)).join(',');
        }
        frame = requestAnimationFrame(loop);
      };
      frame = requestAnimationFrame(loop);
      Promise.resolve(world.ready).then(() => { if (!disposed) setReady(true); }).catch(cause => {
        console.error(cause);
        if (!disposed) setError('The courtyard is not ready. Rally the herd and try again.');
      });

      const keydown = event => {
        if (event.code === 'KeyF' && !event.repeat) { event.preventDefault(); toggleFullscreen(); return; }
        if (menuRef.current) {
          if (event.code === 'KeyP' && menuRef.current === 'pause' && !document.querySelector('.help-scroll')) resume();
          return;
        }
        if (event.code === 'AltLeft' || event.code === 'AltRight') {
          event.preventDefault();
          if (!event.repeat) toggleMouseFocus();
          return;
        }
        if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyQ', 'KeyE'].includes(event.code)) event.preventDefault();
        if (event.repeat) return;
        runtime.current.keys.add(event.code);
        if (event.code === 'Space') runtime.current.edges.jump = true;
        if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') runtime.current.edges.dash = true;
        if (event.code === 'Escape' || event.code === 'KeyP') showMenu('pause');
        if (event.code === 'KeyM') setMuted(value => !value);
        if (event.code === 'KeyR') neckAim.current = { yaw: 0, pitch: .15, extension: neckAim.current.extension };
        if (event.code === 'KeyC') {
          cameraAim.current = { yaw: 0, pitch: 0, distance: 7.2 };
          world.resetCamera();
        }
      };
      const keyup = event => runtime.current.keys.delete(event.code);
      const mousemove = event => {
        if (menuRef.current || (document.pointerLockElement !== canvas.current && !interaction.current.mouseDown && !interaction.current.cameraDrag)) return;
        if (interaction.current.cameraDrag) {
          cameraAim.current.yaw += event.movementX * .0037;
        } else {
          neckAim.current.yaw = clamp(neckAim.current.yaw + event.movementX * .009, -1.8, 1.8);
          neckAim.current.pitch = clamp(neckAim.current.pitch - event.movementY * .009, -.9, 1.2);
        }
      };
      const mouseup = event => {
        if (event.button === 0) interaction.current.mouseDown = false;
        if (event.button === 2) interaction.current.cameraDrag = false;
      };
      const wheel = event => {
        if (menuRef.current) return;
        event.preventDefault();
        if (interaction.current.cameraDrag) cameraAim.current.distance = clamp(cameraAim.current.distance + event.deltaY * .004, 6, 10);
        else neckAim.current.extension = clamp(neckAim.current.extension - event.deltaY * .0012, 0, 1);
      };
      const lockchange = () => {
        const locked = document.pointerLockElement === canvas.current;
        setMouseFocused(locked);
        if (locked && menuRef.current) { document.exitPointerLock(); return; }
        if (locked) { setCaptureFailed(false); delete canvas.current.dataset.captureError; }
        if (!locked && interaction.current.hadLock && !menuRef.current && !interaction.current.explicitUnlock) showMenu('pause');
        interaction.current.explicitUnlock = false;
        interaction.current.hadLock = locked;
      };
      const lockerror = () => {
        const locked = document.pointerLockElement === canvas.current;
        setCaptureFailed(!locked);
        setMouseFocused(locked);
      };
      const blur = () => {
        if (!menuRef.current && runtime.current.started) showMenu('pause');
        else clearInput();
      };
      const fullscreenchange = () => {
        setIsFullscreen(Boolean(document.fullscreenElement));
        if (!document.fullscreenElement && runtime.current.started && !menuRef.current) showMenu('pause');
      };
      window.addEventListener('keydown', keydown);
      window.addEventListener('keyup', keyup);
      window.addEventListener('mousemove', mousemove);
      window.addEventListener('mouseup', mouseup);
      window.addEventListener('wheel', wheel, { passive: false });
      window.addEventListener('blur', blur);
      document.addEventListener('pointerlockchange', lockchange);
      document.addEventListener('pointerlockerror', lockerror);
      document.addEventListener('fullscreenchange', fullscreenchange);
      cleanup = () => {
        disposed = true;
        cancelAnimationFrame(frame);
        observer.disconnect();
        world.dispose();
        audio.dispose();
        window.removeEventListener('keydown', keydown);
        window.removeEventListener('keyup', keyup);
        window.removeEventListener('mousemove', mousemove);
        window.removeEventListener('mouseup', mouseup);
        window.removeEventListener('wheel', wheel);
        window.removeEventListener('blur', blur);
        document.removeEventListener('pointerlockchange', lockchange);
        document.removeEventListener('pointerlockerror', lockerror);
        document.removeEventListener('fullscreenchange', fullscreenchange);
      };
      return cleanup;
    } catch (cause) {
      console.error(cause);
      setError('The courtyard could not be prepared. Try loading it again.');
      disposed = true;
      cancelAnimationFrame(frame);
      observer?.disconnect();
      runtime.current.world?.dispose();
      audio.dispose();
    }
  }, []);

  useEffect(() => { runtime.current.audio?.setMuted(muted); }, [muted]);
  useEffect(() => { runtime.current.audio?.setMusic(music); }, [music]);
  useEffect(() => {
    if (!menu) return;
    const button = panel.current?.querySelector('.play-button:not(:disabled)') || panel.current?.querySelector('button:not(:disabled)');
    button?.focus({ preventScroll: true });
    const trap = event => {
      if (event.key !== 'Tab') return;
      const controls = [...panel.current.querySelectorAll('button:not(:disabled),select,input,summary')].filter(element => element.getClientRects().length);
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', trap);
    return () => document.removeEventListener('keydown', trap);
  }, [menu, ready]);

  function begin() {
    const game = runtime.current.game;
    if (!game) return;
    neckAim.current = { yaw: 0, pitch: .15, extension: .35 };
    cameraAim.current = { yaw: 0, pitch: 0, distance: 7.2 };
    game.reset({ mode, difficulty });
    game.start();
    runtime.current.started = true;
    runtime.current.audio.unlock();
    setResult(null);
    showMenu(null);
    immersiveFocus();
  }

  function resume() {
    runtime.current.audio?.unlock();
    showMenu(null);
    immersiveFocus();
  }

  const clubhouse = () => {
    runtime.current.started = false;
    runtime.current.game?.reset({ mode, difficulty });
    neckAim.current = { yaw: 0, pitch: .15, extension: .35 };
    cameraAim.current = { yaw: 0, pitch: 0, distance: 7.2 };
    showMenu('lobby');
  };

  const bonk = () => {
    runtime.current.edges.swing = true;
    runtime.current.edges.serve = true;
    runtime.current.audio?.unlock();
  };

  const pointerDown = event => {
    if (menuRef.current) return;
    if (event.pointerType === 'touch') {
      const touches = interaction.current.touches;
      touches.set(event.pointerId, { x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY, side: event.clientX < innerWidth * .45 ? 'walk' : 'look', moved: 0 });
      event.currentTarget.setPointerCapture(event.pointerId);
      if (touches.size === 2) {
        for (const point of touches.values()) point.consumed = true;
        runtime.current.edges.jump = true;
      }
      if (touches.size >= 3) showMenu('pause');
    } else {
      if (document.pointerLockElement !== canvas.current) captureMouse();
      if (event.button === 2) interaction.current.cameraDrag = true;
      else if (event.button === 0) { interaction.current.mouseDown = true; bonk(); }
    }
  };

  const pointerMove = event => {
    if (menuRef.current || event.pointerType !== 'touch') return;
    const point = interaction.current.touches.get(event.pointerId);
    if (!point) return;
    const dx = event.clientX - point.x, dy = event.clientY - point.y;
    point.moved += Math.hypot(dx, dy);
    if (point.side === 'look') {
      neckAim.current.yaw = clamp(neckAim.current.yaw + dx * .012, -1.8, 1.8);
      neckAim.current.pitch = clamp(neckAim.current.pitch - dy * .012, -.9, 1.2);
    } else interaction.current.walk = { x: clamp((event.clientX - point.startX) / 60, -1, 1), z: clamp((event.clientY - point.startY) / 60, -1, 1) };
    point.x = event.clientX; point.y = event.clientY;
  };

  const pointerUp = event => {
    if (event.pointerType !== 'touch') {
      if (event.button === 0) interaction.current.mouseDown = false;
      if (event.button === 2) interaction.current.cameraDrag = false;
      return;
    }
    const point = interaction.current.touches.get(event.pointerId);
    if (event.type !== 'pointercancel' && point && !point.consumed && point.moved < 12 && !menuRef.current) bonk();
    if (point?.side === 'walk') interaction.current.walk = { x: 0, z: 0 };
    interaction.current.touches.delete(event.pointerId);
  };

  return <main ref={stage} className="meadow" data-camera="elevated-locked" data-playing={!menu} data-mouse-focus={mouseFocused}>
    <canvas ref={canvas} tabIndex={menu ? -1 : 0} aria-label="Elevated-view giraffe volleyball. Mouse swings your floppy neck independently. Hold right mouse to turn camera horizontally. Alt locks or releases mouse with a centered cursor. WASD walks, click headbutts or serves, Q and E stretch, Space jumps, Escape pauses." onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp} onContextMenu={event => event.preventDefault()} />
    {!menu && <>
      <div ref={reticle} className="center-cursor" aria-hidden="true" data-locked={mouseFocused}>
        <svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="10"/><path d="M20 3v6m0 22v6M3 20h6m22 0h6"/><circle className="cursor-dot" cx="20" cy="20" r="2.5"/></svg>
      </div>
      {!mouseFocused && <button className="capture-prompt" onClick={captureMouse}>
        {captureFailed ? 'Click to retry mouse lock' : 'Click to lock mouse'}
        <small>{captureFailed ? 'Capture blocked? Open in Chrome or Edge. Drag still swings.' : 'Centered cursor · Alt releases · Esc pauses'}</small>
      </button>}
    </>}
    {menu && <GameMenu
      menu={menu} mode={mode} difficulty={difficulty} onMode={setMode} onDifficulty={setDifficulty}
      onPlay={menu === 'pause' ? resume : begin} onBack={clubhouse} ready={ready} error={error} result={result}
      muted={muted} music={music} onMuted={() => setMuted(value => !value)} onMusic={() => setMusic(value => !value)}
      captureFailed={captureFailed} onReload={() => location.reload()} panelRef={panel}
      onFullscreen={toggleFullscreen} isFullscreen={isFullscreen}
      onMenuSound={unlock => { if (unlock) runtime.current.audio?.unlock(); runtime.current.audio?.event('menu'); }}
    />}
  </main>;
}

createRoot(document.getElementById('root')).render(<App/>);



