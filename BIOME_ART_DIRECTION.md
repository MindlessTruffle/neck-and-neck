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

Pages serves the visual assets; Oracle hosts authoritative matches and redirects its web root to Pages.

## November 15 gameplay and scenery pass

- Beach export is deliberately skipped by the builder. Its SHA-256 remains `4a15d318e297e165564884d0876503ab44dd6f8c352c419a03208469f3326565`.
- Meadow gains larger flower drifts, log seating and a second pennant line among its existing groves. Jungle gains a grotto boardwalk. Mountain gains trail lamps, an ice-spire cluster and pond bridge. Volcano gains three giant fossil skeletons and an animated lava sea with drifting crust patches. All scenery remains outside expanded movement bounds.
- Blender MCP could not connect to its interactive server. The installed Blender 5.2 executable rebuilt the authored scenes in background mode; the beach and lobby exports were preserved.
- Bump contact has a dedicated large comic label. Swing attempts have larger arcs and a camera-facing ripple; sparks and success labels require real contact. Online local action cues are predicted, with short server-echo suppression. Stable match identity prevents each network render snapshot from erasing trails and labels.
- Human dives launch immediately with faster cooldown and earlier flop pose. Forward/back neck reach is reduced 24% relative to camera aim; sideways target reach is unchanged. Ball return guidance solves speed-capped, net-clearing arcs into the opponent court for bumps, spikes, blocks and dives. Sets retain teammate-targeted behavior, and Feather retains its lift.
- Network ball positions use velocity-aware interpolation during continuous flight, skip interpolation across hit discontinuities, and preserve remote rig shape during brief extrapolation. Scores and contacts remain authoritative.
- Regression, network, 120-match simulation and asset-budget suites pass. Local eight-court load check measured approximately 120 Hz physics and 20 Hz snapshots, with no dropped simulation time. This is not an Oracle or physical-phone capacity guarantee.

This release changes shared physics and requires deploying `src/physics.js` to Oracle as well as the Pages client.
