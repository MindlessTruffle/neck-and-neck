"""Non-destructive Blender MCP authoring: six sculpted stages, licensed foliage.

Coordinates in helpers use the game's Y-up space. Exports are joined by category
and material; original authored collections remain editable in the saved blend.
"""
import bpy, math, random, os, json
from mathutils import Vector

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = BASE + '/public/models/worlds'
os.makedirs(OUT, exist_ok=True)
random.seed(131126)
scene = bpy.data.scenes.new('Release_SkyHarbour')
bpy.context.window.scene = scene
scene.world = bpy.data.worlds.new('Release_WarmSky')
scene.world.use_nodes = True
scene.world.node_tree.nodes['Background'].inputs[0].default_value = (.46,.69,.82,1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value = .7
scene.render.engine = 'CYCLES'
scene.cycles.samples = 16
scene.view_settings.view_transform = 'AgX'
def xyz(p): return (p[0],-p[2],p[1])
materials={}
def mat(name,hexcolor,texture=None,glow=False):
    key=(name,hexcolor)
    if key in materials:return materials[key]
    c=tuple(int(hexcolor[i:i+2],16)/255 for i in (1,3,5))
    # Store linear pigment, so glTF and Blender share the intended sRGB palette.
    c=tuple(((v+.055)/1.055)**2.4 if v>.04045 else v/12.92 for v in c)
    m=bpy.data.materials.new('Release_'+name);m.diffuse_color=(*c,1);m.use_nodes=True
    bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*c,1);bs.inputs['Roughness'].default_value=.82
    if texture:
        n=m.node_tree.nodes.new('ShaderNodeTexImage');n.image=bpy.data.images.load(BASE+'/public/textures/'+texture,check_existing=True)
        mix=m.node_tree.nodes.new('ShaderNodeMixRGB');mix.blend_type='MULTIPLY';mix.inputs[0].default_value=.24;mix.inputs[1].default_value=(*c,1)
        m.node_tree.links.new(n.outputs['Color'],mix.inputs[2]);m.node_tree.links.new(mix.outputs[0],bs.inputs['Base Color'])
        # glTF cannot export MixRGB. Runtime applies the shared pigment texture.
    if glow:bs.inputs['Emission Color'].default_value=(*c,1);bs.inputs['Emission Strength'].default_value=.7
    materials[key]=m;return m
cream=mat('Ivory','#fff0ca');wood=mat('HoneyWood','#ae7048');darkwood=mat('DarkWood','#624735');gold=mat('Brass','#e5b650');coral=mat('Coral','#e77e68');mint=mat('Mint','#69bcb0');purple=mat('Crystal','#af79de',glow=True);water=mat('Water','#55c7ca',glow=True)
cloud=mat('Cloud','#fff4e3');leaf=mat('PalmLeaf','#51a77c');sand=mat('Sand','#efd8a3');lava=mat('Lava','#ff9847',glow=True)
current=None;category='Scenery'
def mesh(name,verts,faces,material,smooth=False):
    data=bpy.data.meshes.new(name);data.from_pydata([xyz(v) for v in verts],[],faces);data.update()
    obj=bpy.data.objects.new(category+'_'+name,data);current.objects.link(obj);data.materials.append(material)
    for f in data.polygons:f.use_smooth=smooth
    uv=data.uv_layers.new(name='UVMap')
    for poly in data.polygons:
        for li in poly.loop_indices:
            v=data.vertices[data.loops[li].vertex_index].co;uv.data[li].uv=(v.x*.065,v.y*.065)
    return obj
def move_to(obj,name,material):
    for coll in list(obj.users_collection):coll.objects.unlink(obj)
    current.objects.link(obj);obj.name=category+'_'+name;obj.data.materials.clear();obj.data.materials.append(material);return obj
