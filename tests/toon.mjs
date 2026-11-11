import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createToonStyle } from '../src/toon.js';
import { GiraffeRig } from '../src/rig.js';

const finite = values => values.every(Number.isFinite);
const close = (a, b, epsilon = 1e-5) => assert.ok(a.distanceTo(b) < epsilon, `${a.toArray()} differs from ${b.toArray()}`);

// A hull may bake local transforms, but must never mutate shared source data.
{
  const toon = createToonStyle(), root = new THREE.Group();
  const geometry = new THREE.BoxGeometry(1, 2, 3), material = new THREE.MeshBasicMaterial();
  const first = new THREE.Mesh(geometry, material), second = new THREE.Mesh(geometry, material);
  first.position.set(4, 2, -3); first.rotation.y = .7; first.scale.set(2, .5, 1);
  second.position.set(-2, 1, 5); second.scale.set(.7, 2, 1.4); root.add(first, second);
  const position = Array.from(geometry.attributes.position.array), normal = Array.from(geometry.attributes.normal.array);
  const hull = toon.ink(root, { width: 2.2 });
  assert.deepEqual(Array.from(geometry.attributes.position.array), position);
  assert.deepEqual(Array.from(geometry.attributes.normal.array), normal);
  hull.geometry.computeBoundingBox();
  assert.ok(finite([...hull.geometry.boundingBox.min.toArray(), ...hull.geometry.boundingBox.max.toArray()]));
  assert.equal(hull.material.side, THREE.BackSide, 'Only back faces create the ink silhouette');
  assert.equal(hull.castShadow, false, 'Ink must not duplicate the shadow pass');
  const shader = { uniforms: {}, vertexShader: THREE.ShaderLib.basic.vertexShader };
  hull.material.onBeforeCompile(shader);
  assert.ok(shader.vertexShader.includes('gl_Position.xy += inkNormal'));
  assert.ok(shader.vertexShader.includes('#include <skinning_vertex>'));
  toon.update(null, 742, 790);
  assert.deepEqual(shader.uniforms.inkViewport.value.toArray(), [742, 790]);
  toon.dispose(); geometry.dispose(); material.dispose();
}

// Batched transforms retain their world placement, including animated parents.
{
  const toon = createToonStyle(), scene = new THREE.Scene(), parent = new THREE.Group(); scene.add(parent);
  parent.position.set(2, 1, 3); const geometry = new THREE.SphereGeometry(.5, 8, 6), material = toon.material('#e9bb68');
  const sources = [0, 1, 2].map(i => { const object = new THREE.Mesh(geometry, material); object.position.set(i, i * .5, -i); parent.add(object); return object; });
  scene.updateMatrixWorld(true); const wanted = sources.map(object => object.matrixWorld.clone());
  toon.batch(sources, scene, true);
  const batch = scene.children.find(object => object.isInstancedMesh); assert.ok(batch); assert.equal(batch.count, 3);
  const matrix = new THREE.Matrix4(); sources.forEach((source, i) => { batch.getMatrixAt(i, matrix); assert.deepEqual(matrix.elements, wanted[i].elements); assert.equal(source.visible, false); });
  parent.position.x += 7; parent.rotation.y = .6; toon.update(null, 1280, 720);
  sources.forEach((source, i) => { batch.getMatrixAt(i, matrix); matrix.elements.forEach((value, j) => assert.ok(Math.abs(value - source.matrixWorld.elements[j]) < 1e-5)); });
  assert.equal(toon.stats().batchDraws, 1); assert.equal(toon.stats().batchedMeshes, 3);
  toon.dispose(); geometry.dispose();
}

// The production Blender hull shares the exact posed skeleton and bind space.
{
  const path = new URL('../public/models/giraffe-athlete.glb', import.meta.url), bytes = fs.readFileSync(path);
  const asset = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  const toon = createToonStyle(), scene = new THREE.Scene(), rig = new GiraffeRig(asset.scene, scene, 0, toon);
  assert.equal(rig.neck.length, 8); assert.equal(rig.legs.length, 4); assert.ok(rig.ink?.isSkinnedMesh);
  const points = Array.from({ length: 9 }, (_, i) => ({ x: -4.8 + Math.sin(i * .28) * .7, y: 1.45 + i * .19, z: -2.2 + Math.sin(i * .3) * .4 }));
  const player = { x: -4.8, y: 0, z: -2.2, team: 0, vx: 3, vz: 1, head: points[8], neckPoints: points, neck: { yaw: .2, pitch: .1 } };
  rig.update(player, 1 / 60, 2); rig.ink.skeleton.update();
  rig.neck.forEach((record, i) => close(record.bone.getWorldPosition(new THREE.Vector3()), new THREE.Vector3(points[i].x, points[i].y, points[i].z)));
  const sources = []; rig.model.traverse(object => { if (object.isSkinnedMesh && !object.userData.isInk) sources.push(object); });
  let offset = 0;
  for (const source of sources) {
    assert.ok(rig.ink.skeleton.bones.every((bone, i) => bone === source.skeleton.bones[i]), 'Every outline joint must reference the actual source bones');
    const vertex = new THREE.Vector3().fromBufferAttribute(source.geometry.attributes.position, 0), hullVertex = new THREE.Vector3().fromBufferAttribute(rig.ink.geometry.attributes.position, offset);
    source.applyBoneTransform(0, vertex).applyMatrix4(source.matrixWorld);
    rig.ink.applyBoneTransform(offset, hullVertex).applyMatrix4(rig.ink.matrixWorld); close(vertex, hullVertex);
    offset += source.geometry.attributes.position.count;
  }
  assert.equal(offset, rig.ink.geometry.attributes.position.count);
  rig.ink.computeBoundingBox(); assert.ok(finite([...rig.ink.boundingBox.min.toArray(), ...rig.ink.boundingBox.max.toArray()]));
  rig.dispose(); toon.dispose();
}

console.log('Toon checks passed: shared geometry, finite hulls, batching, skinned alignment.');
