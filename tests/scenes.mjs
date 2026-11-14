import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createEnvironments } from '../src/environments.js';
import { createToonStyle } from '../src/toon.js';
import { MAPS, chooseMap } from '../src/maps.js';
import { validateSettings, saveSettings, loadSettings } from '../src/settings.js';

const memory = new Map(); globalThis.localStorage={setItem:(k,v)=>memory.set(k,v),getItem:k=>memory.get(k)};
const saved=saveSettings({sensitivity:2.4,invertY:true,language:'fr',quality:'low',musicVolume:0});
assert.deepEqual(loadSettings(),saved);assert.equal(loadSettings().musicVolume,0);
memory.set('neck.settings.v1','broken JSON');assert.equal(loadSettings().sensitivity,1);
const malformed=validateSettings({sensitivity:Infinity,cameraDistance:-50,language:'unknown',bindings:{forward:'Escape'}});
assert.equal(malformed.sensitivity,1);assert.equal(malformed.cameraDistance,6);assert.equal(malformed.bindings.forward,'KeyW');
assert.equal(new Set(MAPS.map((_,i)=>chooseMap(()=>i/5+.01))).size,5);
for(const coarse of [true,false]){
  const scene=new THREE.Scene(),toon=createToonStyle(),environments=createEnvironments(scene,toon,coarse);
  const geometries=new Set(),materials=new Set();let nodes=0;
  scene.traverse(o=>{nodes++;if(o.geometry)geometries.add(o.geometry);if(o.material)materials.add(o.material);assert(o.position.toArray().every(Number.isFinite));});
  for(let i=0;i<100;i++){
    const map=MAPS[i%5];assert.equal(environments.set(map.id).id,map.id);
    assert.equal([...environments.groups.values()].filter(g=>g.visible).length,1);
    let current=0;scene.traverse(()=>current++);assert.equal(current,nodes,'Changing maps does not allocate new scene nodes');
  }
  assert(geometries.size<25,'Biome geometry is shared, not regenerated per prop');
  environments.setSurfaces(false);environments.setSurfaces(true);
  geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());toon.dispose();
}
console.log('PASS maps/options: five selectable biomes, one rendered biome, stable scene allocations, shared geometry, validated persisted sensitivity/audio/language and corrupt-storage recovery.');
