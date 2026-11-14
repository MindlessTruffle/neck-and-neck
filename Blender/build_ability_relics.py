"""Non-destructive authored ability relics; Blender +Y front, Z up."""
import bpy, math, os
from mathutils import Vector
root=os.path.dirname(os.path.dirname(__file__))
scene=bpy.data.scenes.new('Ability_Relics');bpy.context.window.scene=scene
mats={}
for name,color,metal in [('ink',(0.025,.04,.085,1),.3),('gold',(1,.61,.13,1),.65),('pink',(.88,.12,.46,1),.35),('ice',(.46,.95,.88,1),.25),('blue',(.13,.35,.7,1),.5),('orange',(1,.27,.055,1),.4),('white',(.94,.97,1,1),.15),('violet',(.43,.15,.83,1),.4)]:
 m=bpy.data.materials.new('Relic_'+name);m.diffuse_color=color;m.use_nodes=True;bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=color;bs.inputs['Metallic'].default_value=metal;bs.inputs['Roughness'].default_value=.3;mats[name]=m
parent=None

def finish(obj,mat):
 obj.data.materials.append(mats[mat]);obj.parent=parent
 if obj.type=='MESH':
  for p in obj.data.polygons:p.use_smooth=True
 return obj

def box(loc,scale,mat,bevel=.08):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.scale=scale;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 if bevel:mod=o.modifiers.new('Soft enamel edges','BEVEL');mod.width=bevel;mod.segments=3;o.modifiers.new('Weighted highlights','WEIGHTED_NORMAL')
 return finish(o,mat)
def sphere(loc,scale,mat):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=16,ring_count=8,location=loc);o=bpy.context.object;o.scale=scale;return finish(o,mat)
def cyl(loc,r,depth,mat):
 bpy.ops.mesh.primitive_cylinder_add(vertices=24,radius=r,depth=depth,location=loc);return finish(bpy.context.object,mat)
def cone(loc,r,depth,mat):
 bpy.ops.mesh.primitive_cone_add(vertices=16,radius1=r,radius2=.035,depth=depth,location=loc);return finish(bpy.context.object,mat)
def tube(points,r,mat):
 c=bpy.data.curves.new('Sculpted profile','CURVE');c.dimensions='3D';c.bevel_depth=r;c.bevel_resolution=3;s=c.splines.new('POLY');s.points.add(len(points)-1)
 for p,v in zip(s.points,points):p.co=(*v,1)
 o=bpy.data.objects.new('Relic detail',c);scene.collection.objects.link(o);return finish(o,mat)
def torus(loc,r,minor,mat,rot=(0,0,0)):
 bpy.ops.mesh.primitive_torus_add(major_segments=32,minor_segments=8,location=loc,major_radius=r,minor_radius=minor,rotation=rot);return finish(bpy.context.object,mat)
