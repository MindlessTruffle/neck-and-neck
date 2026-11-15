# Biome art direction

This pass replaces all five arena compositions. The lobby, menu layout, physics, cosmetics and networking remain unchanged.

- Meadow: emerald lawns, berry blossom grove, original Kenney pavilion, flower terraces, fencing and festival pennants.
- Jungle: layered teal canopy, dense fern beds, hanging vine curtains, oversized coral/gold mushrooms, waterfall grotto, carved ruin gate and pool. The added vertical vegetation takes inspiration from Terraria's jungle without copying its assets.
- Beach: peach sand, turquoise sea, striped coral cabana and parasols, palm clusters and boardwalk.
- Volcano: plum basalt, hexagonal columns, orange crater and lava cascade, cooling seams instead of garden paths.
- Mountain: continuous snow-capped ridge, warm timber lodge, pine groups, snowdrifts and frozen pond.

The arena footprint is smaller (31 by 24 radius), with clear playable run-off retained. Unequal groves and low planted beds frame the court. Broad surface patches, coordinated pigments, restrained material fill and a painted terrain atlas replace flat color slabs. Texture repeat mirrors inside each atlas quadrant to prevent neighboring-biome bleed.

## Editable source

Blender MCP runs `Blender/design_biomes.py`, creating `Blender/designed-biomes.blend` and the five runtime `public/models/worlds/*.glb` files. The script imports the existing credited Kenney and Quaternius source assets. Original authoring scenes and lobby export are preserved. Each map is batched by surface, scenery, water and material. Every scenery bounding box is checked against the expanded movement envelope; invalid meshes are rejected before export.

`public/textures/biome-paint-atlas.png` is original built-in imagegen output, copied unchanged. It is not an official Kenney asset. Exact prompt:

> Game environment texture atlas, exactly four equal square quadrants in a 2x2 grid, no borders, no text. Orthographic top-down hand-painted Nintendo-inspired stylized terrain materials, subtle diffuse albedo only, no baked lighting or shadows. Top left: rich emerald meadow grass, broad soft tufts with occasional tiny clover shapes. Top right: warm pale peach beach sand, gently raked ripples and tiny shell flecks. Bottom left: cool deep plum basalt gravel, broad dark stone plates and thin aubergine seams, no lava. Bottom right: clean powder blue-white alpine snow with soft wind-swept brush marks. Each quadrant fills its entire square, low-frequency texture and restrained contrast so a ball and court lines remain readable. High-quality painterly game material, no objects, no perspective, no scenery. Square canvas.

## Review

Start `npm run dev:online`. Game: http://127.0.0.1:5173/ . Gallery: http://127.0.0.1:5173/tests/visual.html?gallery . Select each biome; turn off Overview camera to inspect gameplay framing.

Regression and asset budgets: `npm test`. Production build: `npm run build`. Each map must stay below 40,000 triangles and 25 material batches. Desktop browser review settles near 60 FPS; this is not a physical-mobile performance guarantee. No additional postprocessing, shadow lights, or per-frame scene construction were added.

Release authorized for GitHub Pages and the existing Oracle multiplayer service. Pages serves the visual assets; Oracle hosts authoritative matches and redirects its web root to Pages. This art-only release requires no multiplayer restart.
