"""Art-directed five-biome rebuild; preserves the lobby and all gameplay."""
from pathlib import Path
BASE=str(Path(__file__).resolve().parents[1])
source=Path(BASE+'/Blender/restore_kenney_worlds.py').read_text()
exec(compile(source.split('\nmanifest=[]')[0],__file__,'exec'))
scene.name='Biome_Art_Direction'
# A compact palette per scene keeps the final material batches bounded.
def palette(theme,colors):return {k:mat(theme+'_'+k,v,glow=k in ['Water','Lava']) for k,v in colors.items()}
def patch(name,x,z,rx,rz,m,y=-.035):
    n=40;vs=[(x,y,z)]+[(x+math.cos(i*math.tau/n)*rx*(1+.06*math.sin(i*2.1)),y,z+math.sin(i*math.tau/n)*rz) for i in range(n)]
    return mesh(name,vs,[(0,(i+1)%n+1,i+1) for i in range(n)],m)
def ribbon(name,points,width,m):
    vs=[]
    for i,p in enumerate(points):
        a=points[max(0,i-1)];b=points[min(len(points)-1,i+1)];dx=b[0]-a[0];dz=b[2]-a[2];d=max(.001,math.hypot(dx,dz))
        vs.extend([(p[0]-dz/d*width*.5,p[1],p[2]+dx/d*width*.5),(p[0]+dz/d*width*.5,p[1],p[2]-dx/d*width*.5)])
    return mesh(name,vs,[(i*2+2,i*2+3,i*2+1,i*2) for i in range(len(points)-1)],m)
def place(key,x,z,h,a=0,variant=0):
    before=set(current.objects);asset(key,x,z,h,a)
    for o in set(current.objects)-before:
        if globals().get('theme')=='meadow' and 'meadow_height' in globals():o.location.z+=meadow_height(x,z)
        o.data=o.data.copy()
        for slot in o.material_slots:
            name=slot.material.name.lower()
            if any(t in name for t in ['leaf','grass']):role=['Leaf','LeafLight','Accent'][variant%3] if 'leaf' in name else 'Leaf'
            elif any(t in name for t in ['colorred','flower']):role='Accent'
            elif any(t in name for t in ['coloryellow','lantern']):role='Gold'
            elif any(t in name for t in ['wood','cedar','timber','bark']):role='WoodDark' if 'dark' in name or 'cedar' in name else 'Wood'
            elif 'roof' in name:role='Roof'
            elif 'canvas' in name or 'birch' in name:role='Cream'
            else:role='Rock'
            if key in ['rock','rockB','tallrock']:role='Rock'
            slot.material=P[role]
    return list(set(current.objects)-before)
def bunting(x,z1,z2,height):
    for z in [z1,z2]:beam('FestivalPole',(x,0,z),(x,height,z),.09,P['Wood'])
    pts=[(x,height-.8*math.sin(i/12*math.pi),z1+(z2-z1)*i/12) for i in range(13)]
    tube('FestivalCord',pts,.025,P['WoodDark'])
    for i in range(11):
        z=z1+(z2-z1)*(i+.5)/11;y=height-.8*math.sin((i+.5)/11*math.pi)
        mesh('FestivalPennant',[(x-.04,y,z-.4),(x-.04,y,z+.4),(x-.04,y-.75,z)],[(0,1,2)],P[['Accent','Gold','Roof'][i%3]])
def hut(x,z,snow=False):
    box('LodgePlatform',(x,.2,z),(5,.4,6),P['WoodDark'],.12)
    for j in range(6):box('LodgeTimber',(x,.65+j*.5,z),(4.4,.45,5.5),P['Wood'],.12)
    # Roof ridgeline follows z, so the front gable faces the court.
    vs=[(x-2.9,3.3,z-3.4),(x,6,z-3.4),(x+2.9,3.3,z-3.4),(x-2.9,3.3,z+3.4),(x,6,z+3.4),(x+2.9,3.3,z+3.4)]
    mesh('LodgeRoof',vs,[(3,4,1,0),(4,5,2,1),(1,2,0),(5,4,3)],P['Cream'] if snow else P['Roof'])
    if not snow:
        for j in range(4):
            za=z-3.3+j*1.7;zb=za+.65
            mesh('CabanaRoofStripe',[(x-2.92,3.32,za),(x,6.03,za),(x,6.03,zb),(x-2.92,3.32,zb)],[(3,2,1,0)],P['Cream'])
    box('LodgeDoor',(x-2.23,1.3,z),( .08,2.1,1.3),P['WoodDark'],.04)
    for dz in [-1.8,1.8]:box('LodgeWindow',(x-2.25,2,z+dz),(.09,1.1,.9),P['Gold'],.04)
    box('LodgeChimney',(x+1.2,5,z+1.8),(.8,2,.8),P['Rock'],.1)
    for dz in [-2.7,2.7]:beam('PorchPost',(x-3.4,0,z+dz),(x-3.4,3.1,z+dz),.1,P['Wood'])
    box('PorchAwning',(x-2.8,3.1,z),(1.4,.18,6),P['Roof'],.03)