def box(name,p,s,m,bevel=.08,angle=0):
    bpy.ops.mesh.primitive_cube_add(size=1,location=xyz(p));o=move_to(bpy.context.object,name,m);o.scale=(s[0],s[2],s[1]);o.rotation_euler.z=-angle
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if bevel:
        mod=o.modifiers.new('Soft hand-carved edges','BEVEL');mod.width=bevel;mod.segments=2
        bpy.ops.object.modifier_apply(modifier=mod.name)
        n=o.modifiers.new('Weighted corner normals','WEIGHTED_NORMAL');bpy.ops.object.modifier_apply(modifier=n.name)
    return o
def ellipsoid(name,p,s,m):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=16,ring_count=8,location=xyz(p));o=move_to(bpy.context.object,name,m);o.scale=(s[0],s[2],s[1]);
    for f in o.data.polygons:f.use_smooth=True
    return o
def beam(name,a,b,r,m):
    va,vb=Vector(xyz(a)),Vector(xyz(b));bpy.ops.mesh.primitive_cylinder_add(vertices=10,radius=r,depth=(vb-va).length,location=(va+vb)*.5);o=move_to(bpy.context.object,name,m);o.rotation_euler=(vb-va).to_track_quat('Z','Y').to_euler();return o
def tube(name,points,r,m):
    curve=bpy.data.curves.new(name,'CURVE');curve.dimensions='3D';curve.resolution_u=8;curve.bevel_depth=r;curve.bevel_resolution=2
    sp=curve.splines.new('BEZIER');sp.bezier_points.add(len(points)-1)
    for q,p in zip(sp.bezier_points,points):q.co=xyz(p);q.handle_left_type=q.handle_right_type='AUTO'
    o=bpy.data.objects.new(category+'_'+name,curve);current.objects.link(o);curve.materials.append(m)
    bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o;bpy.ops.object.convert(target='MESH');return bpy.context.object
def island(rx,rz,ground,stone):
    global category
    category='Surface';n=72;radii=[1+.026*math.sin(i*.77)+.018*math.sin(i*1.63) for i in range(n)]
    # Flat, unobstructed playable center, sculpted irregular outer silhouette.
    verts=[(0,-.06,0)]+[(math.cos(i*math.tau/n)*rx*radii[i],-.06,math.sin(i*math.tau/n)*rz*radii[i]) for i in range(n)]
    mesh('PaintedGround',verts,[(0,(i+1)%n+1,i+1) for i in range(n)],ground)
    rings=[(-.12,1),(-.7,1.025),(-1.4,.99),(-3.2,.92),(-5.2,.78),(-7.4,.40),(-8.2,.04)]
    verts=[];faces=[]
    for j,(y,rr) in enumerate(rings):
        for i in range(n):
            a=i*math.tau/n;rad=radii[i]*(rr+.014*math.sin(i*2+j));verts.append((math.cos(a)*rx*rad,y+.12*math.sin(i*.9+j)*(j>0),math.sin(a)*rz*rad))
    for j in range(len(rings)-1):
        for i in range(n):a=j*n+i;b=j*n+(i+1)%n;faces.append((a,b,b+n,a+n))
    cliff=mesh('StratifiedCliff',verts,faces,stone)
    colors=cliff.data.color_attributes.new(name='Color',type='FLOAT_COLOR',domain='CORNER')
    for poly in cliff.data.polygons:
        for li in poly.loop_indices:
            v=cliff.data.vertices[cliff.data.loops[li].vertex_index].co;shade=.64+.31*max(0,min(1,(v.z+8)/8));shade+=.045*math.sin(v.x*.8+v.y*.4)
            colors.data[li].color=(shade,shade,shade,1)
    category='Scenery'
    for i in range(7):
        a=i*math.tau/7
        for j in range(3):ellipsoid('CloudBank',(math.cos(a)*rx+math.sin(j*2)*1.7,-5+j*.35,math.sin(a)*rz+math.cos(j*3)*1.7),(3.1,1.3,2.3),cloud)
