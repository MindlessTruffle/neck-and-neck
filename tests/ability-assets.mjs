import assert from 'node:assert/strict';
import fs from 'node:fs';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import * as THREE from 'three';
const b=fs.readFileSync(new URL('../public/models/abilities/relics.glb',import.meta.url));assert(b.length<600000);
const gltf=await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');
for(const id of ['magnet','feather','spring','rocket','shield']){const model=gltf.scene.children.find(o=>o.name.replace(/[.0-9]/g,'')===id);assert(model,`${id} must load by runtime name`);const bounds=new THREE.Box3().setFromObject(model),size=bounds.getSize(new THREE.Vector3());assert(size.toArray().every(v=>Number.isFinite(v)&&v>0));let draws=0;model.traverse(o=>{if(o.isMesh)draws++;});assert(draws<10);}
assert.equal(gltf.scene.children.length,5);console.log('PASS authored abilities: five finite relics, bounded batches, no unrelated scenery, under 600 KB.');