def umbrella(x,z,color):
    beam('ParasolPole',(x,0,z),(x,3.3,z),.06,P['Cream'])
    for i in range(10):
        a=i*math.tau/10;b=(i+1)*math.tau/10
        mesh('ParasolPanel',[(x,3.5,z),(x+math.cos(a)*1.8,2.8,z+math.sin(a)*1.8),(x+math.cos(b)*1.8,2.8,z+math.sin(b)*1.8)],[(0,1,2)],P['Cream'] if i%2 else color)
    for dx in [-.9,.9]:
        box('BeachLounger',(x+dx,.4,z+2.3),(.65,.13,1.8),P['Cream'],.05)
        box('LoungerStripe',(x+dx,.48,z+2.3),(.4,.02,1.7),color,0)
def mountain_ridge():
    zs=[-18,-14,-10,-6,-2,2,6,10,14,18];hs=[2,6,11,8,15,10,13,9,5,2];vs=[];faces=[]
    for x,f in [(25,0),(28,.4),(31,1),(36,0)]:
        vs += [(x,hs[i]*f,z) for i,z in enumerate(zs)]
    for j in range(3):
        for i in range(9):faces.extend([(j*10+i,j*10+i+1,(j+1)*10+i),((j+1)*10+i,j*10+i+1,(j+1)*10+i+1)])
    o=mesh('AlpineRidgeline',vs,faces,P['Rock']);o.data.materials.append(P['Cream']);o.data.materials.append(P['Roof'])
    for f in o.data.polygons:f.material_index=1 if 18<=f.index<36 else 2 if f.index>=36 else 0

# New landscapes are authored as continuous ecosystems rather than prop bouquets.
# Reuse licensed source meshes, but no prior composition or placement lists.
def ico(name,p,s,m,sub=1):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=sub,radius=1,location=xyz(p));o=move_to(bpy.context.object,name,m);o.scale=(s[0],s[2],s[1]);return o

def chain(name,pts,r,m):
    for a,b in zip(pts,pts[1:]):beam(name,a,b,r,m)

