import * as THREE from 'three';
import { MAPS, getMap } from './maps.js';

/** Blender-authored worlds. Only one biome is rendered; no per-frame allocations. */
export function createEnvironments(parent, toon, coarse = false) {
  const root=new THREE.Group();root.name='SculptedWorlds';parent.add(root);
  const groups=new Map(),surfaces=[],waterMaterials=[],time={value:0};
  for(const theme of MAPS){const group=new THREE.Group();group.name=`Arena_${theme.id}`;group.visible=false;root.add(group);groups.set(theme.id,group);}
  const court=new THREE.Group();court.name='RegulationCourt';parent.add(court);
  const cube=new THREE.BoxGeometry(1,1,1),cylinder=new THREE.CylinderGeometry(1,1,1,12);
  const chalk=new THREE.MeshStandardMaterial({color:'#fff4d6',roughness:1});
  const courtMat=new THREE.MeshStandardMaterial({color:'#b8d878',roughness:1,transparent:true,opacity:.38,depthWrite:false});
  function add(g,m,x,y,z,sx,sy,sz){const o=new THREE.Mesh(g,m);o.position.set(x,y,z);o.scale.set(sx,sy,sz);o.receiveShadow=true;court.add(o);return o;}
  const floor=add(cube,courtMat,0,.005,0,18,.015,10);surfaces.push(floor);
  for(const z of [-5,5])surfaces.push(add(cube,chalk,0,.025,z,18.1,.02,.1));
  for(const x of [-9,9])surfaces.push(add(cube,chalk,x,.025,0,.1,.02,10.1));
  for(const x of [-3,3])surfaces.push(add(cube,chalk,x,.025,0,.055,.02,10));
  const post=new THREE.MeshStandardMaterial({color:'#448b92',roughness:.65});
  for(const z of [-5.6,5.6]){add(cylinder,chalk,0,1.38,z,.09,2.76,.09);add(cylinder,post,0,.62,z,.17,1.24,.17);}
  for(let z=-5.5;z<=5.5;z+=.45)add(cube,chalk,0,1.53,z,.018,1.64,.018);
  for(let y=.7;y<=2.35;y+=.28)add(cube,chalk,0,y,0,.018,.018,11);
  add(cube,chalk,0,2.38,0,.07,.11,11.2);toon.batch(court.children.filter(o=>!surfaces.includes(o)),court);
  let current=null;
  function setModels(models,textures){
    for(let i=0;i<MAPS.length;i++){
      const model=models[i],group=groups.get(MAPS[i].id);group.add(model);
      prepareWorldModel(model,textures,coarse,time,waterMaterials);
      // Keep the original Kenney cel palette and material response.
      model.traverse(o=>{if(o.isMesh){const style=m=>m.name.startsWith('Release_')?m:toon.material(m);o.material=Array.isArray(o.material)?o.material.map(style):style(o.material);}});
      model.traverse(o=>{if(o.name.startsWith('Surface_'))surfaces.push(o);});
      const scenery=[];model.traverse(o=>{if(o.isMesh&&o.parent?.name.startsWith('Scenery_'))scenery.push(o);});
      // A one-instance mesh for each material batch lets the shared win effect
      // launch actual authored scenery, with no duplicate scene or geometry.
      model.updateMatrixWorld(true);
      for(const o of scenery){const inst=new THREE.InstancedMesh(o.geometry,o.material,1);inst.name='AuthoredSceneryBatch';inst.setMatrixAt(0,o.matrixWorld);inst.castShadow=o.castShadow;inst.receiveShadow=true;inst.frustumCulled=false;group.add(inst);o.visible=false;}
    }
  }
  return {root,groups,setModels,setTrees(){},setPaint(){},setSurfaces(visible){surfaces.forEach(o=>o.visible=visible);},
    set(id){const theme=getMap(id);if(current!==theme.id){groups.forEach((g,key)=>g.visible=key===theme.id);current=theme.id;courtMat.color.set(theme.court);}return theme;},
    update(t){time.value=t;},get id(){return current;}};
}

/** Painted pigment, real texture normals and restrained rim light in one pass. */
export function prepareWorldModel(model,textures,coarse,time={value:0},waterMaterials=[]){
  const seen=new Set();
  model.traverse(o=>{
    if(!o.isMesh)return;
    o.castShadow=!coarse&&!/Surface|Water/.test(o.name+' '+o.parent?.name);o.receiveShadow=true;
    for(const m of Array.isArray(o.material)?o.material:[o.material]){
      if(seen.has(m))continue;seen.add(m);m.roughness=.88;m.metalness=0;
      if(m.map)m.map.anisotropy=coarse?2:4;

      const isWater=/Water|Lava/.test(m.name),isGround=/Ground/.test(m.name),isWood=/Wood/.test(m.name),isCliff=/Cliff/.test(m.name);
      if(isGround||isWood||isCliff){m.map=isWood?textures.wood:isCliff?textures.stone:textures.ground;m.needsUpdate=true;}
      if(isWater){m.roughness=.34;m.emissive.copy(m.color);m.emissiveIntensity=.16;m.transparent=true;m.depthWrite=false;m.fog=false;waterMaterials.push(m);}
      m.onBeforeCompile=shader=>{
        shader.uniforms.worldTime=time;
        shader.vertexShader='varying vec3 worldPaint;\n'+shader.vertexShader;
        shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n worldPaint=position;');
        shader.fragmentShader='uniform float worldTime; varying vec3 worldPaint;\n'+shader.fragmentShader;
        if(isGround||isWood||isCliff)shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`vec3 pigment=diffuseColor.rgb;\n#include <map_fragment>\n diffuseColor.rgb=mix(pigment,diffuseColor.rgb,${isWood?'.22':'.20'});`);
        if(isWater)shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\n float crest=pow(.5+.5*sin(worldPaint.x*2.7+worldPaint.z*1.9+sin(worldPaint.z*3.0-worldTime)*.7-worldTime*1.1),16.0);diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.93,.99,.91),crest*.12);diffuseColor.a*=1.0-smoothstep(48.0,79.0,max(abs(worldPaint.x),abs(worldPaint.z)));');
        shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>','float rim=pow(1.0-max(0.0,dot(normal,normalize(vViewPosition))),3.0);outgoingLight+=vec3(.12,.085,.045)*rim;\n#include <opaque_fragment>');
      };
      m.customProgramCacheKey=()=>`painted-world-v2-${isGround}-${isWood}-${isCliff}-${isWater}`;
    }
  });
}
