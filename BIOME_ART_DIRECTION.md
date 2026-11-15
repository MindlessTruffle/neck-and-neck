# Worldbuilding release

Four arena compositions were rebuilt from zero in Blender; the approved beach and lobby exports are preserved. Gameplay, expanded run-off, menus, cosmetics and multiplayer rules remain unchanged.

- Meadow: an open anime-inspired valley, smooth layered hills, irregular oak/blossom groves, painted grass and flower swathes, stream and pavilion landmarks.
- Jungle: a connected multi-depth canopy, broad fern beds, hanging leafy vine curtains, mossy stone guardians and broken ruins, water and irregular mushroom colonies. GPU moths/fireflies and soft canopy light shafts add motion without hiding the court.
- Volcano: a broad lava sea, distant broken caldera, layered basalt faces, glowing rim and descending lava tributaries, fossil skeletons and fractured columns. Lava uses dark crust, irregular molten channels and emission tied to hot areas.
- Mountain: connected alpine ridgelines, broken snow gullies, layered crags, pine belts, glacier water and a warm lodge. Painted blue/lavender mineral and frost variation breaks up large faces.

## Authoring and assets

`Blender/design_biomes.py` builds the four worlds using the credited Kenney/Quaternius source assets plus original Blender-authored landscape and landmark meshes. `Blender/designed-biomes.blend` preserves the editable scene. Each world is merged by material to bound draw calls. Tall scenery stays outside the x +/-17, z +/-12 movement envelope. Groundcover is noncolliding and must leave the regulation court clear.

`public/textures/world-paint-v2.png` is a new original imagegen albedo atlas: meadow grass, jungle moss/earth, volcanic basalt and alpine snow. It is not an official Kenney asset. The approved beach continues to use `biome-paint-atlas.png`; its model SHA-256 remains `4a15d318e297e165564884d0876503ab44dd6f8c352c419a03208469f3326565`.

Texture prompt: four equal top-down painted quadrants, no gutters or text; anime adventure gouache grass in jade/yellow-green, humid emerald jungle floor, charcoal-aubergine basalt and blue-white alpine snow. Broad harmonious pigment variation, no baked shadows or scenery. Original generated PNG copied unchanged into the repository.

## Rendering and performance

Only one world is visible. Each nonbeach biome adds one GPU particle draw; jungle adds one soft shaft draw. Mobile particle counts are reduced. No full-screen postprocessing or additional shadow lights. Leaf motion and atmosphere use shared time uniforms. Terrain and cliff pigment are evaluated in existing material passes.

The frame loop samples actual frame time before physics clamping and ignores hidden/unfocused browser throttling. Hidden pages stop rendering; paused courts and unfocused previews redraw at 30 Hz. Large displays use explicit drawing-buffer pixel budgets (Auto 3M desktop, High 5M, Low/mobile 1.5M); CSS UI stays at native resolution. These budgets follow the rationale in the [Three.js responsive rendering guide](https://threejs.org/manual/pages/responsive.html).

Public model, image and audio URLs now include content hashes on production builds. Changed assets cannot reuse stale cached bytes; unchanged beach assets retain the same version. No cookies, progress or settings are cleared. Canvas diagnostics expose actual GPU, frame/CPU timings and render pixels for local troubleshooting; they are not uploaded.

## Review and checks

The visual critic reviewed both baselines and both sidelines, and required revisions for buried trees, repeated mushroom rows, overly angular hills, flat lava and sparse mountain faces. Use `tests/visual.html?gallery&map=jungle&view=home`; supported views include home, away, north, south, overview, reverse and gameplay. The gallery preserves map/view selections on reload.

Required checks: `npm test`, `npm run build`, CI simulation/network suites and live asset verification. Each arena stays below 40,000 authored triangles and 25 authored material batches. Browser performance observations are not a guarantee of FPS on all devices.

Local preview: `npm run dev:online` then http://127.0.0.1:5173/ . Pages serves visual assets; Oracle remains the authoritative multiplayer server. This release changes client art/rendering only and does not require restarting active Oracle matches.
