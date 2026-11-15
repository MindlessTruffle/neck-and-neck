import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createBiomeAtmosphere, prepareWorldModel } from '../src/environments.js';

const ids=['meadow','jungle','beach','volcano','mountain'];
function atmosphere(coarse){const groups=new Map(ids.map(id=>[id,new THREE.Group()]));const time={value:0};createBiomeAtmosphere(groups,time,coarse);return {groups,time};}
const desktop=atmosphere(false),mobile=atmosphere(true);
assert.equal(desktop.groups.get('beach').children.length,0,'Approved beach must gain no atmosphere draw');
for(const id of ids.filter(id=>id!=='beach')){
  const group=desktop.groups.get(id),points=group.children.find(o=>o.isPoints),small=mobile.groups.get(id).children.find(o=>o.isPoints);
  assert.equal(group.children.length,id==='jungle'?2:1,'Atmosphere draw budget');
  assert(points.geometry.attributes.position.count<=150);
  assert(small.geometry.attributes.position.count<points.geometry.attributes.position.count);
  const positions=points.geometry.attributes.position.array;
  assert([...positions].every(Number.isFinite));
  for(let i=0;i<positions.length;i+=3)assert(Math.abs(positions[i])>=19||Math.abs(positions[i+2])>=15,'Particles stay outside the clear court and run-off');
  assert.equal(points.material.depthWrite,false);
  assert.equal(points.material.uniforms.worldTime,desktop.time,'Share clock; no per-frame buffer updates');
}
const textures={ground:new THREE.Texture(),wood:new THREE.Texture(),stone:new THREE.Texture(),terrain:new THREE.Texture(),worldTerrain:new THREE.Texture()};
function prepared(name){const m=new THREE.MeshStandardMaterial({color:'#4b9e67'});m.name=name;const root=new THREE.Group();root.add(new THREE.Mesh(new THREE.BoxGeometry(),m));prepareWorldModel(root,textures,false);const shader={uniforms:{},vertexShader:'#include <begin_vertex>',fragmentShader:'#include <map_fragment>\n#include <color_fragment>\n#include <opaque_fragment>'};m.onBeforeCompile(shader);return {m,shader};}
const beach=prepared('Release_beach_Ground'),jungle=prepared('Release_jungle_Ground'),leaf=prepared('Release_jungle_Leaf');
assert.equal(beach.m.map,textures.terrain,'Beach keeps original imagegen atlas');
assert.equal(jungle.m.map,textures.worldTerrain,'Jungle uses its own new painted texture');
assert(beach.shader.fragmentShader.includes('vec2(0.5,0.5)'));
assert(jungle.shader.fragmentShader.includes('vec2(0.5,0.5)'));
assert(!beach.shader.fragmentShader.includes('float cloud='),'Beach lighting unchanged');
assert(jungle.shader.fragmentShader.includes('float cloud='));
assert(leaf.shader.vertexShader.includes('transformed.x+='),'Foliage wind stays GPU-side');
console.log('PASS biome atmosphere: bounded draws, reduced mobile particles, clear court, separate new atlas, unchanged beach shading.');

const meadowHill=prepared('Release_meadow_Patch'),beachPatch=prepared('Release_beach_Patch');
assert.equal(meadowHill.m.map,textures.worldTerrain,'Rolling hills share meadow terrain pigment');
assert.equal(beachPatch.m.map,null,'Approved beach patches stay untextured');

const alpineStone=prepared('Release_mountain_Rock'),ruinStone=prepared('Release_jungle_Rock');
assert.equal(alpineStone.m.map,textures.stone);
assert.equal(ruinStone.m.map,textures.stone);
assert(alpineStone.shader.fragmentShader.includes('float fracture='));
assert(ruinStone.shader.fragmentShader.includes('float moss='));
assert(!alpineStone.shader.fragmentShader.includes('float strata='));
assert(!ruinStone.shader.fragmentShader.includes('float strata='));
