"""Run with Blender in background. Bake cave paint and six spectators to compact GLBs."""
from pathlib import Path
import math
import random
import tempfile
import urllib.request
import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public/models/worlds'
rng = random.Random(8825)
TAU = math.tau
# Author in game coordinates with Y up. Positive Z is the face of each animal.
def convert(p):
    return (p[0], -p[2], p[1])

class Batch:
    def __init__(self):
        self.vertices, self.faces, self.colors = [], [], []

    def face(self, pts, tint):
        start = len(self.vertices)
        self.vertices.extend(convert(p) for p in pts)
        self.faces.append(tuple(range(start, start + len(pts))))
        if isinstance(tint, str):
            tint = tuple(int(tint[i:i+2], 16)/255 for i in (0,2,4))
        self.colors.append(tint)

    def rings(self, levels, palette, sides=8, phase=0):
        rings=[]
        for x,y,z,rx,rz in levels:
            rings.append([(x+rx*math.cos(TAU*i/sides+phase),y,z+rz*math.sin(TAU*i/sides+phase)) for i in range(sides)])
        for a,b in zip(rings,rings[1:]):
            for j in range(sides):
                k=(j+1)%sides
                self.face([a[j],b[j],b[k],a[k]],palette[j%len(palette)])
        self.face(rings[-1][::-1],palette[0])
        self.face(rings[0],palette[-1])

    def oval(self, x,y,z,rx,ry,rz,color):
        self.rings([(x,y+ry*h,z,rx*r,rz*r) for h,r in [(-1,.15),(-.65,.77),(0,1),(.68,.73),(1,.16)]],[color],8)

    def rod(self, a,b,radius,color,tip=None):
        a,b=Vector(a),Vector(b)
        direction=(b-a).normalized()
        axis=direction.cross(Vector((0,0,1)) if abs(direction.z)<.9 else Vector((0,1,0))).normalized()
        perp=direction.cross(axis)
        ring=[math.cos(i*TAU/7)*axis+math.sin(i*TAU/7)*perp for i in range(7)]
        for i,v in enumerate(ring):
            w=ring[(i+1)%7];r=radius if tip is None else tip
            self.face([a+w*radius,b+w*r,b+v*r,a+v*radius],color)

    def object(self, name):
        mesh=bpy.data.meshes.new(name)
        mesh.from_pydata(self.vertices,[],self.faces);mesh.update()
        obj=bpy.data.objects.new(name,mesh);bpy.context.scene.collection.objects.link(obj)
        layer=mesh.vertex_colors.new(name='Paint')
        for poly,color in zip(mesh.polygons,self.colors):
            for idx in poly.loop_indices:layer.data[idx].color=(*color,1)
        mesh.materials.append(paint)
        return obj

def export(path, objects):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects:o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_animations=False,export_yup=True)