def ribbon(name,points,width,m):
    verts=[]
    for i,p in enumerate(points):
        before=points[max(0,i-1)];after=points[min(len(points)-1,i+1)];dx=after[0]-before[0];dz=after[2]-before[2];d=max(.001,math.hypot(dx,dz))
        verts += [(p[0]-dz/d*width*.5,p[1],p[2]+dx/d*width*.5),(p[0]+dz/d*width*.5,p[1],p[2]-dx/d*width*.5)]
    return mesh(name,verts,[(i*2,i*2+1,i*2+3,i*2+2) for i in range(len(points)-1)],m)

# Import licensed models once; instances below are copies, originals preserved.
sources={}
source_collection=bpy.data.collections.new('Release_LicensedSources');scene.collection.children.link(source_collection)
for key,path in {'oak':'kenney/nature/tree_oak.glb','pine':'kenney/nature/tree_pineTallA_detailed.glb','rock':'kenney/nature/rock_largeA.glb','flower':'kenney/nature/flower_yellowA.glb','bush':'kenney/nature/plant_bushDetailed.glb','fern':'quaternius/nature/Fern_1.gltf','tree':'quaternius/nature/CommonTree_2.gltf','twisted':'quaternius/nature/TwistedTree_1.gltf'}.items():
    before=set(bpy.data.objects);bpy.ops.import_scene.gltf(filepath=BASE+'/public/'+path);new=[o for o in bpy.data.objects if o not in before]
    parts=[]
    for o in new:
        if o.type=='MESH':
            o.data=o.data.copy();o.data.transform(o.matrix_world);o.parent=None;o.matrix_world.identity();parts.append(o)
        for c in list(o.users_collection):c.objects.unlink(o)
        source_collection.objects.link(o)
    if key in ['tree','twisted']:
        for o in parts:
            bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
            mod=o.modifiers.new('Foliage silhouette LOD','DECIMATE');mod.ratio=.4;bpy.ops.object.modifier_apply(modifier=mod.name)
    sources[key]=parts
source_collection.hide_render=True;source_collection.hide_viewport=True
def asset(key,x,z,height,angle=0):
    parts=sources[key];coords=[v.co for o in parts for v in o.data.vertices];low=min(v.z for v in coords);high=max(v.z for v in coords);scale=height/max(.001,high-low)
    for source in parts:
        o=source.copy();o.data=source.data;current.objects.link(o);o.hide_render=False;o.hide_viewport=False;o.name=category+'_Pack_'+key;o.location=xyz((x,-low*scale,z));o.scale=(scale,scale,scale);o.rotation_euler.z=angle
def canopy(x,z,color):
    for dx in [-2.3,2.3]:beam('CanopyPost',(x+dx,0,z),(x+dx,4.3,z),.12,wood)
    for i in range(10):
        xx=x-2.5+i*.5
        ribbon('ScallopedCanvas',[(xx,4.5,z-1.4),(xx,4.9,z-.5),(xx,4.4,z+1),(xx,4,z+1.65)],.52,color if i%2 else cream)
    box('ShopCounter',(x,.7,z+.2),(4.6,1.3,1.4),wood,.12)
    for dx in [-1.4,0,1.4]:ellipsoid('DyeBottle',(x+dx,1.65,z+.2),(.35,.45,.35),mint if dx<0 else coral if dx>0 else gold)
def palm(x,z,height):
    tube('PalmTrunk',[(x,0,z),(x+.4,height*.45,z),(x+1,height,z+.3)],.24,wood)
    for j in range(7):
        a=j*math.tau/7;pts=[]
        for k in range(7):
            t=k/6;pts.append((x+1+math.cos(a)*t*3.7,height+.8*math.sin(t*math.pi)-t*.8,z+.3+math.sin(a)*t*3.7))
        verts=[]
        for k,p in enumerate(pts):
            w=math.sin(k/6*math.pi)*.65;verts.extend([(p[0]-math.sin(a)*w,p[1]-.1,p[2]+math.cos(a)*w),(p[0],p[1]+.1,p[2]),(p[0]+math.sin(a)*w,p[1]-.1,p[2]-math.cos(a)*w)])
        mesh('SculptedPalmFrond',verts,[(k*3+j,k*3+j+3,k*3+j+4,k*3+j+1) for k in range(6) for j in range(2)],leaf,True)
