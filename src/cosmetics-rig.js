import * as THREE from 'three';
import {cleanCosmetics} from './cosmetics-catalog.js';
import {accessory,disposeAccessory} from './accessory.js';

export function createCosmeticRig(root){
 const head=new THREE.Group(),back=new THREE.Group();root.add(head,back);back.position.set(0,1.25,-.48);
 const slots={hat:head,face:head,scarf:head,back},objects={};
 function set(value){
   for(const [slot,anchor] of Object.entries(slots)){
     const id=value?.[slot]||null;if((objects[slot]?.name||null)===id)continue;
     if(objects[slot])disposeAccessory(objects[slot]);objects[slot]=null;
     if(id&&cleanCosmetics({[slot]:id})[slot]){const model=accessory(id);model.name=id;objects[slot]=model;anchor.add(model);}
   }
 }
 const quaternion=new THREE.Quaternion(),rotation=new THREE.Quaternion(),point=new THREE.Vector3(),euler=new THREE.Euler();
 return {set,update(player,posedHead=null,tumble=null){if(!player?.head)return;if(posedHead)point.copy(posedHead);else point.set(player.head.x,player.head.y,player.head.z);root.updateWorldMatrix(true,false);head.position.copy(root.worldToLocal(point));rotation.setFromEuler(euler.set(-(player.neck?.pitch||0),Math.PI/2-(player.neck?.yaw||0),0,'YXZ'));if(tumble)rotation.premultiply(tumble);head.quaternion.copy(root.getWorldQuaternion(quaternion).invert().multiply(rotation));},dispose(){Object.values(objects).filter(Boolean).forEach(disposeAccessory);head.removeFromParent();back.removeFromParent();}};
}