paint=bpy.data.materials.new('Release_Painted');paint.use_nodes=True
# The GLTF exporter writes the active color layer into COLOR_0.
def landscape():
    floor=Batch();rock=Batch();gems=Batch();lanterns=Batch()
    floor.rings([(0,-3,0,67,55),(0,-.025,0,67,55)],['504456'],48)
    # A continuous vaulted shell with a faceted, irregular underside.
    rings=[]
    for radius,height in [(1,0),(.94,11),(.83,22),(.62,31),(.30,37),(.015,40)]:
        ring=[]
        for n in range(44):
            a=TAU*n/44;r=radius*(1+.075*math.sin(a*7)+.045*math.cos(a*3))
            ring.append((52*r*math.cos(a),height+1.9*math.sin(a*5)+rng.uniform(-1.6,1.6),40*r*math.sin(a)))
        rings.append(ring)
    tones=['302c44','383249','443954','51415a','3c3956','49445f']
    for level,(low,high) in enumerate(zip(rings,rings[1:])):
        for i in range(44):
            j=(i+1)%44
            for tri in ((low[i],high[j],high[i]),(low[i],low[j],high[j])):
                rock.face(tri,rng.choice(tones[:4] if level>2 else tones))
    for i in range(88):
        a=rng.uniform(0,TAU);x,z=math.cos(a)*rng.uniform(30,42),math.sin(a)*rng.uniform(25,34)
        h=rng.uniform(2,12);r=rng.uniform(.9,3.4)
        rock.rings([(x,-1,z,r*1.6,r*1.5),(x,.33*h,z,r*.86,r),(x+.6,h,z+.2,.1,.13)],tones,7,a)
        if i%2==0:
            rock.rings([(x,27-h*.65,z,.14,.12),(x,28,z,r*.9,r),(x-.6,31,z,r*1.7,r*1.8)],tones,7,a)
    for x,z in [(-20,12),(25,-14),(5,-23),(-26,-9),(12,22)]:
        for _ in range(10):
            px=x+rng.uniform(-2,2);pz=z+rng.uniform(-2,2);h=rng.uniform(.8,4);r=rng.uniform(.2,.65)
            gems.rings([(px,0,pz,r,r),(px+.25,h*.78,pz+.15,r*.8,r*.8),(px+.45,h,pz+.28,.02,.02)],['41afbc','6786d5','83d7da','6377af'],5)
    for x,z in TORCHES:
        lanterns.rings([(x,0,z,.8,.8),(x,.3,z,.64,.64),(x,2.0,z,.22,.22),(x,2.25,z,.55,.55),(x,2.55,z,.48,.48)],['895442','684444','b18157','77534e'],8)
        lanterns.rings([(x,2.46,z,.28,.27),(x,2.84,z,.35,.36),(x+.06,3.05,z,.26,.26),(x+.23,3.72,z+.09,.015,.018)],['ff852a','ffcc57','ff9633'],7)
    scenery=bpy.data.objects.new('Scenery_Cave',None);bpy.context.scene.collection.objects.link(scenery)
    parts=[rock.object('Vaulted_basalt'),gems.object('Crystal_geodes'),lanterns.object('Pilgrim_braziers')]
    for part in parts:part.parent=scenery
    export(OUT/'cave.glb',[floor.object('Surface_Cavern'),scenery,*parts])

