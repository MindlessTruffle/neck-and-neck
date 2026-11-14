# World and menu art release

## Authored assets
Six Blender worlds: meadow, jungle, beach, volcano, mountain, and cloud harbour lobby. Editable source: `Blender/release-worlds.blend`. Build script preserves original source scenes and combines runtime scenery by material. Kenney Nature Kit and Quaternius Standard models retain their bundled CC0 licenses.

Imagegen direction:
- Loading: four illustrated retro game frames of a golden giraffe wearing a teal scarf, bouncing a volleyball. Rich sprite-like shading, consistent character and framing; no procedural pixel drawing. Runtime strip: `public/ui/giraffe-loading-illustrated.png`.
- Menu atlas: exactly four equal quadrants, transparent padded background; winged volleyball, coral varsity jacket, purple crystal with gold orbit, two smiling giraffes with mint wreath. Hand-painted inventory art, plum outlines, warm bounce light, no text or borders. Runtime: `public/ui/destination-atlas.png`.
- Sky: seamless horizontal 3:1 painted panorama; cerulean upper sky, turquoise and cream lower sky, peach-lit cumulus on lower third, wisps and open centre. Gouache grain; no terrain, objects, text or sun disk. Runtime: `public/textures/painted-sky.png`.

## Runtime budget
Each world stays below 40,000 triangles, 25 material batches and 6 MiB. Combined exported worlds stay below 12 MiB; enforced by `tests/world-assets.mjs`. Only one arena is visible at a time. Shared textures, no postprocessing pipeline, adaptive pixel ratio and existing quality controls.

Browser review covered all five arenas, desktop menu, portrait and landscape layouts, loading illustration, and airborne win aftermath. Desktop meadow observed 60 FPS / 97 draws / 215,272 total triangles including athletes. Measurements are from this development machine, not a physical phone performance guarantee.
