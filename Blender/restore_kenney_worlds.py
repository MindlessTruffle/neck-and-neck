"""Restore Kenney-led arena art, preserving existing gameplay and lobby export."""
from pathlib import Path
BASE=str(Path(__file__).resolve().parents[1])
# Reuse the non-destructive authoring helpers; do not rebuild the menu.
source=Path(BASE+'/Blender/build_release_worlds.py').read_text()
exec(compile(source.split('manifest=[];collections=[]')[0],__file__,'exec'))
scene.name='Kenney_Arena_Restoration'
extra={'detailed':'tree_detailed','roundpine':'tree_pineRoundC','fall':'tree_oak_fall','plateau':'tree_plateau','small':'tree_small','rockB':'rock_largeB','tallrock':'rock_tallC','fence':'fence_planks','gate':'fence_gate','sign':'sign','logs':'log_stack','stump':'stump_roundDetailed','mushroom':'mushroom_redGroup','redflower':'flower_redA','bushTriangle':'plant_bushLargeTriangle'}
for key,name in extra.items():
    before=set(bpy.data.objects);bpy.ops.import_scene.gltf(filepath=BASE+'/public/kenney/nature/'+name+'.glb');parts=[]
    for o in [o for o in bpy.data.objects if o not in before]:
        if o.type=='MESH':
            o.data=o.data.copy();o.data.transform(o.matrix_world);o.parent=None;o.matrix_world.identity();parts.append(o)
        for c in list(o.users_collection):c.objects.unlink(o)
        source_collection.objects.link(o)
    sources[key]=parts
before=set(bpy.data.objects);bpy.ops.import_scene.gltf(filepath=BASE+'/public/models/meadow-pavilion.glb');parts=[]
for o in [o for o in bpy.data.objects if o not in before]:
    if o.type=='MESH':
        o.data=o.data.copy();o.data.transform(o.matrix_world);o.parent=None;o.matrix_world.identity();parts.append(o)
    for c in list(o.users_collection):c.objects.unlink(o)
    source_collection.objects.link(o)
sources['pavilion']=parts
# Reuse foliage / flower / rock pigments on the pavilion's planter details.
for o in parts:
    for slot in o.material_slots:
        name=slot.material.name.split('.')[0]
        target={'Leaf':'bush','Flower':'flower','Stone':'rock'}.get(name)
        if target:
            candidates=[m for obj in sources[target] for m in obj.data.materials if m]
            slot.material=next((m for m in candidates if ('leafs' in m.name if target=='bush' else 'colorYellow' in m.name if target=='flower' else True)),candidates[0])

# Share identical native pigments across imported assets to keep draw counts small.
shared={}
for parts in sources.values():
    for o in parts:
        for slot in o.material_slots:
            m=slot.material
            if not m:continue
            bs=m.node_tree.nodes.get('Principled BSDF') if m.use_nodes else None
            images=tuple(n.image.name for n in m.node_tree.nodes if n.type=='TEX_IMAGE' and n.image) if m.use_nodes else ()
            key=(tuple(round(x,4) for x in (bs.inputs['Base Color'].default_value if bs else m.diffuse_color)),images)
            if key not in shared:shared[key]=m
            slot.material=shared[key]