def peak(x,z,r,h,stone,snow=False):
    n=13;verts=[];faces=[]
    for j,(y,rr) in enumerate([(0,1),(h*.42,.68),(h*.73,.32),(h,.015)]):
        for i in range(n):a=i*math.tau/n;v=1+.15*math.sin(i*2.7+j);verts.append((x+math.cos(a)*r*rr*v,y,z+math.sin(a)*r*rr*v))
    for j in range(3):
        for i in range(n):faces.append((j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i))
    o=mesh('ChiselledPeak',verts,faces,stone)
    if snow:
        o.data.materials.append(cream)
        for p in o.data.polygons:
            if p.index>=n*2:p.material_index=1
    return o
def export(coll,name):
    copies=[];bpy.ops.object.select_all(action='DESELECT')
    exp=bpy.data.collections.new('Runtime_'+name);scene.collection.children.link(exp)
    # Separate categories preserve whole-map breakup and animated water.
    for cat in ['Surface','Scenery','Water']:
        items=[]
        for source in list(coll.objects):
            if source.type!='MESH' or not source.name.startswith(cat+'_'):continue
            o=source.copy();o.data=source.data.copy();exp.objects.link(o);o.select_set(True);items.append(o)
        if not items:continue
        bpy.context.view_layer.objects.active=items[0];bpy.ops.object.join();o=bpy.context.object;o.name=cat+'_'+name;copies.append(o);
        if name=='jungle' and cat=='Scenery':
            mod=o.modifiers.new('Runtime foliage budget','DECIMATE');mod.ratio=.85;bpy.ops.object.modifier_apply(modifier=mod.name)
        o.select_set(False)
    for o in copies:o.select_set(True)
    path=OUT+'/'+name+'.glb'
    bpy.ops.export_scene.gltf(filepath=path,export_format='GLB',use_selection=True,use_active_scene=True,export_yup=True,export_apply=True,export_animations=False,export_vertex_color='ACTIVE',export_image_format='AUTO',export_extras=True)
    exp.hide_render=True;exp.hide_viewport=True
    return {'file':name+'.glb','bytes':os.path.getsize(path),'triangles':sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in copies),'objects':len(coll.objects)}

