import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {assetUrl} from './assets.js';
import {GiraffeRig} from './rig.js';
import {accessory,disposeAccessory} from './accessory.js';
import {getCosmetic} from './cosmetics-catalog.js';

let template;
export function getAthlete(){
 return template ||= new GLTFLoader().loadAsync(assetUrl('models/giraffe-athlete.glb')).then(g=>g.scene).catch(err=>{template=null;throw err;});
}
export function makeStudio(canvas){
 const renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true});
 renderer.setClearColor(0,0);renderer.outputColorSpace=THREE.SRGBColorSpace;
 const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-1,1,1,-1,.1,60);
 scene.add(new THREE.HemisphereLight('#fff8ec','#a9a2ba',2.3));
 for(const [pos,color,intensity] of [[[3,5,5],'#fff4d7',2.6],[[-3,3,-3],'#b6eaff',1.75]]){
   const lamp=new THREE.DirectionalLight(color,intensity);lamp.position.set(...pos);scene.add(lamp);
 }
 let rig=null,effect=null,effectId=null,particles=null;
 const particleTransform=new THREE.Object3D(),tint=new THREE.Color();
 function fit(bounds,angle=.64,vertical=.16){
   const center=bounds.getCenter(new THREE.Vector3()),size=bounds.getSize(new THREE.Vector3());
   const aspect=canvas.width/canvas.height;
   const width=Math.max(size.x*Math.abs(Math.cos(angle))+size.z*Math.abs(Math.sin(angle)),.1);
   const height=Math.max(size.y+vertical*Math.max(size.z,size.x),.1);
   const half=Math.max(height,width/aspect)*.56;
   Object.assign(camera,{top:half,bottom:-half,left:-half*aspect,right:half*aspect});
   camera.position.set(Math.sin(angle)*12,vertical*12,Math.cos(angle)*12).add(center);
   camera.lookAt(center);camera.updateProjectionMatrix();renderer.render(scene,camera);
 }
 return {renderer,scene,fit,load(source){rig=new GiraffeRig(source,scene);},
 show(palette,cosmetics,angle=.65){
   if(!rig)return;
   rig.setSkin(palette);rig.cosmetics.set(cosmetics);
   const head=rig.head.restPosition;rig.cosmetics.update({head,neck:{pitch:0,yaw:Math.PI/2}});
   if(effectId!==(cosmetics?.goal||null)){
     if(effect)disposeAccessory(effect);
     effectId=cosmetics?.goal||null;effect=null;
     if(effectId){effect=accessory(effectId);effect.position.set(-.84,2.25,.17);scene.add(effect);}
   }
   const bounds=new THREE.Box3(new THREE.Vector3(-1.2,-.1,-1.25),new THREE.Vector3(1.05,3.85,1.15));fit(bounds,angle);
 },burstFrame(phase){
   const item=getCosmetic(effectId);if(!item)return;
   if(!particles){particles=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(.10),new THREE.MeshBasicMaterial(),32);particles.frustumCulled=false;scene.add(particles);}
   particles.visible=phase<1;
   if(particles.visible){
     for(let i=0;i<32;i++){
       const angle=i*2.4,radius=phase*(1+i%4*.22);
       particleTransform.position.set(Math.cos(angle)*radius,1.4+phase*(2+i%3*.68)-2.6*phase*phase,Math.sin(angle)*radius);
       particleTransform.rotation.set(angle+phase*3,i*.37,phase*4);
       const size=Math.max(.03,(1-phase)*(1+i%3*.31));
       particleTransform.scale.set(size,item.shape==='petal'?size*.4:size*1.4,size);
       particleTransform.updateMatrix();particles.setMatrixAt(i,particleTransform.matrix);
       particles.setColorAt(i,tint.set(i%3?item.color:item.trim));
     }
     particles.instanceColor.needsUpdate=true;particles.instanceMatrix.needsUpdate=true;
   }
   renderer.render(scene,camera);
 },dispose(){if(particles){particles.geometry.dispose();particles.material.dispose();particles.dispose();}if(effect)disposeAccessory(effect);rig?.dispose();renderer.dispose();renderer.forceContextLoss();}};
}
