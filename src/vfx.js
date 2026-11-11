import * as THREE from 'three';

const IVORY = '#fff5d4', GOLD = '#ffd35c', TEAL = '#5edbcc', CORAL = '#ff8d70';
const UP = new THREE.Vector3(0, 1, 0);
const vector = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

/** Bounded, reusable world effects: no effect allocates GPU resources on impact. */
export function createVFX(scene, { camera, reducedMotion = false } = {}) {
  const root = new THREE.Group(); root.name = 'AnimeSportsEffects'; scene.add(root);
  const geometries = {
    ring: new THREE.TorusGeometry(1, .025, 5, 64),
    slash: new THREE.TorusGeometry(1, .055, 5, 42, Math.PI * 1.35),
    spark: new THREE.ConeGeometry(.085, .8, 4),
    petal: new THREE.BoxGeometry(.11, .035, .22),
    puff: new THREE.IcosahedronGeometry(.11, 0),
  };
  const pool = [], lightning = [], history = [];
  const color = new THREE.Color(); let impulse = 0, clock = 0;
  function addPool(type, count) {
    for (let i = 0; i < count; i++) {
      const material = new THREE.MeshBasicMaterial({ color: IVORY, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, blending: type === 'petal' || type === 'puff' ? THREE.NormalBlending : THREE.AdditiveBlending });
      const object = new THREE.Mesh(geometries[type], material); object.visible = false; object.frustumCulled = false; root.add(object);
      pool.push({ type, object, velocity: vector(), spin: vector(), life: 0, duration: 1, growth: 0, initialScale: 1, gravity: 0 });
    }
  }
  addPool('ring', 24); addPool('slash', 18); addPool('spark', 130); addPool('petal', 90); addPool('puff', 40);
  for (let i = 0; i < 14; i++) {
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(27), 3));
    const material = new THREE.LineBasicMaterial({ color: IVORY, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    const object = new THREE.Line(geometry, material); object.visible = false; root.add(object); lightning.push({ object, life: 0, duration: .2 });
  }
  function acquire(type, point, tint, duration) {
    const item = pool.find(p => p.type === type && p.life <= 0); if (!item) return null;
    item.life = item.duration = duration; item.velocity.set(0, 0, 0); item.spin.set(0, 0, 0); item.growth = 0; item.initialScale = 1; item.gravity = 0;
    item.object.position.copy(point); item.object.rotation.set(0, 0, 0); item.object.scale.setScalar(1); item.object.material.color.set(tint); item.object.material.opacity = 1; item.object.visible = true;
    return item;
  }
  function shock(point, normal, tint, power = 1, delay = 0) {
    const item = acquire('ring', point, tint, .43 + delay); if (!item) return;
    item.object.quaternion.setFromUnitVectors(vector(0, 0, 1), normal.clone().normalize()); item.initialScale = .18; item.growth = 5.2 * power; item.object.scale.setScalar(.18);
  }
  function burst(point, tint, count, power = 1, confetti = false) {
    count = Math.round(count * (reducedMotion ? .22 : 1));
    for (let i = 0; i < count; i++) {
      const direction = vector(Math.random() - .5, Math.random() - .2, Math.random() - .5).normalize();
      const p = acquire(confetti ? 'petal' : 'spark', point, i % 3 ? tint : IVORY, confetti ? 1.8 + Math.random() : .24 + Math.random() * .2); if (!p) break;
      p.velocity.copy(direction).multiplyScalar((confetti ? 3.5 : 5.5) * power); p.velocity.y += confetti ? 5 : .5;
      p.gravity = confetti ? 4 : 3; p.initialScale = confetti ? .7 + Math.random() : .55 + Math.random() * .7;
      p.object.quaternion.setFromUnitVectors(UP, direction); p.object.scale.setScalar(p.initialScale);
      p.spin.set(Math.random() * 5, Math.random() * 5, Math.random() * 5);
    }
  }
  function bolt(point, tint, power) {
    const item = lightning.find(p => p.life <= 0); if (!item) return;
    const dir = vector(Math.random() - .5, Math.random() - .25, Math.random() - .5).normalize();
    const positions = item.object.geometry.attributes.position;
    for (let i = 0; i < 9; i++) { const d = i / 8 * power * 2; positions.setXYZ(i, point.x + dir.x * d + (Math.random() - .5) * .18, point.y + dir.y * d + (Math.random() - .5) * .18, point.z + dir.z * d + (Math.random() - .5) * .18); }
    positions.needsUpdate = true; item.life = item.duration = .13 + Math.random() * .12; item.object.material.color.set(tint); item.object.visible = true;
  }
  function impact(event = {}) {
    const type = event.type || 'hit', point = vector(event.x, event.y || .07, event.z), power = THREE.MathUtils.clamp(event.power || event.strength || 1, .45, 2);
    const tint = event.team === 1 ? CORAL : GOLD;
    if (/score|win|finish/.test(type)) { burst(point.clone().setY(2.4), event.team === 1 ? CORAL : TEAL, 64, 1.25, true); shock(point.clone().setY(.07), UP, GOLD, 1.7); return { hitstop: 0 }; }
    if (/jump|land|dash/.test(type)) {
      const floor = point.clone().setY(.06); shock(floor, UP, type === 'dash' ? TEAL : IVORY, .45);
      for (let i = 0; i < (reducedMotion ? 2 : 9); i++) { const p = acquire('puff', floor, '#e8daa2', .32 + Math.random() * .2); if (!p) break; p.velocity.set((Math.random() - .5) * 2, Math.random() * .8, (Math.random() - .5) * 2); p.growth = .9; p.gravity = 1; }
      return { hitstop: 0 };
    }
    const source = event.normal || event.velocity;
    const normal = source ? vector(source.x ?? source[0] ?? 1, source.y ?? source[1] ?? 0, source.z ?? source[2] ?? 0).normalize() : vector(event.vx || 1, event.vy || .15, event.vz || .25).normalize();
    shock(point, normal, IVORY, power); shock(point, UP, tint, power * .65, .06);
    burst(point, tint, /spike|smash/.test(type) ? 38 : 24, power);
    if (!reducedMotion) {
      for (let i = 0; i < 3; i++) { const p = acquire('slash', point, i % 2 ? tint : IVORY, .24 + i * .035); if (!p) break; p.object.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * 6); p.initialScale = .45; p.growth = 4.5 * power; }
      for (let i = 0; i < 5; i++) bolt(point, i % 2 ? IVORY : tint, power);
    }
    impulse = Math.min(.22, impulse + .085 * power) * (reducedMotion ? 0 : 1);
    return { hitstop: /spike|smash/.test(type) ? .055 : .035 };
  }
  const trailGeometry = new THREE.BufferGeometry(), trailPositions = new Float32Array(23 * 18), trailColors = new Float32Array(23 * 18);
  trailGeometry.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3)); trailGeometry.setAttribute('color', new THREE.BufferAttribute(trailColors, 3)); trailGeometry.setDrawRange(0, 0);
  const trail = new THREE.Mesh(trailGeometry, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: .55, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending })); trail.frustumCulled = false; root.add(trail);
  let trailClock = 0, streakClock = 0;
  function update(dt, game, time = clock + dt) {
    clock = time; impulse *= Math.exp(-dt * 19);
    for (const p of pool) {
      if (p.life <= 0) continue; p.life -= dt; if (p.life <= 0) { p.object.visible = false; continue; }
      const age = p.duration - p.life, progress = age / p.duration;
      p.velocity.y -= p.gravity * dt; p.object.position.addScaledVector(p.velocity, dt);
      p.object.rotation.x += p.spin.x * dt; p.object.rotation.y += p.spin.y * dt; p.object.rotation.z += p.spin.z * dt;
      p.object.scale.setScalar(Math.max(.001, p.initialScale + age * p.growth) * (p.type === 'spark' ? 1 - progress * .8 : 1));
      p.object.material.opacity = (1 - progress) * (p.type === 'puff' ? .35 : .9);
    }
    for (const l of lightning) { if (l.life <= 0) continue; l.life -= dt; l.object.visible = l.life > 0; l.object.material.opacity = Math.max(0, l.life / l.duration); }
    const b = game?.ball, speed = b ? Math.hypot(b.vx || 0, b.vy || 0, b.vz || 0) : 0;
    trail.visible = !!b && game.phase !== 'attract' && !reducedMotion;
    trailClock += dt;
    if (b && trailClock > .015) { trailClock = 0; const point = vector(b.x, b.y, b.z); if (history.length && point.distanceTo(history[0]) > 4) history.length = 0; history.unshift(point); if (history.length > 24) history.pop(); }
    const count = Math.max(0, history.length - 1);
    for (let i = 0; i < count; i++) {
      const a = history[i], b = history[i + 1], forward = b.clone().sub(a).normalize();
      const view = camera ? camera.position.clone().sub(a).normalize() : UP.clone(); const side = forward.cross(view).normalize();
      const wa = (1 - i / 24) * Math.min(.10, .025 + speed * .004), wb = (1 - (i + 1) / 24) * Math.min(.10, .025 + speed * .004);
      const vertices = [a.clone().addScaledVector(side, wa), a.clone().addScaledVector(side, -wa), b.clone().addScaledVector(side, wb), a.clone().addScaledVector(side, -wa), b.clone().addScaledVector(side, -wb), b.clone().addScaledVector(side, wb)];
      for (let j = 0; j < 6; j++) { const offset = i * 18 + j * 3; vertices[j].toArray(trailPositions, offset); color.set(j < 2 ? GOLD : IVORY).multiplyScalar(Math.pow(1 - i / 24, 1.8)); color.toArray(trailColors, offset); }
    }
    trailGeometry.setDrawRange(0, count * 6); trailGeometry.attributes.position.needsUpdate = true; trailGeometry.attributes.color.needsUpdate = true;
    streakClock += dt;
    if (streakClock > .09 && !reducedMotion) {
      streakClock = 0;
      for (const player of game?.players || []) if (Math.hypot(player.vx || 0, player.vz || 0) > 7) {
        const point = vector(player.x, .6 + (player.y || 0), player.z), p = acquire('spark', point, player.team ? CORAL : TEAL, .18); if (!p) continue;
        p.object.quaternion.setFromUnitVectors(UP, vector(player.vx, 0, player.vz).normalize()); p.object.scale.set(.4, 1.6, .4); p.initialScale = .8; p.velocity.set(-(player.vx || 0) * .25, 0, -(player.vz || 0) * .25);
      }
    }
  }
  function dispose() { root.removeFromParent(); root.traverse(object => { if (object.material) object.material.dispose(); }); Object.values(geometries).forEach(geometry => geometry.dispose()); lightning.forEach(l => l.object.geometry.dispose()); trailGeometry.dispose(); }
  return { impact, update, setReducedMotion: value => { reducedMotion = !!value; }, cameraImpulse: () => impulse, dispose };
}