manifest=[]
for theme,gc,sc in [('meadow','#91bb54','#887d65'),('jungle','#6b9d4b','#63765e'),('beach','#efcf8b','#b59b78'),('volcano','#685e63','#504c58'),('mountain','#aac4a5','#83949e')]:
    current=bpy.data.collections.new('Restored_'+theme);scene.collection.children.link(current)
    ground=mat(theme+'_Ground',gc);stone=mat(theme+'_Cliff',sc)
    island(35,29,ground,stone)
    # Original varied Kenney tree silhouettes, grouped into asymmetric groves.
    groves=[(-26,-16),(-17,-23),(4,-24),(23,-19),(29,-5),(27,15),(10,24),(-16,23),(-29,8)]
    for i,(x,z) in enumerate(groves):
        if theme=='meadow':
            asset(['oak','detailed','fall','roundpine','plateau'][i%5],x,z,5.5+i%3,i*.6)
            asset('detailed' if i%2 else 'small',x+3,z-2,4+i%3,i)
        elif theme=='jungle':
            asset('plateau' if i%2 else 'oak',x,z,8+i%3,i*.5)
            if i%3==0:asset('detailed',x-3,z+2,6,i)
            asset('fern',x+2,z+2,1.1,i)
            asset('small',x+3,z-3,4.5+i%2,i)
        elif theme=='beach':
            palm(x,z,5.5+i%3)
            if i in [1,5]:palm(x+3,z-1,4.5)
        elif theme=='mountain':
            asset('pine' if i%2 else 'roundpine',x,z,6+i%3,i)
            if i%3==0:asset('pine',x+3,z+1,4.8,i)
        else:
            asset('tallrock',x,z,3+i%3,i*.7)
            asset('rockB',x+2,z+1,1.5,i)
        asset('rock' if i%2 else 'rockB',x-2,z+1,1.0+i%3*.25,i*.8)
        if theme!='volcano':asset('bush' if i%2 else 'bushTriangle',x+1,z+2,.8+i%3*.2,i)
    # Keep the entire expanded x +/-17, z +/-12 movement envelope unobstructed.
    for side in [-1,1]:
        if theme in ['meadow','mountain']:
            for x in [-15,-11,-7,7,11,15]:asset('fence',x,side*16.5,.9,0)
            asset('gate',0,side*16.5,1.1,0)
        asset('sign',side*20,side*8,1.2,side*1.1)
        asset('logs',side*22,-side*12,.7,side*.8)
        asset('stump',side*20,-side*14,.55,side)
        for i in range(5):
            x=side*(9+i*2);z=side*(19+math.sin(i)*1.3)
            if theme in ['meadow','jungle','mountain']:
                asset('redflower' if i%2 else 'flower',x,z,.35+i%2*.12,i)
                if theme=='meadow' and i%2:asset('mushroom',x+1,z+.8,.3,i)
            elif theme=='beach':asset('rockB',x,z,.35,i)
    if theme=='meadow':
        asset('pavilion',24,1,6.7,-math.pi/2)
        for x,z in [(-21,2),(-22,-1)]:asset('oak',x,z,5.5,x)
    elif theme=='jungle':
        # Mossy stone terraces and waterfall: one focal landmark, framed by foliage.
        for j in range(3):box('TempleTerrace',(25,j*.7,1),(6-j,.8,6-j),stone,.2)
        tube('TempleArch',[(25,2,-1),(25,5,-1),(25,6.4,1),(25,5,3),(25,2,3)],.45,stone)
        category='Water';ribbon('JungleFalls',[(25,4,-2),(25,2,-.8),(25,.08,3),(31,-1,6)],1.8,water);category='Scenery'
    elif theme=='beach':
        asset('pavilion',-25,2,5.5,math.pi/2)
        for i in range(8):box('PierBoard',(20+i*.65,.1,-16),(.58,.18,3.6),wood,.04)
        category='Water';mesh('Lagoon',[(-80,-1.1,-80),(-80,-1.1,80),(80,-1.1,80),(80,-1.1,-80)],[(0,1,2,3)],water);category='Scenery'
    elif theme=='mountain':
        for x,z,r,h in [(32,-20,7,14),(38,3,8,18),(-32,-19,6,12)]:
            before=set(current.objects);asset('tallrock',x,z,h,x*.2)
            for o in set(current.objects)-before:
                o.data=o.data.copy();o.data.materials.clear();o.data.materials.append(stone);o.data.materials.append(cream)
                low=min(v.co.z for v in o.data.vertices);high=max(v.co.z for v in o.data.vertices)
                for face in o.data.polygons:
                    face.material_index=1 if min(o.data.vertices[v].co.z for v in face.vertices)>low+(high-low)*.65 else 0
        asset('pavilion',-25,3,5.4,math.pi/2)
    else:
        n=24;verts=[];faces=[]
        for h,r in [(0,8),(4,5.7),(8,3.3),(9,2.9),(8.3,2.1)]:
            for i in range(n):
                a=i*math.tau/n;rr=r*(1+.07*math.sin(i*2));verts.append((28+math.cos(a)*rr,h,-19+math.sin(a)*rr))
        for j in range(4):
            for i in range(n):faces.append((j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i))
        mesh('VolcanicCaldera',verts,faces,stone)
        category='Water';ellipsoid('CraterGlow',(28,8.35,-19),(2.15,.08,2.15),lava);category='Scenery'
        for o in current.objects:
            if 'Pack_rock' in o.name or 'Pack_tallrock' in o.name:
                o.data=o.data.copy();o.data.materials.clear();o.data.materials.append(stone)
                for face in o.data.polygons:face.material_index=0
        category='Water';ribbon('LavaFlow',[(28,8.4,-17),(26,5,-15),(24,.05,-13),(25,.05,-5),(31,.05,-2)],1.4,lava);category='Scenery'
        for x,z in [(21,15),(-24,-7),(-20,19)]:asset('tallrock',x,z,4.2,.3)
    if theme=='volcano':
        for o in current.objects:
            if 'Pack_rock' in o.name or 'Pack_tallrock' in o.name:
                o.data=o.data.copy();o.data.materials.clear();o.data.materials.append(stone)
                for face in o.data.polygons:face.material_index=0
    manifest.append(export(current,theme));current.hide_render=True
bpy.data.libraries.write(BASE+'/Blender/kenney-restored-worlds.blend',{scene},compress=True)
old=json.loads(Path(OUT+'/manifest.json').read_text());old['assets']=[*manifest,*[a for a in old['assets'] if a['file']=='lobby.glb']];old['generator']='Blender MCP / Kenney restoration';Path(OUT+'/manifest.json').write_text(json.dumps(old,indent=2))
result={'assets':manifest,'blend':bpy.data.filepath}
