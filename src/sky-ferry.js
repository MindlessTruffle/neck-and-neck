import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// Batched silk gores, basket, ropes and tail fins, lit by the same sun as the island.
export function createSkyFerry(parent){
  const pieces=[],pose=new T.Object3D(),col=new T.Color();
  function paint(shape,c,x,y,z,sx=1,sy=1,sz=1,rot=0){
    const g=shape.index?shape.toNonIndexed():shape;if(shape!==g)shape.dispose();
    pose.position.set(x,y,z);pose.rotation.set(0,0,rot);pose.scale.set(sx,sy,sz);pose.updateMatrix();g.applyMatrix4(pose.matrix);
    col.set(c);const colors=new Float32Array(g.attributes.position.count*3);
    for(let i=0;i<g.attributes.position.count;i++)col.toArray(colors,i*3);
    g.deleteAttribute('uv');g.setAttribute('color',new T.BufferAttribute(colors,3));pieces.push(g);
  }
  for(let i=0;i<16;i++)paint(new T.SphereGeometry(1,4,12,i*Math.PI/8,Math.PI/8),['#e7bd7c','#fcdb9c','#3c898e','#377078'][i%4],0,2.9,0,3.55,1.43,1.44);
  for(const x of [-1.8,1.8])for(const z of [-.48,.48])paint(new T.CylinderGeometry(.046,.043,1.65,5),'#77564a',x*.73,1.12,z,1,1,1,-x*.22);
  paint(new T.SphereGeometry(1,16,8),'#8c563e',0,.28,0,1.8,.43,.65);
  paint(new T.CylinderGeometry(1,1,.1,16),'#f5c279',0,.44,0,1.83,1,.66);
  for(const x of [-.65,.65])paint(new T.BoxGeometry(.51,.48,.69),'#f7dbac',x,.75,0);
  paint(new T.BoxGeometry(2.3,.14,1.18),'#b74f4c',0,1.06,0);
  for(const side of [-1,1])paint(new T.SphereGeometry(1,8,5),'#b55447',-2.92,2.85,side*.88,1.15,.15,.87);
  paint(new T.SphereGeometry(1,8,6),'#ae5048',-2.94,3.47,0,1,.75,.12);
  const material=new T.MeshStandardMaterial({vertexColors:true,roughness:.85});
  const ferry=new T.Mesh(mergeGeometries(pieces),material);pieces.forEach(g=>g.dispose());
  ferry.name='Club spectator ferry';parent.add(ferry);ferry.rotation.y=.4;
  return (t,reduced)=>{ferry.position.set(-17+(reduced?0:Math.sin(t*.06)*1.4),7.5+(reduced?0:.42*Math.sin(t*.32)),-10);ferry.rotation.z=reduced?0:Math.sin(t*.24)*.025;};
}
