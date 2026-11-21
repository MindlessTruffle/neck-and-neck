import React,{useEffect,useRef,useState} from 'react';
import * as T from 'three';
import {getAthlete} from './wardrobe-studio.js';
import {GiraffeRig} from './rig.js';
import {ABILITY_CATALOG} from './profile.js';
import {createAbilityField} from './ability-field.js';
import {PowerIcon} from './power-icon.jsx';

const clamp = T.MathUtils.clamp;
function drawMove(p, ball, id, age) {
  const t=clamp(age/2.4,0,1);
  const beat=Math.sin(Math.PI*clamp((t-.16)/.58,0,1));
  const rocket=id==='rocket', spring=id==='spring', shield=id==='shield', magnet=id==='magnet';
  const reach=magnet?beat*1.1:shield?.32:beat*.24;
  p.x=rocket?-2.3+2.6*clamp((t-.16)/.55,0,1):-.85;
  p.y=spring?beat*1.55:0;
  p.dive=rocket?beat*.92:0;p._diveX=1;p._diveZ=0;
  p.swing=beat;p.action=shield?'block':spring?'spike':'set';p.vx=rocket?beat*8:0;
  const shoulder=1.30+p.y;
  for(let j=0;j<p.neckPoints.length;j++){
    const u=j/8, q=p.neckPoints[j];
    q.x=p.x+.28+u*(.45+reach+(rocket?.6*beat:0));
    q.y=shoulder+(1.84+beat*(shield?.35:.08))*u-.17*Math.sin(Math.PI*u);
    q.z=.18*Math.sin(Math.PI*u+beat)*u;
  }
  Object.assign(p.head,p.neckPoints[8]);
  const hit=.49, before=t<hit, u=before?t/hit:(t-hit)/(1-hit);
  const hitX=rocket?.65:magnet?.94:.14;
  ball.position.x=before?3.15+(hitX-3.15)*u:hitX+2.95*u;
  const height=spring?4.77:rocket?1.85:3.56;
  ball.position.y=before?height+.68*(1-u)+.64*Math.sin(u*Math.PI):
    height+(id==='feather'?1.3:shield?.12:.52)*Math.sin(Math.PI*u)-(spring||shield?2.35:1.12)*u;
  ball.position.z=.12;ball.rotation.z=-t*5.5;
  p.ability.active=t>.13&&t<.87?1:0;
}

export function PowerRoll({selected,rolling,reducedMotion,onTick,palette,cosmetics}) {
  const canvas=useRef(null),live=useRef(null);
  live.current={selected,rolling,reducedMotion,onTick,palette,cosmetics};
  const [failed,setFailed]=useState(false);
  useEffect(()=>{
    const el=canvas.current;
    let renderer;
    try{renderer=new T.WebGLRenderer({canvas:el,alpha:true,antialias:true});}catch{setFailed(true);return;}
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));
    renderer.outputColorSpace=T.SRGBColorSpace;
    const scene=new T.Scene(),camera=new T.OrthographicCamera(-4,4,3,-3,.1,55);
    camera.position.set(2.1,4.5,13);camera.lookAt(0,2.55,0);
    scene.add(new T.HemisphereLight('#fff6d5','#a8b3c0',2.1));
    const sun=new T.DirectionalLight('#fff1c6',2.8);sun.position.set(-3,7,5);scene.add(sun);
    const meshes=[];
    function prop(geometry,color,parent=scene){const mesh=new T.Mesh(geometry,new T.MeshStandardMaterial({color,roughness:.78}));parent.add(mesh);meshes.push(mesh);return mesh;}
    const court=prop(new T.CylinderGeometry(3.65,3.48,.22,40),'#347c79');court.scale.z=.52;court.position.y=-.15;
    const chalk=prop(new T.TorusGeometry(3.35,.028,5,52),'#fff1cb');chalk.rotation.x=Math.PI/2;chalk.scale.y=.51;
    const ball=new T.Group();scene.add(ball);
    for(let i=0;i<6;i++)prop(new T.SphereGeometry(.26,8,14,i*Math.PI/3,Math.PI/3),['#fff4c6','#ed965c','#318e93'][i%3],ball);
    const field=createAbilityField(scene,el.clientWidth<420);
    const p={x:0,y:0,z:0,vx:0,vz:0,team:0,bodyYaw:0,aimYaw:0,energy:1,
      neck:{yaw:0,pitch:0},head:{},neckPoints:Array.from({length:9},()=>({x:0,y:0,z:0}))};
    const players=[p];let rig,closed=false,frame=0,last=0,age=0,rollAge=0,lastTick=-1,wasRolling=false,oldId='';
    const resize=()=>{const w=el.clientWidth,h=el.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);const a=w/h,half=Math.max(2.95,3.8/a);camera.top=half;camera.bottom=-half;camera.left=-half*a;camera.right=half*a;camera.updateProjectionMatrix();};
    const observer=new ResizeObserver(resize);observer.observe(el);resize();
    getAthlete().then(source=>{if(!closed)rig=new GiraffeRig(source,scene);}).catch(()=>{if(!closed)setFailed(true);});
    function render(now) {
      frame=requestAnimationFrame(render);
      if(document.hidden || !rig){last=now;return;}
      const dt=Math.min(.16,(now-last)/1000);last=now;
      const state=live.current;
      if(state.rolling&&!wasRolling){rollAge=0;lastTick=-1;}
      wasRolling=state.rolling;let id=state.selected;
      if(state.rolling){rollAge+=dt;const progress=Math.min(1,rollAge/(state.reducedMotion?.25:2.6));
        const tick=Math.floor((1-(1-progress)**3)*20);
        if(progress<.90)id=ABILITY_CATALOG[tick%ABILITY_CATALOG.length].id;
        if(tick!==lastTick){lastTick=tick;state.onTick?.();}
      }
      if(oldId!==id){oldId=id;age=.65;p.ability={...ABILITY_CATALOG.find(a=>a.id===id),active:0};}
      age=(age+dt)%2.9;p.skin=state.palette;p.cosmetics=state.cosmetics;
      const poseTime=state.reducedMotion?1.12:age;
      drawMove(p,ball,id,poseTime);rig.update(p,dt,poseTime);field.update(players,poseTime,state.reducedMotion);
      el.dataset.demonstration=id;renderer.render(scene,camera);
    }
    frame=requestAnimationFrame(render);
    return()=>{closed=true;cancelAnimationFrame(frame);observer.disconnect();field.dispose();rig?.dispose();for(const m of meshes){m.geometry.dispose();m.material.dispose();}renderer.dispose();renderer.forceContextLoss();};
  },[]);
  return <>{failed&&<PowerIcon id={selected}/>}<canvas ref={canvas} className="power-roll-3d" aria-label={'Giraffe demonstrating '+(ABILITY_CATALOG.find(p=>p.id===selected)?.name||selected)} style={{display:failed?'none':'block',width:'100%',height:'min(33vh,300px)',minHeight:160}}/></>;
}
