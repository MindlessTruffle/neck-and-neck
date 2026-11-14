import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { ABILITY_CATALOG } from './profile.js';

/** A small real 3D carousel, rendered only while the powers menu is mounted. */
export function PowerRoll({ selected, rolling, reducedMotion, onTick }) {
  const canvas = useRef(null), state = useRef({ selected, rolling, reducedMotion, onTick });
  state.current = { selected, rolling, reducedMotion, onTick };
  useEffect(() => {
    const renderer = new THREE.WebGLRenderer({ canvas: canvas.current, alpha: true, antialias: false });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.35)); renderer.outputColorSpace = THREE.SRGBColorSpace;
    const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(36, 1, .1, 60); camera.position.set(0, 3.5, 8.5); camera.lookAt(0, .8, 0);
    scene.add(new THREE.HemisphereLight('#e8ffff', '#55466a', 2.5)); const light = new THREE.DirectionalLight('#fff1c8', 3); light.position.set(-4, 8, 6); scene.add(light);
    const metal = new THREE.MeshStandardMaterial({ color: '#e6bd68', roughness: .3, metalness: .55 });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.9, .45, 32), metal); base.position.y = -.4; scene.add(base);
    const carousel = new THREE.Group(); scene.add(carousel);
    const objects = [];
    ABILITY_CATALOG.forEach((power, i) => {
      const holder = new THREE.Group(); carousel.add(holder); const angle = i * Math.PI * 2 / 5;
      holder.position.set(Math.sin(angle) * 1.9, .9, Math.cos(angle) * 1.9);
      const material = new THREE.MeshStandardMaterial({ color: power.color, metalness: .18, roughness: .3 });
      const icon = new THREE.Group(); holder.add(icon);
      const add = (geometry, x = 0, y = 0, z = 0) => { const mesh = new THREE.Mesh(geometry, material); mesh.position.set(x, y, z); icon.add(mesh); return mesh; };
      if (power.id === 'magnet') { const arc = add(new THREE.TorusGeometry(.48, .18, 8, 24, Math.PI)); arc.rotation.z = Math.PI; add(new THREE.BoxGeometry(.36, .6, .36), -.48, .25); add(new THREE.BoxGeometry(.36, .6, .36), .48, .25); }
      if (power.id === 'feather') { for (let j = 0; j < 6; j++) { const leaf = add(new THREE.SphereGeometry(.32, 8, 6), (j % 2 ? -.15 : .15), -.6 + j * .23); leaf.scale.set(1, .5, .35); leaf.rotation.z = j % 2 ? -.6 : .6; } add(new THREE.CylinderGeometry(.05, .05, 1.6, 6)); }
      if (power.id === 'spring') { const points = Array.from({ length: 81 }, (_, j) => new THREE.Vector3(Math.cos(j * Math.PI / 10) * .43, -.7 + j / 80 * 1.4, Math.sin(j * Math.PI / 10) * .43)); add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 80, .095, 6, false)); }
      if (power.id === 'rocket') { add(new THREE.CylinderGeometry(.28, .33, 1.1, 12)); add(new THREE.ConeGeometry(.29, .6, 12), 0, .83); for (const x of [-.38, .38]) add(new THREE.BoxGeometry(.2, .5, .25), x, -.4); }
      if (power.id === 'shield') { const shield = add(new THREE.CylinderGeometry(.65, .65, .2, 5)); shield.rotation.x = Math.PI / 2; }
      const foot = new THREE.Mesh(new THREE.CylinderGeometry(.8, .9, .15, 20), metal); foot.position.y = -.95; holder.add(foot); objects.push({ holder, icon });
    });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.9, .05, 6, 64), new THREE.MeshBasicMaterial({ color: '#ffe8a1' })); ring.rotation.x = Math.PI / 2; ring.position.y = -.1; scene.add(ring);
    const sparks=new THREE.InstancedMesh(new THREE.OctahedronGeometry(.1),new THREE.MeshBasicMaterial({color:'#fff0ad'}),24),sparkPose=new THREE.Object3D();sparks.frustumCulled=false;sparks.visible=false;scene.add(sparks);
    let frame, start = 0, spinning = false, from = 0, target = 0, lastTick = -1, burstAt=-Infinity;
    const resize = () => { const box = canvas.current?.getBoundingClientRect(); if (!box) return; renderer.setSize(box.width, box.height, false); camera.aspect = box.width / box.height; camera.updateProjectionMatrix(); };
    const observer = new ResizeObserver(resize); observer.observe(canvas.current); resize();
    const update = now => {
      const settings = state.current, index = Math.max(0, ABILITY_CATALOG.findIndex(p => p.id === settings.selected));
      if (settings.rolling && !spinning) { spinning = true; start = now; from = carousel.rotation.y; const landing = -index * Math.PI * 2 / 5; target = from + Math.PI * 8 + ((landing - from) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2); lastTick = -1; }
      if (spinning) {
        const t = Math.min(1, (now - start) / (settings.reducedMotion ? 250 : 2600)), eased = 1 - Math.pow(1 - t, 4);
        carousel.rotation.y = from + (target - from) * eased;
        const tick = Math.floor(carousel.rotation.y / (Math.PI * 2 / 5)); if (tick !== lastTick && t < 1) { settings.onTick?.(); lastTick = tick; }
        if (!settings.rolling) { spinning = false; carousel.rotation.y = -index * Math.PI * 2 / 5; burstAt=now; }
      } else carousel.rotation.y += (-index * Math.PI * 2 / 5 - carousel.rotation.y) * .12;
      objects.forEach(({ holder, icon }, i) => { icon.rotation.y = -carousel.rotation.y; holder.position.y = .9 + (settings.reducedMotion ? 0 : Math.sin(now * .002 + i) * .06); icon.scale.setScalar(i === index && !settings.rolling ? 1.15 : .85); });
      const burst=(now-burstAt)/1000;sparks.visible=!settings.reducedMotion&&burst<.9;
      if(sparks.visible){for(let i=0;i<24;i++){const a=i*Math.PI*2/24,r=.5+burst*(2+i%3);sparkPose.position.set(Math.cos(a)*r,1.4+Math.sin(a)*r+burst*1.5,1.8+Math.sin(i*4)*burst);sparkPose.rotation.set(a+burst*4,a,burst*3);sparkPose.scale.setScalar(Math.max(0,1-burst));sparkPose.updateMatrix();sparks.setMatrixAt(i,sparkPose.matrix);}sparks.instanceMatrix.needsUpdate=true;}
      ring.rotation.z = now * .0002; renderer.render(scene, camera); frame = requestAnimationFrame(update);
    };
    frame = requestAnimationFrame(update);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); const gs = new Set(), ms = new Set(); scene.traverse(o => { if (o.geometry) gs.add(o.geometry); if (o.material) ms.add(o.material); }); gs.forEach(g => g.dispose()); ms.forEach(m => m.dispose()); renderer.dispose(); };
  }, []);
  return <canvas ref={canvas} className="power-roll-3d" aria-label="3D power carousel" style={{ width: '100%', height: 'min(31vh,280px)', minHeight: 160, display: 'block' }}/>;
}
