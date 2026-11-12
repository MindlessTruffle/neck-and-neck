import * as THREE from 'three';
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
export function createWorld({canvas,onProgress=()=>{},reducedMotion=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches||false}) {
  const adaptive=createRenderPerformance({coarse:window.matchMedia?.('(pointer: coarse)').matches||window.innerWidth<700,nativeDpr:window.devicePixelRatio||1,hardwareConcurrency:navigator.hardwareConcurrency||8,deviceMemory:navigator.deviceMemory||8}),budget=adaptive.budget;
  const scene=new THREE.Scene();scene.background=new THREE.Color('#cad8bd');scene.fog=new THREE.Fog('#d2d9b8',45,125);
  const renderer=new THREE.WebGLRenderer({canvas,antialias:budget.antialias,powerPreference:adaptive.state.coarse?'default':'high-performance'});
  renderer.setPixelRatio(adaptive.state.pixelRatio);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.NoToneMapping;renderer.toneMappingExposure=1;
  const camera=new THREE.PerspectiveCamera(65,1,.08,180);camera.position.set(-12,6.8,0);camera.lookAt(1,2.2,0);scene.add(camera);
  const hemisphere=new THREE.HemisphereLight('#fff1c9','#6e6849',.9);scene.add(hemisphere);
  const sun=new THREE.DirectionalLight('#fff2cd',2.35);sun.position.set(-15,27,-11);sun.castShadow=true;sun.shadow.mapSize.set(budget.shadowSize,budget.shadowSize);Object.assign(sun.shadow.camera,{left:-24,right:24,top:22,bottom:-22,near:1,far:70});sun.shadow.normalBias=.026;sun.shadow.bias=-.00016;scene.add(sun);
  const fill=new THREE.DirectionalLight('#c4d7bf',.1);fill.position.set(15,9,18);scene.add(fill);
  const toon=createToonStyle();
  const playRoot=new THREE.Group(),lobbyRoot=new THREE.Group();playRoot.name='FloatingMeadowArena';lobbyRoot.name='CloudGardenLobby';scene.add(playRoot,lobbyRoot);
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
  const skyGeometry=new THREE.SphereGeometry(140,24,16),skyMaterial=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,vertexShader:'varying vec3 skyDirection; void main(){skyDirection=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:'varying vec3 skyDirection; void main(){float h=normalize(skyDirection).y;vec3 horizon=vec3(.92,.94,.76),upper=vec3(.43,.76,.83),lower=vec3(.67,.83,.84);vec3 color=h>0.0?mix(horizon,upper,pow(h,.65)):mix(horizon,lower,min(1.0,-h*2.0));gl_FragColor=vec4(color,1.0);}'}),sky=new THREE.Mesh(skyGeometry,skyMaterial);sky.name='PaintedSkyDome';sky.renderOrder=-1000;sky.frustumCulled=false;scene.add(sky);geometries.push(skyGeometry);
  const terrain=mesh(new THREE.PlaneGeometry(280,280),material('#679d46'),scene,false);terrain.rotation.x=-Math.PI/2;terrain.position.y=-.035;geometries.push(terrain.geometry);
  // Close-cropped stripes and chalk live on the grass, without UI overlays.
  for(let i=0;i<12;i++)box(scene,i%2?'#7caf50':'#73a54a',-9+(i+.5)*1.5,-.017,0,1.5,.025,10).castShadow=false;
  for(const z of [-5,5])box(scene,'#fff3d8',0,.006,z,18.08,.016,.075).castShadow=false;
  for(const x of [-9,9])box(scene,'#fff3d8',x,.006,0,.075,.016,10).castShadow=false;
  for(const x of [-3,3])box(scene,'#dae7b7',x,.003,0,.034,.012,9.98).castShadow=false;
  const grassTime={value:0},grassGeo=new THREE.BufferGeometry();grassGeo.setAttribute('position',new THREE.Float32BufferAttribute([-.032,0,0,.032,0,0,-.017,.3,.018,.032,0,0,.017,.3,.018,-.017,.3,.018,-.017,.3,.018,.017,.3,.018,0,.62,.07],3));grassGeo.computeVertexNormals();geometries.push(grassGeo);
  const grassMat=toon.material(new THREE.MeshBasicMaterial({color:'#c3d19a',side:THREE.DoubleSide}));
  grassMat.onBeforeCompile=shader=>{shader.uniforms.uGrassTime=grassTime;shader.vertexShader='uniform float uGrassTime;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n transformed.x += sin(uGrassTime*1.7+instanceMatrix[3].x*.6+instanceMatrix[3].z*.42)*transformed.y*.13;');};
  const grass=new THREE.InstancedMesh(grassGeo,grassMat,budget.grass),dummy=new THREE.Object3D(),tint=new THREE.Color();
  for(let i=0;i<budget.grass;i++){const x=(random(i*3)-.5)*76,z=(random(i*3+1)-.5)*76,onCourt=Math.abs(x)<9.2&&Math.abs(z)<5.3;dummy.position.set(x,0,z);dummy.rotation.y=random(i+8)*Math.PI;dummy.scale.set(.7,onCourt?.07:.2+random(i+12)*.6,.7);dummy.updateMatrix();grass.setMatrixAt(i,dummy.matrix);tint.setHSL(.23+random(i+15)*.035,.42,.31+random(i+17)*.13);grass.setColorAt(i,tint);}grass.receiveShadow=!adaptive.state.coarse;grass.frustumCulled=false;scene.add(grass);
  // The lacquered net posts carry practical padding and a fine cotton grid.
  for(const z of [-5.6,5.6]){rod(scene,'#b98d56',V(0,0,z),V(0,2.72,z),.09);blob(scene,'#f1d7a3',0,2.75,z,.115);box(scene,'#278d88',0,.65,z,.26,1.3,.29);rod(scene,'#d6c394',V(0,2.5,z),V(1,.02,z+Math.sign(z)*.9),.017);}
  for(let z=-5.5;z<=5.51;z+=.35)rod(scene,'#f7edce',V(0,.7,z),V(0,2.35,z),.010);
  for(let y=.7;y<=2.35;y+=.24)rod(scene,'#f7edce',V(0,y,-5.5),V(0,y,5.5),.010);
  box(scene,'#fff6dc',0,2.37,0,.065,.1,11.17);box(scene,'#d7c698',0,.7,0,.04,.04,11.1);
  // Layered hills frame a clear, central play silhouette.
  for(let i=0;i<budget.hills;i++){const a=i*Math.PI*2/budget.hills,r=45+random(i+60)*13;const hill=blob(scene,i%2?'#80a954':'#91b66c',Math.cos(a)*r,-3,Math.sin(a)*r,15+random(i+70)*12,5+random(i+80)*8,16+random(i+90)*9);hill.castShadow=false;}
  function path(points,width){const curve=new THREE.CatmullRomCurve3(points.map(p=>V(p[0],.005,p[1]))),positions=[],indices=[];for(let i=0;i<=80;i++){const t=i/80,p=curve.getPoint(t),tangent=curve.getTangent(t),side=V(-tangent.z,0,tangent.x).multiplyScalar(width/2);positions.push(p.x+side.x,p.y,p.z+side.z,p.x-side.x,p.y,p.z-side.z);if(i<80){const n=i*2;indices.push(n,n+1,n+2,n+1,n+3,n+2);}}const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeVertexNormals();geometries.push(geometry);mesh(geometry,material('#c7b789'),scene,false);}
  path([[-21,-1],[-15,-2],[-12,-6],[-6,-7.1],[2,-7.2],[11,-6],[17,-1],[23,0]],1.35);
  path([[-17,8],[-10,7.1],[-3,7],[6,7.2],[14,9],[20,15]],1.1);
  // Timber tribunes are shallow enough for every orbit camera angle.
  function stand(z,sign){const group=new THREE.Group();scene.add(group);group.position.z=z;
    for(let row=0;row<3;row++){box(group,'#ad8151',0,.23+row*.29,sign*row*.6,14.6,.22,.66);box(group,'#d4ad74',0,.36+row*.29,sign*row*.6,14.8,.09,.63);}
    for(let x=-7.1;x<=7.2;x+=1.8){rod(group,'#9b7049',V(x,0,sign*1.8),V(x,1.55,sign*1.8),.055);}
    rod(group,'#d2b17d',V(-7.2,1.45,sign*1.8),V(7.2,1.45,sign*1.8),.045);
    for(let i=0;i<budget.fansPerStand;i++){const row=i%3,x=-6.6+Math.floor(i/3)*(13.2/(Math.ceil(budget.fansPerStand/3)-1))+random(i+sign)*.35,gg=new THREE.Group();group.add(gg);gg.position.set(x,.45+row*.29,sign*row*.6);gg.rotation.y=sign>0?Math.PI:0;const c=['#dfab86','#b7c995','#edc86c','#d98c79'][i%4];blob(gg,c,0,.2,0,.18,.28,.18);blob(gg,c,0,.54,0,.22,.21,.2);for(const side of [-1,1]){blob(gg,c,side*.16,.71,0,.07,.12,.06);blob(gg,'#3e4b3b',side*.08,.56,.181,.023,.029,.016);}blob(gg,'#f3d5ac',0,.48,.19,.1,.055,.05);animated.push({type:'fan',object:gg,seed:i+sign,base:gg.position.y});}
  }stand(-8.6,-1);stand(8.9,1);
  // Long, fluttering pennant ropes give the meadow a proper club-day atmosphere.
  const flagGeo=new THREE.BufferGeometry();flagGeo.setAttribute('position',new THREE.Float32BufferAttribute([-.23,0,0,.23,0,0,0,-.47,.018],3));flagGeo.computeVertexNormals();geometries.push(flagGeo);
  for(const z of [-10.7,10.9]){for(const x of [-10.8,10.8])rod(scene,'#a57d4d',V(x,0,z),V(x,3.65,z),.06);rod(scene,'#e6d3a2',V(-10.8,3.55,z),V(10.8,3.55,z),.013);for(let i=0;i<budget.flagsPerSide;i++){const flag=mesh(flagGeo,material(['#e37d58','#f0c765','#3f9e90','#e6e1b8'][i%4]));flag.position.set(-10.3+i*(20.6/(budget.flagsPerSide-1)),3.5-Math.sin(i/(budget.flagsPerSide-1)*Math.PI)*.22,z);animated.push({type:'flag',object:flag,seed:i});}}
  // Clouds, sun and distant birds keep the vista moving without camera noise.
  const sunDisk=blob(scene,'#fff2b9',-43,45,-58,4.5);sunDisk.material=new THREE.MeshBasicMaterial({color:'#fff2b9'});
  for(let i=0;i<budget.clouds;i++){const group=new THREE.Group();scene.add(group);group.position.set(-65+i*15,18+random(i+10)*8,-40-random(i+40)*45);for(let j=0;j<5;j++)blob(group,'#f5f7e9',j*1.8,Math.sin(j)*.55,0,2.5,1+random(j+i)*.7,1.5);animated.push({type:'cloud',object:group,base:group.position.x,seed:i});}
  for(let i=0;i<budget.birds;i++){const group=new THREE.Group();scene.add(group);const wings=[];for(const s of [-1,1])wings.push(blob(group,'#52675a',s*.16,0,0,.22,.025,.065));animated.push({type:'bird',object:group,wings,seed:i});}
  const board=new THREE.Group();scene.add(board);board.position.set(.5,0,-7.45);board.rotation.y=-Math.PI/2;
  for(const x of [-1.2,1.2])box(board,'#9c774d',x,1.4,0,.15,2.8,.15);box(board,'#c19a61',0,2.3,0,3.1,1.85,.19);
  const scoreCanvas=document.createElement('canvas');scoreCanvas.width=1024;scoreCanvas.height=512;const scoreContext=scoreCanvas.getContext('2d'),scoreTexture=new THREE.CanvasTexture(scoreCanvas);scoreTexture.colorSpace=THREE.SRGBColorSpace;
  const face=mesh(new THREE.PlaneGeometry(2.85,1.59),new THREE.MeshBasicMaterial({map:scoreTexture}),board,false);face.position.set(0,2.3,.11);geometries.push(face.geometry);let scoreKey='',lastScore0=-1,lastScore1=-1;
  function updateScore(score=[0,0]){
    if(scoreKey&&score[0]===lastScore0&&score[1]===lastScore1)return;scoreKey='ready';lastScore0=score[0];lastScore1=score[1];const c=scoreContext;
    c.fillStyle='#ead294';c.fillRect(0,0,1024,512);c.lineJoin='round';c.strokeStyle='#28241f';c.lineWidth=16;c.strokeRect(13,13,998,486);c.lineWidth=4;c.strokeRect(31,31,962,450);
    c.fillStyle='#ad5038';c.fillRect(174,36,676,65);c.lineWidth=5;c.strokeRect(174,36,676,65);c.textAlign='center';c.fillStyle='#fff0c0';c.font='34px "Lilita One", Impact, sans-serif';c.fillText('MEADOW MAYHEM',512,81);
    c.strokeStyle='#aa844d';c.lineWidth=4;c.beginPath();c.moveTo(512,124);c.lineTo(512,387);c.stroke();
    c.font='174px "Lilita One", Impact, sans-serif';c.lineWidth=12;c.strokeStyle='#28241f';c.fillStyle='#fff0c0';for(const [value,x]of [[score[0],281],[score[1],743]]){const text=String(value).padStart(2,'0');c.strokeText(text,x,294);c.fillText(text,x,294);}
    c.font='32px "Lilita One", Impact, sans-serif';for(const [name,x,color]of [['MEADOW',281,'#3a7358'],['EMBER',743,'#b85539']]){c.fillStyle=color;c.fillRect(x-148,329,296,57);c.strokeStyle='#28241f';c.lineWidth=5;c.strokeRect(x-148,329,296,57);c.fillStyle='#fff0c0';c.fillText(name,x,371);}
    c.fillStyle='#654b32';c.font='26px "Lilita One", Impact, sans-serif';c.fillText('FIRST TO 7 / WIN BY 2',512,451);scoreTexture.needsUpdate=true;
  }updateScore();
  if(document.fonts)Promise.all([document.fonts.ready,document.fonts.load('32px "Lilita One"')]).then(()=>{if(disposed)return;scoreKey='';updateScore(lastGame?.score);});
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
  function load(url){return loader.loadAsync(assetUrl(url)).then(asset=>{loadedSources.push(asset.scene);if(disposed){asset.scene.traverse(object=>{object.geometry?.dispose();for(const mat of object.material?(Array.isArray(object.material)?object.material:[object.material]):[])mat.dispose();});return asset.scene;}loaded++;onProgress(loaded/totalAssets);asset.scene.traverse(object=>{if(object.isMesh){object.castShadow=true;object.receiveShadow=true;if(object.material){const mats=Array.isArray(object.material)?object.material:[object.material];mats.forEach(m=>{m.roughness=.85;});}}});return asset.scene;});}
  const natureNames=['tree_oak','tree_detailed','tree_pineTallA_detailed','tree_pineRoundC','tree_small','rock_largeA','rock_largeB','plant_bushDetailed','flower_yellowA','flower_redA','tree_oak_fall','tree_plateau','plant_bushLargeTriangle','fence_planks','fence_gate','sign','log_stack','stump_roundDetailed','mushroom_redGroup','flower_redC','flower_yellowB'],quaterniusNames=['CommonTree_2','TwistedTree_1','Bush_Common_Flowers','Rock_Medium_2','Fern_1','Flower_4_Group','RockPath_Round_Wide'],totalAssets=natureNames.length+quaterniusNames.length+5;
  function place(source,x,z,height,angle=0){const object=source.clone(true);const bounds=new THREE.Box3().setFromObject(object),size=bounds.getSize(V());object.scale.setScalar(height/Math.max(.01,size.y));object.rotation.y=angle;object.position.set(x,-bounds.min.y*object.scale.y,z);object.traverse(child=>{if(child.isMesh)child.castShadow=!child.userData.isInk&&!adaptive.state.coarse&&height>2.5&&Math.hypot(x,z)<21;});scene.add(object);props.push(object);return object;}
  const ready=Promise.all([load('/models/giraffe-athlete.glb'),load('/models/meadow-pavilion.glb'),...natureNames.map(name=>load(`/kenney/nature/${name}.glb`)),load('/models/cloud-meadow-arena.glb'),load('/models/cloud-garden-lobby.glb'),...quaterniusNames.map(name=>load(`/quaternius/nature/${name}.gltf`)),new THREE.TextureLoader().loadAsync(assetUrl('/textures/painted-meadow.jpg')).then(texture=>{loaded++;onProgress(loaded/totalAssets);return texture;})]).then(assets=>{
    if(disposed)return;template=assets[0];const pavilion=toon.stylize(assets[1],{width:2.6});pavilion.position.set(15.3,0,-.5);pavilion.rotation.y=-Math.PI/2;scene.add(pavilion);props.push(pavilion);
    const nature=Object.fromEntries(natureNames.map((name,i)=>[name,assets[i+2]]));
    for(const [name,source]of Object.entries(nature))toon.stylize(source,{width:2.2,outline:!name.startsWith('flower')});
    for(let i=0;i<budget.trees;i++){const a=i*Math.PI*2/budget.trees+.13,r=21+random(i+39)*13;const name=i%6===0?'tree_oak_fall':i%6===1?'tree_plateau':i%6===2?'tree_pineTallA_detailed':i%6===3?'tree_pineRoundC':i%6===4?'tree_detailed':'tree_oak';place(nature[name],Math.cos(a)*r,Math.sin(a)*r,4.5+random(i+51)*4,random(i+48)*6.28);}
    for(let i=0;i<18;i++){const a=i*Math.PI*2/18,r=13+random(i+72)*6;const x=Math.cos(a)*r,z=Math.sin(a)*r*.8;if(Math.abs(x)<11&&Math.abs(z)<7.5)continue;place(nature[i%3?(i%2?'plant_bushDetailed':'plant_bushLargeTriangle'):'tree_small'],x,z,i%3?.7+random(i+14)*.6:2+random(i+17)*1.3,i);}
    for(let i=0;i<18;i++){const a=i*Math.PI*2/18+.4,r=13.5+random(i+62)*6;const x=Math.cos(a)*r,z=Math.sin(a)*r*.8;if(Math.abs(x)<11&&Math.abs(z)<7.5)continue;place(nature[i%2?'rock_largeA':'rock_largeB'],x,z,.4+random(i+80)*.8,i);}
    for(let side=-1;side<=1;side+=2)for(let i=0;i<budget.flowersPerSide;i++){const x=-10.5+i*(21/(budget.flowersPerSide-1)),z=side*(11.5+random(i+60)*.7);place(nature[['flower_yellowA','flower_redA','flower_redC','flower_yellowB'][i%4]],x,z,.23+random(i+12)*.22,i);}
    // Genuine Kenney camp props turn the stadium edge into a village field day.
    for(const side of [-1,1]){
      for(let i=0;i<(adaptive.state.coarse?6:9);i++){const x=-15+i*(30/((adaptive.state.coarse?6:9)-1));if(Math.abs(x)<2)continue;place(nature.fence_planks,x,side*13.4,.95,side<0?Math.PI:0);}
      place(nature.fence_gate,0,side*13.4,1.12,0);
      place(nature.sign,side*12.8,side*7.7,1.25,side<0?Math.PI/2:-Math.PI/2);
      place(nature.log_stack,side*13.5,-side*9.8,.65,side*.8);
      place(nature.stump_roundDetailed,side*11.8,-side*11.2,.53,side);
      for(let i=0;i<(adaptive.state.coarse?2:4);i++)place(nature.mushroom_redGroup,side*(12.4+i*.9),-side*(10.5+i*.32),.25+random(i+44)*.12,i);
    }
    const islandIndex=natureNames.length+2,qIndex=islandIndex+2;
    grassTexture=assets[qIndex+quaterniusNames.length];grassTexture.colorSpace=THREE.SRGBColorSpace;grassTexture.wrapS=grassTexture.wrapT=THREE.RepeatWrapping;grassTexture.anisotropy=Math.min(renderer.capabilities.getMaxAnisotropy(),adaptive.state.coarse?2:4);
    function paintLand(root){root.traverse(object=>{for(const mat of object.material?(Array.isArray(object.material)?object.material:[object.material]):[]){if(/Painterly_Meadow/.test(mat.name))mat.map=grassTexture;if(/TurquoiseWater/.test(mat.name)&&mat.map)waterMaps.add(mat.map);}});toon.stylize(root,{outline:false});root.traverse(object=>{for(const mat of object.material?(Array.isArray(object.material)?object.material:[object.material]):[]){if(/CloudCream/.test(mat.name)){mat.color.set('#fff9ed');mat.emissive.set('#dceefa');mat.emissiveIntensity=.48;object.castShadow=false;object.receiveShadow=false;}if(/TurquoiseWater/.test(mat.name)){mat.emissive.set('#79e7de');mat.emissiveIntensity=.13;}}});}
    arenaModel=assets[islandIndex];lobbyModel=assets[islandIndex+1];paintLand(arenaModel);paintLand(lobbyModel);playRoot.add(arenaModel);lobbyRoot.add(lobbyModel);terrain.visible=false;
    const q=Object.fromEntries(quaterniusNames.map((name,i)=>[name,assets[qIndex+i]]));for(const model of Object.values(q))toon.stylize(model,{width:1.3});
    for(let i=0;i<(adaptive.state.coarse?4:8);i++){const a=i*Math.PI*2/(adaptive.state.coarse?4:8)+.5;place(q[i%2?'CommonTree_2':'TwistedTree_1'],Math.cos(a)*19,Math.sin(a)*17,5.5+random(i+222)*2,i*.8);}
    for(const side of [-1,1]){place(q.Bush_Common_Flowers,side*11.5,-7.1,1.1,side);place(q.Fern_1,side*10.3,6.7,.8,side);place(q.Rock_Medium_2,side*13.6,7.5,.8,side);place(q.Flower_4_Group,side*7.5,6.1,.55,side);place(q.RockPath_Round_Wide,side*3.7,7.4,.08,0);}
    function lobbyProp(source,x,z,height,rotation=0){const model=source.clone(true),bounds=new THREE.Box3().setFromObject(model),size=bounds.getSize(V());model.scale.setScalar(height/Math.max(.01,size.y));model.position.set(x,-bounds.min.y*model.scale.y,z);model.rotation.y=rotation;model.traverse(child=>{if(child.isMesh)child.castShadow=false;});lobbyRoot.add(model);}
    lobbyProp(q.CommonTree_2,-10.3,-3.5,4.4,.4);lobbyProp(nature.tree_oak_fall,10,-4.8,3.6,.2);
    if(!adaptive.state.coarse){lobbyProp(q.TwistedTree_1,10,4,3.8,-.5);lobbyProp(nature.tree_small,-10.5,5.5,2.8,1);}
    for(const side of [-1,1]){lobbyProp(q.Bush_Common_Flowers,side*9,3.1,.9,side);lobbyProp(q.Fern_1,side*7,-5.5,.7,side);lobbyProp(q.Flower_4_Group,side*5.5,4.9,.5,side);}
    const courtTexture=grassTexture.clone();courtTexture.wrapS=courtTexture.wrapT=THREE.RepeatWrapping;courtTexture.repeat.set(2.5,1.5);courtTexture.needsUpdate=true;
    const courtMaterial=toon.material(new THREE.MeshStandardMaterial({color:'#e3f3bd',map:courtTexture})),court=new THREE.Mesh(new THREE.PlaneGeometry(18,10),courtMaterial);court.rotation.x=-Math.PI/2;court.position.y=.002;court.receiveShadow=true;paintedCourt=court;playRoot.add(court);
    const scenery=[];props.forEach(prop=>prop.traverse(object=>{if(object.isMesh)scenery.push(object);}));toon.batch(scenery,scene);collectPlayChildren();createLobbyActors();createMapChunks();captureMapBatches();onProgress(1);

  });
  function createLobbyActors(){
    const poses=[[-.7,1.4],[-5,4.7],[5.4,4.4],[-4.8,-2.5],[3.6,-3.2],[.5,-1.8]],palettes=[{body:'#f4c56d',spots:'#9d633c',muzzle:'#ffe1a1',scarf:'#3c9e8c',accent:'#8bd3b1'},{body:'#e4b0a0',spots:'#9a6576',muzzle:'#ffe7c8',scarf:'#b35d4a',accent:'#efb489'},{body:'#bed0a1',spots:'#6d8c60',muzzle:'#f1e5b5',scarf:'#d49248',accent:'#f3cb77'},{body:'#d7c7e0',spots:'#927795',muzzle:'#fff0d2',scarf:'#6a96a1',accent:'#a4d4ce'},{body:'#f2d894',spots:'#ad7c4d',muzzle:'#fff0c3',scarf:'#cb7656',accent:'#f0be7d'},{body:'#b7cfcd',spots:'#658e94',muzzle:'#f4ebc9',scarf:'#839a5e',accent:'#c3d68c'}];
    for(let i=0;i<(adaptive.state.coarse?4:6);i++){const rig=new GiraffeRig(template,lobbyRoot,i,toon),palette=i===0&&playerSkins.has(0)?playerSkins.get(0):palettes[i],p={id:100+i,team:i%2,human:false,x:poses[i][0],z:poses[i][1],y:(i===1||i===2)?.1:0,dive:(i===1||i===2)?.82:0,_diveX:0,_diveZ:1,vx:0,vz:0,swing:0,energy:1,bodyYaw:1.05,neck:{yaw:1.05,pitch:.05,extension:.2},head:{x:0,y:2.95,z:0},neckPoints:Array.from({length:9},()=>({x:0,y:0,z:0})),skin:palette};rig.setSkin?.(palette);lobbyRigs.push(rig);lobbyPlayers.push(p);}
  }
  function updateLobbyActors(dt,t){for(let i=0;i<lobbyPlayers.length;i++){const p=lobbyPlayers[i],yaw=1.05+Math.sin(t*.24+i)*.2,c=Math.cos(yaw),ss=Math.sin(yaw),startX=p.x+c*.28,startZ=p.z+ss*.28;p.bodyYaw=yaw;p.neck.yaw=yaw+Math.sin(t*.55+i)*.13;p.head.x=p.x+c*.36+Math.sin(t*.8+i)*.16;p.head.y=(p.dive?1.65:2.95)+Math.sin(t*.75+i)*(p.dive?.035:.07);p.head.z=p.z+ss*.36+Math.cos(t*.67+i)*.13;for(let j=0;j<9;j++){const u=j/8,q=p.neckPoints[j],bend=Math.sin(Math.PI*u);q.x=startX+(p.head.x-startX)*u+Math.sin(t*.8+i+u*3)*.06*bend;const shoulder=1.45-(p.dive||0)*.85+(p.y||0);q.y=shoulder+(p.head.y-shoulder)*u;q.z=startZ+(p.head.z-startZ)*u+Math.cos(t*.75+i+u*2)*.05*bend;}lobbyRigs[i].update(p,dt,t);}}
  function setPlayerSkin(id,palette){if(!palette)return;playerSkins.set(id,palette);for(let i=0;i<rigs.length;i++)if((lastGame?.players[i]?.id??i)===id)rigs[i].setSkin?.(palette);if(id===0&&lobbyRigs[0]){lobbyPlayers[0].skin=palette;lobbyRigs[0].setSkin?.(palette);}}
  function menuFov(){const aspect=width/height;if(aspect<=.75)return 85;return 85-Math.min(1,(aspect-.75)/.65)*33;}
  function applyLens(){camera.fov=menuScene?menuFov():cameraFovForAspect(camera.aspect);camera.updateProjectionMatrix();}
  function setMenuFocus(key){if(lobbyAnchors[key])menuFocus=key;}
  function setMenuScene(value){const next=!!value;if(next===menuScene)return;menuScene=next;playRoot.visible=!next;lobbyRoot.visible=next;resetMapMotion();resetCamera();applyLens();}
  function updateMenuCamera(dt){const portrait=width/height<.75,anchor=lobbyAnchors[menuFocus]||lobbyAnchors.play;menuEye.set(portrait?1:10,portrait?16:12,portrait?31:25);menuLook.set(anchor.x*.13,1.3+anchor.y*.035,anchor.z*.13);if(!cameraInitialized){cameraPosition.copy(menuEye);cameraTarget.copy(menuLook);cameraInitialized=true;}else{const amount=1-Math.exp(-dt*3.5);cameraPosition.lerp(menuEye,amount);cameraTarget.lerp(menuLook,amount);}camera.position.copy(cameraPosition);camera.lookAt(cameraTarget);}
  function projectMenuHotspots(){camera.updateMatrixWorld();const result={};for(const key of Object.keys(lobbyAnchors)){const point=lobbyAnchors[key],projected=project(point.x,point.y,point.z);projected.visible=!!lobbyModel&&menuScene&&projected.visible;if(width<700){projected.x=width*((key==='play'||key==='shop') ? .25 : .75);projected.y=height*((key==='play'||key==='abilities') ? .44 : .65);}result[key]=projected;}return result;}
  function createMapChunks(){
    const columns=adaptive.state.coarse?6:8,tileX=84/columns,tileZ=76/columns,geometry=new THREE.BoxGeometry(1,1,1),stone=[],top=[],oldIndex=geometry.index.array;for(const group of geometry.groups){const target=group.materialIndex===2?top:stone;for(let i=group.start;i<group.start+group.count;i++)target.push(oldIndex[i]);}geometry.setIndex(stone.concat(top));geometry.clearGroups();geometry.addGroup(0,stone.length,0);geometry.addGroup(stone.length,top.length,1);
    let stoneMaterial=null,topMaterial=null;arenaModel.traverse(o=>{for(const mat of o.material?(Array.isArray(o.material)?o.material:[o.material]):[]){if(/SkyStone/.test(mat.name))stoneMaterial=mat;if(/Meadow/.test(mat.name))topMaterial=mat;}});
    for(let x=0;x<columns;x++)for(let z=0;z<columns;z++){const px=(x-(columns-1)/2)*tileX,pz=(z-(columns-1)/2)*tileZ;if((px/42)**2+(pz/38)**2<1)chunkBases.push({x:px,z:pz,seed:random(x*13+z+317)});}
    mapChunks=new THREE.InstancedMesh(geometry,[stoneMaterial||material('#7596a4'),topMaterial||material('#a8c56a')],chunkBases.length);mapChunks.name='ReusableMapBreakup';mapChunks.frustumCulled=false;mapChunks.visible=false;mapChunks.castShadow=false;mapChunks.receiveShadow=true;mapChunks.userData.tileX=tileX;mapChunks.userData.tileZ=tileZ;playRoot.add(mapChunks);
  }
  function captureMapBatches(){mapBatches.length=0;playRoot.traverse(object=>{if(object.isInstancedMesh&&object!==grass&&object!==mapChunks)mapBatches.push({object,dynamic:object.name==='AnimatedCrowdBatch',rest:new Float32Array(object.instanceMatrix.array)});});}
  function resetMapMotion(){if(!mapMotion.active)return;mapMotion.active=false;if(arenaModel){arenaModel.visible=true;arenaModel.position.y=0;}if(mapChunks)mapChunks.visible=false;if(paintedCourt)paintedCourt.visible=true;grass.count=Math.max(1,Math.floor(budget.grass*adaptive.state.decorationScale));for(const batch of mapBatches)if(!batch.dynamic){batch.object.instanceMatrix.array.set(batch.rest);batch.object.instanceMatrix.needsUpdate=true;}}
  function triggerMapMotion(event){resetMapMotion();if(reducedMotion)return;mapMotion.active=true;mapMotion.final=event.type==='win'||!!event.final;mapMotion.time=0;mapMotion.duration=mapMotion.final?2.8:1.0;mapMotion.originX=event.x||0;mapMotion.originZ=event.z||0;}
  function updateMapMotion(dt,t){if(!mapMotion.active||menuScene)return;mapMotion.time+=dt;const u=Math.min(1,mapMotion.time/mapMotion.duration),envelope=Math.sin(Math.PI*u),final=mapMotion.final;if(final&&mapChunks){arenaModel.visible=false;mapChunks.visible=true;if(paintedCourt)paintedCourt.visible=false;grass.count=0;for(let i=0;i<chunkBases.length;i++){const b=chunkBases[i],r=Math.max(1,Math.hypot(b.x,b.z)),spread=envelope*(3+b.seed*5);chunkPoint.set(b.x+b.x/r*spread,-4+envelope*(7+b.seed*8),b.z+b.z/r*spread);chunkScale.set(mapChunks.userData.tileX*.98,8,mapChunks.userData.tileZ*.98);chunkEuler.set(envelope*(b.seed-.5)*1.4,envelope*(b.seed-.5),envelope*(.5-b.seed));chunkQuaternion.setFromEuler(chunkEuler);chunkMatrix.compose(chunkPoint,chunkQuaternion,chunkScale);mapChunks.setMatrixAt(i,chunkMatrix);}mapChunks.instanceMatrix.needsUpdate=true;}
    for(const batch of mapBatches){const object=batch.object,source=batch.dynamic?object.instanceMatrix.array:batch.rest;for(let i=0;i<object.count;i++){chunkMatrix.fromArray(source,i*16);const x=chunkMatrix.elements[12],z=chunkMatrix.elements[14],dx=x-mapMotion.originX,dz=z-mapMotion.originZ,r=Math.max(.4,Math.hypot(dx,dz));if(final){chunkMatrix.elements[12]+=dx/r*envelope*4;chunkMatrix.elements[14]+=dz/r*envelope*4;chunkMatrix.elements[13]+=envelope*(3+Math.sin(x*.7+z)*1.8);}else{const wave=Math.max(0,1-Math.abs(r-u*40)/4);chunkMatrix.elements[13]+=Math.sin(u*Math.PI*4)*wave*.42;}object.setMatrixAt(i,chunkMatrix);}object.instanceMatrix.needsUpdate=true;}
    if(!final&&arenaModel)arenaModel.position.y=Math.sin(u*Math.PI*5)*(1-u)*.045;if(u>=1)resetMapMotion();
  }
  const orbit={yaw:0,pitch:0,distance:7.2},cameraTarget=V(),cameraPosition=V(),lastBodyPosition=V(),forward=V(),right=V(),base=V(),wanted=V(),aim=V();let cameraInitialized=false,cameraPhase=null,externalPerformanceSample=false,physicalFollowYaw=0;
  function resetCamera(){cameraInitialized=false;}
  function setCamera(value={}){if(Number.isFinite(value.yaw))orbit.yaw=value.yaw;if(Number.isFinite(value.pitch))orbit.pitch=THREE.MathUtils.clamp(value.pitch,-.2,.3);if(Number.isFinite(value.distance))orbit.distance=THREE.MathUtils.clamp(value.distance,6,10);if(value.snap)resetCamera();}
  function applyQuality(){const state=adaptive.state;if(renderer.getPixelRatio()!==state.pixelRatio)renderer.setPixelRatio(state.pixelRatio);if(sun.shadow.mapSize.x!==state.shadowSize){sun.shadow.map?.dispose();sun.shadow.map=null;sun.shadow.mapSize.set(state.shadowSize,state.shadowSize);renderer.shadowMap.needsUpdate=true;}grass.count=Math.max(1,Math.floor(budget.grass*state.decorationScale));canvas.dataset.renderProfile=state.profile;canvas.dataset.renderDpr=state.pixelRatio.toFixed(2);canvas.dataset.renderQuality=String(state.qualityLevel);canvas.dataset.shadowSize=String(state.shadowSize);}
  function updatePerformance(dt){externalPerformanceSample=true;if(adaptive.update(dt))applyQuality();return adaptive.state;}
  applyQuality();
  function resize(w,h){width=Math.max(1,Math.round(w));height=Math.max(1,Math.round(h));if(adaptive.resize(window.devicePixelRatio||1))applyQuality();renderer.setSize(width,height,false);camera.aspect=width/height;applyLens();}
  function update(dt,game,time){if(externalPerformanceSample)externalPerformanceSample=false;else if(adaptive.update(dt))applyQuality();lastGame=game;elapsed=Number.isFinite(time)?time:elapsed+dt;const t=elapsed;grassTime.value=t;const players=game?.players||emptyPlayers;
    if(template&&!menuScene){while(rigs.length<players.length){const rig=new GiraffeRig(template,playRoot,rigs.length,toon),id=players[rigs.length]?.id??rigs.length;if(playerSkins.has(id))rig.setSkin?.(playerSkins.get(id));rigs.push(rig);}for(let index=0;index<rigs.length;index++){rigs[index].update(players[index],dt,t);const desiredSkin=resolveRenderSkin(game,players[index],playerSkins.get(players[index]?.id??index));if(rigs[index].skin!==desiredSkin)rigs[index].setSkin?.(desiredSkin);if(players[index])toon.setInkWidth(rigs[index].ink,players[index].id===(game.localPlayerId??0)?3.6:2.7);}}
    const human=selectRenderPlayer(game);
    if(human&&!menuScene){physicalFollowYaw=neckCameraYaw(orbit.yaw,human.neckPoints?.[0]||human,human.head);forward.set(Math.cos(physicalFollowYaw),0,Math.sin(physicalFollowYaw));right.set(-forward.z,0,forward.x);base.set(human.x,0,human.z);
      if(cameraPhase!==game?.phase&&(game?.phase==='serve'||game?.phase==='attract')){resetMapMotion();resetCamera();}else if(cameraInitialized&&base.distanceTo(lastBodyPosition)>4.5)resetCamera();cameraPhase=game?.phase;lastBodyPosition.copy(base);
      writeShoulderPose(human.x,human.z,physicalFollowYaw,orbit.pitch,orbit.distance,wanted,aim);
      if(!cameraInitialized){cameraPosition.copy(wanted);cameraTarget.copy(aim);cameraInitialized=true;}else{const follow=cameraFollowAlpha(dt);cameraPosition.lerp(wanted,follow);cameraTarget.lerp(aim,follow);}
      camera.position.copy(cameraPosition);const shake=vfx.cameraImpulse();if(shake&&!reducedMotion)camera.position.addScaledVector(right,Math.sin(t*137)*shake*.5);camera.lookAt(cameraTarget);
    }
    if(menuScene){updateLobbyActors(dt,t);updateMenuCamera(dt);}else if(mapMotion.active&&mapMotion.final){menuEye.set(38,35,43);menuLook.set(0,0,0);cameraPosition.lerp(menuEye,1-Math.exp(-dt*3));cameraTarget.lerp(menuLook,1-Math.exp(-dt*3));camera.position.copy(cameraPosition);camera.lookAt(cameraTarget);}
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
  function getDebugSnapshot(){const human=selectRenderPlayer(lastGame);return{camera:{position:camera.position.toArray(),target:cameraTarget.toArray(),fov:camera.fov,physicalFollowYaw,...orbit},performance:{...adaptive.state},lobby:{visible:menuScene,focus:menuFocus,actors:lobbyRigs.length,ready:!!lobbyModel},mapMotion:{active:mapMotion.active,final:mapMotion.final,time:mapMotion.time},toon:toon.stats(),actors:rigs.filter(r=>r.root.visible).length,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,resources:{...renderer.info.memory},human:human?{body:[human.x,human.y,human.z],head:{...human.head},neckPoints:human.neckPoints?.map(p=>({...p}))}:null,rigs:rigs.map(r=>({bones:r.bones.size,neck:r.neck.map(b=>b.bone.getWorldPosition(V()).toArray()),head:r.head?.bone.getWorldPosition(V()).toArray()}))};}
  function dispose(){disposed=true;vfx.dispose();rigs.forEach(rig=>rig.dispose());lobbyRigs.forEach(rig=>rig.dispose());scoreTexture.dispose();const seenGeometry=new Set(),seenMaterial=new Set(),seenTexture=new Set();for(const source of [scene,...loadedSources])source.traverse(o=>{if(o.geometry&&!seenGeometry.has(o.geometry)){seenGeometry.add(o.geometry);o.geometry.dispose();}for(const mat of o.material?(Array.isArray(o.material)?o.material:[o.material]):[]){if(seenMaterial.has(mat))continue;seenMaterial.add(mat);for(const value of Object.values(mat)){if(value?.isTexture&&!seenTexture.has(value)){seenTexture.add(value);value.dispose();}}mat.dispose();}});toon.dispose();renderer.dispose();}
  return{renderer,scene,camera,ready,resize,update,dispose,project,burst,impact,setCamera,resetCamera,setMenuScene,setMenuFocus,projectMenuHotspots,setPlayerSkin,performance:adaptive.state,updatePerformance,getDebugSnapshot,setLook:(yaw,pitch)=>setCamera({yaw,pitch}),setReducedMotion:value=>{reducedMotion=!!value;if(reducedMotion)resetMapMotion();vfx.setReducedMotion(reducedMotion);}};
}