manifest=[];collections=[]
for theme,groundcolor,stonecolor in [('meadow','#9bc377','#73888e'),('jungle','#71a577','#4b7270'),('beach','#eed29b','#b99870'),('volcano','#79616c','#494654'),('mountain','#c3d4cc','#8094ab'),('lobby','#9ec47b','#758e9d')]:
    current=bpy.data.collections.new('Release_'+theme);scene.collection.children.link(current);collections.append(current)
    g=mat(theme+'_Ground',groundcolor);s=mat(theme+'_Cliff',stonecolor)
    island(19 if theme=='lobby' else 34,15 if theme=='lobby' else 28,g,s)
    if theme=='lobby':
        for x,z in [(-9,4),(9,4),(-9,-7),(9,-7)]:
            ribbon('IvoryGardenWalk',[(0,.035,1),(x*.45,.035,z*.4),(x,.035,z)],1.7,sand)
            for dx in [-2.9,2.9]:box('DestinationStep',(x+dx,.13,z),(1.2,.24,3.4),cream,.18)
        canopy(9,4,coral)
        # Volleyball club gateway: carved arch and gold crest mount.
        tube('ClubArch',[(-11.8,0,3.8),(-11.8,4.2,3.8),(-9,6.2,3.8),(-6.2,4.2,3.8),(-6.2,0,3.8)],.32,cream)
        for dx in [-2.8,2.8]:box('ArchFoot',(-9+dx,.25,3.8),(.9,.5,.9),gold,.1)
        # Crystal garden with faceted gems, orbital brass bands and steps.
        for dx,dz,h in [(0,0,3),(-1.8,.5,1.8),(1.8,-.6,2.1)]:
            peak(-9+dx,-7+dz,.65,h,purple)
        for r in [2.2,2.8]:tube('ShrineOrbit',[(-9+math.cos(i*math.tau/24)*r,1.1,-7+math.sin(i*math.tau/24)*r) for i in range(25)],.07,gold)
        # Airship boarding dock: ribbed hull, striped balloon and hanging ropes.
        for j in range(9):box('DockPlank',(9,.2,-8+j*.45),(5.8,.25,.39),wood,.04)
        ellipsoid('AirshipHull',(9,2.6,-8.2),(2.7,.65,1.1),darkwood)
        ellipsoid('AirshipEnvelope',(9,6.8,-8.2),(3.4,1.75,1.8),mint)
        for dx in [-1.8,1.8]:
            for dz in [-.7,.7]:beam('AirshipRigging',(9+dx,3,-8.2+dz),(9+dx,6,-8.2+dz),.035,gold)
        for dx in [-1.8,0,1.8]:tube('BalloonBand',[(9+dx,6.8+math.cos(i*math.tau/20)*1.78,-8.2+math.sin(i*math.tau/20)*1.82) for i in range(21)],.075,cream)
        asset('tree',-15,-4,8);asset('tree',15,-3,7);asset('bush',-13,9,1.4);asset('bush',13,9,1.5)
        for x,z in [(-3,5),(4,3),(-2,-4)]:ellipsoid('LoungeCushion',(x,.17,z),(1.3,.22,.9),coral if x>0 else mint)
        category='Water';ribbon('LobbyFalls',[(-4,.02,13),(-4,-2,15.5),(-4,-8,15.8)],2,water);category='Scenery'
        for x in [-5.3,-2.7]:asset('rock',x,12.6,1.1)
    else:
        # All scenery remains beyond expanded player bounds x=17,z=12.
        placements=[(-24,-14),(-15,-21),(-5,-23),(8,-23),(22,-17),(27,-6),(27,10),(17,22),(-17,22),(-28,5)]
        for i,(x,z) in enumerate(placements):
            if theme=='meadow':asset('tree' if i%3 else 'oak',x,z,7+i%3);asset('bush',x+2,z+1,1.5)
            elif theme=='jungle':asset('twisted' if i%3==0 else 'tree',x,z,9+i%3);asset('fern',x+2,z+1,1.6)
            elif theme=='beach':palm(x,z,6+i%3)
            elif theme=='mountain':asset('pine',x,z,6+i%4)
            else:peak(x,z,2+i%2,3+i%5,s)
            if i%2==0:asset('rock',x-2,z+2,1.8)
        if theme=='meadow':
            canopy(-22,8,mint)
            # Windmill silhouette on the far ridge.
            box('WindmillTower',(27,4,-7),(2.8,8,2.8),cream,.3)
            roof=peak(27,-7,3,2.7,coral);roof.location.z=7.6
            for a in [0,math.pi/2]:
                b=box('WindmillSail',(27,7,-4.9),(.45,9,.13),wood,.05);b.rotation_euler.y=a+.4
            for x,z in [(-21,14),(23,14),(-13,-19)]:asset('flower',x,z,.85)
        elif theme=='jungle':
            for j in range(4):box('TempleTerrace',(24,j*.7,-8),(7-j*1.1,.8,7-j*1.1),s,.25)
            tube('AncientArch',[(21,2,-8),(21,6,-8),(24,8,-8),(27,6,-8),(27,2,-8)],.65,s)
            category='Water';ribbon('JungleFalls',[(25,5,-10),(25,3,-6),(24,.15,-4)],2.5,water);category='Scenery'
            for i in range(3):tube('HangingVine',[(21+i*2,6,-8),(21.5+i*2,4,-8.3),(21+i*2,2.7,-8)],.06,leaf)
        elif theme=='beach':
            canopy(-23,5,coral)
            for x in [21,24]:box('SunLounger',(x,.5,10),(1.4,.25,3.4),cream,.1)
            for i in range(9):box('PierBoard',(19+i*.6,.2,-16),( .54,.3,4),wood,.06)
            category='Water';mesh('Lagoon',[(-80,-1.1,-80),(-80,-1.1,80),(80,-1.1,80),(80,-1.1,-80)],[(0,1,2,3)],water);category='Scenery'
            # Curved shell sculpture on the far shore.
            for j in range(7):tube('ShellRidge',[(24+math.cos(j*.42)*2,.2,15+math.sin(j*.42)*2),(24,2.8,15),(24-math.cos(j*.42)*2,.2,15-math.sin(j*.42)*2)],.16,coral)
        elif theme=='volcano':
            n=32;verts=[];faces=[]
            for j,(h,r) in enumerate([(0,11),(4,8),(9,4),(11,3),(10.2,2.2)]):
                for i in range(n):a=i*math.tau/n;rr=r*(1+.08*math.sin(i*2));verts.append((25+math.cos(a)*rr,h+.2*math.sin(i*3),-16+math.sin(a)*rr))
            for j in range(4):
                for i in range(n):faces.append((j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i))
            mesh('Caldera',verts,faces,s)
            category='Water';ellipsoid('MoltenCrater',(25,10.25,-16),(2.3,.12,2.3),lava)
            ribbon('LavaRiver',[(23,10,-13),(21,5,-9),(22,.15,-5),(24,.15,1),(30,.15,4)],1.7,lava);category='Scenery'
            for i in range(5):ellipsoid('VolcanicSteam',(25+i*.55,13+i*.8,-16),(1.5+i*.2,.8,1.4),mat('Steam','#bba4b5'))
        elif theme=='mountain':
            for x,z,r,h in [(32,-19,9,15),(38,0,11,22),(32,20,9,17),(-31,0,6,12)]:peak(x,z,r,h,s,True)
            # Alpine lodge, stacked log walls and pitched roof.
            for j in range(6):box('LodgeLogs',(-23,j*.43+.3,8),(5,.4,4),wood,.18)
            verts=[(-26,2.7,5.5),(-23,5.2,5.5),(-20,2.7,5.5),(-26,2.7,10.5),(-23,5.2,10.5),(-20,2.7,10.5)]
            mesh('SnowRoof',verts,[(0,1,4,3),(1,2,5,4)],cream)
            box('LodgeDoor',(-23,1,10.05),(1.2,2,.12),darkwood,.08)
        # Sparse edge vegetation; never a uniform ring of clutter.
        if theme in ['meadow','jungle']:
            for i in range(7):asset('flower' if theme=='meadow' else 'fern',-26+i*2,17+math.sin(i)*2,.65 if theme=='meadow' else 1.2)
    manifest.append(export(current,theme));current.hide_render=theme!='lobby'

