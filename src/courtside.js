import * as THREE from 'three';

// Leave the extended player envelope open. Pairs occupy little courtside vignettes.
const STANDS = {
  beach: ['crab', [[-5,13,1.5],[-3.6,13.7,1.1],[18,-4,1.3],[19,-3.3,.95]]],
  jungle: ['capuchin', [[-18,-6,1.15],[-19,-5.1,.86],[6,13.4,1.1],[8.1,14,.85]]],
  meadow: ['fox', [[-18.5,4,1],[5.5,13.1,.82],[7.4,13.8,1.1]]],
  mountain: ['alpaca', [[18.5,-4,1.4],[20,-4.7,1.05],[-3,14,1.25]]],
  volcano: ['salamander', [[-18,4,1.65],[-18.9,5.5,1.2],[6,-13.7,1.55],[8,-14,1.25]]],
  cave: ['bat', [[-14,15,1.35],[-11,17,1.1],[19,-6,1.4],[20,-3,1]]],
};
const BRAZIERS = [[-19,10],[19,-10],[-7,-14],[7,15],[-26,-5],[25,6]];
const pose = new THREE.Object3D();

export function createCourtsideWildlife(groups, models, pack, coarse) {
  const stands = new Map();
  const ray = new THREE.Raycaster();
  ray.ray.direction.set(0,-1,0);
  for (const [id,[name,positions]] of Object.entries(STANDS)) {
    const source = pack.getObjectByName(name);
    const group = groups.get(id), terrain = models.get(id);
    const seats = positions.slice(0,coarse ? 2 : positions.length).map(([x,z,size],i) => {
      // Ground varies with the hand-sculpted island. Sample the surface once.
      ray.ray.origin.set(x,5,z);
      const floor = ray.intersectObject(terrain,true).find(hit => hit.object.name.startsWith('Surface_'));
      return {x,z,size,y:floor?.point.y ?? 0,phase:i*2.23};
    });
    const batch = new THREE.InstancedMesh(source.geometry,source.material,seats.length);
    batch.name='AnimatedCrowdBatch';
    batch.userData.species=name;
    batch.frustumCulled=false;
    batch.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    group.add(batch);
    stands.set(id,{batch,seats});
  }
  function landmark(id,name,x,y,z) {
    const mesh=pack.getObjectByName(name).clone();
    mesh.position.set(x,y,z);groups.get(id).add(mesh);
    return mesh;
  }
  landmark('meadow','meadowMill',-16,0,-24);
  const sails=landmark('meadow','meadowSails',-16,6.3,-22.52);
  landmark('mountain','mountainCable',0,0,-21.8);
  const cableCar=landmark('mountain','mountainCar',0,8.5,-21.8);
  landmark('volcano','volcanoVents',-23,0,-14.8);
  return function update(id,t,ball,celebrate) {
    if(id==='meadow')sails.rotation.z=t*.36;
    if(id==='mountain'){
      const x=Math.sin(t*.095)*17.5;
      cableCar.position.set(x,10.5+x/12-2*(1-(x/18)**2),-21.8);
      cableCar.rotation.z=.025*Math.cos(t*.19);
    }
    const stand=stands.get(id);
    if(!stand)return;
    for(let i=0;i<stand.seats.length;i++) {
      const {x,y,z,size,phase}=stand.seats[i];
      const hover=id==='cave', beat=t*(hover?3.7:2.4)+phase;
      const sway=Math.sin(beat);
      const hop=celebrate ? .55*Math.abs(Math.sin(t*6+phase)) : 0;
      pose.position.set(x+(hover?.45*Math.sin(beat*.55):0),y+(hover?6+.47*sway:.016+.014*sway)+hop,z);
      const gaze=Math.atan2(-x,-z);
      const tracking=ball ? Math.sin(Math.atan2(ball.x-x,ball.z-z)-gaze)*.65 : 0;
      pose.rotation.set(hover?.1*sway:0,gaze+tracking+.06*Math.sin(beat*.45),sway*(hover?.22:.035));
      pose.scale.set(size,size*(1+sway*.016),size);
      pose.updateMatrix();stand.batch.setMatrixAt(i,pose.matrix);
    }
    stand.batch.instanceMatrix.needsUpdate=true;
  };
}

