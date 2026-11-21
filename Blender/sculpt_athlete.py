"""Sculpt and vertex-paint the club athlete while retaining the original skin and armature.
Usage: python Blender/sculpt_athlete.py source.glb destination.glb
"""
import json
import struct
import sys
from pathlib import Path
import numpy as np

source, output = map(Path, sys.argv[1:])
raw = source.read_bytes()
length = struct.unpack_from('<I', raw, 12)[0]
doc = json.loads(raw[20:20+length])
blob = bytearray(raw[28+length:])
parts = doc['meshes'][0]['primitives']

def read(ix):
    a = doc['accessors'][ix]
    v = doc['bufferViews'][a['bufferView']]
    return np.frombuffer(blob, '<f4', a['count']*3, v.get('byteOffset',0)+a.get('byteOffset',0)).reshape(-1,3).copy()

def append(values,kind,component):
    values=np.ascontiguousarray(values)
    blob.extend(bytes((-len(blob))%4))
    start=len(blob)
    blob.extend(values.tobytes())
    doc['bufferViews'].append(dict(buffer=0,byteOffset=start,byteLength=values.nbytes))
    a=dict(bufferView=len(doc['bufferViews'])-1,componentType=component,count=len(values),type=kind)
    if kind=='VEC3' and component==5126:
        a.update(min=values.min(axis=0).tolist(),max=values.max(axis=0).tolist())
    doc['accessors'].append(a)
    return len(doc['accessors'])-1

def sculpt(p):
    x,y,z=p.T
    head=np.clip((y-2.55)/.35,0,1)
    ears=np.clip((abs(x)-.36)*4,0,1)*head
    muzzle=np.clip((z-.58)*2.4,0,1)*head
    chest=np.exp(-((y-1.05)/.48)**2)
    return np.stack([x*(1+.13*head+.12*ears+.045*chest), y+.04*head+.11*ears+.035*muzzle,
                     z-.075*muzzle+.055*head],axis=1)

for part in parts:
    attr=part['attributes'];p=read(attr['POSITION']);n=read(attr['NORMAL'])
    v=sculpt(p)
    jac=np.stack([(sculpt(p+e)-sculpt(p-e))/.002 for e in np.eye(3)*.001],axis=2)
    normal=(np.linalg.inv(jac).transpose(0,2,1)@n[:,:,None])[:,:,0]
    normal/=np.maximum(1e-8,np.linalg.norm(normal,axis=1,keepdims=True))
    for key,values in [('POSITION',v),('NORMAL',normal)]:
        a=doc['accessors'][attr[key]];view=doc['bufferViews'][a['bufferView']]
        start=view.get('byteOffset',0)+a.get('byteOffset',0)
        data=values.astype('<f4').tobytes();blob[start:start+len(data)]=data
        if key=='POSITION':a.update(min=values.min(0).tolist(),max=values.max(0).tolist())
    x,y,z=p.T
    light=np.clip(.60+.23*n[:,1]+.15*n[:,2]+.06*np.sin(15*y+6*z),0,1)
    shade=np.column_stack([.81+.19*light,.65+.35*light,.64+.36*light])
    if part['material']==4:shade*=np.column_stack([.85+.15*np.cos(24*y),.82+.18*np.cos(26*y),np.ones(len(y))])
    attr['COLOR_0']=append((np.column_stack([shade,np.ones(len(shade))])*255).astype('u1'),'VEC4',5121)
    doc['accessors'][-1]['normalized']=True

# Swept chestnut locks on individual neck joints and a side-parted forelock.
positions=[]; normals=[]; colors=[]; joints=[]; indices=[]
def lock(center,scale,lean,joint,tip):
    start=len(positions)
    for ring in range(7):
        t=ring/6; radius=.012+np.sin(np.pi*t)**.75
        for k in range(10):
            a=k*np.pi/5; r=np.array([np.cos(a),0,np.sin(a)])
            pos=np.array(center)+[scale[0]*radius*r[0]+lean[0]*t*t,scale[1]*t,scale[2]*radius*r[2]+lean[1]*t*t]
            positions.append(pos);norm=np.array([r[0],(t-.5)*1.4,r[2]]);normals.append(norm/np.linalg.norm(norm))
            colors.append(np.array([.36,.13,.072])*(1-t)+np.array(tip)*t);joints.append([joint,0,0,0])
            if ring<6:
                i=start+ring*10+k;j=start+ring*10+(k+1)%10
                indices.extend([i,i+10,j,j,i+10,j+10])
for i in range(8):
    lock([0,1.43+i*.185,.11+i*.011],[.075,.30,.13],[0,-.14],10+i,[.62,.28,.12])
for x,lean,h in [(-.13,-.12,.24),(.04,-.16,.32),(.19,-.09,.18)]:
    lock([x,3.20,.51],[.12,h,.145],[lean,.07],18,[.76,.40,.17])
attr={}
for key,values,kind,typ,code in [('POSITION',positions,'VEC3','<f4',5126),('NORMAL',normals,'VEC3','<f4',5126),
    ('COLOR_0',colors,'VEC3','<f4',5126),('JOINTS_0',joints,'VEC4','u1',5121),
    ('WEIGHTS_0',[[1,0,0,0]]*len(joints),'VEC4','<f4',5126)]:
    attr[key]=append(np.array(values,dtype=typ),kind,code)
doc['materials'].append(dict(name='ChestnutMane',doubleSided=True,pbrMetallicRoughness=dict(metallicFactor=0,roughnessFactor=.94)))
parts.append(dict(attributes=attr,indices=append(np.array(indices,'<u2'),'SCALAR',5123),material=len(doc['materials'])-1))
blob.extend(bytes((-len(blob))%4));doc['buffers'][0]['byteLength']=len(blob)
meta=json.dumps(doc,separators=(',',':')).encode();meta+=b' '*((-len(meta))%4)
output.write_bytes(struct.pack('<4sII',b'glTF',2,28+len(meta)+len(blob))+struct.pack('<I4s',len(meta),b'JSON')+meta+struct.pack('<I4s',len(blob),b'BIN\0')+blob)