camera_data=bpy.data.cameras.new('ReleasePreviewCamera');camera=bpy.data.objects.new('ReleasePreviewCamera',camera_data);scene.collection.objects.link(camera);camera.location=xyz((5,25,39));camera.rotation_euler=(Vector(xyz((0,1,0)))-camera.location).to_track_quat('-Z','Y').to_euler();camera_data.type='ORTHO';camera_data.ortho_scale=45;scene.camera=camera
ld=bpy.data.lights.new('WarmKey','AREA');light=bpy.data.objects.new('WarmKey',ld);scene.collection.objects.link(light);light.location=xyz((-14,26,15));ld.energy=2400;ld.shape='DISK';ld.size=14;light.rotation_euler=(-light.location).to_track_quat('-Z','Y').to_euler()
scene.render.resolution_x=1200;scene.render.resolution_y=900;scene.render.resolution_percentage=100
scene.render.filepath=BASE+'/Blender/release-lobby-preview.png'
bpy.ops.wm.save_as_mainfile(filepath=BASE+'/Blender/release-worlds.blend')
with open(OUT+'/manifest.json','w') as f:json.dump({'generator':'Blender MCP','assets':manifest,'licensed_packs':['Kenney Nature Kit CC0','Quaternius Stylized Nature MegaKit CC0']},f,indent=2)
result={'assets':manifest,'blend':bpy.data.filepath}
