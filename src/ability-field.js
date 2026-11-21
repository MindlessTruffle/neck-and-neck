import * as T from 'three';

// All four players share one particle draw call. Motion follows the equipped power.
export function createAbilityField(parent, compact = false) {
  const perPlayer = compact ? 27 : 54;
  const geometry = new T.OctahedronGeometry(1);
  const material = new T.MeshBasicMaterial({vertexColors:false, toneMapped:false});
  const mesh = new T.InstancedMesh(geometry, material, perPlayer * 4);
  const pose = new T.Object3D(), tint = new T.Color();
  mesh.name = 'ActivePowerParticles';
  mesh.frustumCulled = false;
  mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
  mesh.visible = false;
  parent.add(mesh);
  function update(players, time, reduced = false) {
    let count = 0;
    for (const p of players || []) {
      const a=p.ability;
      if (!a?.active || !p.head) continue;
      const n=reduced?12:perPlayer;
      const yaw=p.aimYaw ?? p.neck?.yaw ?? 0, dx=Math.cos(yaw), dz=Math.sin(yaw);
      const t=reduced?.45:time;
      for (let i=0;i<n && count<mesh.instanceMatrix.count;i++) {
        const f=(i/n+t*.69)%1, angle=i*2.39996+t*.92;
        const c=Math.cos(angle), s=Math.sin(angle);
        let x=p.x,y=p.y||0,z=p.z, sx=.048,sy=.085,sz=.048;
        if (a.id==='shield') {
          const u=(i+.5)/n, r=Math.sqrt(1-u*u);
          x=p.head.x+dx*u*.9-dz*c*r*1.35;
          z=p.head.z+dz*u*.9+dx*c*r*1.35;
          y=p.head.y+s*r*1.1; sx=.10; sy=.062;
        } else if (a.id==='magnet') {
          const ring=(1-f)*1.65+.23;
          x=p.head.x+dx*ring-dz*c*ring*.56;
          z=p.head.z+dz*ring+dx*c*ring*.56;
          y=p.head.y+s*ring*.56; sx=.095; sy=.045;
        } else if (a.id==='feather') {
          x=p.head.x+c*(.55+f*.65);z=p.head.z+s*(.55+f*.65);
          y=p.head.y-.85+f*1.85; sx=.036;sy=.135;
        } else if (a.id==='rocket') {
          x-=dx*(.2+f*2.5)+dz*c*.22;z-=dz*(.2+f*2.5)-dx*c*.22;
          y+=.34+s*.18+f*.24; sx=.08*(1-f)+.024;sy=sx*2;
        } else if (a.id==='spring') {
          const helix=f*Math.PI*5+t*1.5,r=.25+.30*(1-f);
          x+=Math.cos(helix)*r; z+=Math.sin(helix)*r;
          y=Math.max(.06,y-1.38)+f*1.26; sy=.055;sx=.10;
        } else continue;
        pose.position.set(x,y,z);pose.rotation.set(.4*s,angle,a.id==='rocket'?1.4:.5*c);
        pose.scale.set(sx,sy,sz);pose.updateMatrix();mesh.setMatrixAt(count,pose.matrix);
        mesh.setColorAt(count++,tint.set(i%5===0?'#fff6ca':a.color));
      }
    }
    mesh.count=count;mesh.visible=count>0;
    if(count){mesh.instanceMatrix.needsUpdate=true;mesh.instanceColor.needsUpdate=true;}
  }
  return {update,dispose(){mesh.removeFromParent();mesh.dispose();geometry.dispose();material.dispose();}};
}
