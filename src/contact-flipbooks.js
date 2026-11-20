import * as THREE from 'three';

// Eight hand-shaped phases, shared by every sprite. No canvas upload during play.
function paintFrame(frame, fire) {
  const size=96, bytes=new Uint8Array(size*size*4), t=frame/8;
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const u=2*(x+.5)/size-1,v=2*(y+.5)/size-1,r=Math.hypot(u,v),a=Math.atan2(v,u);
    const rays=Math.pow(Math.max(0,Math.cos(7*a+.5*t)),8);
    const edge=.15+t*.57+.22*rays, band=.12*(1-t)+.035;
    const flame=Math.hypot(u*(1.45+t),v+.27-t*.3)+.14*Math.sin(3*a+8*t)+.08*Math.sin(7*a-5*t);
    const value=fire?(.75-t*.43-flame):band-Math.abs(r-edge);
    if(value<=0)continue;
    const i=(x+y*size)*4;
    bytes[i]=255;bytes[i+1]=fire?(value>.26?224:value>.13?125:57):251;
    bytes[i+2]=fire?(value>.35?141:21):215;
    bytes[i+3]=Math.round(255*Math.min(1,value*25)*(1-.55*t));
  }
  const map=new THREE.DataTexture(bytes,size,size);
  map.colorSpace=THREE.SRGBColorSpace;map.magFilter=THREE.LinearFilter;map.minFilter=THREE.LinearMipmapLinearFilter;map.generateMipmaps=true;map.needsUpdate=true;
  return map;
}
export function createFlipbooks(root,count){
 const frames=[false,true].map(fire=>Array.from({length:8},(_,i)=>paintFrame(i,fire)));
 const pool=Array.from({length:count},()=>{
   const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:frames[0][0],transparent:true,depthWrite:false,toneMapped:false}));
   sprite.name='ContactFlipbook';sprite.renderOrder=12;sprite.visible=false;root.add(sprite);
   return {sprite,age:0,duration:0,size:1,kind:0};
 });
 // One draw call for the solid, tapered mantle around a perfect spike.
 const lobes=9;
 const geometry=new THREE.OctahedronGeometry(1,0);
 const corona=new THREE.InstancedMesh(geometry,new THREE.MeshBasicMaterial({toneMapped:false}),lobes);
 corona.name='SpikeFireMantle';corona.visible=false;corona.frustumCulled=false;
 corona.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
 const pose=new THREE.Object3D(), axis=new THREE.Vector3(), right=new THREE.Vector3(), up=new THREE.Vector3();
 const worldUp=new THREE.Vector3(0,1,0), localY=new THREE.Vector3(0,1,0);
 for(let i=0;i<lobes;i++)corona.setColorAt(i,new THREE.Color(['#ff591e','#ffba38','#fff4af'][i%3]));
 root.add(corona);
 function updateMantle(ball,time){
   axis.set(ball.vx,ball.vy,ball.vz).normalize();
   right.crossVectors(axis,worldUp);
   if(right.lengthSq()<.001)right.set(1,0,0);else right.normalize();
   up.crossVectors(right,axis).normalize();
   pose.quaternion.setFromUnitVectors(localY,axis);
   for(let i=0;i<lobes;i++){
     const phase=i*2.39996+time*6, radius=.23+.09*Math.sin(i+time*13);
     const length=(.35+.32*(i%3))*Math.min(1,time*7);
     pose.position.copy(ball).addScaledVector(axis,-.22-length)
       .addScaledVector(right,radius*Math.cos(phase)).addScaledVector(up,radius*Math.sin(phase));
     pose.scale.set(.13,length,.13);pose.updateMatrix();corona.setMatrixAt(i,pose.matrix);
   }
   corona.instanceMatrix.needsUpdate=true;
 }
 let cursor=0,fireTime=0,interval=0;
 function spawn(point,color,size=2,fire=false){
   const p=pool[cursor++%count];p.age=0;p.kind=Number(fire);p.duration=fire?.34:.46;p.size=size;
   p.sprite.position.copy(point);p.sprite.scale.setScalar(size);p.sprite.material.map=frames[p.kind][0];
   p.sprite.material.color.set(color);p.sprite.visible=true;
 }
 function clear(){corona.visible=false;fireTime=0;pool.forEach(p=>p.sprite.visible=false)}
 function update(dt,game,reduced){
   if(game?.paused||game?.phase==='attract'){clear();return}
   if(game?.phase!=='play')fireTime=0;
   corona.visible=fireTime>0 && !!game?.ball && !reduced;
   if(corona.visible)updateMantle(game.ball,fireTime);
   if(fireTime>0&&game.ball){fireTime-=dt;interval-=dt;if(interval<=0){interval=reduced?.13:.045;spawn(game.ball,0xffffff,.95,true)}}
   for(const p of pool)if(p.sprite.visible){p.age+=dt;const t=p.age/p.duration;
     if(t>=1){p.sprite.visible=false;continue}
     p.sprite.material.map=frames[p.kind][Math.floor(t*8)];p.sprite.scale.setScalar(p.size*(p.kind?1-.5*t:1+.25*t));
   }
 }
 return {spawn,ignite(){fireTime=.95;interval=0},clear,update,dispose(){geometry.dispose();corona.dispose();frames.flat().forEach(map=>map.dispose())}};
}
