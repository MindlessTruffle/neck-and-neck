import * as THREE from 'three';
import { createCourtsideWildlife, createSceneryLight, paintCavernFloor } from './courtside.js';
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
  createBiomeAtmosphere(groups,time,coarse);
  let current=null, updateCrowd=null;
  function setModels(models,textures,wildlife){
    createSceneryLight(groups,time);
    for(let i=0;i<MAPS.length;i++){
      const model=models[i],group=groups.get(MAPS[i].id);group.add(model);
      prepareWorldModel(model,textures,coarse,time,waterMaterials);
      // Keep the original Kenney cel palette and material response.
      model.traverse(o=>{if(o.isMesh){const style=m=>m.name.startsWith('Release_')?m:toon.material(m);o.material=Array.isArray(o.material)?o.material.map(style):style(o.material);}});
      model.traverse(o=>{if(o.name.startsWith('Surface_'))surfaces.push(o);});
      if(MAPS[i].id==='cave')paintCavernFloor(model,time);
      const scenery=[];model.traverse(o=>{if(o.isMesh&&o.parent?.name.startsWith('Scenery_'))scenery.push(o);});
      // A one-instance mesh for each material batch lets the shared win effect
      // launch actual authored scenery, with no duplicate scene or geometry.
      model.updateMatrixWorld(true);
      for(const o of scenery){const inst=new THREE.InstancedMesh(o.geometry,o.material,1);inst.name='AuthoredSceneryBatch';inst.setMatrixAt(0,o.matrixWorld);inst.castShadow=o.castShadow;inst.receiveShadow=true;inst.frustumCulled=false;group.add(inst);o.visible=false;}
    }
    if(wildlife)updateCrowd=createCourtsideWildlife(groups,new Map(MAPS.map(({id},i)=>[id,models[i]])),wildlife,coarse);
  }
  return {root,groups,setModels,setTrees(){},setPaint(){},setSurfaces(visible){surfaces.forEach(o=>o.visible=visible);},
    set(id){const theme=getMap(id);if(current!==theme.id){groups.forEach((g,key)=>g.visible=key===theme.id);current=theme.id;courtMat.color.set(theme.court);}return theme;},
    update(t,ball,celebrate,menu){time.value=t;if(!menu)updateCrowd?.(current,t,ball,celebrate);},get id(){return current;}};
}