def ridge(name,x,z,rx,rz,h,m,seed=1):
    rng=random.Random(seed);n=18;vs=[]
    for j,(level,scale) in enumerate([(0,1),(.35,.85),(.73,.48),(1,.08)]):
        for i in range(n):
            a=i*math.tau/n;rr=1+rng.uniform(-.18,.18);vs.append((x+math.cos(a)*rx*scale*rr,h*level*(1+.15*math.sin(i*1.3) if j<3 else 1),z+math.sin(a)*rz*scale*rr))
    vs.append((x,h+.1,z));faces=[tuple(reversed((j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i))) for j in range(3) for i in range(n)];faces.extend([(len(vs)-1,3*n+(i+1)%n,3*n+i) for i in range(n)]);o=mesh(name,vs,faces,m,True)
    if globals().get('theme')=='volcano':
        o.data.materials.append(P['Roof']);o.data.materials.append(P['Rock'])
        for f in o.data.polygons:
            f.use_smooth=False;f.material_index=1 if (f.index//n==1 and f.index%5!=0) else 2 if f.index//n>=2 else 0
    return o

def alpine_range(points,heights,width):
    points=[(x*1.3,z*1.3) for x,z in points];heights=[h*.67 for h in heights]
    vs=[];fs=[];n=7
    for i,((x,z),h) in enumerate(zip(points,heights)):
        a=points[max(0,i-1)];b=points[min(len(points)-1,i+1)];dx=b[0]-a[0];dz=b[1]-a[1];ll=max(.01,math.hypot(dx,dz));nx=-dz/ll;nz=dx/ll
        snow=.68+.1*math.sin(i*2.3)
        for offset,yy in [(-1,0),(-.7,.28),(-.24,snow),(0,1),(.21,snow+.07),(.65,.32),(1,0)]:
            vs.append((x+nx*width*offset,h*yy,z+nz*width*offset))
    for i in range(len(points)-1):
        for j in range(6):
            a=i*n+j;b=(i+1)*n+j;fs.extend([(a,a+1,b),(b,a+1,b+1)])
    fs.extend([tuple(range(6,-1,-1)),tuple(range(len(vs)-7,len(vs)))]);o=mesh('AlpineRidgeline',vs,fs,P['Rock']);o.data.materials.append(P['Cream']);o.data.materials.append(P['Roof'])
    for f in o.data.polygons:
        col=(f.index//2)%6;row=f.index//12;f.material_index=1 if col in [2,3] or (col in [1,4] and row%3==1 and f.index%2==0) else 2 if col in [1,4] else 0
    return o

def meadow_grass(count,flower=False):
    global category
    saved_category=category
    # Shared mesh per pigment: thousands of silhouettes, four material batches.
    roles=['Accent','Gold','Cream'] if flower else ['LeafLight','Patch'];groups={}
    for i in range(count):
        x=random.uniform(-42,42);z=random.uniform(-34,34)
        if abs(x)<18.2 and abs(z)<13.2:continue
        if (x/45)**2+(z/36)**2>1:continue
        # Broad diagonal drifts; no checkerboard, ring, or copied arrangement.
        density=.55+.35*math.sin(x*.17+z*.11)+.15*math.sin(z*.57-x*.18)
        if random.random()>density:continue
        if not flower and i%3==0:x*=.65;z*=.65
        low=not flower and abs(x)<18.2 and abs(z)<13.2
        role=random.choice(roles);key=(role,int(x//4),int(z//4),low);vs,fs=groups.setdefault(key,([],[]));h=random.uniform(.12,.32)*(.4 if low else 1);w=h*.12;a=random.random()*math.tau
        if flower:
            h=random.uniform(.35,.7);r=random.uniform(.18,.29)
            for k in range(3):
                a=k*math.pi/3;dx=math.cos(a)*r;dz=math.sin(a)*r;n=len(vs)
                vs.extend([(x-dx,h,z-dz),(x,h+r*.5,z),(x+dx,h,z+dz),(x,h-r*.5,z)]);fs.append((n,n+1,n+2,n+3))
        else:
            for k in range(2):
                aa=a+k*math.pi*.55;dx=math.cos(aa)*w;dz=math.sin(aa)*w;n=len(vs)
                vs.extend([(x-dx,0,z-dz),(x+dx,0,z+dz),(x+dx*.7,h,z+dz*.7)]);fs.append((n,n+1,n+2))
    # Batch bounds encompass the court, but all individual blades stay outside it.
    # Keep individual clumps for envelope audit, export joins them by material.
    for (role,cx,cz,low),(vs,fs) in groups.items():
        category='Surface' if low else saved_category
        mesh('Wildflower' if flower else 'WindGrass',vs,fs,P[role])
    category=saved_category

def vine(x,z,top,length,seed):
    rr=random.Random(seed);pts=[(x+math.sin(k*.7+seed)*.24,top-length*k/5,z+math.sin(k+seed)*.2) for k in range(6)]
    chain('ClimbingVine',pts,.035,P['Leaf'])
    for k,p in enumerate(pts):
        side=1 if k%2 else -1
        mesh('HeartVineLeaf',[p,(p[0]+side*.7,p[1]+.4,p[2]+.1),(p[0]+side*1.1,p[1],p[2]+.15),(p[0]+side*.25,p[1]-.15,p[2]+.1)],[(0,1,2,3)],P['LeafLight'])

def guardian(x,z,s=1,broken=False):
    # Mossy, friendly ancient primate sculpture. Different silhouettes at each ruin.
    box('GuardianPlinth',(x,.25,z),(3*s,.5,3*s),P['Rock'],.1)
    ico('GuardianTorso',(x,1.5*s,z),(1*s,1.4*s,.9*s),P['Rock'],1)
    for side in [-1,1]:
        ico('GuardianFoldedKnee',(x+side*.9*s,.6*s,z-.35*s),(.75*s,.6*s,.9*s),P['Rock'])
        beam('GuardianArm',(x+side*.9*s,2*s,z),(x+side*1.2*s,.75*s,z-.3*s),.3*s,P['Rock'])
    if not broken:
        ico('GuardianHead',(x,3.2*s,z),(.95*s,1.1*s,.85*s),P['Rock'],2)
        for side in [-1,1]:
            ico('GuardianEar',(x+side*.97*s,3.2*s,z),(.4*s,.55*s,.25*s),P['Rock'])
            box('CarvedEye',(x+side*.35*s,3.5*s,z-.76*s),(.4*s,.15*s,.08*s),P['WoodDark'],0)
        box('CarvedMouth',(x,2.85*s,z-.81*s),(.8*s,.12*s,.08*s),P['WoodDark'],0)
        ico('MossCrown',(x,4.15*s,z),(.9*s,.2*s,.7*s),P['LeafLight'])
    else:ico('FallenGuardianHead',(x+2.3*s,.7*s,z-1*s),(1*s,.85*s,.95*s),P['Rock'],2)
    for j in range(3):vine(x-.7+j*.6,z-.75,3.7*s,2.6*s,j+int(x*3))

def fossil(x,z,s=1):
    chain('LeviathanSpine',[(x+math.sin(j*.6)*.4,1*s,z+(j-4)*s) for j in range(9)],.16*s,P['Cream'])
    for j in range(7):
        for side in [-1,1]:
            r=math.sin((j+1)/9*math.pi)*2*s
            chain('LeviathanRib',[(x,1*s,z+(j-3)*s),(x+side*r*.5,2*s,z+(j-3)*s),(x+side*r,1.5*s,z+(j-3)*s),(x+side*r,.2,z+(j-3)*s)],.12*s,P['Cream'])
    ico('LeviathanSkull',(x,.9*s,z-5*s),(1.1*s,.85*s,1.6*s),P['Cream'],2)
    for side in [-1,1]:ico('SkullSocket',(x+side*.65*s,1.45*s,z-5.5*s),(.3*s,.17*s,.5*s),P['WoodDark'])

def newground(rx,rz):
    island(rx,rz,P['Ground'],P['Cliff'])
    # No floating toy-platform cloud ring. Terrain stretches to distant skylines.
    for o in list(current.objects):
        if 'CloudBank' in o.name:bpy.data.objects.remove(o,do_unlink=True)

MEADOW_HILLS=[(-43,-26,22,18,8),(39,32,25,16,6),(53,-12,20,23,10),(-40,35,25,15,6)]
def meadow_height(x,z):
    return max([0]+[h*max(0,1-((x-cx)/rx)**2-((z-cz)/rz)**2)**2 for cx,cz,rx,rz,h in MEADOW_HILLS])
def rolling_hill(x,z,rx,rz,h):
    n=32;vs=[(x,h,z)];fs=[]
    for j in range(1,11):
        r=j/10
        for i in range(n):
            a=i*math.tau/n;vs.append((x+math.cos(a)*rx*r,h*(1-r*r)**2-.01,z+math.sin(a)*rz*r))
    for i in range(n):fs.append((0,1+(i+1)%n,1+i))
    for j in range(9):
        for i in range(n):a=1+j*n+i;b=1+j*n+(i+1)%n;fs.append((a,b,b+n,a+n))
    return mesh('RollingMeadow',vs,fs,P['Patch'],True)

palettes={
'meadow':dict(Ground='#7ebc5c',Cliff='#5b7d73',Leaf='#36835a',LeafLight='#a7d35c',Accent='#e89fba',Gold='#ffe692',Wood='#bc8a62',WoodDark='#65564c',Roof='#6faaa0',Cream='#fff8db',Rock='#a4afa1',Water='#69c9c2',Patch='#a2cb6e',Path='#d9cda0'),
'jungle':dict(Ground='#367c61',Cliff='#245159',Leaf='#165c4e',LeafLight='#69b65b',Accent='#f09a65',Gold='#d9e79a',Wood='#73594a',WoodDark='#253e3e',Roof='#4a8c64',Cream='#b6cc9c',Rock='#6c9382',Water='#3bd9c0',Patch='#528e5f',Path='#7a9b72'),
'volcano':dict(Ground='#4d3b4b',Cliff='#2a283d',Leaf='#57445f',LeafLight='#9d6272',Accent='#ed6046',Gold='#ffd177',Wood='#775058',WoodDark='#302534',Roof='#795368',Cream='#ead5b0',Rock='#3f334b',Water='#ff9e45',Lava='#ff7630',Patch='#765061',Path='#a66e71'),
'mountain':dict(Ground='#d4e4e4',Cliff='#64809a',Leaf='#396d78',LeafLight='#6b9e9b',Accent='#d87e64',Gold='#ffce85',Wood='#a87a65',WoodDark='#554b63',Roof='#7795b4',Cream='#fff9ec',Rock='#809bb2',Water='#77d4dd',Patch='#edf3e7',Path='#b8cbd5')}
# Keep dense jungle silhouettes within a fixed geometry budget after joining.
# Other maps retain their authored topology; beach is never loaded or exported.
def export(coll,name):
    copies=[];bpy.ops.object.select_all(action='DESELECT')
    exp=bpy.data.collections.new('Runtime_'+name);scene.collection.children.link(exp)
    for cat in ['Surface','Scenery','Water']:
        items=[]
        for source in list(coll.objects):
            if source.type!='MESH' or not source.name.startswith(cat+'_'):continue
            o=source.copy();o.data=source.data.copy();exp.objects.link(o);o.select_set(True);items.append(o)
        if not items:continue
        bpy.context.view_layer.objects.active=items[0]
        if len(items)>1:bpy.ops.object.join()
        o=bpy.context.object;o.name=cat+'_'+name;copies.append(o)
        if name=='jungle' and cat=='Scenery':
            triangles=sum(len(p.vertices)-2 for p in o.data.polygons)
            if triangles>36500:
                mod=o.modifiers.new('Bounded forest silhouette budget','DECIMATE');mod.ratio=36500/triangles;bpy.ops.object.modifier_apply(modifier=mod.name)
        o.select_set(False)
    for o in copies:o.select_set(True)
    path=OUT+'/'+name+'.glb'
    bpy.ops.export_scene.gltf(filepath=path,export_format='GLB',use_selection=True,use_active_scene=True,export_yup=True,export_apply=True,export_animations=False,export_vertex_color='ACTIVE',export_image_format='AUTO',export_extras=True)
    exp.hide_render=True;exp.hide_viewport=True
    return {'file':name+'.glb','bytes':os.path.getsize(path),'triangles':sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in copies),'objects':len(coll.objects)}

manifest=[]
selected=os.environ.get('BIOME_FILTER')
for ti,(theme,colors) in enumerate(palettes.items()):
    if selected and theme!=selected:continue
    random.seed(85001+ti*173)
    P=palette(theme,colors);current=bpy.data.collections.new('Worldbuilt_'+theme);scene.collection.children.link(current)
    newground(82 if theme=='mountain' else 62 if theme!='volcano' else 30,66 if theme=='mountain' else 48 if theme!='volcano' else 24)
    category='Scenery'
    if theme=='meadow':
        # Wind-swept valley: opposing, unequal landforms with open sky corridors.
        for x,z,rx,rz,h in MEADOW_HILLS:rolling_hill(x,z,rx,rz,h)
        coords=[]
        for i in range(42):
            x=random.uniform(-49,49);z=random.uniform(-37,37)
            if abs(x)<24 and abs(z)<20:continue
            if (x/55)**2+(z/43)**2>1:continue
            if any(math.hypot(x-a,z-b)<4 for a,b in coords):continue
            coords.append((x,z));place(random.choice(['oak','detailed','small']),x,z,random.uniform(4,10),random.random()*6,1 if i%4 else 2)
        # Hero oak and a distant blossom grove establish unequal visual anchors.
        place('detailed',26,-7,12,.6,0)
        for x,z,h in [(-27,7,8),(-31,13,9),(-24,18,6),(-36,9,7)]:place('oak',x,z,h,x*.2,2)
        place('pavilion',30,13,5.5,-.4)
        place('logs',23,13,1.2,.8);place('stump',21,15,.75)
        for x,z in [(-21,-7),(21,8),(-11,-17),(7,17)]:
            place('rockB',x,z,1.1,x);place('bush',x+1.4,z+1,1.3,z,1)
        category='Water';ribbon('SpringStream',[(-37,.01,-28),(-28,.01,-20),(-24,.01,-8),(-27,.01,7),(-37,.01,23)],2.2,P['Water']);category='Scenery'
        for j in range(9):box('SpringBridge',(-24,.25,-3+j*.42),(4.4,.18,.35),P['Wood'],.02)
        meadow_grass(6500);meadow_grass(1700,True)
        # Southwest orchard is one irregular blossom mass, not evenly spaced lollipops.
        for key,x,z,h in [('detailed',-23,24,8),('oak',-28,22,6),('small',-31,25,4.5),('detailed',-27,29,9),('oak',-21,29,5.7)]:place(key,x,z,h,random.random()*6,2)
        for key,x,z,h in [('detailed',5,-28,11),('small',9,-25,4.5),('oak',1,-26,6)]:place(key,x,z,h,random.random()*6,0)
        for x,z in [(-22,22),(-25,24),(-29,26),(-21,28),(3,-23),(6,-24),(9,-23)]:place('bush',x,z,random.uniform(.8,1.4),random.random()*6,1)
        for region in [(-26,25),(5,-24)]:
            for i in range(90):
                x=region[0]+random.uniform(-5,5);z=region[1]+random.uniform(-3,3);h=meadow_height(x,z)+random.uniform(.3,.6);r=random.uniform(.16,.3)
                mesh('BlossomUnderplant',[(x-r,h,z),(x,h+r*.6,z-r),(x+r,h,z),(x,h-r*.6,z+r)],[(0,1,2,3)],P['Accent'] if i%3 else P['Cream'])

    elif theme=='jungle':
        # Connected forest walls with irregular depth; generous open sports clearing.
        # Six unequal overlapping banks close the blue horizon behind the hero trees.
        # These are distant folded foliage silhouettes, never a perimeter wall.
        banks=[(-44,-5,8,25,8),(-45,14,9,14,6),(-23,-38,24,9,8),(-1,-39,21,8,6),(30,-35,18,10,9),(42,-22,10,20,7),(46,8,9,26,8),(43,27,10,16,6.5),(14,39,24,9,8),(-9,39,22,9,7),(-33,32,19,10,9),(-44,20,8,17,7)]
        for bi,(x,z,rx,rz,h) in enumerate(banks):
            n=12;vs=[];fs=[]
            for j,(yy,rr) in enumerate([(.1,1),(.35,1.05),(.78,.77),(1,.18)]):
                for k in range(n):
                    a=k*math.tau/n;fold=1+.16*math.sin(k*2.1+bi)+.1*math.cos(k*3.3+bi)
                    vs.append((x+math.cos(a)*rx*rr*fold,h*yy*(1+.12*math.sin(k*1.7+bi)),z+math.sin(a)*rz*rr*fold))
            for j in range(3):
                for k in range(n):fs.append(((j+1)*n+k,(j+1)*n+(k+1)%n,j*n+(k+1)%n,j*n+k))
            vs.append((x,h*.95,z))
            for k in range(n):fs.append((len(vs)-1,3*n+(k+1)%n,3*n+k))
            o=mesh('FarForestCanopyBank',vs,fs,P['Leaf'],True);o.data.materials.append(P['Roof'])
            for f in o.data.polygons:f.material_index=1 if f.index%11==bi%11 and bi%3==0 else 0
        coords=[]
        for i in range(170):
            x=random.uniform(-53,53);z=random.uniform(-41,41)
            if abs(x)<25 and abs(z)<21:continue
            if (x/58)**2+(z/46)**2>1:continue
            if any(math.hypot(x-a,z-b)<4.7 for a,b in coords):continue
            coords.append((x,z));place(['plateau','detailed','detailed','oak'][i%4],x,z,random.uniform(9,17),random.random()*6,i%2)
        for x,z,h in [(-28,-6,19),(28,12,16),(-8,-23,15),(11,24,17),(-24,19,14),(26,-13,16)]:
            place('plateau',x,z,h,.4*x,0)
            for j in range(3):vine(x+(j-1)*1.5,z+.3*j,h*.8,h*.55,int(x*11+j))
        # A buttressed giant reaches across the western canopy.
        for j in range(5):
            a=j*math.tau/5;chain('StranglerRoot',[(-29,5,-5),(-29+math.cos(a)*1.2,1.4,-5+math.sin(a)*1.2),(-29+math.cos(a)*3,.1,-5+math.sin(a)*3)],.35,P['Wood'])
        guardian(24,5,1.4);guardian(-7,24,1.1,True)
        for x,z in [(22,11),(26,-5),(-23,7),(-18,-18)]:
            for j in range(3):box('BrokenTempleStep',(x,.22+j*.25,z+j*.5),(3.2-j*.6,.5,1.4),P['Rock'],.08)
        for x,z,h in [(35,-17,12),(36,-12,17),(38,-7,11)]:ridge('RainforestEscarpment',x,z,5,6,h,P['Rock'],int(z))
        category='Water';ribbon('TallFalls',[(34,13,-13),(33.8,8,-13),(31,0,-13)],2.7,P['Water']);patch('Cenote',29,-14,6,4,P['Water'],.015);category='Scenery'
        # Uneven understory belts connect the canopy masses; dense ferns and lianas.
        for i in range(110):
            x=random.uniform(-36,36);z=random.uniform(-28,28)
            if abs(x)<20 and abs(z)<15.5:continue
            if (x/39)**2+(z/31)**2>1:continue
            place('fern' if i%3 else 'bush',x,z,random.uniform(.8,2.2),random.random()*6,i%2)
            if i%5==0:place('redflower',x+.5,z+.2,.8,i)
        for x,z in [(-22,-11),(23,15),(-13,19),(13,-19)]:
            for j in range(random.randint(2,5)):
                fx=x+random.uniform(-1.3,1.3);fz=z+random.uniform(-1.2,1.2);h=random.uniform(.65,1.8);r=random.uniform(.35,.75)
                beam('FungusStem',(fx,0,fz),(fx,h,fz),.08,P['Cream']);ico('FungusCap',(fx,h,fz),(r,.2,r),P['Accent'])
        for i,(x,z) in enumerate([(23,-9),(24,-7),(25,10),(-24,4),(-23,7),(6,-23),(9,-22),(-10,23),(-7,24)]):vine(x,z,random.uniform(8,11),random.uniform(5,8),i+100)
        # Broad low fern ribbons connect roots without crossing the run-off.
        for i in range(55):
            if i%2:x=random.choice([-1,1])*random.uniform(20,24);z=random.uniform(-19,19)
            else:x=random.uniform(-20,20);z=random.choice([-1,1])*random.uniform(16,20)
            vs=[];fs=[];h=random.uniform(.8,1.5)
            for j in range(7):
                a=j*math.tau/7+random.random()*.3;dx=math.cos(a)*h;dz=math.sin(a)*h;n=len(vs)
                vs.extend([(x,.1,z),(x+dx*.5-dz*.25,h*.6,z+dz*.5+dx*.25),(x+dx,h*.3,z+dz),(x+dx*.5+dz*.25,h*.6,z+dz*.5-dx*.25),(x+dx*.4,h*.8,z+dz*.4)])
                fs.extend([(n,n+1,n+4),(n+1,n+2,n+4),(n+2,n+3,n+4),(n+3,n,n+4)])
            mesh('FernRibbon',vs,fs,P['LeafLight'] if i%3 else P['Leaf'])
    elif theme=='volcano':
        category='Water';mesh('VastLavaSea',[(-140,-2,-140),(-140,-2,140),(140,-2,140),(140,-2,-140)],[(0,1,2,3)],P['Lava']);category='Scenery'
        # Huge distant caldera, not a small volcano prop beside the court.
        n=30;vs=[]
        for j,(h,r) in enumerate([(0,29),(13,20),(29,10),(32,7),(29.7,5)]):
            for i in range(n):
                a=i*math.tau/n;rr=r*(1+.08*math.sin(i*1.7));vs.append((62+math.cos(a)*rr,h+math.sin(i*2)*.8,-17+math.sin(a)*rr))
        o=mesh('DistantCaldera',vs,[tuple(reversed((j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i))) for j in range(4) for i in range(n)],P['Rock']);o.data.materials.append(P['Roof']);o.data.materials.append(P['Cliff'])
        for f in o.data.polygons:f.material_index=1 if f.index//n==1 and f.index%4 else 2 if f.index%7==0 else 0
        category='Water';rv=[]
        for rad in [6.5,7.5]:
            for k in range(30):a=k*math.tau/30;rv.append((62+math.cos(a)*rad,32.9+math.sin(k*2)*.8,-17+math.sin(a)*rad))
        mesh('IncandescentRim',rv,[(k,(k+1)%30,(k+1)%30+30,k+30) for k in range(30)],P['Lava']);category='Scenery'
        for k in [1,4,9,12,17,22,26]:
            a=k*math.tau/30;o=peak(62+math.cos(a)*9,-17+math.sin(a)*9,1.5,random.uniform(2,4),P['Roof']);o.location.z+=28

        category='Water';patch('DistantCrater',62,-17,5.6,5.6,P['Lava'],30);ribbon('LavaRiver',[(55,32.8,-17),(52,30.5,-16),(47,23.5,-18),(41,15.5,-17),(35,5,-16),(31,.15,-17),(27,.04,-17),(20,.04,-21)],3.4,P['Lava']);category='Water'
        ribbon('WestLavaTributary',[(48,23,-20),(42,17,-24),(37,8,-28),(29,.2,-30)],1.3,P['Lava'])
        ribbon('EastLavaTributary',[(54,30,-12),(47,23,-8),(40,13,-5),(33,1,-2)],1.8,P['Lava']);category='Scenery'
        for x,z,rx,rz,h in [(-52,-24,14,18,18),(-49,29,17,12,10),(16,57,28,13,14),(45,37,15,12,19),(-5,-57,22,17,11)]:ridge('DistantBasaltMassif',x,z,rx,rz,h,P['Cliff'],int(x-z))
        for i in range(48):
            a=random.random()*math.tau;x=math.cos(a)*random.uniform(22,31);z=math.sin(a)*random.uniform(17,25)
            if abs(x)<20 and abs(z)<15:continue
            h=random.uniform(.5,3.7);bpy.ops.mesh.primitive_cylinder_add(vertices=6,radius=random.uniform(.5,1.3),depth=h,location=xyz((x,h*.5,z)));o=move_to(bpy.context.object,'FracturedBasalt',P['Roof'] if i%4==0 else P['Rock']);o.rotation_euler=(random.uniform(-.12,.12),random.uniform(-.12,.12),random.random()*6.28)
        fossil(-24,-5,1.25);fossil(1,19,.85)
        for x,z in [(22,10),(-22,12),(10,-18)]:
            for j in range(4):place('rockB',x+j*.55,z,random.uniform(.5,1.2),j)
        category='Water'
        for pts in [[(-29,.04,8),(-23,.04,10),(-21,.04,17)],[(20,.04,-12),(23,.04,-6),(29,.04,-3)],[(-15,.04,-19),(-5,.04,-16),(6,.04,-20)]]:ribbon('MoltenFissure',pts,.3,P['Lava'])
        category='Scenery'
    elif theme=='mountain':
        # Four connected mountain ranges: unequal summits, crag layers and ragged snowlines.
        alpine_range([(-49,-39),(-46,-24),(-51,-8),(-47,9),(-50,25),(-44,40)],[4,20,29,23,17,4],12)
        alpine_range([(45,-40),(51,-26),(47,-9),(53,8),(46,24),(48,39)],[4,23,34,26,19,3],13)
        alpine_range([(-40,-43),(-24,-48),(-8,-44),(10,-49),(26,-43),(41,-46)],[4,22,31,25,18,4],11)
        alpine_range([(-39,45),(-23,49),(-5,45),(13,51),(29,46),(42,47)],[3,15,24,20,13,3],10)
        for x,z,rx,rz,h in [(-44,-26,10,13,10),(-45,6,10,14,12),(-40,30,8,10,8),(43,-27,9,12,12),(44,6,10,13,13),(41,29,8,11,9),(-13,-40,13,8,10),(16,40,15,7,8)]:ridge('AlpineButtress',x,z,rx,rz,h,P['Roof'],int(x-z))
        for x,z,h in [(-36,-19,7),(-35,20,9),(34,23,8),(35,-21,10),(-12,-33,8),(15,34,7)]:
            place('tallrock',x,z,h,z)
        for i in range(100):
            x=random.uniform(-33,33);z=random.uniform(-28,28)
            if abs(x)<23 and abs(z)<18:continue
            if x>19 and -18<z<8:continue
            place('pine' if i%3 else 'roundpine',x,z,random.uniform(3.5,9),random.random()*6,i%2)
        for cx,cz,count in [(-25,-19,10),(25,22,12)]:
            for j in range(count):
                x=cx+random.uniform(-4,4);z=cz+random.uniform(-3,3)
                place('pine' if j%3 else 'roundpine',x,z,random.uniform(2,7),random.random()*6,j%2)
                if j%4==0:place('rock',x+.8,z,.6+j*.06,j)
        before=set(current.objects)
        hut(-27,4,True)
        from mathutils import Matrix
        pivot=Vector(xyz((-27,0,4)));turn=Matrix.Translation(pivot)@Matrix.Rotation(math.pi,4,'Z')@Matrix.Translation(-pivot)
        for o in set(current.objects)-before:o.matrix_world=turn@o.matrix_world
        category='Water';patch('GlacierLake',28,-5,8,12,P['Water'],.01);category='Scenery'
        for j in range(13):box('LakeBridge',(20.5,.25,-9+j*.55),(3,.18,.45),P['Wood'],.02)
        place('logs',22,10,1.1,.65);place('rockB',24,11,1.5,.3);place('rock',23,14,.8,.9)
        for j in range(9):
            x=23+random.uniform(-2,3);z=9+random.uniform(-1,6);o=peak(x,z,random.uniform(.25,.55),random.uniform(.8,2),P['Water'])
        category='Surface';ribbon('LodgeTrail',[(-27,-.01,10),(-20,-.01,16),(-4,-.01,20),(12,-.01,18),(22,-.01,10)],1.5,P['Path']);category='Scenery'
        for x,z in [(-16,17),(7,19),(21,11)]:
            beam('ValleyWayLamp',(x,0,z),(x,2.5,z),.08,P['WoodDark']);box('WarmWayLight',(x,2.5,z),(.4,.5,.4),P['Gold'],.03)

        for x,z in [(-21,-8),(-21,11),(20,12)]:
            beam('AlpineLamp',(x,0,z),(x,3,z),.1,P['WoodDark']);box('Lantern',(x,3,z),(.5,.6,.5),P['Gold'],.05)
        for x,z in [(22,-17),(-20,-17),(8,20),(-11,20)]:
            place('rockB',x,z,1.5,z)
            for j in range(4):peak(x+j*.8,z+.4*j,.35,1+j*.4,P['Water'])
        category='Surface'
        for x,z,rx,rz in [(-24,-10,6,9),(23,16,7,4),(-10,-22,13,6),(8,23,11,5)]:patch('PowderDrift',x,z,rx,rz,P['Cream'],.015)
        category='Scenery'
    bpy.context.view_layer.update();detail_bounds=[]
    for o in current.objects:
        if o.type!='MESH' or not o.name.startswith('Scenery_'):continue
        assert not o.data.validate(), 'Invalid authored mesh: '+o.name
        c=[o.matrix_world@Vector(v) for v in o.bound_box];lo=[min(v[k] for v in c) for k in range(3)];hi=[max(v[k] for v in c) for k in range(3)]
        assert hi[0]<=-17 or lo[0]>=17 or hi[1]<=-12 or lo[1]>=12, 'Scenery enters player envelope: '+o.name+' '+str((lo,hi))
        detail_bounds.append({'min':lo,'max':hi})
    entry=export(current,theme);entry['border_detail_meshes']=len(detail_bounds);entry['border_detail_bounds_z_up']=detail_bounds;entry['art_direction']='worldbuilt-'+theme;manifest.append(entry);current.hide_render=True;current.hide_viewport=True
if selected and os.environ.get('BIOME_MASTER_UPDATE')=='1':
    combined=next(sc for sc in bpy.data.scenes if sc!=scene and any(c.name.startswith('Worldbuilt_meadow') for c in sc.collection.children))
    for coll in list(combined.collection.children):
        if coll.name.startswith('Worldbuilt_'+selected) or coll.name.startswith('Runtime_'+selected):combined.collection.children.unlink(coll)
    for coll in scene.collection.children:
        if coll.name.startswith('Worldbuilt_'+selected) or coll.name.startswith('Runtime_'+selected):combined.collection.children.link(coll)
    bpy.data.libraries.write(BASE+'/Blender/designed-biomes.blend',{combined},compress=True)
else:bpy.data.libraries.write(BASE+'/Blender/designed-'+(selected or 'biomes')+'.blend',{scene},compress=True)
old=json.loads(Path(OUT+'/manifest.json').read_text());old['assets']=[*manifest,*[a for a in old['assets'] if a['file'] not in [m['file'] for m in manifest]]];old['generator']='Blender / continuous worldbuilt biomes';Path(OUT+'/manifest.json').write_text(json.dumps(old,indent=2))
print('WORLD_REBUILD_RESULT',json.dumps([{k:v for k,v in a.items() if 'bounds' not in k} for a in manifest]))
