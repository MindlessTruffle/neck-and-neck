import * as THREE from 'three';
import {getCosmetic} from './cosmetics-catalog.js';

export function accessory(id) {
  const item=getCosmetic(id), group=new THREE.Group();
  if(!item)return group;
  const {color,trim,shape}=item;
  const ink='#30314d',cream='#fff4d9';
  const materials=new Map();
  function mesh(geometry,c,x,y,z,sx=1,sy=1,sz=1){
    if(!materials.has(c)){
      const mat=new THREE.MeshStandardMaterial({color:c,roughness:shape==='boater'||item.slot==='scarf'?.88:.48,metalness:id==='crown'?.34:0});
      mat.onBeforeCompile=shader=>{
        shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`
          float edge=1.-abs(dot(normal,normalize(vViewPosition)));
          outgoingLight+=vec3(.21,.16,.09)*smoothstep(.60,.80,edge)*smoothstep(-.45,.40,normal.y);
          #include <opaque_fragment>`);
      };
      materials.set(c,mat);
    }
    const m=new THREE.Mesh(geometry,materials.get(c));m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.castShadow=true;group.add(m);return m;
  }
  const orb=(c,x,y,z,a,b,d)=>mesh(new THREE.SphereGeometry(1,16,10),c,x,y,z,a,b,d);
  const drum=(c,x,y,z,top,base,h)=>mesh(new THREE.CylinderGeometry(top,base,h,20),c,x,y,z);
  const box=(c,x,y,z,a,b,d)=>mesh(new THREE.BoxGeometry(a,b,d),c,x,y,z);
  function plate(c,outline,z,thickness=.045){
    const path=new THREE.Shape(outline.map(([x,y])=>new THREE.Vector2(x,y)));path.closePath();
    return mesh(new THREE.ExtrudeGeometry(path,{depth:thickness,bevelEnabled:true,bevelSegments:1,steps:1,bevelSize:.015,bevelThickness:.015}),c,0,0,z);
  }
  if(item.slot==='hat'){
    if(id==='cap'){orb(color,0,.34,0,.4,.22,.38);orb(trim,0,.24,.33,.43,.045,.32);orb(cream,0,.55,0,.055,.035,.055);}
    if(id==='bucket'||shape==='boater'){drum(trim,0,.27,0,shape==='boater'?.56:.49,.51,.07);drum(color,0,.43,0,.31,.38,.32);drum(trim,0,.35,0,.38,.39,.08);}
    if(id==='crown'){drum(color,0,.33,0,.37,.37,.16);for(let i=0;i<6;i++){const x=Math.sin(i*Math.PI/3)*.32,z=Math.cos(i*Math.PI/3)*.32;drum(trim,x,.51,z,.02,.13,.3);orb('#6ddad0',x,.37,z,.065,.075,.065);}}
    if(shape==='witch'){orb(color,0,.3,0,.56,.055,.47);drum(color,0,.54,0,.14,.34,.49);drum(color,.055,.82,0,.015,.14,.28).rotation.z=-.38;drum(trim,0,.4,0,.295,.325,.08);}
    if(shape==='mushroom'){orb(trim,0,.31,0,.49,.12,.46);orb(color,0,.43,0,.5,.26,.47);for(let i=0;i<7;i++){const a=i*2.4,r=i%2?.26:.38;orb(cream,r*Math.cos(a),i%2?.64:.57,r*Math.sin(a),.084,.033,.086);}}
    if(shape==='angler'||shape==='beanie'||shape==='frog'){orb(color,0,.4,0,.4,.27,.37);drum(trim,0,.29,0,.40,.39,.085);
      if(shape==='beanie')for(let i=0;i<12;i++){const a=i*Math.PI/6;orb(trim,.387*Math.cos(a),.3,.377*Math.sin(a),.018,.052,.018);}
      if(shape==='beanie')orb(trim,0,.69,0,.13,.13,.13);
      if(shape==='frog')for(const x of [-.23,.23]){orb(color,x,.61,.07,.14,.14,.14);orb(cream,x,.65,.16,.092,.095,.07);orb(ink,x,.65,.215,.047,.057,.026);}
      if(shape==='angler'){const path=new THREE.CatmullRomCurve3([new THREE.Vector3(0,.55,0),new THREE.Vector3(0,.85,.18),new THREE.Vector3(0,.75,.45)]);mesh(new THREE.TubeGeometry(path,10,.034,6,false),color,0,0,0);orb(trim,0,.7,.45,.094,.11,.09);}
    }
  }
  if(item.slot==='face'){
    if(shape==='visor'){orb(color,0,.10,.36,.45,.16,.09);orb(trim,0,.1,.435,.4,.105,.045);}
    else for(const x of (shape==='monocle'?[.2]:[-.2,.2])){
      if(shape==='pilot'||shape==='monocle'){orb(color,x,.09,.38,.19,.17,.077);orb(trim,x,.09,.445,.14,.12,.037);}
      else{box(color,x,.08,.38,.34,.25,.07);box(trim,x,.08,.425,.26,.16,.025);if(id==='hearts')for(const d of [-.08,.08])orb(color,x+d,.19,.4,.09,.08,.045);}
    }
    if(shape==='monocle')for(let i=0;i<6;i++)orb(color,.36,.03-i*.049,.36-i*.02,.022,.032,.022);
    else {box(ink,0,.11,.39,.12,.044,.055);for(const x of [-.36,.36])box(color,x,.1,.14,.045,.06,.5);}
  }
  if(item.slot==='back'){
    if(shape==='wings'||shape==='bat'){for(const side of [-1,1]){
      const outline=shape==='bat'?[[0,0],[.45,.62],[1,.78],[.85,.45],[.94,.25],[.59,.28],[.45,.04],[.25,.14],[0,-.17]]:[[0,-.1],[.12,.42],[.88,.75],[.72,.48],[.85,.53],[.63,.26],[.75,.28],[.43,.01],[.15,-.16]];
      const wing=plate(color,outline.map(([x,y])=>[x*side,y]),-.14);wing.rotation.y=-side*.24;orb(trim,side*.24,.17,-.15,.25,.085,.065).rotation.z=side*.55;
    }}else if(shape==='tank'||shape==='quiver'){for(const x of (shape==='tank'?[-.18,.18]:[0])){drum(color,x,0,-.09,.17,.15,.62);orb(trim,x,-.28,-.09,.17,.115,.17);drum(trim,x,.34,-.09,.15,.17,.11);}
      if(shape==='quiver')for(let i=0;i<3;i++){const x=(i-1)*.09;drum(cream,x,.49,-.07,.022,.022,.46);plate(trim,[[x,.64],[x+.07,.77],[x+.024,.77],[x-.04,.71]],-.07);}
    }else {box(color,0,0,0,.68,shape==='satchel'?.5:.72,.34);box(trim,0,-.08,-.2,.5,.28,.12);orb(cream,0,.08,-.27,.09,.065,.025);for(const x of [-.24,.24])box(color,x,0,.21,.08,.79,.075);}
  }
  if(item.slot==='scarf'){
    drum(color,0,-.26,0,.33,.29,.19);
    drum(trim,0,-.33,0,.307,.30,.023);
    if(shape!=='bow')plate(trim,[[.073,-.49],[.194,-.47],[.212,-.51],[.084,-.54]],.257,.012);
    if(shape==='bow'){for(const side of [-1,1])plate(color,[[0,-.28],[side*.25,-.13],[side*.28,-.46]],.23);orb(trim,0,-.28,.29,.073,.075,.05);}
    else{plate(color,[[-.05,-.28],[.14,-.26],[.28,-.65],[.11,-.58],[.04,-.67]],.21);if(shape==='stripe')drum(trim,0,-.26,0,.335,.32,.048);}
  }
  if(item.slot==='goal'){
    const n=shape==='frost'?6:shape==='petal'?5:shape==='star'?5:4;
    for(let i=0;i<n;i++){const a=i*Math.PI*2/n,ray=shape==='petal'?orb(color,Math.sin(a)*.3,Math.cos(a)*.3,0,.16,.29,.085):plate(color,[[-.08,.1],[0,.64],[.12,.18],[0,.25]],0);ray.rotation.z=-a;}
    orb(trim,0,0,.09,.16,.16,.1);
  }
  return group;
}
export function disposeAccessory(group){
  const materials=new Set();group.traverse(o=>{o.geometry?.dispose();if(o.material)materials.add(o.material);});materials.forEach(m=>m.dispose());group.removeFromParent();
}