// Transparent atmospheric ribbons give distant silhouettes depth without shadow maps.
const LIGHT = {
  meadow:{tint:'#ffe9bd',strength:.16,streaks:[[-22,16,18,11],[18,-24,24,14],[-30,-20,17,8]]},
  mountain:{tint:'#c4dcff',strength:.28,streaks:[[-30,23,24,16],[27,-29,29,18],[-23,-34,20,12]]},
  volcano:{tint:'#ff824a',strength:.32,streaks:[[-29,22,15,11],[28,-25,22,15],[-34,-18,18,14],[23,25,12,11]]},
  cave:{tint:'#ff9e4c',strength:.58,streaks:BRAZIERS.map(([x,z])=>[x,z,4.3,4.5])},
};
export function createSceneryLight(groups,clock) {
  for(const [id,{tint,strength,streaks}] of Object.entries(LIGHT)) {
    const positions=[],uvs=[],widths=[],indices=[];
    for(const [x,z,height,width] of streaks) {
      const start=positions.length/3, shaft=id==='cave'||id==='volcano'?0:-7;
      for(const [u,v] of [[0,0],[1,0],[1,1],[0,1]]) {
        positions.push(x+shaft*v,.07+height*v,z+shaft*.35*v);
        uvs.push(u,v);widths.push(width*(id==='cave'?1:v*.4+.65));
      }
      indices.push(start,start+1,start+2,start,start+2,start+3);
    }
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
    geometry.setAttribute('span',new THREE.Float32BufferAttribute(widths,1));geometry.setIndex(indices);
    const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,
      uniforms:{clock,tint:{value:new THREE.Color(tint)},strength:{value:strength},brazier:{value:id==='cave'?1:0}},
      vertexShader:'attribute float span; varying vec2 st; varying float phase; void main(){st=uv;phase=position.x;vec4 p=modelViewMatrix*vec4(position,1.);p.x+=(uv.x-.5)*span;gl_Position=projectionMatrix*p;}',
      fragmentShader:`uniform vec3 tint;uniform float clock,strength,brazier;varying vec2 st;varying float phase;
      void main(){float side=pow(max(0.,1.-abs(st.x*2.-1.)),2.5);float h=mix(sin(st.y*3.14159),exp(-pow((st.y-.68)*3.,2.))*sin(st.y*3.14159),brazier);
      float pulse=.86+.14*sin(clock*mix(.38,6.,brazier)+phase+st.y*3.);gl_FragColor=vec4(tint,strength*side*h*pulse);}`});
    const mesh=new THREE.Mesh(geometry,material);mesh.name='SceneryLight';mesh.renderOrder=1;mesh.frustumCulled=false;groups.get(id).add(mesh);
  }
}

export function paintCavernFloor(model,clock) {
  const gems=model.getObjectByName('Crystal_geodes');
  gems.material=gems.material.clone();
  gems.material.roughness=.34;
  gems.material.onBeforeCompile=shader=>{
    shader.uniforms.gemClock=clock;
    shader.vertexShader='varying vec3 crystalPos;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ncrystalPos=position;');
    shader.fragmentShader='uniform float gemClock; varying vec3 crystalPos;\n'+shader.fragmentShader.replace('#include <opaque_fragment>','outgoingLight+=vColor.rgb*(.62+.21*sin(gemClock*1.1+crystalPos.x+crystalPos.y*1.7));\n#include <opaque_fragment>');
  };
  gems.material.customProgramCacheKey=()=> 'cavern-geode-light-v1';
  const rock=model.getObjectByName('Vaulted_basalt');
  rock.material=rock.material.clone();
  rock.material.onBeforeCompile=shader=>{
    shader.vertexShader='varying vec3 wallPos;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nwallPos=position;');
    shader.fragmentShader='varying vec3 wallPos;\n'+shader.fragmentShader.replace('#include <opaque_fragment>',`float layer=sin(wallPos.y*2.6+sin(wallPos.x*.28+wallPos.z*.17)*3.5);
    float mineral=smoothstep(.93,.99,layer)*(.5+.5*sin(wallPos.y*.8+wallPos.x*.22));
    outgoingLight+=vec3(.029,.041,.085)+mineral*vec3(.059,.055,.095);
    #include <opaque_fragment>`);
  };
  rock.material.customProgramCacheKey=()=> 'cavern-violet-strata-v1';
  const floor=model.getObjectByName('Surface_Cavern');
  const material=floor.material.clone();floor.material=material;
  material.onBeforeCompile=shader=>{
    shader.uniforms.brazierClock=clock;
    shader.vertexShader='varying vec2 cavernPos;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ncavernPos=(modelMatrix*vec4(transformed,1.)).xz;');
    const pools=BRAZIERS.map(([x,z])=>`exp(-dot(cavernPos-vec2(${x}.,${z}.),cavernPos-vec2(${x}.,${z}.))*.052)`).join('+');
    shader.fragmentShader='varying vec2 cavernPos; uniform float brazierClock;\n'+shader.fragmentShader.replace('#include <opaque_fragment>',`outgoingLight+=vec3(.94,.35,.065)*(${pools})*(.88+.12*sin(brazierClock*5.+cavernPos.x));\n#include <opaque_fragment>`);
  };
  material.customProgramCacheKey=()=> 'cavern-torch-pools-v1';
}

