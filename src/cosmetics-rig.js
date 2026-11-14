import * as THREE from 'three';
import { cleanCosmetics } from './cosmetics-catalog.js';
/** Lightweight accessories follow the same head pose as the floppy armature. */
export function createCosmeticRig(root){
 const head=new THREE.Group(),back=new THREE.Group();root.add(head,back);back.position.set(0,1.25,-.48);let key='';
 const clear=group=>{for(const child of [...group.children]){child.traverse(o=>{o.geometry?.dispose();if(Array.isArray(o.material))o.material.forEach(m=>m.dispose());else o.material?.dispose();});group.remove(child);}};
 function add(group,geometry,color,pos,scale=[1,1,1]){const m=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color,roughness:.6}));m.position.set(...pos);m.scale.set(...scale);m.castShadow=true;group.add(m);return m;}
 const box=(g,p,s,c)=>add(g,new THREE.BoxGeometry(...s),c,p),ball=(g,p,s,c)=>add(g,new THREE.SphereGeometry(1,12,8),c,p,s),disc=(g,p,r,h,c)=>add(g,new THREE.CylinderGeometry(r,r,h,16),c,p);
 function set(value){const c=cleanCosmetics(value),next=JSON.stringify(c);if(next===key)return;key=next;clear(head);clear(back);
  if(c.hat==='cap'){ball(head,[0,.34,0],[.4,.22,.38],'#39aaa9');ball(head,[0,.23,.34],[.44,.04,.32],'#214b69');ball(head,[0,.54,0],[.06,.04,.06],'#f5ce6e');}
  if(c.hat==='bucket'){disc(head,[0,.27,0],.49,.08,'#ffe4ad');add(head,new THREE.CylinderGeometry(.31,.38,.32,16),'#e77f80',[0,.43,0]);disc(head,[0,.32,0],.39,.06,'#fff1cc');}
  if(c.hat==='crown'){disc(head,[0,.32,0],.37,.16,'#edb335');for(let i=0;i<5;i++){const a=i*Math.PI*2/5,x=Math.sin(a)*.32,z=Math.cos(a)*.32;add(head,new THREE.ConeGeometry(.12,.3,4),'#ffdb70',[x,.52,z]);ball(head,[x,.38,z],[.06,.07,.06],i%2?'#ef6b9e':'#66ded6');}}
  if(c.face){for(const x of [-.2,.2]){box(head,[x,.08,.38],[.34,.25,.07],c.face==='hearts'?'#e85d9e':'#19283d');box(head,[x,.08,.425],[.26,.16,.025],c.face==='hearts'?'#ffb8d4':'#67c5df');if(c.face==='hearts'){ball(head,[x-.08,.19,.4],[.09,.08,.045],'#e85d9e');ball(head,[x+.08,.19,.4],[.09,.08,.045],'#e85d9e');}}box(head,[0,.11,.4],[.14,.04,.05],'#19283d');for(const x of [-.36,.36])box(head,[x,.1,.14],[.035,.04,.5],'#19283d');}
  if(c.back==='pack'){box(back,[0,0,0],[.68,.72,.34],'#3cb5b4');box(back,[0,-.12,-.2],[.5,.34,.12],'#edb849');ball(back,[0,.18,-.2],[.14,.14,.06],'#fff0cb');for(const x of [-.24,.24])box(back,[x,0,.2],[.08,.8,.07],'#e78377');}
 }
 const quaternion=new THREE.Quaternion(),rotation=new THREE.Quaternion(),point=new THREE.Vector3();
 return {set,update(player,posedHead=null,tumble=null){if(!player?.head)return;if(posedHead)point.copy(posedHead);else point.set(player.head.x,player.head.y,player.head.z);root.updateWorldMatrix(true,false);head.position.copy(root.worldToLocal(point));rotation.setFromEuler(new THREE.Euler(-(player.neck?.pitch||0),Math.PI/2-(player.neck?.yaw||0),0,'YXZ'));if(tumble)rotation.premultiply(tumble);head.quaternion.copy(root.getWorldQuaternion(quaternion).invert().multiply(rotation));},dispose(){clear(head);clear(back);head.removeFromParent();back.removeFromParent();}};
}