TORCHES=[(-19,10),(19,-10),(-7,-14),(7,15),(-26,-5),(25,6)]
def crowd(kind):
    b=Batch();brown='704635';cream='f5ce97';ink='242335'
    if kind=='capuchin':
        b.oval(0,.69,0,.32,.42,.28,brown);b.oval(0,1.19,.04,.4,.38,.34,brown)
        b.oval(0,1.15,.28,.31,.27,.10,cream);b.oval(0,1.04,.36,.16,.115,.08,'dca780')
        for s in (-1,1):
            b.oval(s*.375,1.19,.04,.13,.15,.10,cream);b.oval(s*.12,1.22,.37,.048,.056,.035,ink)
            b.rod((s*.23,.88,0),(s*.53,1.12,.12),.085,brown);b.oval(s*.55,1.14,.13,.085,.12,.08,cream)
            b.oval(s*.19,.32,.08,.15,.24,.20,brown)
        for a,c in zip([(0,.52,-.15),(0,.41,-.53),(.09,.7,-.79),(.17,.98,-.75)],[(0,.41,-.53),(.09,.7,-.79),(.17,.98,-.75),(.16,.97,-.56)]):b.rod(a,c,.066,brown)
    if kind=='crab':
        b.oval(0,.35,0,.48,.26,.32,'f07351')
        for s in (-1,1):
            for n in range(3):
                z=-.19+n*.16;b.rod((s*.3,.31,z),(s*.65,.24,z-.04),.055,'d95048');b.rod((s*.65,.24,z-.04),(s*.72,.04,z-.08),.045,'d95048',.015)
            b.rod((s*.28,.39,.15),(s*.63,.60,.26),.095,'e35540')
            b.oval(s*.65,.67,.26,.16,.18,.12,'fb8054')
            for d in (-1,1):b.rod((s*.65+d*.07,.70,.27),(s*.65+d*.095,.90,.28),.063,'fb8054',.018)
            b.rod((s*.19,.49,.11),(s*.22,.66,.14),.042,'c95241');b.oval(s*.22,.68,.15,.052,.059,.05,ink)
    if kind=='salamander':
        b.oval(0,.27,0,.29,.19,.49,'4a364b');b.oval(0,.37,.46,.33,.22,.29,'683d4a')
        for n in range(4):b.oval(0,.44-.018*n,.32-.18*n,.11,.05,.08,'ffa438')
        for s in (-1,1):
            b.oval(s*.21,.52,.57,.066,.06,.06,'ffc95d')
            for z in (-.22,.21):b.rod((s*.16,.22,z),(s*.48,.06,z+.10),.076,'9b5147',.05)
        b.rod((0,.25,-.32),(.09,.25,-.77),.16,'4a364b',.1);b.rod((.09,.25,-.77),(.36,.31,-1.03),.10,'f19b43',.019)
    if kind=='bat':
        b.oval(0,.05,0,.20,.34,.18,'56426e')
        for s in (-1,1):
            b.rod((s*.12,.28,0),(s*.19,.55,0),.085,'77577e',.012);b.oval(s*.075,.17,.16,.034,.045,.03,'ffd394')
            shoulder=(s*.13,.16,0);elbow=(s*.51,.40,-.06);tip=(s*1.05,.16,.02)
            for a,c,color in [(shoulder,(s*.34,-.19,.04),'794e81'),((s*.34,-.19,.04),(s*.60,.015,-.04),'9a6791'),((s*.60,.015,-.04),(s*.75,-.08,.06),'825a80'),((s*.75,-.08,.06),tip,'a47799')]:
                b.face([elbow,a,c],color);b.face([elbow,c,a],color)
    return b.object(kind)

