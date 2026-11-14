import * as THREE from 'three';
import { createEnvironments } from './environments.js';
import { createMenuWorld } from './menu-world.js';
import { assetUrl } from './assets.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { GiraffeRig } from './rig.js';
import { createVFX } from './vfx.js';
import { createToonStyle } from './toon.js';
import { BALL_GRAVITY, BALL_RADIUS } from './physics.js';
import { createRenderPerformance } from './performance.js';

const V = (x=0,y=0,z=0) => new THREE.Vector3(x,y,z);
const UP = V(0,1,0);
const random = n => { const value=Math.sin(n*127.1+311.7)*43758.5453;return value-Math.floor(value); };

export function cameraFovForAspect(aspect){
  if(!Number.isFinite(aspect)||aspect<=0)return 65;
  const blend=Math.max(0,Math.min(1,(aspect-.75)/.45));return 85-blend*20;
}

/** A small physical-neck contribution, bounded so whips cannot reverse the view. */
export function neckCameraYaw(commandedYaw,neckBase,head){
  if(!neckBase||!head)return commandedYaw;
  const dx=head.x-neckBase.x,dz=head.z-neckBase.z;
  if(!Number.isFinite(dx)||!Number.isFinite(dz)||Math.hypot(dx,dz)<=.15)return commandedYaw;
  const bearing=Math.atan2(dz,dx),deviation=Math.atan2(Math.sin(bearing-commandedYaw),Math.cos(bearing-commandedYaw));
  return commandedYaw+Math.max(-.22,Math.min(.22,deviation))*.35;
}

export function cameraFollowAlpha(dt){return 1-Math.exp(-Math.max(0,dt)*16);}

export function selectRenderPlayer(game){const players=game?.players;if(!players?.length)return null;if(Number.isInteger(game.localPlayerId))for(const player of players)if(player.id===game.localPlayerId)return player;for(const player of players)if(player.human)return player;return players[0];}

export function resolveRenderSkin(game,player,cached){if(player?.skin&&typeof player.skin==='object')return player.skin;return game?.network?null:cached||null;}

/** Writes a restrained, elevated shoulder view without allocating frame objects. */
export function writeShoulderPose(x,z,yaw,pitch,distance,position,target){
  const angle=Math.max(-.2,Math.min(.3,Number.isFinite(pitch)?pitch:0)),reach=Math.max(6,Math.min(10,distance)),c=Math.cos(yaw),s=Math.sin(yaw);
  position.set(x-c*reach-s*.8,Math.max(5.5,6.8-angle*4),z-s*reach+c*.8);
  target.set(x+c*3,2.2+angle*2,z+s*3);
}

