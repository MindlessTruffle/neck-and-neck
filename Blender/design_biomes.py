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

themes={
'meadow':dict(Ground='#69a849',Cliff='#6b6783',Leaf='#287e56',LeafLight='#68b453',Accent='#e76b94',Gold='#ffc750',Wood='#b47b4b',WoodDark='#67506a',Roof='#398a91',Cream='#fff1d2',Rock='#9486a4',Water='#53c9d4',Patch='#8abb5b',Path='#e3c499'),
'jungle':dict(Ground='#3c8565',Cliff='#35566a',Leaf='#126c5e',LeafLight='#39a97a',Accent='#f08454',Gold='#eec861',Wood='#90724e',WoodDark='#3d5356',Roof='#498f83',Cream='#dbedb4',Rock='#577d7b',Water='#42e3d3',Patch='#59946a',Path='#9da785'),
'beach':dict(Ground='#f0cc98',Cliff='#c49586',Leaf='#238b77',LeafLight='#5bbd8c',Accent='#f17480',Gold='#f6bd54',Wood='#b78460',WoodDark='#735d73',Roof='#ef7f82',Cream='#fff4dc',Rock='#b69bb3',Water='#36bfd3',Patch='#ffe3b6',Path='#f1bda1'),
'volcano':dict(Ground='#53405f',Cliff='#302c4e',Leaf='#694c82',LeafLight='#957299',Accent='#ef6e65',Gold='#ffd567',Wood='#796278',WoodDark='#352f4a',Roof='#8665a1',Cream='#ccb0c9',Rock='#473d62',Water='#ff9844',Lava='#ff813b',Patch='#6c4a70',Path='#92718b'),
'mountain':dict(Ground='#c4d8e7',Cliff='#566d94',Leaf='#286c7b',LeafLight='#5693a1',Accent='#ed8a70',Gold='#ffd386',Wood='#ad7964',WoodDark='#5d526d',Roof='#627fa8',Cream='#f4f6ec',Rock='#7d95ba',Water='#72cae4',Patch='#dbe8ef',Path='#9fb7ca')}
manifest=[]
for theme,colors in themes.items():
    if theme=='beach':continue  # Approved beach GLB stays byte-for-byte unchanged.
    P=palette(theme,colors);current=bpy.data.collections.new('Designed_'+theme);scene.collection.children.link(current)
    # Compact, layered island: no extra empty outer rim, no geometry in play bounds.
    island(31,24,P['Ground'],P['Cliff'])
    # Broad, calm surface masses break up the old single-color slab.
    category='Surface'
    for side in [-1,1]:
        patch('PerimeterWash',side*22,0,7,18,P['Patch'])
        if theme in ['meadow','beach','mountain']:ribbon('GardenWalk',[(side*18,-.025,-17),(side*19,-.025,-7),(side*19,-.025,7),(side*18,-.025,17)],1.5,P['Path'])

    category='Scenery'
    # Deliberately unequal groves frame the landmark rather than form a ring.
    groups=[(-23,-12),(-25,7),(23,-12),(24,11),(-10,-20),(9,20)]
    if theme=='jungle':groups=[(-23,-11),(-25,3),(-22,12),(24,-13),(24,13),(-9,-19),(7,19),(8,-19)]
    elif theme=='beach':groups=[(-25,-12),(-25,7),(23,-12),(24,11),(-10,-20),(9,20)]
    elif theme=='mountain':groups=[(-23,-12),(-25,10),(23,-13),(24,12),(-8,-20),(11,19)]
    elif theme=='volcano':groups=[(-24,-9),(-23,11),(24,-12),(24,13),(-8,-19),(12,19)]
    for i,(x,z) in enumerate(groups):
        for j,(dx,dz,h) in enumerate([(0,0,7.5),(2.4,1.2,5),(-1.8,2,4)]):
            if theme=='beach':
                if j<2:
                    before=set(current.objects);palm(x+dx,z+dz,h*.8)
                    for o in set(current.objects)-before:
                        o.data=o.data.copy()
                        for sl in o.material_slots:sl.material=P['Leaf'] if 'Frond' in o.name else P['Wood']
            elif theme=='volcano':place('tallrock',x+dx,z+dz,h*.55,i+j)
            else:place('pine' if theme=='mountain' else ['detailed','oak','small'][j],x+dx,z+dz,h*(1.15 if theme=='jungle' else 1),i*.7,2 if theme=='meadow' and i==1 else j%2)
        for j in range(3):place('rockB',x-2+j,z-1.5,.7+j*.2,j)
        if theme in ['meadow','jungle']:
            for j in range(3):place('bush' if theme=='meadow' else 'fern',x-2+j*1.5,z+2,1.1+j*.2,j,j%2)
            if theme=='jungle':place('redflower',x-1,z-2,1.05,i)

    # Dense but low garden beds, framing the reachable outer margins.
    detail_before=set(current.objects)
    for i,(x,z) in enumerate([(-20,-6),(-20,6),(20,-6),(20,6),(-12,-16),(12,-16),(-12,16),(12,16)]):
        if theme=='volcano':
            for j in range(4):place('rockB',x+(j%2)*1.3,z+(j//2)*1.2,.6+j*.25,j)
        else:
            place('bush',x,z,1.1,i,0);place('bushTriangle',x+1,z+1,.7,i,1)
            for j in range(3):place('redflower' if j%2 else 'flower',x-1+j*.75,z-1,.65+j*.1,i+j)
            if theme in ['meadow','jungle']:place('mushroom' if theme=='meadow' else 'fern',x-1,z+1,.45 if theme=='meadow' else .9,i)
    bpy.context.view_layer.update();detail_bounds=[]
    for o in set(current.objects)-detail_before:
        c=[o.matrix_world@Vector(v) for v in o.bound_box];lo=[min(v[k] for v in c) for k in range(3)];hi=[max(v[k] for v in c) for k in range(3)]
        assert hi[0]<=-17 or lo[0]>=17 or hi[1]<=-12 or lo[1]>=12
        detail_bounds.append({'min':lo,'max':hi})
    if theme=='meadow':
        place('pavilion',24,0,6.8,-math.pi/2)
        bunting(19.5,-12,12,6.8)
        for side in [-1,1]:
            for z in [-11,-7,7,11]:place('fence',side*18.5,z,1.0,math.pi/2)
            for x in [-12,-8,8,12]:place('fence',x,side*14.5,.85,0)
            place('logs',side*22,6,1,side);place('stump',side*21,8,.7,0)
        # Festive flower terraces with restrained cream retaining edges.
        for x,z in [(-24,0),(21,-15)]:
            box('FlowerBed',(x,.25,z),(4,.5,2.5),P['Cream'],.15)
            for j in range(6):place('redflower' if j%2 else 'flower',x-1.5+j*.6,z,.8,j)
        # Generous wildflower drifts and shaded picnic corners, not isolated dots.
        for i,(x,z) in enumerate([(-19,-9),(-20,10),(-8,-15),(7,15)]):
            for j in range(5):place('redflower' if j%2 else 'flower',x+(j%3)*.65,z+(j//3)*.8,.85+(j%2)*.25,i+j)
            place('logs',x-1,z+1.8,.75,i)
        bunting(-20,-10,10,5)
    elif theme=='jungle':
        # A broad waterfall grotto, not another pavilion or lonely arch.
        for z,h in [(-7,5),(-3,8),(2,7),(6,4)]:
            for o in place('rockB',28,z,h,z):o.scale.x*=.4
        for j in range(3):box('RuinTerrace',(24,j*.6,5),(6-j,.7,4-j*.5),P['Rock'],.18)
        for z in [2.8,7.2]:box('CarvedPillar',(23.5,2.9,z),(1,4.2,1),P['Roof'],.18)
        box('CarvedLintel',(23.5,5,5),(1.4,.9,6),P['Rock'],.2)
        category='Water';ribbon('Waterfall',[(24,6.5,-3),(23.8,4,-3),(22.8,.2,-3)],3.2,P['Water']);patch('GrottoPool',23,-3,4,5,P['Water'],.02);category='Scenery'
        for z in [-5,-1,3]:tube('HangingVine',[(24,7,z),(23,5,z+.3),(23.5,3,z)],.07,P['Leaf'])
        for z in [-13,14]:place('plateau',21,z,8,z,1)
        for j in range(9):box('GrottoBridgePlank',(20.3,.35,-7+j*.55),(2.4,.18,.46),P['Wood'],.04)
        for z in [-7,-2.6]:
            for x in [19.2,21.4]:beam('GrottoBridgePost',(x,0,z),(x,1.5,z),.09,P['WoodDark'])
        # Terraria-inspired vertical layers: tangled hanging vines, giant
        # colorful fungi and fern thickets, all beyond playable run-off.
        for i,(x,z) in enumerate([(-23,-8),(-24,7),(23,-12),(23,13),(-8,-19),(8,19)]):
            for j in range(3):
                vx=x+(j-1)*.8;vz=z+j*.6;top=6.5+(i%3)*.7;bottom=2.2+j*.5
                points=[(vx,top,vz),(vx+.35,(top+bottom)/2,vz+.2),(vx-.2,bottom,vz+.4)]
                for k in range(2):beam('CanopyVine',points[k],points[k+1],.045,P['Leaf'])
                for k in range(4):
                    y=bottom+(top-bottom)*k/4;side=1 if k%2 else -1
                    mesh('VineLeaf',[(vx,y,vz),(vx+side*.65,y+.22,vz+.25),(vx+side*.3,y+.5,vz+.4)],[(0,1,2)],P['LeafLight'])
            for j in range(2):place('fern',x-1+j*2,z+1.5,1.3+j*.3,i+j)
            mx=x+.6;mz=z-1.6;h=1.1+(i%3)*.35;r=.75+(i%2)*.25
            beam('GiantMushroomStem',(mx,0,mz),(mx,h,mz),.13,P['Cream'])
            vertices=[(mx,h+.65,mz)]+[(mx+math.cos(k*math.tau/12)*r,h,mz+math.sin(k*math.tau/12)*r) for k in range(12)]
            mesh('GiantMushroomCap',vertices,[(0,k+1,(k+1)%12+1) for k in range(12)],P['Accent'] if i%2 else P['Gold'])
            for k in range(3):
                a=k*math.tau/3
                ellipsoid('MushroomSpot',(mx+math.cos(a)*r*.45,h+.38,mz+math.sin(a)*r*.45),(.12,.045,.12),P['Cream'])
    elif theme=='beach':
        hut(24,-3)
        for x,z in [(-22,-6),(-21,7),(22,12)]:umbrella(x,z,P['Accent'] if z<0 else P['Roof'])
        for j in range(8):box('Boardwalk',(23,.08,-14+j*.5),(5,.15,.42),P['Wood'],.03)
        category='Water';mesh('Sea',[(-90,-1,-90),(-90,-1,90),(90,-1,90),(90,-1,-90)],[(0,1,2,3)],P['Water']);category='Scenery'
        for side in [-1,1]:
            category='Surface';ribbon('FoamShore',[(side*29,-.04,-8),(side*30,-.04,0),(side*28,-.04,10)],.45,P['Cream']);category='Scenery'
    elif theme=='mountain':
        mountain_ridge();hut(-24,0,True)
        for side in [-1,1]:
            for z in [-9,-5,5,9]:place('fence',side*19,z,.9,math.pi/2)
            category='Surface';patch('Snowdrift',side*23,12,5,4,P['Cream'],.01);category='Scenery'
        category='Water';patch('FrozenPond',23,-12,4,4,P['Water'],.01);category='Scenery'
        for z in [-9,-3,4,10]:place('pine',22,z,4.5,z,1)
        # Warm trail lamps and blue ice spires frame the alpine lodge.
        for x,z in [(-20,-8),(-20,8),(20,-10),(20,10)]:
            beam('TrailLampPost',(x,0,z),(x,3.1,z),.1,P['WoodDark'])
            box('TrailLantern',(x,3,z),(.5,.7,.5),P['Gold'],.06)
            box('LanternSnowCap',(x,3.45,z),(.75,.16,.75),P['Cream'],.04)
        for j in range(8):
            x=22+j%3;z=-16+j*.7
            peak(x,z,.35+(j%2)*.25,1.5+(j%3)*.6,P['Water'])
        for j in range(10):box('FrozenPondBridge',(21,.3,-15+j*.55),(2.4,.18,.45),P['Wood'],.03)
    else:
        # Dark terraced basalt frames a saturated lava basin and crater.
        n=24;vs=[];faces=[]
        for h,r in [(0,8),(4,6),(8,3.4),(8.7,2.8),(8.1,2.0)]:
            for i in range(n):a=i*math.tau/n;vs.append((29+math.cos(a)*r,h,math.sin(a)*r))
        for j in range(4):
            for i in range(n):faces.append((j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i))
        mesh('Caldera',vs,[tuple(reversed(f)) for f in faces],P['Rock'])
        category='Water';patch('Crater',29,0,2.1,2.1,P['Lava'],8.15);ribbon('LavaCascade',[(25.3,8.2,0),(22.5,4.1,0),(20.6,.1,0),(20.6,.1,7),(24,.1,13)],1.8,P['Lava']);category='Scenery'
        for side in [-1,1]:
            for j in range(7):
                x=side*(21+j%2*1.3);z=-12+j*3
                bpy.ops.mesh.primitive_cylinder_add(vertices=6,radius=.8,depth=1+j%3,location=xyz((x,(1+j%3)/2,z)));move_to(bpy.context.object,'BasaltColumn',P['Roof'] if j%3==0 else P['Rock'])
        category='Surface'
        for z in [-17,17]:ribbon('CoolingSeam',[(-17,.0,z),(-8,.0,z+.5),(5,.0,z-1),(18,.0,z)],.22,P['Lava'])
        category='Water';mesh('LavaSea',[(-90,-1.5,-90),(-90,-1.5,90),(90,-1.5,90),(90,-1.5,-90)],[(0,1,2,3)],P['Lava'])
        category='Scenery'
        # Playful bleached giant fossils: spine, paired curved ribs and skull.
        for x,z,scale in [(-22,-5,1),(22,11,.8),(-9,-18,.85)]:
            beam('FossilSpine',(x,1,z-3*scale),(x,1,z+3*scale),.14*scale,P['Cream'])
            for j in range(5):
                rz=z-2*scale+j*scale
                for side in [-1,1]:
                    pts=[(x,1,rz),(x+side*.8*scale,1.9*scale,rz),(x+side*1.5*scale,1.4*scale,rz),(x+side*1.6*scale,.2,rz)]
                    for a,b in zip(pts,pts[1:]):beam('FossilRib',a,b,.11*scale,P['Cream'])
            ellipsoid('FossilSkull',(x,1,z-3.4*scale),(.85*scale,.65*scale,1.1*scale),P['Cream'])
            for side in [-1,1]:
                ellipsoid('FossilEye',(x+side*.55*scale,1.45,z-3.8*scale),(.23*scale,.12*scale,.3*scale),P['WoodDark'])
                beam('FossilHorn',(x+side*.55*scale,1.45,z-3*scale),(x+side*.7*scale,2.2,z-2.8*scale),.1*scale,P['Cream'])
    # Validate every authored scenery mesh, including landmark and canopy bounds.
    bpy.context.view_layer.update();detail_bounds=[]
    for o in current.objects:
        if o.type!='MESH' or not o.name.startswith('Scenery_'):continue
        assert not o.data.validate(), 'Invalid authored mesh: '+o.name
        c=[o.matrix_world@Vector(v) for v in o.bound_box];lo=[min(v[k] for v in c) for k in range(3)];hi=[max(v[k] for v in c) for k in range(3)]
        assert hi[0]<=-17 or lo[0]>=17 or hi[1]<=-12 or lo[1]>=12, 'Scenery enters player envelope: '+o.name
        detail_bounds.append({'min':lo,'max':hi})
    entry=export(current,theme);entry['border_detail_meshes']=len(detail_bounds);entry['border_detail_bounds_z_up']=detail_bounds;entry['art_direction']=theme;manifest.append(entry);current.hide_render=True
bpy.data.libraries.write(BASE+'/Blender/designed-biomes.blend',{scene},compress=True)
old=json.loads(Path(OUT+'/manifest.json').read_text());old['assets']=[*manifest,*[a for a in old['assets'] if a['file'] in ['lobby.glb','beach.glb']]];old['generator']='Blender MCP / art-directed biomes';Path(OUT+'/manifest.json').write_text(json.dumps(old,indent=2))
result={'assets':[{k:v for k,v in a.items() if 'bounds' not in k} for a in manifest]}