def pack_animal(name):
    cache=Path(tempfile.gettempdir())/'neck-crowd';cache.mkdir(exist_ok=True)
    path=cache/(name+'.glb')
    if not path.exists():
        urllib.request.urlretrieve('https://raw.githubusercontent.com/trebeljahr/quaternius-showcase/0128ca510d653bb04d6d1e4885bd8890b5050b4f/public/glb/animals_pack/'+name+'.glb',str(path))
    before=set(bpy.data.objects);bpy.ops.import_scene.gltf(filepath=str(path))
    mesh=next(o for o in set(bpy.data.objects)-before if o.type=='MESH')
    bpy.context.view_layer.update()
    m=mesh.evaluated_get(bpy.context.evaluated_depsgraph_get())
    coords=[m.matrix_world@v.co for v in m.data.vertices]
    hmin=min(v.z for v in coords);scale=1.5/(max(v.z for v in coords)-hmin)
    cx=(min(v.x for v in coords)+max(v.x for v in coords))*.5
    cy=(min(v.y for v in coords)+max(v.y for v in coords))*.5
    batch=Batch()
    for face in m.data.polygons:
        mat=m.data.materials[face.material_index];node=next(n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
        color=node.inputs['Base Color'].default_value[:3]
        # GLTF COLOR_0 receives linearized vertex paint from Blender.
        tint=tuple(max(0,min(1,c))**(1/2.2) for c in color)
        batch.face([((coords[i].x-cx)*scale,(coords[i].z-hmin)*scale,-(coords[i].y-cy)*scale) for i in face.vertices],tint)
    return batch.object(name.lower())

landscape()
animals=[crowd(k) for k in ['capuchin','crab','salamander','bat']]
animals.extend(pack_animal(n) for n in ['Fox','Alpaca'])

def landmarks():
    mill=Batch();rotor=Batch();station=Batch();gondola=Batch();chimney=Batch()
    # The windmill's shingled tower and four timber-framed linen sails.
    mill.rings([(0,-.6,0,2.15,2.15),(0,1,0,1.9,1.9),(0,6.8,0,1.25,1.25)],['e9c99a','ebd7af','d5aa85','f3dbad'],10)
    mill.rings([(0,6.7,0,1.65,1.65),(0,7.5,0,1.38,1.38),(.25,9,0,.09,.09)],['98545b','bf7764','8b4a58'],10)
    for h in (1.05,6.4):mill.rings([(0,h,0,1.97 if h<2 else 1.38,1.97 if h<2 else 1.38),(0,h+.14,0,1.97 if h<2 else 1.38,1.97 if h<2 else 1.38)],['88544e'],10)
    for side in (-1,1):
        mill.face([(side*.88,2,1.51),(side*.48,2,1.58),(side*.48,3.04,1.58),(side*.88,3.04,1.51)],'694956')
    for n in range(4):
        a=n*TAU/4+.38;dx,dy=math.sin(a),math.cos(a)
        def sail(h,w):return(dx*h+dy*w,dy*h-dx*w,0)
        rotor.rod(sail(.05,0),sail(4,0),.095,'844d44',.065)
        for j in range(5):
            r=.98+j*.58;wid=.84+j*.055
            rotor.face([sail(r,.1),sail(r+.52,.1),sail(r+.52,wid),sail(r,wid*.96)],'fff0bc' if j!=3 else 'e9a383')
        rotor.rod(sail(.98,.81),sail(3.9,1.02),.047,'b47954')
    rotor.oval(0,0,.05,.36,.36,.25,'744845')
    # High alpine cable crossing with deep red panoramic lift.
    for x,h in [(-18,9),(18,12)]:
        for foot in (-1,1):
            station.rod((x+foot*1.1,0,0),(x+foot*.44,h,0),.22,'667887')
        station.rod((x-1.8,h,0),(x+1.8,h,0),.22,'566576')
        for j in range(3):
            station.rod((x-.9,j*2.25+1,0),(x+.75,(j+1)*2.25+1,0),.095,'7f929a')
    def y(x):return 10.5+x/12-2*(1-(x/18)**2)
    for j in range(12):
        a=-18+j*3;z=a+3;station.rod((a,y(a),0),(z,y(z),0),.065,'495367')
    gondola.rod((0,0,0),(0,-1.25,0),.085,'57616b')
    gondola.rings([(0,-3.05,0,.99,.58),(0,-2.8,0,1.48,.83),(0,-2.32,0,1.5,.85)],['cd534c','e86b54'],8)
    gondola.rings([(0,-2.30,0,1.5,.85),(0,-1.4,0,1.27,.73)],['76aab5','a3cdd0','719aa8'],8)
    gondola.rings([(0,-1.48,0,1.34,.76),(0,-1.20,0,1.18,.69)],['d85b49','e38766'],8)
    # A broken basalt caldera with orange seams and mineral crust at its lip.
    for i in range(32):
        angle=i*TAU/32;rr=rng.uniform(2.6,5);x=math.sin(angle)*rr;z=math.cos(angle)*rr
        height=rng.uniform(2.2,5.7)+max(0,-x*.65);r=rng.uniform(.72,1.22)
        chimney.rings([(x,-.7,z,r*1.45,r*1.45),(x,height*.78,z,r,r),(x+.15,height,z+.1,r*.88,r*.88)],['51425a','684c59','4d4051','756071'],6)
        if i%4==0:
            chimney.rings([(x+.1,height-.21,z+.1,r*.96,r*.96),(x+.15,height-.11,z+.1,r*.95,r*.95)],['ffa24f','ff7542'],6)
    return [mill.object('meadowMill'),rotor.object('meadowSails'),station.object('mountainCable'),gondola.object('mountainCar'),chimney.object('volcanoVents')]
export(OUT/'courtside-wildlife.glb',animals+landmarks())


