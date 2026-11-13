import * as THREE from 'three';
import { BALL_RADIUS } from './physics.js';

const IVORY = '#fff5d4', GOLD = '#ffd35c', TEAL = '#5edbcc', CORAL = '#ff8d70';
const UP = new THREE.Vector3(0, 1, 0);
const vector = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const TRAIL_SAMPLES = 24;
const ACTION_LABELS = { set: 'SET!', spike: 'SPIKE!', block: 'BLOCK!', dive: 'DIVE!' };
const ABILITIES = {
  feather: { text: 'FEATHER FLOAT!', color: '#d8f4ee' },
  spring: { text: 'SPRING STEP!', color: '#ffd56c' },
  magnet: { text: 'MAGNET HEAD!', color: '#f3a4db' },
  rocket: { text: 'ROCKET HOOVES!', color: '#ffa574' },
  shield: { text: 'IRON CANOPY!', color: '#82cbe8' },
};

/** Reusable, bounded world effects. A missed swing never receives impact feedback. */
export function createVFX(scene, { camera, reducedMotion = false, mobile = globalThis.matchMedia?.('(pointer: coarse)')?.matches ?? false } = {}) {
  const root = new THREE.Group();
  root.name = 'AnimeSportsEffects';
  scene.add(root);
  const geometries = {
    ring: new THREE.TorusGeometry(1, .025, 5, 64),
    slash: new THREE.TorusGeometry(1, .055, 5, 42, Math.PI * 1.35),
    spark: new THREE.ConeGeometry(.085, .8, 4),
    petal: new THREE.BoxGeometry(.11, .035, .22),
    puff: new THREE.IcosahedronGeometry(.11, 0),
  };
  const pool = [], lightning = [];
  let impulse = 0, clock = 0, disposed = false, volleyCount = 0, lastHitTeam = 0, successPulse = 0, lastAbility = null;
  const anticipationTimes = new Map();
  // Prepaint every comic label before play. Impacts only switch existing maps.
  const calloutTextures = new Map();
  function comicTexture(text, fill) {
    const canvas = globalThis.document?.createElement?.('canvas') || (globalThis.OffscreenCanvas ? new globalThis.OffscreenCanvas(512, 160) : null);
    let texture;
    if (canvas) {
      canvas.width = 512; canvas.height = 160;
      const context = canvas.getContext('2d');
      if (context) {
        context.translate(256, 82);
        context.rotate(-.035);
        context.textAlign = 'center'; context.textBaseline = 'middle';
        context.font = `900 ${text.length > 12 ? 50 : text.length > 10 ? 58 : 76}px "Lilita One", Impact, sans-serif`;
        context.lineJoin = 'round'; context.miterLimit = 2;
        context.strokeStyle = '#28241f'; context.lineWidth = 16;
        context.strokeText(text, 0, 0);
        context.fillStyle = fill; context.fillText(text, 0, 0);
        texture = new THREE.CanvasTexture(canvas);
      }
    }
    // Headless regression checks still exercise the same pool and texture lifecycle.
    texture ||= new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
    texture.name = `Comic_${text}`;
    texture.userData.text = text;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = false; texture.needsUpdate = true;
    calloutTextures.set(text, texture);
    return texture;
  }
  comicTexture('NICE!', GOLD);
  comicTexture('GOOD SAVE!', TEAL);
  comicTexture('POINT!', IVORY);
  comicTexture('VICTORY!', GOLD);
  for (let count = 2; count <= 12; count++) comicTexture(`VOLLEY ${count}!`, count % 3 === 0 ? CORAL : count % 3 === 1 ? GOLD : TEAL);
  comicTexture('EPIC RALLY!', GOLD);
  comicTexture('TOSS!', IVORY);
  for (const [action, label] of Object.entries(ACTION_LABELS)) comicTexture(label, action === 'spike' ? CORAL : action === 'set' ? TEAL : GOLD);
  for (const ability of Object.values(ABILITIES)) comicTexture(ability.text, ability.color);
  const callouts = [];
  for (let i = 0; i < 4; i++) {
    const material = new THREE.SpriteMaterial({ map: calloutTextures.get('NICE!'), transparent: true, opacity: 0, depthTest: false, depthWrite: false, toneMapped: false });
    const object = new THREE.Sprite(material);
    object.name = 'VolleyComicCallout'; object.visible = false; object.renderOrder = 25;
    root.add(object);
    callouts.push({ object, life: 0, duration: .72, y: 0, width: 3.0, duringServe: false });
  }
  function announce(text, point, duration = .72, { height = .8, width = 3, duringServe = false } = {}) {
    const label = callouts.find(item => item.life <= 0) || callouts.reduce((oldest, item) => item.life < oldest.life ? item : oldest, callouts[0]);
    label.life = label.duration = duration;
    label.y = point.y + height; label.width = width; label.duringServe = duringServe;
    label.object.position.set(point.x, label.y, point.z);
    label.object.scale.set(width, width / 3.2, 1);
    label.object.material.map = calloutTextures.get(text) || calloutTextures.get('EPIC RALLY!');
    label.object.material.opacity = 1;
    label.object.material.rotation = -.055;
    label.object.visible = true;
    label.object.userData.text = text;
  }
  const aura = [0, 1].map(index => {
    const object = new THREE.Mesh(geometries.ring, new THREE.MeshBasicMaterial({ color: index ? GOLD : TEAL, transparent: true, opacity: .75, depthWrite: false }));
    object.name = `RallyBallAura_${index}`; object.visible = false; root.add(object);
    return object;
  });
  function addPool(type, count) {
    for (let i = 0; i < count; i++) {
      // Opaque-looking colors suit the cel world; alpha only fades the effect away.
      const material = new THREE.MeshBasicMaterial({ color: IVORY, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
      const object = new THREE.Mesh(geometries[type], material);
      object.name = `Effect_${type}`;
      object.visible = false;
      object.frustumCulled = false;
      root.add(object);
      pool.push({ type, object, velocity: vector(), spin: vector(), life: 0, duration: 1, growth: 0, initialScale: 1, gravity: 0 });
    }
  }
  addPool('ring', 24); addPool('slash', 18); addPool('spark', 130); addPool('petal', 90); addPool('puff', 40);
  // One draw call for the entire score explosion. Every piece is allocated once.
  const debrisGeometry = new THREE.IcosahedronGeometry(.16, 0);
  const debrisMaterial = new THREE.MeshBasicMaterial({ color: IVORY, transparent: true, opacity: 1 });
  const debris = new THREE.InstancedMesh(debrisGeometry, debrisMaterial, mobile ? 36 : 88);
  debris.name = 'ScoreExplosionDebris'; debris.frustumCulled = false; debris.visible = false; debris.count = 0;
  debris.instanceMatrix.setUsage(THREE.DynamicDrawUsage); root.add(debris);
  const fragments = Array.from({ length: debris.instanceMatrix.count }, () => ({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, size: 1, spin: 0 }));
  const debrisTransform = new THREE.Object3D(), debrisColor = new THREE.Color();
  let debrisLife = 0, debrisDuration = 1;
  function scoreExplosion(team, final, origin) {
    const count = reducedMotion ? 8 : mobile ? (final ? 36 : 24) : final ? 88 : 58;
    debris.count = count; debris.visible = true; debrisLife = debrisDuration = final ? 2.25 : 1.65;
    for (let i = 0; i < count; i++) {
      const fragment = fragments[i], angle = i * 2.39996, speed = reducedMotion ? 1.2 : (final ? 8 : 6) + Math.random() * 8;
      fragment.x = origin.x + Math.cos(angle) * .4; fragment.y = origin.y + .25; fragment.z = origin.z + Math.sin(angle) * .4;
      fragment.vx = Math.cos(angle) * speed; fragment.vz = Math.sin(angle) * speed * .72; fragment.vy = reducedMotion ? .6 : 4 + Math.random() * 8;
      fragment.size = reducedMotion ? .4 : .5 + Math.random() * 1.4; fragment.spin = Math.random() * 8 - 4;
      // Score impacts read as a hot orange blast for either team; team colors
      // remain in the rings, callouts, and rally feedback around it.
      debrisColor.set([ '#ff6a24', '#ff9a32', '#ffd15a', '#fff0a3' ][i % 4]); debris.setColorAt(i, debrisColor);
      debrisTransform.position.set(fragment.x, fragment.y, fragment.z); debrisTransform.scale.setScalar(fragment.size); debrisTransform.rotation.set(0, 0, 0); debrisTransform.updateMatrix(); debris.setMatrixAt(i, debrisTransform.matrix);
    }
    debris.instanceMatrix.needsUpdate = true; debris.instanceColor.needsUpdate = true;
    const center = vector(0, .12, 0);
    for (let i = 0; i < (reducedMotion ? 1 : mobile ? final ? 3 : 2 : final ? 6 : 4); i++) {
      center.set(origin.x, origin.y, origin.z);
      const wave = acquire('ring', center, i % 2 ? '#fff0a3' : '#ff8730', .72 + i * .09);
      if (!wave) break;
      wave.object.rotation.x = Math.PI / 2 + (i % 3 === 2 ? .45 : 0);
      wave.initialScale = .6 + i * .28; wave.growth = reducedMotion ? 4 : 15 + i * 2;
      wave.object.scale.setScalar(wave.initialScale);
    }
  }
  for (let i = 0; i < 14; i++) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(27), 3));
    const material = new THREE.LineBasicMaterial({ color: IVORY, transparent: true, opacity: 0, depthWrite: false });
    const object = new THREE.Line(geometry, material);
    object.name = 'Effect_lightning';
    object.visible = false;
    root.add(object);
    lightning.push({ object, life: 0, duration: .2 });
  }
  function acquire(type, point, tint, duration) {
    const item = pool.find(effect => effect.type === type && effect.life <= 0);
    if (!item) return null;
    item.life = item.duration = duration;
    item.velocity.set(0, 0, 0); item.spin.set(0, 0, 0);
    item.growth = 0; item.initialScale = 1; item.gravity = 0;
    item.object.position.copy(point);
    item.object.rotation.set(0, 0, 0);
    item.object.scale.setScalar(1);
    item.object.material.color.set(tint);
    item.object.material.opacity = 1;
    item.object.visible = true;
    return item;
  }
  function shock(point, normal, tint, power = 1) {
    const item = acquire('ring', point, tint, .38);
    if (!item) return;
    item.object.quaternion.setFromUnitVectors(vector(0, 0, 1), normal.clone().normalize());
    item.initialScale = .18; item.growth = 4.8 * power;
    item.object.scale.setScalar(.18);
  }
  function burst(point, tint, count, power = 1, confetti = false) {
    count = Math.round(count * (reducedMotion ? .22 : mobile ? .5 : 1));
    for (let i = 0; i < count; i++) {
      const direction = vector(Math.random() - .5, Math.random() - .2, Math.random() - .5).normalize();
      const effect = acquire(confetti ? 'petal' : 'spark', point, i % 3 ? tint : IVORY, confetti ? 1.6 + Math.random() : .22 + Math.random() * .15);
      if (!effect) break;
      effect.velocity.copy(direction).multiplyScalar((confetti ? 3 : 4.8) * power);
      effect.velocity.y += confetti ? 4.5 : .5;
      effect.gravity = confetti ? 4 : 3;
      effect.initialScale = confetti ? .7 + Math.random() : .45 + Math.random() * .55;
      effect.object.quaternion.setFromUnitVectors(UP, direction);
      effect.object.scale.setScalar(effect.initialScale);
      effect.spin.set(Math.random() * 5, Math.random() * 5, Math.random() * 5);
    }
  }
  function bolt(point, tint, power) {
    const item = lightning.find(effect => effect.life <= 0);
    if (!item) return;
    const direction = vector(Math.random() - .5, Math.random() - .25, Math.random() - .5).normalize();
    const positions = item.object.geometry.attributes.position;
    for (let i = 0; i < 9; i++) {
      const distance = i / 8 * power * 1.8;
      positions.setXYZ(i, point.x + direction.x * distance + (Math.random() - .5) * .13, point.y + direction.y * distance + (Math.random() - .5) * .13, point.z + direction.z * distance + (Math.random() - .5) * .13);
    }
    positions.needsUpdate = true;
    item.life = item.duration = .10 + Math.random() * .08;
    item.object.material.color.set(tint);
    item.object.visible = true;
  }
  function impact(event = {}) {
    if (disposed) return { hitstop: 0 };
    const type = event.type || 'hit';
    const point = vector(event.x, event.y ?? .07, event.z);
    const rawPower = Number.isFinite(event.power) ? event.power : Number.isFinite(event.strength) ? event.strength : .6;
    const power = THREE.MathUtils.clamp(rawPower, .15, 1.5);
    const ability = ABILITIES[event.ability];
    const tint = ability?.color || (event.team === 1 ? CORAL : GOLD);
    if (type === 'round') {
      volleyCount = 0; successPulse = 0; lastAbility = null; clearTrail();
      const kit = event.abilities?.find(entry => entry.player === 0);
      const identity = ABILITIES[kit?.id];
      if (identity) announce(identity.text, vector(kit.x ?? -4.8, kit.y ?? 3.2, kit.z ?? 0), 1.1, { height: .7, width: 3.8, duringServe: true });
      return { hitstop: 0 };
    }
    if (type === 'ability') {
      if (!ability) return { hitstop: 0 };
      announce(ability.text, point, .95, { width: 3.8, duringServe: true });
      const forward = vector(event.team === 1 ? -1 : 1, 0, 0);
      shock(point, event.ability === 'shield' ? forward : UP, ability.color, 1.1);
      if (event.ability === 'magnet' && !reducedMotion) for (let i = 0; i < 2; i++) bolt(point, ability.color, .7);
      burst(point, ability.color, 16, .65, event.ability === 'feather');
      return { hitstop: 0 };
    }
    if (type === 'toss') {
      volleyCount = 0; successPulse = 0; clearTrail();
      announce('TOSS!', point, .5, { width: 2.1, duringServe: true });
      shock(point, UP, IVORY, .3);
      return { hitstop: 0 };
    }
    if (/score|win|finish/.test(type)) {
      volleyCount = 0; successPulse = 0; lastAbility = null;
      impulse = Math.min(.18, impulse + (type === 'score' ? .09 : .15));
      clearTrail();
      scoreExplosion(event.team, type !== 'score', point);
      burst(point.clone().setY(point.y + 1), '#ff8730', type === 'score' ? 34 : 66, 1.1, true);
      shock(point.clone().setY(.07), UP, '#ff8730', 1.4);
      announce(type === 'score' ? 'POINT!' : 'VICTORY!', vector(point.x, point.y + .7, point.z), type === 'score' ? .82 : 1.3, { width: type === 'score' ? 3 : 4.8 });
      return { hitstop: 0 };
    }
    if (/jump|land|dash|dive/.test(type)) {
      const floor = point.clone().setY(.06);
      shock(floor, UP, type === 'dash' ? TEAL : IVORY, .4);
      if (type === 'dive') announce('DIVE!', point, .55, { height: 1, width: 2.6 });
      for (let i = 0; i < (reducedMotion ? 2 : 7); i++) {
        const effect = acquire('puff', floor, '#e8daa2', .25 + Math.random() * .15);
        if (!effect) break;
        effect.velocity.set((Math.random() - .5) * 2, Math.random() * .8, (Math.random() - .5) * 2);
        effect.growth = .7; effect.gravity = 1;
      }
      return { hitstop: 0 };
    }
    // The simulation emits smash when a headbutt begins, even if it misses.
    // Show only the anticipation arc; actual contact owns sparks, bolts and shake.
    if (type === 'smash' || type === 'swing' || type === 'action') {
      const action = event.action || 'spike';
      if (action === 'dive') return { hitstop: 0 };
      const key = event.player ?? 0;
      if (clock - (anticipationTimes.get(key) ?? -Infinity) < .075) return { hitstop: 0 };
      anticipationTimes.set(key, clock);
      if (action === 'set' || action === 'block') {
        shock(point, action === 'block' ? vector(event.team === 1 ? -1 : 1, 0, 0) : UP, action === 'set' ? TEAL : IVORY, .32);
        return { hitstop: 0 };
      }
      if (!reducedMotion) {
        const slash = acquire('slash', point, tint, .18);
        if (slash) {
          slash.object.rotation.set(.4, event.team === 1 ? Math.PI / 2 : -Math.PI / 2, -.4);
          slash.initialScale = .28; slash.growth = 1.4;
          slash.object.scale.setScalar(slash.initialScale);
        }
        if (action === 'bump' || action === 'spike') {
          const puff = acquire('puff', point, IVORY, .16);
          if (puff) { puff.initialScale = .45; puff.growth = 2.2; }
        }
      }
      return { hitstop: 0 };
    }
    if (type === 'serve' || type === 'net') {
      if (type === 'serve') { volleyCount = 0; successPulse = 0; lastHitTeam = event.team ?? 0; tintTrail(lastHitTeam ? CORAL : TEAL); }
      shock(point, UP, type === 'net' ? IVORY : tint, .4);
      return { hitstop: 0 };
    }
    volleyCount = Number.isFinite(event.rallyHits) ? Math.max(1, Math.floor(event.rallyHits)) : volleyCount + 1;
    lastHitTeam = event.team ?? 0;
    lastAbility = ability || null;
    successPulse = 1;
    const callout = volleyCount > 12 ? 'EPIC RALLY!' : volleyCount > 1 ? `VOLLEY ${volleyCount}!` : event.assisted || event.softContact ? 'GOOD SAVE!' : 'NICE!';
    if (ACTION_LABELS[event.action]) {
      announce(ACTION_LABELS[event.action], point);
      if (volleyCount >= 3) announce(callout, point, .72, { height: 1.65, width: 2.3 });
    } else announce(callout, point);
    tintTrail(ability?.color || (volleyCount >= 5 ? GOLD : lastHitTeam ? CORAL : TEAL));
    const source = event.normal || event.velocity;
    const normal = source ? vector(source.x ?? source[0] ?? 1, source.y ?? source[1] ?? 0, source.z ?? source[2] ?? 0).normalize() : vector(1, .15, .25).normalize();
    const strong = power > .6;
    // Even a gentle, assisted contact gets an unmistakable success ring and chime.
    shock(point, normal, IVORY, .7 + power * .55);
    shock(point, UP, volleyCount >= 3 ? TEAL : tint, .5 + Math.min(volleyCount, 6) * .07);
    burst(point, tint, strong ? 26 : 12, .45 + power * .55);
    if (!reducedMotion && strong) {
      for (let i = 0; i < 2; i++) {
        const slash = acquire('slash', point, i ? tint : IVORY, .20 + i * .025);
        if (!slash) break;
        slash.object.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * 6);
        slash.initialScale = .4; slash.growth = 3.6 * power;
      }
      for (let i = 0; i < 3; i++) bolt(point, i % 2 ? IVORY : tint, power);
      impulse = Math.min(.095, impulse + .045 * power);
    }
    return { hitstop: 0 };
  }

  // Ring-buffered trail points and scalar vertex writes avoid hundreds of temporary
  // vectors per rendered frame. No GPU attributes or materials are rebuilt in play.
  const history = Array.from({ length: TRAIL_SAMPLES }, () => vector());
  const trailPositions = new Float32Array((TRAIL_SAMPLES - 1) * 18);
  const trailColors = new Float32Array((TRAIL_SAMPLES - 1) * 24);
  const trailGeometry = new THREE.BufferGeometry();
  trailGeometry.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));
  trailGeometry.setAttribute('color', new THREE.BufferAttribute(trailColors, 4));
  trailGeometry.setDrawRange(0, 0);
  const trail = new THREE.Mesh(trailGeometry, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: .45, depthWrite: false, side: THREE.DoubleSide }));
  trail.name = 'BallCometTrail'; trail.frustumCulled = false; root.add(trail);
  const trailTint = new THREE.Color(GOLD), ivory = new THREE.Color(IVORY);
  function tintTrail(tint) {
    trailTint.set(tint);
    for (let i = 0; i < TRAIL_SAMPLES - 1; i++) {
      const fade = Math.pow(1 - i / TRAIL_SAMPLES, 1.6);
      for (let j = 0; j < 6; j++) {
        const color = j < 2 ? trailTint : ivory, offset = i * 24 + j * 4;
        trailColors[offset] = color.r;
        trailColors[offset + 1] = color.g;
        trailColors[offset + 2] = color.b;
        trailColors[offset + 3] = fade;
      }
    }
    trailGeometry.attributes.color.needsUpdate = true;
  }
  tintTrail(GOLD);
  let historyHead = 0, historyCount = 0, trailClock = 0, streakClock = 0;
  let previousGame = null, previousPhase = null, previousPaused = false, previousHits = 0, previousRally = 0;
  const streakPoint = vector(), streakDirection = vector();
  function clearTrail() {
    historyHead = historyCount = 0; trailClock = 0;
    trail.visible = false; trailGeometry.setDrawRange(0, 0);
  }
  function writeTrailVertex(offset, point, side, sx, sy, sz) {
    trailPositions[offset] = point.x + sx * side;
    trailPositions[offset + 1] = point.y + sy * side;
    trailPositions[offset + 2] = point.z + sz * side;
  }
  function updateTrail(dt, game) {
    const ball = game?.ball, paused = !!game?.paused;
    if ((previousGame && game !== previousGame) || (game?.hits ?? 0) < previousHits) {
      volleyCount = 0; successPulse = 0;
      for (const label of callouts) { label.life = 0; label.object.visible = false; }
    }
    const reset = game !== previousGame || game?.phase !== previousPhase || paused !== previousPaused || (game?.hits ?? 0) < previousHits || (game?.rally ?? 0) !== previousRally;
    previousGame = game; previousPhase = game?.phase; previousPaused = paused;
    previousHits = game?.hits ?? 0; previousRally = game?.rally ?? 0;
    if (reset) clearTrail();
    if (game?.phase === 'serve' || game?.phase === 'attract' || game?.phase === 'point' || game?.phase === 'finished') { volleyCount = 0; successPulse = 0; }
    if (!ball || paused || game.phase !== 'play' || reducedMotion) { clearTrail(); return; }
    const speed = Math.hypot(ball.vx || 0, ball.vy || 0, ball.vz || 0);
    if (speed < .4) { clearTrail(); return; }
    trailClock += dt;
    if (trailClock > .015) {
      trailClock %= .015;
      const latest = history[historyHead];
      if (historyCount && Math.hypot(ball.x - latest.x, ball.y - latest.y, ball.z - latest.z) > 4) clearTrail();
      historyHead = (historyHead + TRAIL_SAMPLES - 1) % TRAIL_SAMPLES;
      history[historyHead].set(ball.x, ball.y, ball.z);
      historyCount = Math.min(TRAIL_SAMPLES, historyCount + 1);
    }
    const count = Math.max(0, historyCount - 1);
    trail.visible = count > 0;
    for (let i = 0; i < count; i++) {
      const a = history[(historyHead + i) % TRAIL_SAMPLES], b = history[(historyHead + i + 1) % TRAIL_SAMPLES];
      const fx = b.x - a.x, fy = b.y - a.y, fz = b.z - a.z;
      const vx = camera ? camera.position.x - a.x : 0, vy = camera ? camera.position.y - a.y : 1, vz = camera ? camera.position.z - a.z : 0;
      let sx = fy * vz - fz * vy, sy = fz * vx - fx * vz, sz = fx * vy - fy * vx;
      let length = Math.hypot(sx, sy, sz);
      if (length < 1e-8) { sx = 1; sy = 0; sz = 0; length = 1; }
      sx /= length; sy /= length; sz /= length;
      const width = Math.min(.13, .035 + speed * .004 + Math.min(volleyCount, 6) * .006);
      const wa = (1 - i / TRAIL_SAMPLES) * width, wb = (1 - (i + 1) / TRAIL_SAMPLES) * width;
      const offset = i * 18;
      writeTrailVertex(offset, a, wa, sx, sy, sz);
      writeTrailVertex(offset + 3, a, -wa, sx, sy, sz);
      writeTrailVertex(offset + 6, b, wb, sx, sy, sz);
      writeTrailVertex(offset + 9, a, -wa, sx, sy, sz);
      writeTrailVertex(offset + 12, b, -wb, sx, sy, sz);
      writeTrailVertex(offset + 15, b, wb, sx, sy, sz);
    }
    trailGeometry.setDrawRange(0, count * 6);
    trailGeometry.attributes.position.needsUpdate = true;
  }
  function update(dt, game, time = clock + dt) {
    if (disposed) return;
    clock = time; impulse *= Math.exp(-dt * 22);
    successPulse *= Math.exp(-dt * 6);
    if (debrisLife > 0) {
      debrisLife -= dt;
      if (debrisLife <= 0 || game?.paused || game?.phase === 'serve' || game?.phase === 'attract') { debrisLife = 0; debris.visible = false; }
      else {
        const age = debrisDuration - debrisLife;
        debrisMaterial.opacity = Math.min(1, debrisLife / .5);
        for (let i = 0; i < debris.count; i++) {
          const fragment = fragments[i];
          fragment.vy -= dt * 10; fragment.x += fragment.vx * dt; fragment.y += fragment.vy * dt; fragment.z += fragment.vz * dt;
          if (fragment.y < .08) { fragment.y = .08; fragment.vy = Math.abs(fragment.vy) * .3; fragment.vx *= .86; fragment.vz *= .86; }
          debrisTransform.position.set(fragment.x, fragment.y, fragment.z);
          debrisTransform.rotation.set(age * fragment.spin, age * fragment.spin * .7, age * 1.4);
          debrisTransform.scale.setScalar(fragment.size * Math.min(1, debrisLife * 3)); debrisTransform.updateMatrix(); debris.setMatrixAt(i, debrisTransform.matrix);
        }
        debris.instanceMatrix.needsUpdate = true;
      }
    }
    for (const label of callouts) {
      if (label.life <= 0) continue;
      label.life -= dt;
      if (label.life <= 0 || game?.paused || game?.phase === 'attract' || (game?.phase === 'serve' && !label.duringServe)) { label.life = 0; label.object.visible = false; continue; }
      const age = label.duration - label.life, progress = age / label.duration;
      const pop = reducedMotion ? 1 : 1 + Math.sin(Math.min(1, age / .18) * Math.PI) * .12;
      label.object.scale.set(label.width * pop, label.width / 3.2 * pop, 1);
      label.object.position.y = label.y + (reducedMotion ? 0 : age * .36);
      label.object.material.opacity = Math.min(1, label.life / .23);
      label.object.material.rotation = reducedMotion ? 0 : -.055 + Math.sin(progress * Math.PI) * .025;
    }
    for (const effect of pool) {
      if (effect.life <= 0) continue;
      effect.life -= dt;
      if (effect.life <= 0) { effect.object.visible = false; continue; }
      const age = effect.duration - effect.life, progress = age / effect.duration;
      effect.velocity.y -= effect.gravity * dt;
      effect.object.position.addScaledVector(effect.velocity, dt);
      effect.object.rotation.x += effect.spin.x * dt;
      effect.object.rotation.y += effect.spin.y * dt;
      effect.object.rotation.z += effect.spin.z * dt;
      effect.object.scale.setScalar(Math.max(.001, effect.initialScale + age * effect.growth) * (effect.type === 'spark' ? 1 - progress * .8 : 1));
      effect.object.material.opacity = (1 - progress) * (effect.type === 'puff' ? .35 : .9);
    }
    for (const effect of lightning) {
      if (effect.life <= 0) continue;
      effect.life -= dt;
      effect.object.visible = effect.life > 0;
      effect.object.material.opacity = Math.max(0, effect.life / effect.duration);
    }
    updateTrail(dt, game);
    const ball = game?.ball, inPlay = !!ball && game.phase === 'play' && !game.paused && volleyCount > 0;
    const ballSpeed = ball ? Math.hypot(ball.vx || 0, ball.vy || 0, ball.vz || 0) : 0;
    for (let i = 0; i < aura.length; i++) {
      const object = aura[i];
      object.visible = inPlay && (!i || volleyCount >= 3 || ballSpeed > 9);
      if (!object.visible) continue;
      object.position.set(ball.x, ball.y, ball.z);
      object.scale.setScalar(BALL_RADIUS * 1.35 + i * .065 + successPulse * .12);
      object.rotation.set(Math.PI / 3 + i * .7, reducedMotion ? i * 1.2 : clock * (i ? -2 : 2.3), i * .7);
      object.material.color.set(lastAbility?.color || (i || volleyCount >= 5 ? GOLD : lastHitTeam ? CORAL : TEAL));
      object.material.opacity = .48 + successPulse * .4;
    }
    streakClock += dt;
    if (streakClock > .09 && !reducedMotion && !game?.paused && game?.phase === 'play') {
      streakClock %= .09;
      for (const player of game.players) {
        if (Math.hypot(player.vx || 0, player.vz || 0) <= 7) continue;
        streakPoint.set(player.x, .6 + (player.y || 0), player.z);
        const effect = acquire('spark', streakPoint, player.team ? CORAL : TEAL, .18);
        if (!effect) continue;
        streakDirection.set(player.vx, 0, player.vz).normalize();
        effect.object.quaternion.setFromUnitVectors(UP, streakDirection);
        effect.initialScale = .8;
        effect.velocity.set(-player.vx * .25, 0, -player.vz * .25);
      }
    }
  }
  function setReducedMotion(value) {
    reducedMotion = !!value;
    if (reducedMotion) { impulse = 0; clearTrail(); }
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    root.removeFromParent();
    root.traverse(object => object.material?.dispose());
    Object.values(geometries).forEach(geometry => geometry.dispose());
    lightning.forEach(effect => effect.object.geometry.dispose());
    calloutTextures.forEach(texture => texture.dispose());
    trailGeometry.dispose();
    debrisGeometry.dispose();
    debris.dispose();
  }
  return { impact, update, setReducedMotion, cameraImpulse: () => impulse, dispose };
}
