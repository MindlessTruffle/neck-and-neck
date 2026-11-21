import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// The clubhouse, market and practice court are baked together. Only the ball,
// windmill and clock hands move, so storefront detail adds no per-frame work.
export function createAthleticVillage(parent) {
  const pieces=[], transform=new T.Object3D(), tint=new T.Color();
  const wood='#855841',cream='#fff0c7',jade='#347878',glass='#405971',brick='#bf674d';
  function part(shape,color,x,y,z,sx=1,sy=1,sz=1,rx=0,ry=0,rz=0){
    const g=shape.index?shape.toNonIndexed():shape;
    if(g!==shape)shape.dispose();
    transform.position.set(x,y,z);transform.rotation.set(rx,ry,rz);transform.scale.set(sx,sy,sz);transform.updateMatrix();
    g.applyMatrix4(transform.matrix);g.deleteAttribute('uv');
    const colors=new Float32Array(g.attributes.position.count*3);tint.set(color);
    for(let i=0;i<colors.length;i+=3)tint.toArray(colors,i);
    g.setAttribute('color',new T.BufferAttribute(colors,3));pieces.push(g);
  }
  const box=(color,x,y,z,w,h,d,rx=0,ry=0,rz=0)=>part(new T.BoxGeometry(1,1,1),color,x,y,z,w,h,d,rx,ry,rz);
  function house(x,z,w,h,d,roof,body){
    box(body,x,h/2,z,w,h,d);
    for(const side of [-1,1]){
      box(wood,x+side*(w/2-.09),h/2,z+d/2+.03,.14,h,.16);
      box(roof,x+side*w*.24,h+w*.15,z,w*.64,.19,d+.52,0,0,-side*.53);
    }
    const gable = new T.Shape();
    gable.moveTo(-w/2,0);gable.lineTo(w/2,0);gable.lineTo(0,w*.285);gable.closePath();
    part(new T.ExtrudeGeometry(gable,{depth:d,bevelEnabled:false}),body,x,h,z-d/2);
    box(wood,x,h+.07,z+d*.5+.04,w+.15,.17,.14);
    const front=z+d*.5+.09;
    box(wood,x,.76,front,.85,1.52,.12);
    for(const side of [-1,1]){
      const wx=x+side*w*.31;
      box(cream,wx,1.38,front,.85,.95,.14);
      box(glass,wx,1.38,front+.09,.68,.77,.08);
      box(cream,wx,1.38,front+.14,.065,.8,.05);
      box(cream,wx,1.38,front+.14,.69,.065,.05);
      box(roof,wx,.88,front+.12,.98,.16,.34);
    }
    box(brick,x+w*.31,h+.55,z-d*.20,.46,1.18,.50);
  }
  house(-8.0,-5.1,4.1,2.6,3.25,jade,'#f3d5a0');
  house(-3.5,-8.0,3.5,2.24,2.9,'#be624b','#f3dfa9');
  house(5.7,-7.6,4.5,2.64,3.4,'#5c7596','#ebbf89');
  house(9.5,-3.9,2.45,1.92,2.3,'#bd7951','#f4d79c');
  // Timekeeper's tower and balcony overlooking the green.
  box('#e5bd80',1.15,2.4,-7.8,2.0,4.8,2.15);
  box(wood,1.15,3.51,-7.8,2.38,.25,2.48);
  part(new T.ConeGeometry(1.76,1.75,4),jade,1.15,5.55,-7.8,1,1,1,0,Math.PI/4);
  const clockZ=-6.68;
  part(new T.CylinderGeometry(.61,.61,.12,24),wood,1.15,4.22,clockZ,1,1,1,Math.PI/2);
  part(new T.CylinderGeometry(.52,.52,.13,24),cream,1.15,4.22,clockZ+.07,1,1,1,Math.PI/2);
  for(let i=0;i<12;i++){
    const a=i*Math.PI/6;
    box(wood,1.15+Math.sin(a)*.43,4.22+Math.cos(a)*.43,clockZ+.15,.04,.09,.02,0,0,-a);
  }
  // Practice court and a small stepped grandstand at the edge of the square.
  box('#cda375',.45,.045,2.65,8.8,.075,3.25);
  for(const z of [1.15,4.15])box(cream,.45,.11,z,8.55,.034,.09);
  for(const x of [-3.8,.45,4.7])box(cream,x,.11,2.65,.075,.034,3.03);
  for(const z of [1.03,4.27])box(jade,.45,1.0,z,.12,2,.12);
  for(let y=1.05;y<2.01;y+=.20)box(cream,.45,y,2.65,.035,.034,3.25);
  for(let z=1.18;z<=4.2;z+=.28)box('#8b7760',.45,1.50,z,.026,.91,.024);
  for(let i=0;i<3;i++)box(i%2?jade:wood,6.6,.23+i*.25,3.7+i*.6,2.9,.34+i*.41,.65);
  // Striped victory bunting traces the street rather than crossing the court.
  for(let row=0;row<2;row++){
    const left=row?-3.4:-8.2,right=row?7.8:-.3,z=row?-4.9:-2.0;
    for(const x of [left,right])box(wood,x,1.67,z,.10,3.35,.10);
    for(let i=0;i<16;i++){
      const u=(i+.5)/16,x=left+(right-left)*u,y=3.35-.58*Math.sin(Math.PI*u);
      box(wood,x,y,z,(right-left)/16+.02,.035,.038,0,0,-.58*Math.PI*Math.cos(Math.PI*u)/(right-left));
      if(i%2===0)part(new T.ConeGeometry(.28,.47,3),[jade,cream,brick,'#eab95b'][i/2%4],x,y-.21,z,1,1,.15,0,0,Math.PI);
    }
  }
  // Water barrels, flower boxes and bikes outside the clubhouse.
  for(const x of [-9.1,-7.1,4.1,7.3]){
    const z=x<0?-2.95:-5.48;
    box(wood,x,.18,z,1.38,.36,.48);
    for(let j=0;j<5;j++)part(new T.IcosahedronGeometry(.21,0),j%2?'#56916b':'#e68f75',x-.50+j*.25,.44+(j%2)*.08,z);
  }
  for(const x of [-6.5,-5.5]){
    part(new T.TorusGeometry(.40,.07,5,16),glass,x,.43,-1.7);
    box(brick,x,.65,-1.7,.86,.085,.09,0,0,.7);
  }
  box(wood,-6.0,.92,-1.7,.85,.08,.1);
  // A warmup oval and relay hurdles occupy the far side of the green.
  const oval=(rx,rz,color,thickness,y)=>{
    const path=new T.CurvePath();
    const points=Array.from({length:49},(_,i)=>new T.Vector3(-8.4+rx*Math.cos(i*Math.PI/24),y,4.2+rz*Math.sin(i*Math.PI/24)));
    for(let i=1;i<points.length;i++)path.add(new T.LineCurve3(points[i-1],points[i]));
    part(new T.TubeGeometry(path,72,thickness,5,true),color,0,0,0);
  };
  oval(2.48,1.75,'#b5775a',.28,.01);oval(2.7,1.9,cream,.034,.10);oval(2.24,1.57,cream,.034,.10);
  for(const z of [3.5,4.95]){
    for(const x of [-9.1,-8.05])box(jade,x,.31,z,.08,.62,.12);
    box(cream,-8.58,.64,z,1.18,.10,.11);
  }
  // Trophy plinth and court-side café tables provide distinct gathering spots.
  box(wood,7.8,.34,1.46,.83,.68,.81);
  part(new T.CylinderGeometry(.43,.16,.58,12),'#e4aa48',7.8,1.02,1.46);
  for(const x of [7.33,8.27])part(new T.TorusGeometry(.19,.05,6,12),'#ecc570',x,1.08,1.46);
  for(const [x,z] of [[-5.35,-3.25],[3.55,-4.75]]){
    part(new T.CylinderGeometry(.56,.55,.12,12),cream,x,.72,z);
    box(wood,x,.34,z,.13,.68,.13);
    for(const side of [-1,1])part(new T.CylinderGeometry(.26,.22,.43,9),'#459997',x+side*.72,.22,z);
  }
  const material=new T.MeshStandardMaterial({vertexColors:true,roughness:.84});
  const streets=new T.Mesh(mergeGeometries(pieces),material);pieces.forEach(g=>g.dispose());
  streets.name='Clubhouse street and practice green';parent.add(streets);
  const moving=(g,c)=>{const m=new T.Mesh(g,new T.MeshStandardMaterial({color:c}));parent.add(m);return m;};
  const hand=moving(new T.BoxGeometry(.06,.37,.05).translate(0,.16,0),glass);hand.position.set(1.15,4.22,clockZ+.19);
  const wheel=new T.Group();parent.add(wheel);wheel.position.set(-8,3.25,-3.27);
  for(let i=0;i<4;i++){const sail=moving(new T.BoxGeometry(.28,.94,.08).translate(.085,.55,0),i%2?cream:'#b5d8cd');wheel.add(sail);sail.rotation.z=i*Math.PI/2;}
  const ball=moving(new T.SphereGeometry(.25,14,8),'#ffe3a0');
  const seam=moving(new T.TorusGeometry(.245,.035,5,18),'#29867e');ball.add(seam);seam.rotation.y=.65;
  return (t,reduced)=>{
    const time=reduced?.83:t,phase=time*1.65;
    ball.position.set(.45-3.08*Math.cos(phase),2.99+1.63*Math.abs(Math.sin(phase)),2.68);
    ball.rotation.z=time*2.9;wheel.rotation.z=time*.52;hand.rotation.z=-time*.012-.5;
  };
}