for ident in ['magnet','feather','spring','rocket','shield']:
 parent=bpy.data.objects.new(ident,None);scene.collection.objects.link(parent)
 if ident=='magnet':
  pts=[(.72*math.cos(t),0,.1+.72*math.sin(t)) for t in [math.pi+i*math.pi/32 for i in range(33)]];tube(pts,.23,'pink')
  for x in [-.72,.72]:
   box((x,0,.4),(.45,.47,.66),'pink');box((x,0,.8),(.47,.5,.24),'gold');box((x,0,.99),(.38,.43,.14),'white')
   for z in [-.1,.05,.2]:torus((x,0,z),.25,.035,'gold')
  sphere((0,-.02,-.53),(.34,.27,.28),'ink');sphere((0,-.25,-.53),(.2,.08,.18),'ice')
  for x in [-1,1]:tube([(x*.94,0,.5),(x*1.17,0,.76),(x*.98,0,.8),(x*1.23,0,1.1)],.055,'ice')
 if ident=='feather':
  sphere((0,0,0),(.25,.2,.72),'gold');torus((0,0,.9),.34,.055,'gold')
  for side in [-1,1]:
   for j in range(6):
    o=sphere((side*(.25+j*.13),0,.6-j*.2),(.14,.12,.62-j*.045),'ice' if j%2 else 'white');o.rotation_euler[1]=side*(.45+j*.09)
   tube([(side*.15,0,-.7),(side*.48,0,0),(side*.65,0,.63)],.045,'gold')
  sphere((0,-.21,.2),(.19,.12,.23),'violet')
 if ident=='spring':
  box((0,0,-.7),(1.2,.72,.28),'ink');box((0,-.15,-.52),(1.15,.95,.24),'gold')
  pts=[(.34*math.cos(t),.34*math.sin(t),-.35+i/100*1.1) for i,t in enumerate([i*math.pi/10 for i in range(101)])];tube(pts,.09,'gold')
  cyl((0,0,.86),.49,.2,'violet');sphere((0,0,1),(.32,.32,.2),'ice')
  for x in [-.5,.5]:
   tube([(x,0,-.5),(x,0,.65)],.06,'blue');sphere((x,0,.65),(.12,.12,.12),'pink')
  for x in [-.35,0,.35]:box((x,-.61,-.55),(.15,.1,.1),'ice',.02)
 if ident=='rocket':
  for x in [-.42,.42]:
   cyl((x,0,.2),.29,1.1,'orange');cone((x,0,.98),.3,.48,'gold');cyl((x,0,-.43),.34,.2,'ink');torus((x,0,.37),.3,.04,'gold')
   sphere((x,-.28,.4),(.16,.07,.18),'ice');box((x,-.16,-.31),(.52,.85,.22),'blue')
   flame=cone((x,0,-.93),.24,.75,'gold');flame.rotation_euler[0]=math.pi
   flame=cone((x,-.02,-.8),.12,.48,'ice');flame.rotation_euler[0]=math.pi
   for side in [-1,1]:o=box((x+side*.3,0,-.1),(.1,.5,.45),'gold');o.rotation_euler[1]=side*-.28
  tube([(-.42,.22,.6),(0,.3,.73),(.42,.22,.6)],.065,'ink')
 if ident=='shield':
  # A faceted canopy shield, with radial ribs, a jewel and curled handle.
  verts=[(0,-.24,.2)]+[(math.sin(i*math.pi/4)*.94,0,.2+math.cos(i*math.pi/4)*.94) for i in range(8)]
  mesh=bpy.data.meshes.new('Shield shell');mesh.from_pydata(verts,[],[(0,i+1,(i+1)%8+1) for i in range(8)]);mesh.update();o=bpy.data.objects.new('Canopy shield',mesh);scene.collection.objects.link(o);finish(o,'blue');sol=o.modifiers.new('Shell thickness','SOLIDIFY');sol.thickness=.1
  for i in range(8):
   a=verts[i+1];b=verts[(i+1)%8+1];tube([a,b],.055,'gold');tube([(0,-.26,.2),a],.024,'ice')
  sphere((0,-.31,.2),(.3,.15,.34),'violet');sphere((0,-.43,.23),(.14,.05,.18),'ice')
  tube([(0,.15,.1),(0,.15,-.93),(.14,.15,-1.06),(.32,.15,-.95)],.085,'gold')
# Bake and merge each authored relic into material batches for runtime.
for relic in [o for o in scene.objects if o.type=='EMPTY']:
 bpy.ops.object.select_all(action='DESELECT')
 children=[o for o in scene.objects if o.parent==relic]
 for o in children:o.select_set(True)
 bpy.context.view_layer.objects.active=children[0]
 bpy.ops.object.convert(target='MESH');bpy.ops.object.join()
 bpy.context.object.name=relic.name+'_surface'
# Single export, individual named relic roots. No existing scene changed.
bpy.ops.object.select_all(action='DESELECT')
for o in scene.objects:o.select_set(True)
os.makedirs(os.path.join(root,'public/models/abilities'),exist_ok=True)
bpy.ops.export_scene.gltf(filepath=os.path.join(root,'public/models/abilities/relics.glb'),export_format='GLB',use_selection=True,use_active_scene=True,export_apply=True)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(root,'Blender/ability-relics.blend'))
result={'models':5,'bytes':os.path.getsize(os.path.join(root,'public/models/abilities/relics.glb'))}
