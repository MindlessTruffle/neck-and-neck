import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { prepareWorldModel } from './environments.js';

export const MENU_ITEMS=[['play','PLAY','#f3bc63'],['shop','STYLE','#ee9b98'],['abilities','POWERS','#b9a0e5'],['online','MULTIPLAYER','#8ed6c6']];
export function createMenuWorld(root,toon,model,textures,atlas,coarse=false){
  prepareWorldModel(model,textures,coarse);root.add(model);
  const shadowOffset=new THREE.Vector3(.16,-.22,-.04);
  const signs=[],raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
  const anchors={play:[-9,2.3,7.6],shop:[9,2.3,7.6],abilities:[-9,4.4,-3.4],online:[9,4.4,-3.4]};
  const boardGeometry=new RoundedBoxGeometry(8.5,1.9,.3,2,.16);
  const edgeMaterial=new THREE.MeshStandardMaterial({color:'#634737',roughness:.8});
  for(let i=0;i<MENU_ITEMS.length;i++){
    const [id,label,color]=MENU_ITEMS[i],sign=new THREE.Group();sign.position.set(...anchors[id]);root.add(sign);
    const backing=new THREE.Mesh(boardGeometry,edgeMaterial);backing.castShadow=true;sign.add(backing);
    const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=224;
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
    const face=new THREE.Mesh(new THREE.PlaneGeometry(8.2,1.65),new THREE.MeshBasicMaterial({map:texture}));face.position.z=.17;face.userData.menu=id;sign.add(face);
    const iconTexture=atlas.clone();iconTexture.repeat.set(.5,.5);iconTexture.offset.set(i%2*.5,i<2?.5:0);iconTexture.magFilter=THREE.NearestFilter;iconTexture.minFilter=THREE.NearestFilter;iconTexture.generateMipmaps=false;iconTexture.needsUpdate=true;
    const icon=new THREE.Mesh(new THREE.PlaneGeometry(4.1,4.1),new THREE.MeshBasicMaterial({map:iconTexture,transparent:true,depthWrite:false,alphaTest:.03}));icon.position.set(0,2.6,.2);icon.userData.menu=id;sign.add(icon);
    const shadow=new THREE.Mesh(icon.geometry,new THREE.MeshBasicMaterial({map:iconTexture,color:'#171225',transparent:true,opacity:.65,depthWrite:false,alphaTest:.03}));shadow.renderOrder=1;icon.renderOrder=2;sign.add(shadow);
    const paint=title=>{const c=canvas.getContext('2d');c.fillStyle=color;c.fillRect(0,0,1024,224);const grad=c.createLinearGradient(0,0,0,224);grad.addColorStop(0,'#fff6d944');grad.addColorStop(1,'#8a513522');c.fillStyle=grad;c.fillRect(0,0,1024,224);c.strokeStyle='#fff3cf';c.lineWidth=5;c.strokeRect(14,14,996,196);c.font=`${title.length>12?116:144}px "Lilita One", sans-serif`;c.textAlign='center';c.textBaseline='middle';c.fillStyle='#553f45';/* Crisp labels are DOM text anchored to this board. */for(const x of [32,992]){c.beginPath();c.arc(x,112,7,0,Math.PI*2);c.fillStyle='#79583c';c.fill();}texture.needsUpdate=true;};
    paint(label);signs.push({id,root:sign,face,icon,shadow,paint,baseY:sign.position.y});
  }
  let hover=null;const forward=new THREE.Vector3(),up=new THREE.Vector3(),base=new THREE.Vector3(),scale=new THREE.Vector3();
  return{anchors,signs,setVisible(value){signs.forEach(s=>{s.root.visible=value;});},setLabels(labels){signs.forEach(s=>s.paint(labels[s.id]));},
    pick(x,y,width,height,camera){pointer.set(x/width*2-1,1-y/height*2);root.updateMatrixWorld(true);raycaster.setFromCamera(pointer,camera);return raycaster.intersectObjects(signs.flatMap(s=>[s.face,s.icon]),false)[0]?.object.userData.menu||null;},
    hover(id){hover=id;},update(dt,t,camera,reduced){
      const portrait=camera.aspect<.75;if(portrait){camera.getWorldDirection(forward);up.set(0,1,0).applyQuaternion(camera.quaternion);base.copy(camera.position).addScaledVector(forward,30);}
      for(let i=0;i<signs.length;i++){
        const s=signs[i],target=(portrait?1.85:camera.aspect>2?1.55:1)*(hover===s.id?1.07:1);s.root.scale.lerp(scale.setScalar(target),1-Math.exp(-dt*12));s.root.quaternion.copy(camera.quaternion);
        if(portrait){s.root.position.copy(base).addScaledVector(up,[10,4,-5,-14][i]);s.icon.scale.setScalar(.55);s.icon.position.set(-5,.15,.25);}
        else{s.root.position.set(...anchors[s.id]);s.root.position.y+=hover===s.id?.18:0;s.icon.scale.setScalar(1);s.icon.position.set(0,2.6+(reduced?0:Math.sin(t*1.4+i)*.09),.2);}
        s.icon.visible=!['abilities','online'].includes(s.id);s.shadow.visible=s.icon.visible;
        s.shadow.position.copy(s.icon.position).add(shadowOffset);s.shadow.scale.copy(s.icon.scale);
      }
    }};
}
