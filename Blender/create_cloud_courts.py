import bpy, math, random, os, json, shutil
import numpy as np
from mathutils import Vector
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCE = os.environ.get('QUATERNIUS_SOURCE', os.path.join(BASE, 'public', 'quaternius', 'nature'))
TEX = BASE + '/public/textures'
random.seed(8361)
# This background process preserves all existing scenes and adds one isolated studio.
original_scene_names = [s.name for s in bpy.data.scenes]
scene = bpy.data.scenes.new('CloudCourt_Studio')
bpy.context.window.scene = scene
scene.render.engine = 'CYCLES'; scene.cycles.samples = 12
scene.world = bpy.data.worlds.new('CloudCourt_SoftSky'); scene.world.use_nodes = True
scene.world.node_tree.nodes['Background'].inputs[0].default_value = (.52,.73,.79,1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value = .7

def coord(p): return (p[0],-p[2],p[1])
def texture(name, base, kind):
    size=256; y,x=np.mgrid[0:size,0:size].astype(np.float32); u=x/size;v=y/size
    field=np.zeros((size,size),dtype=np.float32)
    for k,amp in [(3,.55),(7,.25),(19,.12),(43,.07)]:
        phase=random.random()*6.28
        field+=amp*np.sin(u*k*6.28+np.cos(v*(k+2)*6.28)*.55+phase)*np.cos(v*k*6.28+phase)
    if kind=='wood': field+=.42*np.sin(u*6.28*15+np.sin(v*6.28*2)*1.3)+.13*np.sin(u*6.28*53)
    if kind=='rock': field+=.3*np.sin(v*6.28*7+np.sin(u*6.28*2))+.1*np.sin((u+v*.3)*6.28*31)
    if kind=='water': field=.42*np.sin(u*6.28*11+np.sin(v*6.28*2)*.6)+.17*np.sin((u*17+v*2)*6.28)
    rgba=np.ones((size,size,4),dtype=np.float32)
    for i,b in enumerate(base): rgba[:,:,i]=np.clip(b+field*.075,0,1)
    image=bpy.data.images.new(name,width=size,height=size,alpha=True);image.pixels.foreach_set(rgba.ravel());image.filepath_raw=TEX+'/'+name+'.png';image.file_format='PNG';image.save();return image
rockImage=texture('painted-sky-stone',(.46,.58,.66),'rock')
woodImage=texture('painted-honey-wood',(.72,.49,.25),'wood')
cloudImage=texture('painted-cloud-cream',(.92,.95,.88),'cloud')
waterImage=texture('painted-turquoise-water',(.24,.74,.75),'water')
# Convert the generated diffuse image once for the shipping, mobile-sized texture.
grassOriginal=bpy.data.images.load(BASE+'/Blender/painted-meadow-source.png',check_existing=True);grassOriginal.pack()
grassImage=grassOriginal.copy();grassImage.name='PaintedMeadow_Runtime';grassImage.scale(1024,1024);grassImage.filepath_raw=TEX+'/painted-meadow.jpg';grassImage.file_format='JPEG';grassImage.save()

def mat(name,color,image=None):
    material=bpy.data.materials.new(name);material.diffuse_color=(*color,1);material.use_nodes=True
    bsdf=material.node_tree.nodes.get('Principled BSDF');bsdf.inputs['Base Color'].default_value=(*color,1);bsdf.inputs['Roughness'].default_value=.85
    if image:
        node=material.node_tree.nodes.new('ShaderNodeTexImage');node.image=image;node.interpolation='Linear';material.node_tree.links.new(node.outputs['Color'],bsdf.inputs['Base Color'])
    return material
M={
'grass':mat('Painterly_Meadow',(.8,.95,.57),grassImage),
'rock':mat('Painterly_SkyStone',(.48,.59,.65),rockImage),
'moss':mat('Mint_Moss_Lip',(.37,.65,.45)),
'wood':mat('Painterly_HoneyWood',(.72,.49,.25),woodImage),
'cloud':mat('Painterly_CloudCream',(.94,.97,.91),cloudImage),
'water':mat('Painterly_TurquoiseWater',(.25,.77,.78),waterImage),
'ivory':mat('Warm_Ivory',(.99,.9,.65)),
'peach':mat('Coral_Canvas',(.94,.53,.37)),
'mint':mat('Mint_Canvas',(.35,.71,.61)),
'gold':mat('Honey_Gold',(.96,.73,.28)),
'blue':mat('Sky_Blue_Paint',(.36,.65,.74)),
}

def collection(name):
    c=bpy.data.collections.new(name);scene.collection.children.link(c);return c
arena=collection('CloudMeadowArena');lobby=collection('CloudGardenLobby');current=arena

def mesh(name,verts,faces,material,uv=None):
    data=bpy.data.meshes.new(name+'Mesh');data.from_pydata([coord(v) for v in verts],[],faces);data.update()
    obj=bpy.data.objects.new(name,data);current.objects.link(obj);obj.data.materials.append(material)
    if uv:
        layer=data.uv_layers.new(name='PainterlyUV')
        for polygon in data.polygons:
            for loop in polygon.loop_indices:layer.data[loop].uv=uv[data.loops[loop].vertex_index]
    return obj

def ellipsoid(name,c,s,material,segments=16,rings=9):
    verts=[];faces=[];uv=[]
    for j in range(rings+1):
        p=-math.pi/2+math.pi*j/rings
        for i in range(segments+1):
            a=i*math.tau/segments;verts.append((c[0]+s[0]*math.cos(p)*math.cos(a),c[1]+s[1]*math.sin(p),c[2]+s[2]*math.cos(p)*math.sin(a)));uv.append((i/segments,j/rings))
    for j in range(rings):
        for i in range(segments):
            a=j*(segments+1)+i;faces.append((a,a+segments+1,a+segments+2,a+1))
    obj=mesh(name,verts,faces,material,uv)
    for f in obj.data.polygons:f.use_smooth=True
    return obj

def box(name,c,s,material,bevel=.07):
    bpy.ops.mesh.primitive_cube_add(size=1,location=coord(c));obj=bpy.context.object;obj.name=name;obj.scale=(s[0],s[2],s[1]);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    for coll in list(obj.users_collection):coll.objects.unlink(obj)
    current.objects.link(obj);obj.data.materials.append(material)
    if bevel:
        mod=obj.modifiers.new('RoundedPaintEdges','BEVEL');mod.width=min(bevel,min(s)*.24);mod.segments=2
        bpy.context.view_layer.objects.active=obj;bpy.ops.object.modifier_apply(modifier=mod.name)
    return obj

def beam(name,a,b,r,material):
    start=Vector(coord(a));end=Vector(coord(b));mid=(start+end)/2
    bpy.ops.mesh.primitive_cylinder_add(vertices=10,radius=r,depth=(end-start).length,location=mid)
    obj=bpy.context.object;obj.name=name;obj.rotation_euler=(end-start).to_track_quat('Z','Y').to_euler()
    for coll in list(obj.users_collection):coll.objects.unlink(obj)
    current.objects.link(obj);obj.data.materials.append(material)
    return obj

def island(name,c,rx,rz,depth,segments=64):
    # Broad flat meadow, scalloped grass lip and hand-painted faceted sky stone.
    verts=[(c[0],c[1]-.04,c[2])];uv=[(.5,.5)]
    radii=[]
    for i in range(segments):
        a=i*math.tau/segments;r=1+.026*math.sin(a*5)+.017*math.cos(a*9);radii.append(r);verts.append((c[0]+math.cos(a)*rx*r,c[1]-.04,c[2]+math.sin(a)*rz*r));uv.append((.5+math.cos(a)*.5,.5+math.sin(a)*.5))
    top=mesh(name+'_PaintedMeadow',verts,[(0,(i+1)%segments+1,i+1) for i in range(segments)],M['grass'],uv)
    for layer,material in [('GrassLip',M['moss']),('Rock',M['rock'])]:
        rings=[(-.05,1),(-.4,1.025),(-.85,.995)] if layer=='GrassLip' else [(-.75,.995),(-depth*.2,.96),(-depth*.42,.84),(-depth*.7,.61),(-depth*.91,.28),(-depth,.04)]
        vv=[];ff=[];tt=[]
        for j,(y,radius) in enumerate(rings):
            for i in range(segments+1):
                k=i%segments;a=k*math.tau/segments;rr=radii[k]*radius;vv.append((c[0]+math.cos(a)*rx*rr,c[1]+y+.1*math.sin(a*7+j)*j/len(rings),c[2]+math.sin(a)*rz*rr));tt.append((i/segments*6,j/(len(rings)-1)*2))
        for j in range(len(rings)-1):
            for i in range(segments):
                a=j*(segments+1)+i;ff.append((a,a+1,a+segments+2,a+segments+1))
        mesh(name+'_'+layer,vv,ff,material,tt)
    return top

def cloud_bank(name,c,s,count=9):
    for i in range(count):
        a=i*2.4;rr=(i%3)*.22
        ellipsoid(name+'_%02d'%i,(c[0]+math.cos(a)*s[0]*rr,c[1]+math.sin(i)*s[1]*.22,c[2]+math.sin(a)*s[2]*rr),(s[0]*(.35+random.random()*.18),s[1]*(.65+random.random()*.2),s[2]*(.35+random.random()*.18)),M['cloud'],14,8)

def waterfall(name,x,z,top,drop,width):
    verts=[];uv=[];faces=[]
    for j in range(13):
        t=j/12;y=top-drop*t;zz=z+math.sin(t*1.1)*.42
        for i in range(5):
            u=i/4;verts.append((x+(u-.5)*width*(1+t*.22),y,zz+.09*math.sin(i*2+t*9)));uv.append((u*2,t*4))
    for j in range(12):
        for i in range(4):a=j*5+i;faces.append((a,a+5,a+6,a+1))
    water=mesh(name,verts,faces,M['water'],uv)
    for i in range(5):ellipsoid(name+'_Mist'+str(i),(x+(random.random()-.5)*width*1.4,top-drop+.3+random.random()*.4,z+.4),(width*.35,.25,width*.25),M['cloud'],12,7)
    return water

island('SkyMeadow_Arena',(0,0,0),42,38,12,72)
waterfall('Arena_SilverFalls',25,27,-.05,13,4)
waterfall('Arena_MintFalls',-29,-23,-.05,11,3)
for i in range(10):
    a=i*math.tau/10;cloud_bank('Arena_CloudSkirt'+str(i),(math.cos(a)*43,-8.5,math.sin(a)*37),(8,1.9,6),5)
# Small sculpted floating stepping stones orbit below the grassy stadium.
for i in range(7):
    a=i*math.tau/7+.4;ellipsoid('Floating_SkyPebble'+str(i),(math.cos(a)*34,-13-random.random()*4,math.sin(a)*30),(2+random.random()*2,1.4+random.random(),2+random.random()*2),M['rock'],12,7)

current=lobby
island('CloudGarden_Main',(0,0,0),13.4,10.3,7.7,64)
island('CloudGarden_ShopWing',(-10.2,-.22,-1),4.2,4,4.8,36)
island('CloudGarden_PowersWing',(9.4,.1,-2),4,3.8,5.4,36)
waterfall('Lobby_RainbowFalls',-3.8,9.6,-.05,9,2.1)
# Curved, rounded portal of actual painted stone.
for i in range(13):
    a=math.pi*i/12;ellipsoid('CloudArch_Stone'+str(i),(math.cos(a)*2.35,1.6+math.sin(a)*2.65,-5.6),(.48,.47,.49),M['cloud'],14,9)
for x in [-2.35,2.35]:
    beam('Portal_WoodPillar',(x,.05,-5.6),(x,1.8,-5.6),.18,M['wood'])
    box('Portal_GoldFoot',(x,.15,-5.6),(.65,.3,.7),M['gold'])
box('Portal_EntryStep',(0,.08,-4.7),(4.8,.2,1.4),M['ivory'])
# The skin shop is a little cloth market stall, with a painted honey-wood counter.
for x in [-9.4,-5.7]:beam('Shop_CanopyPost',(x,.1,.2),(x,3.1,.2),.09,M['wood'])
box('Shop_Counter',(-7.55,.66,.45),(3.8,1.15,1.25),M['wood'])
for i in range(8):
    x=-9.55+(i+.5)*.5
    roof=box('Shop_CanvasStripe'+str(i),(x,2.95,.0),(.5,.16,2.25),M['peach'] if i%2 else M['ivory']);roof.rotation_euler[0]=.1
for i in range(3):ellipsoid('Shop_DyeJar'+str(i),(-8.5+i*.9,1.45,.4),(.25,.3,.25),M[['mint','peach','gold'][i]],14,8)
# Powers shrine: a sculpted crystal above a sunburst plinth.
box('Powers_Platform',(7,.24,-1.8),(3.8,.45,3.3),M['rock'])
box('Powers_GoldPlinth',(7,.75,-1.8),(1.25,.6,1.25),M['gold'])
verts=[(7,1.15,-1.8),(7,3.1,-1.8),(6.45,2.05,-1.8),(7.55,2.05,-1.8),(7,2.05,-2.35),(7,2.05,-1.25)]
faces=[(1,2,4),(1,4,3),(1,3,5),(1,5,2),(0,4,2),(0,3,4),(0,5,3),(0,2,5)]
mesh('Powers_HoneyCrystal',verts,faces,M['blue'])
# Party dock: toy airmail box and paper aeroplane on a curved wooden quay.
box('Party_Dock',(1.2,.1,6.6),(4.6,.22,2.8),M['wood'])
beam('Party_Post',(1.2,.1,6.5),(1.2,1.55,6.5),.15,M['wood'])
box('Party_AirmailBox',(1.2,1.9,6.5),(1.55,1.0,.9),M['mint'])
box('Party_LetterSlot',(1.2,1.96,7.0),(.8,.12,.06),M['wood'],.01)
mesh('Party_PaperPlane',[(-.1,3,6.6),(2.2,3,6.4),(1.1,3.2,5.8),(1.1,2.8,6.0)],[(0,1,2),(0,3,1)],M['ivory'])
# Resting pads, rounded steps, a few clouds and lanterns tie the plaza together.
for i in range(7):
    x=-5+i*1.5;box('Lobby_SteppingStone'+str(i),(x,.035,3.8+math.sin(i*.6)*.25),(1.0,.08,.73),M['ivory'],.15)
for x,z in [(-5,4.7),(5.4,4.4),(-4.8,-2.5),(3.6,-3.2)]:
    ellipsoid('Lounge_Cushion',(x,.13,z),(1.1,.18,.78),M['mint'] if x<0 else M['peach'],18,9)
for i in range(11):
    a=i*math.tau/11;cloud_bank('Lobby_CloudSkirt'+str(i),(math.cos(a)*13,-5.3,math.sin(a)*10),(4.1,1.1,3.1),5)
for x,z in [(-10,5.8),(9.4,4.8),(-4,-6.7),(4.5,-6.7)]:
    beam('Lantern_Post',(x,0,z),(x,2.5,z),.055,M['wood']);ellipsoid('Lantern_Glass',(x,2.22,z),(.24,.33,.24),M['gold'],12,8)

# Export each isolated collection, preserving original scene contents in the .blend.
def export_collection(coll,path):
    export_coll=bpy.data.collections.new(coll.name+'_Export');scene.collection.children.link(export_coll)
    copies=[]
    bpy.ops.object.select_all(action='DESELECT')
    for source in coll.objects:
        if source.type!='MESH':continue
        obj=source.copy();obj.data=source.data.copy();export_coll.objects.link(obj);obj.select_set(True);copies.append(obj)
    bpy.context.view_layer.objects.active=copies[0];bpy.ops.object.join();joined=bpy.context.object;joined.name=coll.name+'_JoinedRuntime'
    bpy.ops.export_scene.gltf(filepath=path,export_format='GLB',use_selection=True,use_active_scene=True,export_yup=True,export_apply=True,export_image_format='AUTO',export_materials='EXPORT')
    joined.select_set(False);export_coll.hide_render=True;export_coll.hide_viewport=True
export_collection(arena,BASE+'/public/models/cloud-meadow-arena.glb')
export_collection(lobby,BASE+'/public/models/cloud-garden-lobby.glb')
# Optimize the licensed pack's original textures to a mobile-friendly shared 512px.
qout=BASE+'/public/quaternius/nature';os.makedirs(qout,exist_ok=True)
for filename in os.listdir(SOURCE):
    src=SOURCE+'/'+filename;dst=qout+'/'+filename
    if os.path.abspath(src)==os.path.abspath(dst): continue
    if filename.lower().endswith('.png'):
        image=bpy.data.images.load(src,check_existing=False);image.scale(min(512,image.size[0]),min(512,image.size[1]));image.filepath_raw=dst;image.file_format='PNG';image.save()
    else:shutil.copyfile(src,dst)
# Retain an editable source scene and a staged render camera.
bpy.ops.object.select_all(action='DESELECT')
camera_data=bpy.data.cameras.new('CloudGarden_PreviewCamera');camera=bpy.data.objects.new('CloudGarden_PreviewCamera',camera_data);scene.collection.objects.link(camera);camera.location=coord((20,17,25));camera.rotation_euler=(Vector(coord((0,0,0)))-camera.location).to_track_quat('-Z','Y').to_euler();scene.camera=camera;camera_data.type='ORTHO';camera_data.ortho_scale=37
light_data=bpy.data.lights.new('CloudGarden_PreviewSun','AREA');light=bpy.data.objects.new('CloudGarden_PreviewSun',light_data);scene.collection.objects.link(light);light.location=coord((-8,15,12));light_data.energy=1800;light_data.shape='DISK';light_data.size=10;light.rotation_euler=(Vector(coord((0,0,0)))-light.location).to_track_quat('-Z','Y').to_euler()
# The preview hides only this new scene's arena collection, not any source data.
arena.hide_render=True
scene.render.resolution_x=1100;scene.render.resolution_y=850;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.render.filepath=BASE+'/Blender/cloud-garden-preview.png'
bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=BASE+'/Blender/cloud-courts.blend')
bpy.ops.render.render(write_still=True)
result={'preserved_scenes':original_scene_names,'new_scene':scene.name,'arena_objects':len(arena.objects),'lobby_objects':len(lobby.objects),'arena_glb_bytes':os.path.getsize(BASE+'/public/models/cloud-meadow-arena.glb'),'lobby_glb_bytes':os.path.getsize(BASE+'/public/models/cloud-garden-lobby.glb'),'optimized_pack_bytes':sum(os.path.getsize(qout+'/'+f) for f in os.listdir(qout)),'source':BASE+'/Blender/cloud-courts.blend','preview':scene.render.filepath}