/** Meadow stadium. Player art is an actual Blender-authored, skinned glTF rig. */
export function createWorld({canvas,onProgress=()=>{},onLoadProgress=()=>{},reducedMotion=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches||false}) {
  const adaptive=createRenderPerformance({coarse:window.matchMedia?.('(pointer: coarse)').matches||window.innerWidth<700,nativeDpr:window.devicePixelRatio||1,hardwareConcurrency:navigator.hardwareConcurrency||8,deviceMemory:navigator.deviceMemory||8}),budget=adaptive.budget;
  const scene=new THREE.Scene();scene.background=new THREE.Color('#d7e2d0');scene.fog=new THREE.Fog('#d7e2d0',48,118);
  const renderer=new THREE.WebGLRenderer({canvas,antialias:budget.antialias,powerPreference:adaptive.state.coarse?'default':'high-performance'});
  renderer.setPixelRatio(adaptive.state.pixelRatio);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.08;
  const camera=new THREE.PerspectiveCamera(65,1,.08,180);camera.position.set(-12,6.8,0);camera.lookAt(1,2.2,0);scene.add(camera);
  const hemisphere=new THREE.HemisphereLight('#f5f4e7','#8e9d8f',1.35);scene.add(hemisphere);
  const sun=new THREE.DirectionalLight('#fff1d7',2.3);sun.position.set(-15,27,-11);sun.castShadow=true;sun.shadow.mapSize.set(budget.shadowSize,budget.shadowSize);Object.assign(sun.shadow.camera,{left:-24,right:24,top:22,bottom:-22,near:1,far:70});sun.shadow.normalBias=.035;sun.shadow.bias=-.0002;scene.add(sun);
  const fill=new THREE.DirectionalLight('#b6dce9',.8);fill.position.set(15,9,18);scene.add(fill);
  const toon=createToonStyle();
  const playRoot=new THREE.Group(),lobbyRoot=new THREE.Group();playRoot.name='FloatingMeadowArena';lobbyRoot.name='CloudGardenLobby';scene.add(playRoot,lobbyRoot);
  let options={quality:'auto',shadows:true,fov:0,shake:true};
  let menuScene=true,menuFocus='play',arenaModel=null,lobbyModel=null,grassTexture=null,paintedCourt=null;
  const playerSkins=new Map(),lobbyRigs=[],lobbyPlayers=[],waterMaps=new Set();
  const lobbyAnchors={play:V(0,6.1,-6),shop:V(-9.2,4,.5),abilities:V(8.6,5,-2),online:V(1.5,1.5,8.3)};
  const menuLook=V(),menuEye=V(),mapMotion={active:false,final:false,time:0,duration:1,originX:0,originZ:0};
  const mapBatches=[];let mapChunks=null;const chunkBases=[],chunkMatrix=new THREE.Matrix4(),chunkPoint=V(),chunkScale=V(),chunkEuler=new THREE.Euler(),chunkQuaternion=new THREE.Quaternion();
  const materials=new Map(),geometries=[];
  const material=(color,roughness=.85)=>{if(!materials.has(color))materials.set(color,toon.material(color));return materials.get(color);};
  const sphere=new THREE.SphereGeometry(1,18,12),cube=new THREE.BoxGeometry(1,1,1),cylinder=new THREE.CylinderGeometry(1,1,1,10);geometries.push(sphere,cube,cylinder);
  function mesh(geometry,mat,parent=scene,cast=true){const object=new THREE.Mesh(geometry,mat);object.castShadow=cast;object.receiveShadow=true;object.userData.procedural=true;parent.add(object);return object;}
  function blob(parent,color,x,y,z,sx,sy=sx,sz=sx){const object=mesh(sphere,material(color),parent);object.position.set(x,y,z);object.scale.set(sx,sy,sz);return object;}
  function box(parent,color,x,y,z,sx,sy,sz){const object=mesh(cube,material(color),parent);object.position.set(x,y,z);object.scale.set(sx,sy,sz);return object;}
  function rod(parent,color,a,b,r){const object=mesh(cylinder,material(color),parent);const delta=b.clone().sub(a);object.position.copy(a).add(b).multiplyScalar(.5);object.scale.set(r,delta.length(),r);object.quaternion.setFromUnitVectors(UP,delta.normalize());return object;}
  const animated=[],props=[],rigs=[],emptyPlayers=[],fallbackBall={x:0,y:3,z:0};let disposed=false,template=null,width=1,height=1,elapsed=0,lastGame=null;
  const skyGeometry=new THREE.SphereGeometry(140,24,16),skyMaterial=new THREE.ShaderMaterial({uniforms:{skyMood:{value:0},skyPaint:{value:null},hasPaint:{value:0},upper:{value:new THREE.Color('#64bbdf')},horizon:{value:new THREE.Color('#f4eac7')}},side:THREE.BackSide,depthWrite:false,vertexShader:'varying vec3 skyDirection; void main(){skyDirection=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:'uniform float skyMood;uniform sampler2D skyPaint;uniform float hasPaint;uniform vec3 upper;uniform vec3 horizon;varying vec3 skyDirection; void main(){float h=normalize(skyDirection).y;vec3 lower=mix(upper,horizon,.6);vec3 color=h>0.0?mix(horizon,upper,pow(h,.65)):mix(horizon,lower,min(1.0,-h*2.0));vec3 d=normalize(skyDirection);vec2 uv=vec2(atan(d.z,d.x)/6.2831853+.5,clamp(.75+d.y*.5,0.0,1.0));vec3 painting=texture2D(skyPaint,uv).rgb;vec3 tinted=mix(painting,painting*upper*1.8,mix(.22,.78,skyMood));color=mix(color,tinted,hasPaint*.88);gl_FragColor=vec4(color,1.0);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}'}),sky=new THREE.Mesh(skyGeometry,skyMaterial);sky.name='PaintedSkyDome';sky.renderOrder=-1000;sky.frustumCulled=false;scene.add(sky);geometries.push(skyGeometry);
  const environments=createEnvironments(playRoot,toon,adaptive.state.coarse);
  arenaModel=environments.root;
  const terrain={visible:false},grass={count:0},grassTime={value:0};
  const scoreTexture=new THREE.Texture();
  function updateScore(){}
  let menuWorld=null,currentTheme=null;
  // Bright ivory panels, a crisp amber silhouette and a slim orbital seam keep
  // the volleyball readable against trees, grass and every sky angle.
  const ball=new THREE.Group();ball.name='HighlightedVolleyball';ball.scale.setScalar(BALL_RADIUS/.258);scene.add(ball);
  const outlineMat=new THREE.MeshBasicMaterial({color:'#28241f',side:THREE.BackSide});const outline=mesh(new THREE.SphereGeometry(.286,24,16),outlineMat,ball,false);geometries.push(outline.geometry);
  const ballMat=toon.material(new THREE.MeshStandardMaterial({color:'#fff8dd',emissive:'#fac357',emissiveIntensity:.18}));const core=mesh(new THREE.SphereGeometry(.258,28,20),ballMat,ball);geometries.push(core.geometry);
  for(let i=0;i<6;i++){const panelGeo=new THREE.SphereGeometry(.26,10,16,i*Math.PI/3,Math.PI/3-.045,.21,Math.PI-.42);const panel=mesh(panelGeo,material(i%3===0?'#e68a43':i%3===1?'#fff4d3':'#429a8c',.55),ball);panel.rotation.z=.35;geometries.push(panelGeo);}
  const haloGeo=new THREE.TorusGeometry(.36,.011,6,56),halo=mesh(haloGeo,new THREE.MeshBasicMaterial({color:'#ffe4a2',transparent:true,opacity:.8}),ball,false);geometries.push(haloGeo);halo.rotation.x=.7;
  // Only the thin locator rings ignore depth, so a held ball remains readable
  // when the player's floppy head crosses the line of sight.
  const locator=new THREE.Group();locator.name='BallWorldLocator';locator.scale.setScalar(BALL_RADIUS/.258);scene.add(locator);locator.renderOrder=1000;
  for(const [inner,outer,color,opacity] of [[.350,.369,'#fff1b2',.98],[.383,.398,'#ad6a24',.85]]){const geometry=new THREE.RingGeometry(inner,outer,64);geometries.push(geometry);const ring=mesh(geometry,new THREE.MeshBasicMaterial({color,transparent:true,opacity,side:THREE.DoubleSide,depthTest:false,depthWrite:false}),locator,false);ring.renderOrder=1000;}
  const chevronGeometry=new THREE.BufferGeometry().setFromPoints([V(-.075,.58,0),V(0,.515,0),V(.075,.58,0)]);geometries.push(chevronGeometry);const chevron=new THREE.Line(chevronGeometry,new THREE.LineBasicMaterial({color:'#fff1b2',transparent:true,opacity:.9,depthTest:false,depthWrite:false}));chevron.renderOrder=1001;locator.add(chevron);
  const landing=new THREE.Group();scene.add(landing);const ringGeo=new THREE.RingGeometry(.46,.49,64);geometries.push(ringGeo);const landingRing=mesh(ringGeo,new THREE.MeshBasicMaterial({color:'#ffe5a2',transparent:true,opacity:.65,side:THREE.DoubleSide,depthWrite:false}),landing,false);landingRing.rotation.x=-Math.PI/2;
  for(let i=0;i<4;i++){const marker=box(landing,'#ffd775',Math.cos(i*Math.PI/2)*.61,.008,Math.sin(i*Math.PI/2)*.61,.13,.013,.045);marker.rotation.y=-i*Math.PI/2;marker.castShadow=false;}
  const ballShadow=mesh(new THREE.CircleGeometry(BALL_RADIUS,32),new THREE.MeshBasicMaterial({color:'#354f28',transparent:true,opacity:.21,depthWrite:false}),scene,false);ballShadow.rotation.x=-Math.PI/2;geometries.push(ballShadow.geometry);
  let fanInk=null;for(const item of animated)if(item.type==='fan'){const outline=fanInk?new THREE.Mesh(fanInk.geometry,fanInk.material):toon.ink(item.object,{width:1.7,predicate:object=>object.scale.x>=.17});if(!fanInk)fanInk=outline;else item.object.add(outline);outline.userData.isInk=true;outline.userData.procedural=true;outline.castShadow=false;outline.receiveShadow=false;}
  // Flat ink belongs on strong silhouettes. Tiny net squares, blades, clouds,
  // crowd details and VFX stay clear; repeated pieces share instanced draws.
  const movingRoots=new Set(animated.map(item=>item.object)),excludedRoots=new Set([ball,locator,landing,ballShadow,camera]);
  const under=(object,roots)=>{for(let current=object;current&&current!==scene;current=current.parent)if(roots.has(current))return true;return false;};
  const staticPieces=[],movingPieces=[];
  scene.traverse(object=>{if(!object.isMesh||!object.userData.procedural||under(object,excludedRoots))return;if(under(object,movingRoots)){object.castShadow=false;movingPieces.push(object);}else if(object.geometry===sphere||object.geometry===cube||object.geometry===cylinder)staticPieces.push(object);});
  const inkCandidates=new Set(staticPieces.filter(object=>object.material.isMeshToonMaterial&&Math.min(object.scale.x,object.scale.y,object.scale.z)>.045));
  toon.ink(scene,{width:2.2,predicate:object=>inkCandidates.has(object)});
  toon.batch(staticPieces,scene);toon.batch(movingPieces,scene,true);
  const vfx=createVFX(scene,{camera,reducedMotion});
  const sharedChildren=new Set([camera,hemisphere,sun,fill,playRoot,lobbyRoot,sky]);
  function collectPlayChildren(){for(const child of [...scene.children])if(!sharedChildren.has(child))playRoot.add(child);playRoot.visible=!menuScene;lobbyRoot.visible=menuScene;}
  collectPlayChildren();

  // Assets are local, bundled and awaited before play can start.
  const loader=new GLTFLoader(),loadedSources=[];let loaded=0;
  const reportLoad=()=>{const progress=loaded/totalAssets;onProgress(progress);onLoadProgress(loaded,totalAssets);};
  function load(url){return loader.loadAsync(assetUrl(url)).then(asset=>{loadedSources.push(asset.scene);if(disposed){asset.scene.traverse(object=>{object.geometry?.dispose();for(const mat of object.material?(Array.isArray(object.material)?object.material:[object.material]):[])mat.dispose();});return asset.scene;}loaded++;reportLoad();asset.scene.traverse(object=>{if(object.isMesh){object.castShadow=!adaptive.state.coarse;object.receiveShadow=!adaptive.state.coarse;if(object.material){const mats=Array.isArray(object.material)?object.material:[object.material];mats.forEach(m=>{m.roughness=.85;});}}});return asset.scene;});}
  const totalAssets=13;
  const texLoader=new THREE.TextureLoader();
  function loadTexture(url,repeat=false){return texLoader.loadAsync(assetUrl(url)).then(t=>{t.colorSpace=THREE.SRGBColorSpace;if(repeat)t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=adaptive.state.coarse?2:4;loaded++;reportLoad();return t;});}
  const ready=Promise.all([load('/models/giraffe-athlete.glb'),...['meadow','jungle','beach','volcano','mountain','lobby'].map(id=>load(`/models/worlds/${id}.glb`)),loadTexture('/textures/painted-meadow.jpg',true),loadTexture('/textures/painted-honey-wood.png',true),loadTexture('/textures/painted-sky-stone.png',true),loadTexture('/ui/destination-atlas.png'),loadTexture('/textures/painted-sky.png'),document.fonts.load('24px "Lilita One"').then(()=>{loaded++;reportLoad();})]).then(([source,...assets])=>{
    if(disposed)return;
    const [meadow,jungle,beach,volcano,mountain,lobby,ground,wood,stone,atlas,skyPaint]=assets;
    template=source;const textures={ground,wood,stone};environments.setModels([meadow,jungle,beach,volcano,mountain],textures);
    menuWorld=createMenuWorld(lobbyRoot,toon,lobby,textures,atlas,adaptive.state.coarse);lobbyModel=lobbyRoot;
    skyMaterial.uniforms.skyPaint.value=skyPaint;skyMaterial.uniforms.hasPaint.value=1;
    createLobbyActors();createMapChunks();captureMapBatches();onProgress(1);
  });
  function createLobbyActors(){
    const poses=[[0,4],[-3,5],[4,3],[-2,-4],[3.6,-3.2],[.5,-1.8]],palettes=[{body:'#f4c56d',spots:'#9d633c',muzzle:'#ffe1a1',scarf:'#3c9e8c',accent:'#8bd3b1'},{body:'#e4b0a0',spots:'#9a6576',muzzle:'#ffe7c8',scarf:'#b35d4a',accent:'#efb489'},{body:'#bed0a1',spots:'#6d8c60',muzzle:'#f1e5b5',scarf:'#d49248',accent:'#f3cb77'},{body:'#d7c7e0',spots:'#927795',muzzle:'#fff0d2',scarf:'#6a96a1',accent:'#a4d4ce'},{body:'#f2d894',spots:'#ad7c4d',muzzle:'#fff0c3',scarf:'#cb7656',accent:'#f0be7d'},{body:'#b7cfcd',spots:'#658e94',muzzle:'#f4ebc9',scarf:'#839a5e',accent:'#c3d68c'}];
    for(let i=0;i<(adaptive.state.coarse?3:4);i++){const rig=new GiraffeRig(template,lobbyRoot,i,toon),palette=i===0&&playerSkins.has(0)?playerSkins.get(0):palettes[i],p={id:100+i,team:i%2,human:false,x:poses[i][0],z:poses[i][1],y:(i===1||i===2)?.1:0,dive:(i===1||i===2)?.82:0,_diveX:0,_diveZ:1,vx:0,vz:0,swing:0,energy:1,bodyYaw:1.05,neck:{yaw:1.05,pitch:.05,extension:.2},head:{x:0,y:2.95,z:0},neckPoints:Array.from({length:9},()=>({x:0,y:0,z:0})),skin:palette};rig.setSkin?.(palette);lobbyRigs.push(rig);lobbyPlayers.push(p);}
  }
  function updateLobbyActors(dt,t){for(let i=0;i<lobbyPlayers.length;i++){const p=lobbyPlayers[i],yaw=1.05+Math.sin(t*.24+i)*.2,c=Math.cos(yaw),ss=Math.sin(yaw),startX=p.x+c*.28,startZ=p.z+ss*.28;p.bodyYaw=yaw;p.neck.yaw=yaw+Math.sin(t*.55+i)*.13;p.head.x=p.x+c*.36+Math.sin(t*.8+i)*.16;p.head.y=(p.dive?1.65:2.95)+Math.sin(t*.75+i)*(p.dive?.035:.07);p.head.z=p.z+ss*.36+Math.cos(t*.67+i)*.13;for(let j=0;j<9;j++){const u=j/8,q=p.neckPoints[j],bend=Math.sin(Math.PI*u);q.x=startX+(p.head.x-startX)*u+Math.sin(t*.8+i+u*3)*.06*bend;const shoulder=1.45-(p.dive||0)*.85+(p.y||0);q.y=shoulder+(p.head.y-shoulder)*u;q.z=startZ+(p.head.z-startZ)*u+Math.cos(t*.75+i+u*2)*.05*bend;}lobbyRigs[i].update(p,dt,t);}}
  function setPlayerSkin(id,palette){if(!palette)return;playerSkins.set(id,palette);for(let i=0;i<rigs.length;i++)if((lastGame?.players[i]?.id??i)===id)rigs[i].setSkin?.(palette);if(id===0&&lobbyRigs[0]){lobbyPlayers[0].skin=palette;lobbyRigs[0].setSkin?.(palette);}}
  function menuFov(){const aspect=width/height;if(aspect<=.75)return 85;return 85-Math.min(1,(aspect-.75)/.65)*33;}
  function applyLens(){camera.fov=menuScene?menuFov():cameraFovForAspect(camera.aspect)+(options.fov||0);camera.updateProjectionMatrix();}
  function setMenuFocus(key){if(lobbyAnchors[key])menuFocus=key;}
  function setMenuScene(value){const next=!!value;if(next===menuScene)return;menuScene=next;playRoot.visible=!next;lobbyRoot.visible=next;resetMapMotion();resetCamera();applyLens();}
  function updateMenuCamera(dt){const portrait=width/height<.75,anchor=lobbyAnchors[menuFocus]||lobbyAnchors.play;menuEye.set(portrait?0:2,portrait?25:21,portrait?43:34);menuLook.set(0,1.5,0);if(!cameraInitialized){cameraPosition.copy(menuEye);cameraTarget.copy(menuLook);cameraInitialized=true;}else{const amount=1-Math.exp(-dt*3.5);cameraPosition.lerp(menuEye,amount);cameraTarget.lerp(menuLook,amount);}camera.position.copy(cameraPosition);camera.lookAt(cameraTarget);}
  function projectMenuHotspots(){camera.updateMatrixWorld();const result={};for(const [key,point] of Object.entries(menuWorld?.anchors||{})){result[key]=project(...point);}return result;}
  function pickMenu(x,y){return menuScene?menuWorld?.pick(x,y,width,height,camera):null;}
  function hoverMenu(key){menuWorld?.hover(key);}
  function setMenuLabels(labels){menuWorld?.setLabels(labels);}
  function createMapChunks(){
    const columns=adaptive.state.coarse?6:8,tileX=84/columns,tileZ=76/columns,geometry=new THREE.BoxGeometry(1,1,1),stone=[],top=[],oldIndex=geometry.index.array;for(const group of geometry.groups){const target=group.materialIndex===2?top:stone;for(let i=group.start;i<group.start+group.count;i++)target.push(oldIndex[i]);}geometry.setIndex(stone.concat(top));geometry.clearGroups();geometry.addGroup(0,stone.length,0);geometry.addGroup(stone.length,top.length,1);
    let stoneMaterial=null,topMaterial=null;arenaModel.traverse(o=>{for(const mat of o.material?(Array.isArray(o.material)?o.material:[o.material]):[]){if(/SkyStone/.test(mat.name))stoneMaterial=mat;if(/Meadow/.test(mat.name))topMaterial=mat;}});
    for(let x=0;x<columns;x++)for(let z=0;z<columns;z++){const px=(x-(columns-1)/2)*tileX,pz=(z-(columns-1)/2)*tileZ;if((px/42)**2+(pz/38)**2<1)chunkBases.push({x:px,z:pz,seed:random(x*13+z+317)});}
    mapChunks=new THREE.InstancedMesh(geometry,[stoneMaterial||material('#7596a4'),topMaterial||material('#a8c56a')],chunkBases.length);mapChunks.name='ReusableMapBreakup';mapChunks.frustumCulled=false;mapChunks.visible=false;mapChunks.castShadow=false;mapChunks.receiveShadow=true;mapChunks.userData.tileX=tileX;mapChunks.userData.tileZ=tileZ;playRoot.add(mapChunks);
  }
  function captureMapBatches(){mapBatches.length=0;playRoot.traverse(object=>{if(object.isInstancedMesh&&object!==grass&&object!==mapChunks)mapBatches.push({object,dynamic:object.name==='AnimatedCrowdBatch',rest:new Float32Array(object.instanceMatrix.array)});});}
  function resetMapMotion(){if(!mapMotion.active)return;mapMotion.active=false;environments.setSurfaces(true);if(arenaModel){arenaModel.visible=true;arenaModel.position.y=0;}if(mapChunks)mapChunks.visible=false;if(paintedCourt)paintedCourt.visible=true;grass.count=Math.max(1,Math.floor(budget.grass*adaptive.state.decorationScale));for(const batch of mapBatches)if(!batch.dynamic){batch.object.instanceMatrix.array.set(batch.rest);batch.object.instanceMatrix.needsUpdate=true;}}
  function triggerMapMotion(event){resetMapMotion();if(reducedMotion)return;mapMotion.active=true;mapMotion.final=event.type==='win'||!!event.final;mapMotion.time=0;mapMotion.duration=mapMotion.final?2.8:1.0;mapMotion.originX=event.x||0;mapMotion.originZ=event.z||0;}
  function updateMapMotion(dt,t){scene.fog.near=mapMotion.active&&mapMotion.final?85:48;scene.fog.far=mapMotion.active&&mapMotion.final?160:118;if(!mapMotion.active||menuScene)return;mapMotion.time+=dt;const u=Math.min(1,mapMotion.time/mapMotion.duration),envelope=Math.sin(Math.PI*u),final=mapMotion.final;if(final&&mapChunks){environments.setSurfaces(false);mapChunks.visible=true;mapChunks.material[1].color.set(currentTheme?environments.set(currentTheme).ground:'#a8c56a');if(paintedCourt)paintedCourt.visible=false;grass.count=0;for(let i=0;i<chunkBases.length;i++){const b=chunkBases[i],r=Math.max(1,Math.hypot(b.x-mapMotion.originX,b.z-mapMotion.originZ)),spread=envelope*(4+b.seed*8);chunkPoint.set(b.x+(b.x-mapMotion.originX)/r*spread,envelope*(10+b.seed*12),b.z+(b.z-mapMotion.originZ)/r*spread);chunkScale.set(mapChunks.userData.tileX*.98,8,mapChunks.userData.tileZ*.98);chunkEuler.set(envelope*(b.seed-.5)*1.4,envelope*(b.seed-.5),envelope*(.5-b.seed));chunkQuaternion.setFromEuler(chunkEuler);chunkMatrix.compose(chunkPoint,chunkQuaternion,chunkScale);mapChunks.setMatrixAt(i,chunkMatrix);}mapChunks.instanceMatrix.needsUpdate=true;}
    for(const batch of mapBatches){const object=batch.object,source=batch.dynamic?object.instanceMatrix.array:batch.rest;for(let i=0;i<object.count;i++){chunkMatrix.fromArray(source,i*16);const x=chunkMatrix.elements[12],z=chunkMatrix.elements[14],dx=x-mapMotion.originX,dz=z-mapMotion.originZ,r=Math.max(.4,Math.hypot(dx,dz));if(final){const seed=random(i*19+Math.round(x*7)+Math.round(z*11));chunkMatrix.elements[12]+=dx/r*envelope*(5+seed*7);chunkMatrix.elements[14]+=dz/r*envelope*(5+seed*7);chunkMatrix.elements[13]+=envelope*(8+seed*10);}else{const wave=Math.max(0,1-Math.abs(r-u*40)/4);chunkMatrix.elements[13]+=Math.sin(u*Math.PI*4)*wave*.42;}object.setMatrixAt(i,chunkMatrix);}object.instanceMatrix.needsUpdate=true;}
    if(!final&&arenaModel)arenaModel.position.y=Math.sin(u*Math.PI*5)*(1-u)*.045;if(u>=1)resetMapMotion();
  }
  const orbit={yaw:0,pitch:0,distance:7.2},cameraTarget=V(),cameraPosition=V(),lastBodyPosition=V(),forward=V(),right=V(),base=V(),wanted=V(),aim=V();let cameraInitialized=false,cameraPhase=null,externalPerformanceSample=false,physicalFollowYaw=0;
  function resetCamera(){cameraInitialized=false;}
  function setCamera(value={}){if(Number.isFinite(value.yaw))orbit.yaw=value.yaw;if(Number.isFinite(value.pitch))orbit.pitch=THREE.MathUtils.clamp(value.pitch,-.2,.3);if(Number.isFinite(value.distance))orbit.distance=THREE.MathUtils.clamp(value.distance,6,10);if(value.snap)resetCamera();}
  function applyQuality(){const state={...adaptive.state};if(options.quality==='low'){state.pixelRatio=Math.min(1,state.pixelRatio);state.shadowSize=512;}if(options.quality==='high')state.pixelRatio=Math.max(state.minimumPixelRatio,Math.min(window.devicePixelRatio||1,adaptive.state.coarse?1.5:2)-state.qualityLevel*.15);renderer.shadowMap.enabled=options.shadows;if(renderer.getPixelRatio()!==state.pixelRatio)renderer.setPixelRatio(state.pixelRatio);if(sun.shadow.mapSize.x!==state.shadowSize){sun.shadow.map?.dispose();sun.shadow.map=null;sun.shadow.mapSize.set(state.shadowSize,state.shadowSize);renderer.shadowMap.needsUpdate=true;}grass.count=Math.max(1,Math.floor(budget.grass*state.decorationScale));canvas.dataset.renderProfile=state.profile;canvas.dataset.renderDpr=state.pixelRatio.toFixed(2);canvas.dataset.renderQuality=String(state.qualityLevel);canvas.dataset.shadowSize=String(state.shadowSize);}
  function setOptions(value){options={...options,...value};applyQuality();applyLens();}
  function updatePerformance(dt){externalPerformanceSample=true;if(adaptive.update(dt))applyQuality();return adaptive.state;}
  applyQuality();
  function resize(w,h){width=Math.max(1,Math.round(w));height=Math.max(1,Math.round(h));if(adaptive.resize(window.devicePixelRatio||1))applyQuality();renderer.setSize(width,height,false);camera.aspect=width/height;applyLens();}
  function update(dt,game,time){if(externalPerformanceSample)externalPerformanceSample=false;else if(adaptive.update(dt))applyQuality();lastGame=game;elapsed=Number.isFinite(time)?time:elapsed+dt;const t=elapsed;grassTime.value=t;const theme=environments.set(menuScene?'meadow':game?.mapId);if(currentTheme!==theme.id){currentTheme=theme.id;skyMaterial.uniforms.upper.value.set(theme.sky);skyMaterial.uniforms.skyMood.value=theme.id==='volcano'?1:0;skyMaterial.uniforms.horizon.value.set(menuScene?'#c6e9ed':theme.horizon);scene.fog.color.set(theme.horizon);sun.color.set(theme.sun);hemisphere.color.set(theme.horizon);}environments.update(t);const players=game?.players||emptyPlayers;
    if(template&&!menuScene){while(rigs.length<players.length){const rig=new GiraffeRig(template,playRoot,rigs.length,toon),id=players[rigs.length]?.id??rigs.length;if(playerSkins.has(id))rig.setSkin?.(playerSkins.get(id));rigs.push(rig);}for(let index=0;index<rigs.length;index++){rigs[index].update(players[index],dt,t);const desiredSkin=resolveRenderSkin(game,players[index],playerSkins.get(players[index]?.id??index));if(rigs[index].skin!==desiredSkin)rigs[index].setSkin?.(desiredSkin);if(players[index])toon.setInkWidth(rigs[index].ink,players[index].id===(game.localPlayerId??0)?3.6:2.7);}}
    const human=selectRenderPlayer(game);
    if(human&&!menuScene&&!(mapMotion.active&&mapMotion.final)){physicalFollowYaw=neckCameraYaw(orbit.yaw,human.neckPoints?.[0]||human,human.head);forward.set(Math.cos(physicalFollowYaw),0,Math.sin(physicalFollowYaw));right.set(-forward.z,0,forward.x);base.set(human.x,0,human.z);
      if(cameraPhase!==game?.phase&&(game?.phase==='serve'||game?.phase==='attract')){resetMapMotion();resetCamera();}else if(cameraInitialized&&base.distanceTo(lastBodyPosition)>4.5)resetCamera();cameraPhase=game?.phase;lastBodyPosition.copy(base);
      writeShoulderPose(human.x,human.z,physicalFollowYaw,orbit.pitch,orbit.distance,wanted,aim);
      if(!cameraInitialized){cameraPosition.copy(wanted);cameraTarget.copy(aim);cameraInitialized=true;}else{const follow=cameraFollowAlpha(dt);cameraPosition.lerp(wanted,follow);cameraTarget.lerp(aim,follow);}
      camera.position.copy(cameraPosition);const shake=vfx.cameraImpulse();if(shake&&!reducedMotion&&options.shake)camera.position.addScaledVector(right,Math.sin(t*137)*shake*.5);camera.lookAt(cameraTarget);
    }
    if(menuScene){updateLobbyActors(dt,t);updateMenuCamera(dt);menuWorld?.update(dt,t,camera,reducedMotion);}else if(mapMotion.active&&mapMotion.final){menuEye.set(52,48,54);menuLook.set(0,10,0);cameraPosition.lerp(menuEye,1-Math.exp(-dt*3));cameraTarget.lerp(menuLook,1-Math.exp(-dt*3));camera.position.copy(cameraPosition);camera.lookAt(cameraTarget);}
    sky.position.copy(camera.position);for(const texture of waterMaps)texture.offset.y=-t*.16;
    const b=game?.ball||fallbackBall;ball.visible=game?.phase!=='attract';ball.position.set(b.x,Math.max(BALL_RADIUS,b.y),b.z);core.rotation.x+=dt*2;ball.rotation.z+=dt*1.8;halo.rotation.y=t*1.6;locator.visible=ball.visible;locator.position.copy(ball.position);locator.quaternion.copy(camera.quaternion);
    const landingTime=Math.max(0,((b.vy||0)+Math.sqrt((b.vy||0)**2+2*BALL_GRAVITY*Math.max(0,b.y-BALL_RADIUS)))/BALL_GRAVITY);landing.position.set(THREE.MathUtils.clamp(b.x+(b.vx||0)*landingTime,-10,10),.018,THREE.MathUtils.clamp(b.z+(b.vz||0)*landingTime,-6,6));landing.visible=ball.visible;landing.rotation.y=t*.35;landingRing.material.opacity=.43+Math.sin(t*4)*.08;
    ballShadow.visible=ball.visible;ballShadow.position.set(b.x,.01,b.z);ballShadow.scale.setScalar(1+b.y*.08);ballShadow.material.opacity=.22/(1+b.y*.2);updateScore(game?.score);
    for(const a of animated){if(a.type==='flag'){a.object.rotation.y=Math.sin(t*4+a.seed*.5)*.2;a.object.rotation.x=Math.cos(t*3+a.seed)*.05;}if(a.type==='fan'){a.object.rotation.z=Math.sin(t*3+a.seed)*.07;a.object.position.y=a.base+Math.max(0,Math.sin(t*2.8+a.seed))*.04;}if(a.type==='cloud')a.object.position.x=a.base+Math.sin(t*.015+a.seed)*5;if(a.type==='bird'){const q=t*.12+a.seed*.85;a.object.position.set(Math.cos(q)*34,11+Math.sin(q*2+a.seed)*1.5,Math.sin(q)*29);a.object.rotation.y=-q;for(let j=0;j<2;j++)a.wings[j].rotation.z=(j?1:-1)*Math.sin(t*5+a.seed)*.5;}}
    vfx.update(dt,menuScene?null:game,t);toon.update(camera,width,height);updateMapMotion(dt,t);
  }
  function impact(event){if(event?.type==='score'||event?.type==='win')triggerMapMotion(event);const point=event?.type==='score'||event?.type==='win'?{x:0,y:2,z:0,...event}:event;return vfx.impact(point);}
  function burst(x,y,z,color,power=1){return impact({type:'hit',x,y,z,power});}
  function project(x,y,z){const p=V(x,y,z).project(camera);return{x:(p.x+1)*width/2,y:(1-p.y)*height/2,visible:p.z<1&&p.z>-1};}
  function getDebugSnapshot(){const human=selectRenderPlayer(lastGame);return{camera:{position:camera.position.toArray(),target:cameraTarget.toArray(),fov:camera.fov,physicalFollowYaw,...orbit},performance:{...adaptive.state},lobby:{visible:menuScene,focus:menuFocus,actors:lobbyRigs.length,ready:!!lobbyModel},mapId:environments.id,mapMotion:{active:mapMotion.active,final:mapMotion.final,time:mapMotion.time},toon:toon.stats(),actors:rigs.filter(r=>r.root.visible).length,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,resources:{...renderer.info.memory},human:human?{body:[human.x,human.y,human.z],head:{...human.head},neckPoints:human.neckPoints?.map(p=>({...p}))}:null,rigs:rigs.map(r=>({bones:r.bones.size,neck:r.neck.map(b=>b.bone.getWorldPosition(V()).toArray()),head:r.head?.bone.getWorldPosition(V()).toArray()}))};}
  function dispose(){disposed=true;vfx.dispose();rigs.forEach(rig=>rig.dispose());lobbyRigs.forEach(rig=>rig.dispose());scoreTexture.dispose();const seenGeometry=new Set(),seenMaterial=new Set(),seenTexture=new Set();for(const source of [scene,...loadedSources])source.traverse(o=>{if(o.geometry&&!seenGeometry.has(o.geometry)){seenGeometry.add(o.geometry);o.geometry.dispose();}for(const mat of o.material?(Array.isArray(o.material)?o.material:[o.material]):[]){if(seenMaterial.has(mat))continue;seenMaterial.add(mat);for(const value of Object.values(mat)){if(value?.isTexture&&!seenTexture.has(value)){seenTexture.add(value);value.dispose();}}mat.dispose();}});toon.dispose();renderer.dispose();}
  return{renderer,scene,camera,ready,setOptions,pickMenu,hoverMenu,setMenuLabels,resize,update,dispose,project,burst,impact,setCamera,resetCamera,setMenuScene,setMenuFocus,projectMenuHotspots,setPlayerSkin,performance:adaptive.state,updatePerformance,getDebugSnapshot,setLook:(yaw,pitch)=>setCamera({yaw,pitch}),setReducedMotion:value=>{reducedMotion=!!value;if(reducedMotion)resetMapMotion();vfx.setReducedMotion(reducedMotion);}};
}

