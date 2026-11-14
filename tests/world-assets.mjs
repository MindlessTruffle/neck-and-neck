import assert from 'node:assert/strict';
import fs from 'node:fs';
import { MAPS } from '../src/maps.js';

// Inspect the actual shipping glTF buffers, not just the authoring manifest.
let totalBytes=0;
for(const id of [...MAPS.map(m=>m.id),'lobby']){
  const buffer=fs.readFileSync(new URL(`../public/models/worlds/${id}.glb`,import.meta.url));
  assert.equal(buffer.readUInt32LE(0),0x46546c67);
  const json=JSON.parse(buffer.subarray(20,20+buffer.readUInt32LE(12)).toString());
  assert(json.nodes.some(n=>n.name.startsWith('Surface_')));
  assert(json.nodes.some(n=>n.name.startsWith('Scenery_')));
  let triangles=0,draws=0;
  for(const mesh of json.meshes)for(const primitive of mesh.primitives){
    draws++;const positions=json.accessors[primitive.attributes.POSITION];
    assert(positions.min.every(Number.isFinite)&&positions.max.every(Number.isFinite));
    triangles+=json.accessors[primitive.indices].count/3;
  }
  assert(triangles<40000,`${id} exceeds environment triangle budget: ${triangles}`);
  assert(draws<25,`${id} exceeds authored material batch budget: ${draws}`);
  assert(buffer.length<6*1024*1024,`${id} exceeds download budget`);
  totalBytes+=buffer.length;
  console.log(`PASS authored ${id}: ${triangles} triangles, ${draws} material batches, ${(buffer.length/1048576).toFixed(2)} MiB`);
}
assert(totalBytes<12*1024*1024);
const loader=fs.readFileSync(new URL('../src/loading-screen.jsx',import.meta.url),'utf8');
assert(loader.includes('giraffe-pixel-clouds.png'));
const sprite=fs.readFileSync(new URL('../public/ui/giraffe-pixel-clouds.png',import.meta.url));
assert.equal(sprite.subarray(1,4).toString(),'PNG');
assert.equal(sprite.readUInt32BE(16)/sprite.readUInt32BE(20),3,'four 3:4 frames form a 3:1 strip');
console.log('PASS retro imagegen sprite and world download budgets.');
