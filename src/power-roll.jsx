import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { ABILITY_CATALOG } from './profile.js';
import { assetUrl } from './assets.js';
let relicsPromise;
function loadRelics(){return relicsPromise ||= new GLTFLoader().loadAsync(assetUrl('models/abilities/relics.glb')).catch(error=>{relicsPromise=null;throw error;});}
export function PowerRoll({ selected, rolling, reducedMotion, onTick }) {
  const canvas=useRef(null),state=useRef({});state.current={selected,rolling,reducedMotion,onTick};
  const [failed,setFailed]=useState(false);
  useEffect(()=>{
    setFailed(false);
    let disposed=false,frame,start=0,wasRolling=false,lastTick=-1,lastIndex=-1,models=[];
    const renderer=new THREE.WebGLRenderer({canvas:canvas.current,alpha:true,antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.35));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.35;
    const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(36,1,.1,40);camera.position.set(0,1.8,8.5);camera.lookAt(0,.5,0);
    scene.add(new THREE.HemisphereLight('#c5eeff','#51416c',2.2));const sun=new THREE.DirectionalLight('#fff1cd',4);sun.position.set(-3,5,6);scene.add(sun);const rim=new THREE.DirectionalLight('#b7afff',2);rim.position.set(4,2,-4);scene.add(rim);
    const black=new THREE.MeshBasicMaterial({color:0x000000,toneMapped:false});
    const ringMaterial=new THREE.MeshBasicMaterial({color:'#f9d99b',transparent:true,opacity:.6}),ringGeometry=new THREE.TorusGeometry(2.8,.018,5,80),ring=new THREE.Mesh(ringGeometry,ringMaterial);ring.scale.y=.49;ring.position.set(0,.4,-1.7);scene.add(ring);
    loadRelics().then(({scene:source})=>{
      if(disposed)return;
      models=ABILITY_CATALOG.map((power,i)=>{
        const template=source.children.find(o=>o.name.replace(/[.0-9]/g,'')===power.id);
        if(!template)throw new Error('Missing ability relic '+power.id);
        const hero=new THREE.Group(),model=template.clone(true);hero.add(model);model.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(model),center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3()),scale=2.4/Math.max(size.x,size.y,size.z);model.position.sub(center);hero.scale.setScalar(scale);const holder=new THREE.Group();holder.add(hero);scene.add(holder);
        const shadow=holder.clone(true);shadow.traverse(o=>{if(o.isMesh)o.material=black;});shadow.scale.setScalar(.42);scene.add(shadow);
        return {holder,shadow,index:i};
      });
    }).catch(error=>{if(!disposed){console.error('Ability relic load failed',error);setFailed(true);}});
    const resize=()=>{const b=canvas.current?.getBoundingClientRect();if(!b||!b.height)return;renderer.setSize(b.width,b.height,false);camera.aspect=b.width/b.height;camera.position.z=camera.aspect<1.2?11:8.5;camera.updateProjectionMatrix();};const observer=new ResizeObserver(resize);observer.observe(canvas.current);resize();
    const update=now=>{
      if(disposed)return;const s=state.current;if(s.rolling&&!wasRolling){start=now;lastTick=-1;}wasRolling=s.rolling;
      const progress=Math.min(1,(now-start)/(s.reducedMotion?250:2600));let index=Math.max(0,ABILITY_CATALOG.findIndex(p=>p.id===s.selected));
      if(s.rolling&&progress<.92){const tick=Math.floor((1-Math.pow(1-progress,3))*28);index=tick%5;if(tick!==lastTick){s.onTick?.();lastTick=tick;}}
      let slot=0;for(const m of models){m.holder.visible=m.index===index;m.holder.position.set(0,.45,0);m.holder.rotation.y=s.reducedMotion?-.15:Math.sin(now*.0007)*.22;m.holder.scale.setScalar(s.rolling?1.35:1.6);m.shadow.visible=m.index!==index;
        if(m.shadow.visible){const a=slot++*Math.PI/2+(s.reducedMotion?0:now*.0001)+(s.rolling?progress*Math.PI*4:0);m.shadow.position.set(Math.cos(a)*2.65,.45+Math.sin(a)*1.5,-1.6);m.shadow.rotation.y=-.2;}}
      lastIndex=index;renderer.render(scene,camera);frame=requestAnimationFrame(update);
    };frame=requestAnimationFrame(update);
    return()=>{disposed=true;cancelAnimationFrame(frame);observer.disconnect();black.dispose();ringMaterial.dispose();ringGeometry.dispose();renderer.dispose();};
  },[]);
  return <><canvas ref={canvas} className="power-roll-3d" aria-label="Equipped ability relic with black silhouettes" style={{width:'100%',height:'min(31vh,280px)',minHeight:160,display:'block'}}/>{failed&&<span role="status">Model unavailable — rolling still works.</span>}</>;
}