/** Two cheap atmosphere draws at most. Positions animate on GPU, never on CPU. */
export function createBiomeAtmosphere(groups,time,coarse=false){
  const themes={
    meadow:{count:100,color:'#fff0cd',size:11,speed:.22,flutter:.7},
    jungle:{count:64,color:'#d5df73',size:13,speed:.34,flutter:1.5},
    volcano:{count:100,color:'#ffb251',size:12,speed:.5,flutter:.5},
    cave:{count:42,color:'#fbc485',size:11,speed:.27,flutter:.6},
    mountain:{count:70,color:'#e0f8ff',size:10,speed:.12,flutter:.3},
  };
  for(const [id,style] of Object.entries(themes)){
    const group=groups.get(id);if(!group)continue;
    const count=coarse?Math.ceil(style.count*.45):style.count,positions=new Float32Array(count*3),seeds=new Float32Array(count);
    let seed=1337+id.length*719;
    const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
    for(let i=0;i<count;i++){
      // Unequal pockets, with an intentionally clear ball-reading corridor.
      const edge=i%4,along=(random()-.5)*56;
      positions[i*3]=edge<2?(edge===0?-1:1)*(19+random()*18):along;
      positions[i*3+2]=edge>=2?(edge===2?-1:1)*(15+random()*15):along;
      positions[i*3+1]=.7+random()*(id==='volcano'?13:id==='jungle'?13:7);seeds[i]=random()*20;
      if(id==='volcano' && i%3===0){
        positions[i*3]=-23+(random()-.5)*2;
        positions[i*3+1]=4+random()*8;
        positions[i*3+2]=-14.8+(random()-.5)*2;
      }
    }
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setAttribute('phase',new THREE.BufferAttribute(seeds,1));
    const flight = {
      meadow: 'p.x+=sin(t*.43+phase)*2.4;p.y+=sin(t*1.5)*.22;',
      volcano: 'float rise=fract(t*.125);p.y+=8.*rise*(1.-rise)+2.6*rise;p.x+=rise*1.4;',
      mountain: 'float fall=fract(t*.22);p.y+=2.-fall*4.;p.x+=fall*3.2;',
      cave: 'p.y+=sin(t*.54+phase)*.24;',
    }[id] || '';
    const silhouette = {
      meadow: 'float petal=1.-smoothstep(.29,.49,length(vec2(p.x*1.75,p.y+p.x*.6)));alpha=petal*(.27+.57*glow);color=mix(vec3(.92,.50,.58),tint,kind);',
      mountain: 'alpha=(1.-smoothstep(.09,.48,length(vec2(p.x,p.y+p.x*.6)*vec2(1.,2.))))*(.26+.42*glow);',
      volcano: 'alpha=(1.-smoothstep(.06,.5,length(vec2(p.x*2.1,p.y))))*(.39+.6*glow);color=mix(vec3(.88,.19,.026),tint,kind);',
    }[id] || '';
    const material=new THREE.ShaderMaterial({
      uniforms:{worldTime:time,tint:{value:new THREE.Color(style.color)},size:{value:style.size},speed:{value:style.speed},flutter:{value:style.flutter},insect:{value:id==='jungle'?1:0}},
      transparent:true,depthWrite:false,blending:id==='meadow'||id==='jungle'?THREE.NormalBlending:THREE.AdditiveBlending,
      vertexShader:`uniform float worldTime,size,speed,flutter; attribute float phase; varying float glow,kind; void main(){kind=step(.8,fract(phase));vec3 p=position;float t=worldTime*speed+phase;p.x+=sin(t*1.7)*flutter;p.z+=cos(t*1.3)*flutter;p.y+=sin(t*.8)*.65;${flight} vec4 view=modelViewMatrix*vec4(p,1.0);glow=.45+.55*pow(.5+.5*sin(t*2.1),2.0);gl_PointSize=clamp(size*18.0/max(8.0,-view.z),1.0,8.0);gl_Position=projectionMatrix*view;}`,
      fragmentShader:`uniform vec3 tint; uniform float insect; varying float glow,kind; void main(){vec2 p=gl_PointCoord-.5;float disc=1.0-smoothstep(.08,.5,length(p));float wings=1.0-smoothstep(.45,1.0,length(vec2((abs(p.x)-.19)*5.5,(p.y-p.x*.4)*3.8)));float alpha=mix(disc*glow*.62,mix(wings*.5,disc*glow*.6,kind),insect);vec3 color=mix(tint,mix(vec3(.16,.26,.13),tint,kind),insect);${silhouette} if(alpha<.025)discard;gl_FragColor=vec4(color,alpha);}`,
    });
    const particles=new THREE.Points(geometry,material);particles.name=`Atmosphere_${id}`;particles.frustumCulled=false;particles.renderOrder=2;group.add(particles);
  }
  const jungle=groups.get('jungle');if(!jungle)return;
  const positions=[],uvs=[],widths=[],indices=[];
  // Broad soft beams behind the touchline. Diagonal shafts share one sun direction.
  for(const [x,z,h,w] of [[-23,8,14,3.8],[23,-8,16,4.2],[8,23,13,3.4],[-29,-13,15,4]]){
    const i=positions.length/3;
    positions.push(x-5,h,z-3,x-5,h,z-3,x,.3,z,x,.3,z);widths.push(w*.35,w*.35,w,w);
    uvs.push(0,1,1,1,1,0,0,0);indices.push(i,i+1,i+2,i,i+2,i+3);
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.setIndex(indices);geometry.setAttribute('beamWidth',new THREE.Float32BufferAttribute(widths,1));
  const material=new THREE.ShaderMaterial({uniforms:{worldTime:time},transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,
    vertexShader:'attribute float beamWidth; varying vec2 shaftUV; void main(){shaftUV=uv;vec4 view=modelViewMatrix*vec4(position,1.0);view.x+=(uv.x-.5)*beamWidth;gl_Position=projectionMatrix*view;}',
    fragmentShader:'uniform float worldTime; varying vec2 shaftUV; void main(){float edge=pow(max(0.0,1.0-abs(shaftUV.x*2.0-1.0)),2.5);float fade=smoothstep(0.0,.25,shaftUV.y)*(1.0-smoothstep(.65,1.0,shaftUV.y));float drift=.85+.15*sin(shaftUV.y*8.0+worldTime*.22);gl_FragColor=vec4(.85,1.0,.64,edge*fade*drift*.065);}',
  });
  const shafts=new THREE.Mesh(geometry,material);shafts.name='CanopyLightShafts';shafts.renderOrder=1;shafts.frustumCulled=false;jungle.add(shafts);
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
      if(/^Release_(meadow|jungle|beach|volcano|mountain)_/.test(m.name)&&!/Water|Lava/.test(m.name)){m.emissive.copy(m.color);m.emissiveIntensity=/Ground|Cliff/.test(m.name)?.04:.16;}

      const biome=/Release_(meadow|jungle|beach|volcano|mountain)_/.exec(m.name)?.[1];
      const enhanced=biome&&biome!=='beach',isLeaf=/Leaf/.test(m.name),isRock=/Rock|Cliff/.test(m.name);
      if(enhanced)m.emissiveIntensity=isLeaf?.10:/Ground|Cliff|Patch/.test(m.name)?.025:.055;
      const isLava=/Lava/.test(m.name),isWater=/Water|Lava/.test(m.name),isGround=/Ground/.test(m.name)||(enhanced&&/Patch/.test(m.name)),isWood=/Wood/.test(m.name),isCliff=/Cliff/.test(m.name);
      const newPaint=enhanced&&textures.worldTerrain;
      const volcanicRock=biome==='volcano'&&isRock&&!!newPaint;
      const weatheredRock=(biome==='mountain'||biome==='jungle')&&isRock&&!!textures.stone;
      const biomePaint=isGround&&!/lobby/.test(m.name)&&(newPaint||textures.terrain);
      const tile=/beach/.test(m.name)||newPaint&&biome==='jungle'?[.5,.5]:/volcano/.test(m.name)?[0,0]:/mountain/.test(m.name)?[.5,0]:[0,.5];
      if(isGround||isWood||isCliff||volcanicRock||weatheredRock){m.map=volcanicRock?newPaint:weatheredRock?textures.stone:isWood?textures.wood:isCliff?textures.stone:biomePaint||textures.ground;m.needsUpdate=true;}
      if(isWater){m.roughness=.34;m.emissive.copy(m.color);m.emissiveIntensity=/Lava/.test(m.name)?.3:.22;m.transparent=true;m.depthWrite=false;m.fog=false;waterMaterials.push(m);}
      m.onBeforeCompile=shader=>{
        shader.uniforms.worldTime=time;
        shader.vertexShader='varying vec3 worldPaint; varying vec3 worldPaintNormal;\n'+shader.vertexShader;
        shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n worldPaint=position; worldPaintNormal=normal;');
        if(enhanced&&isLeaf){shader.vertexShader='uniform float worldTime;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('worldPaint=position;', 'worldPaint=position; transformed.x+=sin(position.x*.47+position.z*.31+worldTime*.8)*smoothstep(2.0,12.0,position.y)*.13;');}
        shader.fragmentShader='uniform float worldTime; varying vec3 worldPaint; varying vec3 worldPaintNormal;\n'+shader.fragmentShader;
        if(isGround||isWood||isCliff||volcanicRock||weatheredRock)shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`vec3 pigment=diffuseColor.rgb;\n#include <map_fragment>\n diffuseColor.rgb=mix(pigment,diffuseColor.rgb,${isWood?'.22':'.20'});`);
        if(biomePaint){
          // Mirror each repeat inside one atlas cell; inset UVs prevent biome bleed.
          shader.fragmentShader=shader.fragmentShader.replace(/vec3 pigment=diffuseColor.rgb;[\s\S]*?diffuseColor.rgb=mix\(pigment,diffuseColor.rgb,[^;]+;/,`vec2 paintUV=1.0-abs(mod(worldPaint.xz*.065,2.0)-1.0); vec3 terrainPigment=texture2D(map,vec2(${tile[0]},${tile[1]})+.002+paintUV*.496).rgb; diffuseColor.rgb=mix(diffuseColor.rgb,terrainPigment,.32);`);
        }
        if(volcanicRock)shader.fragmentShader=shader.fragmentShader.replace(/vec3 pigment=diffuseColor.rgb;[\s\S]*?diffuseColor.rgb=mix\(pigment,diffuseColor.rgb,[^;]+;/,`vec2 wallUV=1.0-abs(mod(vec2(worldPaint.x+worldPaint.z*.43,worldPaint.y)*.085,2.0)-1.0); vec2 topUV=1.0-abs(mod(worldPaint.xz*.085,2.0)-1.0); vec3 wallPaint=texture2D(map,vec2(.002)+wallUV*.496).rgb; vec3 topPaint=texture2D(map,vec2(.002)+topUV*.496).rgb; vec3 basaltPaint=mix(wallPaint,topPaint,pow(abs(normalize(worldPaintNormal).y),3.0)); float basaltValue=dot(basaltPaint,vec3(.3,.5,.2)); diffuseColor.rgb=mix(diffuseColor.rgb,basaltPaint,.48); diffuseColor.rgb*=.72+basaltValue*.65;`);
        if(weatheredRock){
          const tint=biome==='mountain'?`float mineral=.5+.5*sin(worldPaint.x*.13+worldPaint.z*.19+sin(worldPaint.y*.4)); diffuseColor.rgb*=mix(vec3(.74,.86,1.05),vec3(1.03,.87,1.08),mineral); float fracture=abs(sin(worldPaint.x*.43+sin(worldPaint.z*.31)+worldPaint.y*.26)+sin(worldPaint.y*.61+worldPaint.z*.29)); float frost=(1.0-smoothstep(.025,.10,fracture))*(.18+.32*max(0.0,normalize(worldPaintNormal).y)); diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.76,.87,.96),frost);`:`float damp=.5+.5*sin(worldPaint.x*.47+sin(worldPaint.z*.37)*1.6+worldPaint.y*.23)*sin(worldPaint.z*.29-worldPaint.y*.43); float moss=smoothstep(.32,.78,damp)*(.35+.3*max(0.0,normalize(worldPaintNormal).y)+.35*(1.0-smoothstep(1.0,9.0,worldPaint.y))); diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.12,.25,.115),moss*.55);`;
          shader.fragmentShader=shader.fragmentShader.replace(/vec3 pigment=diffuseColor.rgb;[\s\S]*?diffuseColor.rgb=mix\(pigment,diffuseColor.rgb,[^;]+;/,`vec2 stoneWall=1.0-abs(mod(vec2(worldPaint.x+worldPaint.z*.57,worldPaint.y)*.12,2.0)-1.0); vec2 stoneTop=1.0-abs(mod(worldPaint.xz*.12,2.0)-1.0); vec3 stonePaint=mix(texture2D(map,stoneWall).rgb,texture2D(map,stoneTop).rgb,pow(abs(normalize(worldPaintNormal).y),3.0)); float stoneValue=dot(stonePaint,vec3(.3,.5,.2)); diffuseColor.rgb*=.62+stoneValue*.85; ${tint}`);
        }
        if(enhanced){
          const pigment=isLeaf?'float canopy=.5+.5*sin(worldPaint.x*.19+worldPaint.z*.24); diffuseColor.rgb*=mix(vec3(.72,.89,.88),vec3(1.12,1.13,.89),canopy);':isGround?'float cloud=.5+.5*sin(worldPaint.x*.085+sin(worldPaint.z*.095)+worldTime*.018); float grass=.5+.5*sin(worldPaint.x*2.7+worldPaint.z*1.4); diffuseColor.rgb*=mix(vec3(.85,.93,.99),vec3(1.07,1.04,.91),cloud); diffuseColor.rgb*=.98+grass*.04;':isRock&&!weatheredRock?'float strata=.5+.5*sin(worldPaint.y*1.3+sin(worldPaint.x*.37+worldPaint.z*.23)); diffuseColor.rgb*=mix(vec3(.77,.83,.93),vec3(1.06,1.02,.95),strata);':'';
          if(pigment)shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\n'+pigment);
        }
        if(isWater)shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',isLava?'#include <color_fragment>\n vec2 lavaUV=worldPaint.xz*.18+vec2(sin(worldPaint.z*.07+worldTime*.07),cos(worldPaint.x*.09-worldTime*.06))*.45; float seam=abs(sin(lavaUV.x+sin(lavaUV.y*.73)*.6)*cos(lavaUV.y+sin(lavaUV.x*.67)*.55)); float lavaPool=sin(worldPaint.x*.053+worldPaint.z*.035+worldTime*.015)*cos(worldPaint.z*.041-worldPaint.x*.018); float lavaHeat=max(1.0-smoothstep(.09,.34,seam),smoothstep(.48,.8,lavaPool)*.95); float lavaThread=1.0-smoothstep(.025,.085,seam); float lavaPlate=.5+.5*sin(worldPaint.x*.6+worldPaint.z*.43); diffuseColor.rgb=mix(mix(vec3(.028,.018,.038),vec3(.095,.043,.065),lavaPlate),vec3(.55,.085,.012),lavaHeat); diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.95,.34,.045),lavaThread*.7);diffuseColor.a*=1.0-smoothstep(104.0,140.0,max(abs(worldPaint.x),abs(worldPaint.z)));':'#include <color_fragment>\n float crest=pow(.5+.5*sin(worldPaint.x*2.7+worldPaint.z*1.9+sin(worldPaint.z*3.0-worldTime)*.7-worldTime*1.1),16.0);diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.93,.99,.91),crest*.12);diffuseColor.a*=1.0-smoothstep(48.0,79.0,max(abs(worldPaint.x),abs(worldPaint.z)));');
        if(isLava)shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\n totalEmissiveRadiance=vec3(.55,.075,.006)*lavaHeat+vec3(.35,.16,.028)*lavaThread;');
        shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>','float rim=pow(1.0-max(0.0,dot(normal,normalize(vViewPosition))),3.0);outgoingLight+=vec3(.12,.085,.045)*rim;\n#include <opaque_fragment>');
      };
      m.customProgramCacheKey=()=>`painted-world-v9-${weatheredRock}-${volcanicRock}-${enhanced}-${isLeaf}-${isRock}-${isGround}-${isWood}-${isCliff}-${isWater}-${isLava}-${!!biomePaint}-${tile}`;
    }
  });
}
