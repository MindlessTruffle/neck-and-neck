# Relic and cosmetics release

Blender MCP authored five distinct models, exported to `public/models/abilities/relics.glb` (478,540 bytes). Editable source `Blender/ability-relics.blend`; reproducible builder `Blender/build_ability_relics.py`. Source scenes preserved. Runtime material batches, cached source GLB, and black unlit silhouette clones.

Built-in imagegen assets and exact prompts:

## Utility icons
`public/ui/toy-icons.png`

Production UI sprite atlas for a cute sports video game. Square transparent canvas, EXACTLY 4 columns and 4 rows, 16 equal cells, each icon centered with 20% transparent padding, no overlap. Kenney-style clean chunky 3D toy UI icons, vibrant pastel enamel colors, thick dark navy outline, soft beveled edges, extremely readable, consistent scale and frontal three-quarter view, no text, no background panels, no letters. Row1 left to right: golden gear; blue question-mark symbol; mint speaker with sound waves; pink musical double note. Row2: cream hand pointing index finger; blue fullscreen four corner brackets; red left arrow; red cross X. Row3: golden clover coin; violet lightning bolt; green play triangle; gold trophy. Row4: cyan padlock; mint checkmark; blue globe with meridians; orange pause two vertical bars. Crisp high quality game-ready isolated icon sheet, preserve exact grid order.

## Cosmetics
`public/ui/cosmetics-atlas.png`

Create game inventory icon atlas, transparent wide 3:2 canvas, exactly THREE columns and TWO rows, six equal square cells with generous transparent margins. Kenney-style polished chunky toy objects, navy outlines, bright clean enamel colors, front three-quarter perspective, no text, no numbers, no card backgrounds. Top row left to right: teal baseball cap with gold star badge; royal gold crown with three colored jewels; coral bucket hat with cream band. Bottom row left to right: dark navy sunglasses with cyan reflective lenses; pink heart-shaped sunglasses; turquoise little hiking backpack with gold volleyball badge and coral straps. Consistent high quality game item icons, no shadows baked outside objects. Each occupies central 65 percent of cell.

## Supplied bubble
`public/ui/player-power-bubble.png` is the user's supplied bubble, copied unchanged. Both main-menu badges use it with `background-size: contain`.

## Retro power icons
`public/ui/power-icons-retro.png`: built-in imagegen, six icons in a 3 by 2 atlas. Square cells, nearest-neighbor display, original alpha retained. Used for all five abilities and online players. No SVG substitutes.

Create a true transparent retro pixel-art game icon atlas, square canvas exactly 3 columns by 2 rows, six equally sized cells. Crisp intentional chunky pixels, limited SNES 32-color palette, dark pixel outlines and stepped highlights, NO smooth gradients, NO painted brush strokes, NO typography. Each complete icon centered with 10 percent empty margin within its own cell. Top left pink horseshoe MAGNET silver tips yellow lightning; top center mint ivory FEATHER golden stem; top right teal BOOT ON PURPLE COIL SPRING; bottom left orange twin ROCKET BOOTS with gold pixel flames; bottom center turquoise SHIELD gold border; bottom right BLUE TWO-PLAYER head and shoulder icon. Unique, polished readable silhouettes, cheerful classic handheld RPG inventory art, tiny pixel shadow below each. Transparent background between and behind icons, no panels or borders.

