import * as THREE from 'three';
import { assetUrl } from './assets.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { GiraffeRig } from './rig.js';
import { createVFX } from './vfx.js';

const V = (x=0,y=0,z=0) => new THREE.Vector3(x,y,z);
const UP = V(0,1,0);
const random = n => { const value=Math.sin(n*127.1+311.7)*43758.5453;return value-Math.floor(value); };

/** Meadow stadium. Player art is an actual Blender-authored, skinned glTF rig. */
export function createWorld({canvas,onProgress=()=>{},reducedMotion=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches||false}) {
  const scene=new THREE.Scene();scene.background=new THREE.Color('#95d2ed');scene.fog=new THREE.Fog('#b9d6c6',45,125);
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.65));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
  const camera=new THREE.PerspectiveCamera(69,1,.08,180);camera.position.set(-10,4,0);camera.lookAt(1,2,0);scene.add(camera);
  const hemisphere=new THREE.HemisphereLight('#e6f5ff','#42632f',2.25);scene.add(hemisphere);
  const sun=new THREE.DirectionalLight('#fff0c5',3.3);sun.position.set(-15,27,-11);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-24,right:24,top:22,bottom:-22,near:1,far:70});sun.shadow.normalBias=.026;sun.shadow.bias=-.00016;scene.add(sun);
  const fill=new THREE.DirectionalLight('#bedef3',.6);fill.position.set(15,9,18);scene.add(fill);
  const materials=new Map(),geometries=[];
  const material=(color,roughness=.85)=>{if(!materials.has(color))materials.set(color,new THREE.MeshStandardMaterial({color,roughness,metalness:0}));return materials.get(color);};
  const sphere=new THREE.SphereGeometry(1,18,12),cube=new THREE.BoxGeometry(1,1,1),cylinder=new THREE.CylinderGeometry(1,1,1,10);geometries.push(sphere,cube,cylinder);
  function mesh(geometry,mat,parent=scene,cast=true){const object=new THREE.Mesh(geometry,mat);object.castShadow=cast;object.receiveShadow=true;parent.add(object);return object;}
  function blob(parent,color,x,y,z,sx,sy=sx,sz=sx){const object=mesh(sphere,material(color),parent);object.position.set(x,y,z);object.scale.set(sx,sy,sz);return object;}
  function box(parent,color,x,y,z,sx,sy,sz){const object=mesh(cube,material(color),parent);object.position.set(x,y,z);object.scale.set(sx,sy,sz);return object;}
  function rod(parent,color,a,b,r){const object=mesh(cylinder,material(color),parent);const delta=b.clone().sub(a);object.position.copy(a).add(b).multiplyScalar(.5);object.scale.set(r,delta.length(),r);object.quaternion.setFromUnitVectors(UP,delta.normalize());return object;}
  const animated=[],props=[],rigs=[];let disposed=false,template=null,width=1,height=1,elapsed=0,lastGame=null;
  const terrain=mesh(new THREE.PlaneGeometry(280,280),material('#679d46'),scene,false);terrain.rotation.x=-Math.PI/2;terrain.position.y=-.035;geometries.push(terrain.geometry);
  // Close-cropped stripes and chalk live on the grass, without UI overlays.
  for(let i=0;i<12;i++)box(scene,i%2?'#7caf50':'#73a54a',-9+(i+.5)*1.5,-.017,0,1.5,.025,10).castShadow=false;
  for(const z of [-5,5])box(scene,'#fff3d8',0,.006,z,18.08,.016,.075).castShadow=false;
  for(const x of [-9,9])box(scene,'#fff3d8',x,.006,0,.075,.016,10).castShadow=false;
  for(const x of [-3,3])box(scene,'#dae7b7',x,.003,0,.034,.012,9.98).castShadow=false;
  const grassTime={value:0},grassGeo=new THREE.BufferGeometry();grassGeo.setAttribute('position',new THREE.Float32BufferAttribute([-.032,0,0,.032,0,0,-.017,.3,.018,.032,0,0,.017,.3,.018,-.017,.3,.018,-.017,.3,.018,.017,.3,.018,0,.62,.07],3));grassGeo.computeVertexNormals();geometries.push(grassGeo);
  const grassMat=new THREE.MeshStandardMaterial({color:'#d1e6a8',roughness:1,side:THREE.DoubleSide});
  grassMat.onBeforeCompile=shader=>{shader.uniforms.uGrassTime=grassTime;shader.vertexShader='uniform float uGrassTime;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n transformed.x += sin(uGrassTime*1.7+instanceMatrix[3].x*.6+instanceMatrix[3].z*.42)*transformed.y*.13;');};
  const grass=new THREE.InstancedMesh(grassGeo,grassMat,19000),dummy=new THREE.Object3D(),tint=new THREE.Color();
  for(let i=0;i<19000;i++){const x=(random(i*3)-.5)*76,z=(random(i*3+1)-.5)*76,onCourt=Math.abs(x)<9.2&&Math.abs(z)<5.3;dummy.position.set(x,0,z);dummy.rotation.y=random(i+8)*Math.PI;dummy.scale.set(.7,onCourt?.07:.2+random(i+12)*.6,.7);dummy.updateMatrix();grass.setMatrixAt(i,dummy.matrix);tint.setHSL(.23+random(i+15)*.035,.42,.31+random(i+17)*.13);grass.setColorAt(i,tint);}grass.receiveShadow=true;grass.frustumCulled=false;scene.add(grass);
  // The lacquered net posts carry practical padding and a fine cotton grid.
  for(const z of [-5.6,5.6]){rod(scene,'#b98d56',V(0,0,z),V(0,2.72,z),.09);blob(scene,'#f1d7a3',0,2.75,z,.115);box(scene,'#278d88',0,.65,z,.26,1.3,.29);rod(scene,'#d6c394',V(0,2.5,z),V(1,.02,z+Math.sign(z)*.9),.017);}
  for(let z=-5.5;z<=5.51;z+=.35)rod(scene,'#f7edce',V(0,.7,z),V(0,2.35,z),.010);
  for(let y=.7;y<=2.35;y+=.24)rod(scene,'#f7edce',V(0,y,-5.5),V(0,y,5.5),.010);
  box(scene,'#fff6dc',0,2.37,0,.065,.1,11.17);box(scene,'#d7c698',0,.7,0,.04,.04,11.1);
  // Layered hills frame a clear, central play silhouette.
  for(let i=0;i<16;i++){const a=i*Math.PI*2/16,r=45+random(i+60)*13;const hill=blob(scene,i%2?'#80a954':'#91b66c',Math.cos(a)*r,-3,Math.sin(a)*r,15+random(i+70)*12,5+random(i+80)*8,16+random(i+90)*9);hill.castShadow=false;}
  function path(points,width){const curve=new THREE.CatmullRomCurve3(points.map(p=>V(p[0],.005,p[1]))),positions=[],indices=[];for(let i=0;i<=80;i++){const t=i/80,p=curve.getPoint(t),tangent=curve.getTangent(t),side=V(-tangent.z,0,tangent.x).multiplyScalar(width/2);positions.push(p.x+side.x,p.y,p.z+side.z,p.x-side.x,p.y,p.z-side.z);if(i<80){const n=i*2;indices.push(n,n+1,n+2,n+1,n+3,n+2);}}const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeVertexNormals();geometries.push(geometry);mesh(geometry,material('#c7b789'),scene,false);}
  path([[-21,-1],[-15,-2],[-12,-6],[-6,-7.1],[2,-7.2],[11,-6],[17,-1],[23,0]],1.35);
  path([[-17,8],[-10,7.1],[-3,7],[6,7.2],[14,9],[20,15]],1.1);
  // Timber tribunes are shallow enough for every orbit camera angle.
  function stand(z,sign){const group=new THREE.Group();scene.add(group);group.position.z=z;
    for(let row=0;row<3;row++){box(group,'#ad8151',0,.23+row*.29,sign*row*.6,14.6,.22,.66);box(group,'#d4ad74',0,.36+row*.29,sign*row*.6,14.8,.09,.63);}
    for(let x=-7.1;x<=7.2;x+=1.8){rod(group,'#9b7049',V(x,0,sign*1.8),V(x,1.55,sign*1.8),.055);}
    rod(group,'#d2b17d',V(-7.2,1.45,sign*1.8),V(7.2,1.45,sign*1.8),.045);
    for(let i=0;i<21;i++){const row=i%3,x=-6.6+Math.floor(i/3)*2.15+random(i+sign)*.35,gg=new THREE.Group();group.add(gg);gg.position.set(x,.45+row*.29,sign*row*.6);gg.rotation.y=sign>0?Math.PI:0;const c=['#dfab86','#b7c995','#edc86c','#d98c79'][i%4];blob(gg,c,0,.2,0,.18,.28,.18);blob(gg,c,0,.54,0,.22,.21,.2);for(const side of [-1,1]){blob(gg,c,side*.16,.71,0,.07,.12,.06);blob(gg,'#3e4b3b',side*.08,.56,.181,.023,.029,.016);}blob(gg,'#f3d5ac',0,.48,.19,.1,.055,.05);animated.push({type:'fan',object:gg,seed:i+sign,base:gg.position.y});}
  }stand(-8.6,-1);stand(8.9,1);
  // Long, fluttering pennant ropes give the meadow a proper club-day atmosphere.
  const flagGeo=new THREE.BufferGeometry();flagGeo.setAttribute('position',new THREE.Float32BufferAttribute([-.23,0,0,.23,0,0,0,-.47,.018],3));flagGeo.computeVertexNormals();geometries.push(flagGeo);
  for(const z of [-10.7,10.9]){for(const x of [-10.8,10.8])rod(scene,'#a57d4d',V(x,0,z),V(x,3.65,z),.06);rod(scene,'#e6d3a2',V(-10.8,3.55,z),V(10.8,3.55,z),.013);for(let i=0;i<29;i++){const flag=mesh(flagGeo,new THREE.MeshStandardMaterial({color:['#e37d58','#f0c765','#3f9e90','#e6e1b8'][i%4],side:THREE.DoubleSide,roughness:.8}));flag.position.set(-10.3+i*.74,3.5-Math.sin(i/28*Math.PI)*.22,z);animated.push({type:'flag',object:flag,seed:i});}}
  // Clouds, sun and distant birds keep the vista moving without camera noise.
  const sunDisk=blob(scene,'#fff2b9',-43,45,-58,4.5);sunDisk.material=new THREE.MeshBasicMaterial({color:'#fff2b9'});
  for(let i=0;i<10;i++){const group=new THREE.Group();scene.add(group);group.position.set(-65+i*15,18+random(i+10)*8,-40-random(i+40)*45);for(let j=0;j<5;j++)blob(group,'#f5f7e9',j*1.8,Math.sin(j)*.55,0,2.5,1+random(j+i)*.7,1.5);animated.push({type:'cloud',object:group,base:group.position.x,seed:i});}
  for(let i=0;i<7;i++){const group=new THREE.Group();scene.add(group);const wings=[];for(const s of [-1,1])wings.push(blob(group,'#52675a',s*.16,0,0,.22,.025,.065));animated.push({type:'bird',object:group,wings,seed:i});}
  const board=new THREE.Group();scene.add(board);board.position.set(.5,0,-7.45);board.rotation.y=-Math.PI/2;
  for(const x of [-1.2,1.2])box(board,'#9c774d',x,1.4,0,.15,2.8,.15);box(board,'#c19a61',0,2.3,0,3.1,1.85,.19);
  const scoreCanvas=document.createElement('canvas');scoreCanvas.width=1024;scoreCanvas.height=512;const scoreContext=scoreCanvas.getContext('2d'),scoreTexture=new THREE.CanvasTexture(scoreCanvas);scoreTexture.colorSpace=THREE.SRGBColorSpace;
  const face=mesh(new THREE.PlaneGeometry(2.85,1.59),new THREE.MeshBasicMaterial({map:scoreTexture}),board,false);face.position.set(0,2.3,.11);geometries.push(face.geometry);let scoreKey='';
  function updateScore(score=[0,0]){const key=score.join(':');if(key===scoreKey)return;scoreKey=key;const c=scoreContext;c.fillStyle='#314c3c';c.fillRect(0,0,1024,512);c.textAlign='center';c.fillStyle='#e6dfba';c.font='600 34px sans-serif';c.fillText('MEADOW COURT',512,69);c.font='bold 166px sans-serif';c.fillStyle='#7ec6b4';c.fillText(String(score[0]).padStart(2,'0'),281,292);c.fillStyle='#eea27e';c.fillText(String(score[1]).padStart(2,'0'),743,292);c.fillStyle='#e6dfba';c.font='500 29px sans-serif';c.fillText('CLOVER',281,374);c.fillText('SUNSET',743,374);c.font='25px sans-serif';c.fillText('FIRST TO 7 / WIN BY 2',512,455);scoreTexture.needsUpdate=true;}updateScore();
  // Bright ivory panels, a crisp amber silhouette and a slim orbital seam keep
  // the volleyball readable against trees, grass and every sky angle.
  const ball=new THREE.Group();ball.name='HighlightedVolleyball';scene.add(ball);
  const outlineMat=new THREE.MeshBasicMaterial({color:'#b86e26',side:THREE.BackSide});const outline=mesh(new THREE.SphereGeometry(.286,24,16),outlineMat,ball,false);geometries.push(outline.geometry);
  const ballMat=new THREE.MeshStandardMaterial({color:'#fff8dd',roughness:.55,emissive:'#fac357',emissiveIntensity:.18});const core=mesh(new THREE.SphereGeometry(.258,28,20),ballMat,ball);geometries.push(core.geometry);
  for(let i=0;i<6;i++){const panelGeo=new THREE.SphereGeometry(.26,10,16,i*Math.PI/3,Math.PI/3-.045,.21,Math.PI-.42);const panel=mesh(panelGeo,material(i%3===0?'#e68a43':i%3===1?'#fff4d3':'#429a8c',.55),ball);panel.rotation.z=.35;geometries.push(panelGeo);}
  const haloGeo=new THREE.TorusGeometry(.36,.011,6,56),halo=mesh(haloGeo,new THREE.MeshBasicMaterial({color:'#ffe4a2',transparent:true,opacity:.8}),ball,false);geometries.push(haloGeo);halo.rotation.x=.7;
  // Only the thin locator rings ignore depth, so a held ball remains readable
  // when the player's floppy head crosses the line of sight.
  const locator=new THREE.Group();locator.name='BallWorldLocator';scene.add(locator);locator.renderOrder=1000;
  for(const [inner,outer,color,opacity] of [[.335,.350,'#fff1b2',.98],[.363,.376,'#ad6a24',.78]]){const geometry=new THREE.RingGeometry(inner,outer,64);geometries.push(geometry);const ring=mesh(geometry,new THREE.MeshBasicMaterial({color,transparent:true,opacity,side:THREE.DoubleSide,depthTest:false,depthWrite:false}),locator,false);ring.renderOrder=1000;}
  const chevronGeometry=new THREE.BufferGeometry().setFromPoints([V(-.075,.58,0),V(0,.515,0),V(.075,.58,0)]);geometries.push(chevronGeometry);const chevron=new THREE.Line(chevronGeometry,new THREE.LineBasicMaterial({color:'#fff1b2',transparent:true,opacity:.9,depthTest:false,depthWrite:false}));chevron.renderOrder=1001;locator.add(chevron);
  const landing=new THREE.Group();scene.add(landing);const ringGeo=new THREE.RingGeometry(.46,.49,64);geometries.push(ringGeo);const landingRing=mesh(ringGeo,new THREE.MeshBasicMaterial({color:'#ffe5a2',transparent:true,opacity:.65,side:THREE.DoubleSide,depthWrite:false}),landing,false);landingRing.rotation.x=-Math.PI/2;
  for(let i=0;i<4;i++){const marker=box(landing,'#ffd775',Math.cos(i*Math.PI/2)*.61,.008,Math.sin(i*Math.PI/2)*.61,.13,.013,.045);marker.rotation.y=-i*Math.PI/2;marker.castShadow=false;}
  const ballShadow=mesh(new THREE.CircleGeometry(.27,32),new THREE.MeshBasicMaterial({color:'#354f28',transparent:true,opacity:.21,depthWrite:false}),scene,false);ballShadow.rotation.x=-Math.PI/2;geometries.push(ballShadow.geometry);
  const vfx=createVFX(scene,{camera,reducedMotion});
  // Assets are local, bundled and awaited before play can start.
  const loader=new GLTFLoader(),loadedSources=[];let loaded=0;
  function load(url){return loader.loadAsync(assetUrl(url)).then(asset=>{loadedSources.push(asset.scene);if(disposed){asset.scene.traverse(object=>{object.geometry?.dispose();for(const mat of object.material?(Array.isArray(object.material)?object.material:[object.material]):[])mat.dispose();});return asset.scene;}loaded++;onProgress(loaded/12);asset.scene.traverse(object=>{if(object.isMesh){object.castShadow=true;object.receiveShadow=true;if(object.material){const mats=Array.isArray(object.material)?object.material:[object.material];mats.forEach(m=>{m.roughness=.85;});}}});return asset.scene;});}
  const natureNames=['tree_oak','tree_detailed','tree_pineTallA_detailed','tree_pineRoundC','tree_small','rock_largeA','rock_largeB','plant_bushDetailed','flower_yellowA','flower_redA'];
  function place(source,x,z,height,angle=0){const object=source.clone(true);const bounds=new THREE.Box3().setFromObject(object),size=bounds.getSize(V());object.scale.setScalar(height/Math.max(.01,size.y));object.rotation.y=angle;object.position.set(x,-bounds.min.y*object.scale.y,z);scene.add(object);props.push(object);return object;}
  const ready=Promise.all([load('/models/giraffe-athlete.glb'),load('/models/meadow-pavilion.glb'),...natureNames.map(name=>load(`/kenney/nature/${name}.glb`))]).then(assets=>{
    if(disposed)return;template=assets[0];const pavilion=assets[1];pavilion.position.set(15.3,0,-.5);pavilion.rotation.y=-Math.PI/2;scene.add(pavilion);props.push(pavilion);
    const nature=Object.fromEntries(natureNames.map((name,i)=>[name,assets[i+2]]));
    for(let i=0;i<35;i++){const a=i*Math.PI*2/35+.13,r=21+random(i+39)*13;const name=i%4===0?'tree_pineTallA_detailed':i%4===1?'tree_pineRoundC':i%4===2?'tree_detailed':'tree_oak';place(nature[name],Math.cos(a)*r,Math.sin(a)*r,4.5+random(i+51)*4,random(i+48)*6.28);}
    for(let i=0;i<18;i++){const a=i*Math.PI*2/18,r=13+random(i+72)*6;const x=Math.cos(a)*r,z=Math.sin(a)*r*.8;if(Math.abs(x)<11&&Math.abs(z)<7.5)continue;place(nature[i%3?'plant_bushDetailed':'tree_small'],x,z,i%3?.7+random(i+14)*.6:2+random(i+17)*1.3,i);}
    for(let i=0;i<18;i++){const a=i*Math.PI*2/18+.4,r=13.5+random(i+62)*6;const x=Math.cos(a)*r,z=Math.sin(a)*r*.8;if(Math.abs(x)<11&&Math.abs(z)<7.5)continue;place(nature[i%2?'rock_largeA':'rock_largeB'],x,z,.4+random(i+80)*.8,i);}
    for(let side=-1;side<=1;side+=2)for(let i=0;i<24;i++){const x=-10.5+i*.9,z=side*(11.5+random(i+60)*.7);place(nature[i%3?'flower_yellowA':'flower_redA'],x,z,.23+random(i+12)*.22,i);}
    onProgress(1);
  });
  const orbit={yaw:0,pitch:-.15,distance:5.4},cameraTarget=V(),cameraPosition=V();let cameraInitialized=false;
  function setCamera(value={}){if(Number.isFinite(value.yaw))orbit.yaw=value.yaw;if(Number.isFinite(value.pitch))orbit.pitch=THREE.MathUtils.clamp(value.pitch,-.75,.8);if(Number.isFinite(value.distance))orbit.distance=THREE.MathUtils.clamp(value.distance,3.1,8);}
  function resize(w,h){width=w;height=h;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
  function update(dt,game,time){lastGame=game;elapsed=Number.isFinite(time)?time:elapsed+dt;const t=elapsed;grassTime.value=t;const players=game?.players||[];
    if(template)while(rigs.length<players.length)rigs.push(new GiraffeRig(template,scene,rigs.length));rigs.forEach((rig,index)=>rig.update(players[index],dt,t));
    const human=players.find(p=>p.human)||players[0];
    if(human){const forward=V(Math.cos(orbit.yaw),0,Math.sin(orbit.yaw)),right=V(-forward.z,0,forward.x),base=V(human.x,human.y||0,human.z);
      const wanted=base.clone().addScaledVector(forward,-orbit.distance).addScaledVector(right,1.45);wanted.y=base.y+3.35-Math.sin(orbit.pitch)*orbit.distance*.75;
      const aim=base.clone().addScaledVector(forward,3.0);aim.y=base.y+2.25+Math.sin(orbit.pitch)*2.5;
      if(!cameraInitialized){cameraPosition.copy(wanted);cameraTarget.copy(aim);cameraInitialized=true;}else{const follow=1-Math.exp(-dt*10);cameraPosition.lerp(wanted,follow);cameraTarget.lerp(aim,follow);}
      camera.position.copy(cameraPosition);const shake=vfx.cameraImpulse();if(shake&&!reducedMotion){camera.position.addScaledVector(right,Math.sin(t*137)*shake);camera.position.y+=Math.cos(t*113)*shake*.65;}camera.lookAt(cameraTarget);
      const targetFov=69+Math.min(5,Math.hypot(human.vx||0,human.vz||0)*.3);camera.fov=THREE.MathUtils.lerp(camera.fov,targetFov,1-Math.exp(-dt*5));camera.updateProjectionMatrix();
    }
    const b=game?.ball||{x:0,y:3,z:0};ball.visible=game?.phase!=='attract';ball.position.set(b.x,Math.max(.23,b.y),b.z);core.rotation.x+=dt*2;ball.rotation.z+=dt*1.8;halo.rotation.y=t*1.6;locator.visible=ball.visible;locator.position.copy(ball.position);locator.quaternion.copy(camera.quaternion);
    const landingTime=Math.max(0,((b.vy||0)+Math.sqrt((b.vy||0)**2+36*Math.max(0,b.y-.23)))/18);landing.position.set(THREE.MathUtils.clamp(b.x+(b.vx||0)*landingTime,-10,10),.018,THREE.MathUtils.clamp(b.z+(b.vz||0)*landingTime,-6,6));landing.visible=ball.visible;landing.rotation.y=t*.35;landingRing.material.opacity=.43+Math.sin(t*4)*.08;
    ballShadow.visible=ball.visible;ballShadow.position.set(b.x,.01,b.z);ballShadow.scale.setScalar(1+b.y*.08);ballShadow.material.opacity=.22/(1+b.y*.2);updateScore(game?.score);
    for(const a of animated){if(a.type==='flag'){a.object.rotation.y=Math.sin(t*4+a.seed*.5)*.2;a.object.rotation.x=Math.cos(t*3+a.seed)*.05;}if(a.type==='fan'){a.object.rotation.z=Math.sin(t*3+a.seed)*.07;a.object.position.y=a.base+Math.max(0,Math.sin(t*2.8+a.seed))*.04;}if(a.type==='cloud')a.object.position.x=a.base+Math.sin(t*.015+a.seed)*5;if(a.type==='bird'){const q=t*.12+a.seed*.85;a.object.position.set(Math.cos(q)*34,11+Math.sin(q*2+a.seed)*1.5,Math.sin(q)*29);a.object.rotation.y=-q;for(let j=0;j<2;j++)a.wings[j].rotation.z=(j?1:-1)*Math.sin(t*5+a.seed)*.5;}}
    vfx.update(dt,game,t);
  }
  function impact(event){const point=event?.type==='score'||event?.type==='win'?{x:0,y:2,z:0,...event}:event;return vfx.impact(point);}
  function burst(x,y,z,color,power=1){return impact({type:'hit',x,y,z,power});}
  function project(x,y,z){const p=V(x,y,z).project(camera);return{x:(p.x+1)*width/2,y:(1-p.y)*height/2,visible:p.z<1&&p.z>-1};}
  function getDebugSnapshot(){const human=lastGame?.players.find(p=>p.human);return{camera:{position:camera.position.toArray(),target:cameraTarget.toArray(),fov:camera.fov,...orbit},actors:rigs.filter(r=>r.root.visible).length,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,resources:{...renderer.info.memory},human:human?{body:[human.x,human.y,human.z],head:{...human.head},neckPoints:human.neckPoints?.map(p=>({...p}))}:null,rigs:rigs.map(r=>({bones:r.bones.size,neck:r.neck.map(b=>b.bone.getWorldPosition(V()).toArray()),head:r.head?.bone.getWorldPosition(V()).toArray()}))};}
  function dispose(){disposed=true;vfx.dispose();rigs.forEach(rig=>rig.dispose());scoreTexture.dispose();const seenGeometry=new Set(),seenMaterial=new Set(),seenTexture=new Set();for(const source of [scene,...loadedSources])source.traverse(o=>{if(o.geometry&&!seenGeometry.has(o.geometry)){seenGeometry.add(o.geometry);o.geometry.dispose();}for(const mat of o.material?(Array.isArray(o.material)?o.material:[o.material]):[]){if(seenMaterial.has(mat))continue;seenMaterial.add(mat);for(const value of Object.values(mat)){if(value?.isTexture&&!seenTexture.has(value)){seenTexture.add(value);value.dispose();}}mat.dispose();}});renderer.dispose();}
  return{renderer,scene,camera,ready,resize,update,dispose,project,burst,impact,setCamera,getDebugSnapshot,setLook:(yaw,pitch)=>setCamera({yaw,pitch}),setReducedMotion:value=>{reducedMotion=!!value;vfx.setReducedMotion(reducedMotion);}};
}

