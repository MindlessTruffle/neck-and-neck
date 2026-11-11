# Neck & Neck: Meadow Mayhem

[Play on GitHub Pages](https://mindlesstruffle.github.io/neck-and-neck/) · [Source repository](https://github.com/MindlessTruffle/neck-and-neck)

A cartoon 3D giraffe volleyball game with an elevated camera, independently controlled floppy neck, Blender-skinned athletes, an ink-outlined meadow stadium, Kenney assets, and dramatic world-space effects. Both 1v1 and 2v2 use physical bots. Gameplay keeps a centered aiming cursor, world-space feedback, highlighted ball, and physical scoreboard.

## Start

Double-click **Start Game.cmd**, or run `npm run dev -- --port 5173` in this folder and open http://127.0.0.1:5173. Requires Node.js 20.19+ or 22.12+ and a WebGL-capable browser. Run `npm install` if dependencies are missing. Local development serves on localhost. The public release is deployed to GitHub Pages. No game account is required.

## Cartoon game interface

Original hand-inked giraffe illustrations, a chunky title crest, ragged parchment, wooden foe selector, red cloth banners, hard shadows, and tactile game buttons replace the former card interface. Start, pause, victory, defeat, controls, sound and fullscreen screens share the same illustrated style. Arrow keys browse menus; Enter chooses; H opens controls; F toggles fullscreen. Starting or resuming requests fullscreen when supported. Gameplay keeps a centered cursor and a capture prompt only while mouse capture is released.

Characters and scenery use four-band cel materials, warm flat colors, and dark ink silhouettes. The character outlines follow the actual deformed Blender skin; scenery outlines share geometry and repeated scene pieces are instanced. Outline widths stay legible at different camera distances. The world and menus share the same original cartoon-brawler art direction.

## PC controls

| Input | Action |
| --- | --- |
| Mouse | Swing and bend your neck independently of the camera |
| Left click | Headbutt / serve |
| Right mouse held + move | Turn the camera horizontally without changing neck aim; height stays locked |
| Alt | Toggle native mouse capture / release, with a visible centered game cursor |
| WASD / arrows | Move relative to the camera |
| Scroll / Q and E | Shorten / extend neck |
| Right mouse + scroll | Change camera distance |
| Space / Shift | Jump / dash |
| R / C | Center neck / reset camera |
| J / L | Keyboard camera turn alternative |
| Esc / P | Pause; P also resumes |
| M | Toggle audio |

Starting, resuming, or pressing Alt requests pointer lock before fullscreen, within the same user gesture. Native capture keeps relative mouse movement inside the game while a drawn cursor stays centered. Escape pauses and releases capture. If an embedded browser rejects capture, the game shows a retry prompt and leaves the real pointer visible; it never claims a fake lock. Left-drag remains available. Open the game in Chrome or Edge for native capture.

Camera height stays fixed at 6.8 units with a 65° field of view. Jumping, mouse pitch, and impacts cannot move it vertically. Horizontal turning and distance adjustment remain available.

Touch stays free of on-screen buttons: left drag moves, right drag swings the neck, tap bonks, two fingers jump, three fingers pause.

## Physics and play

Nine physical neck joints use damped springs, inertia, and iterative distance constraints. The human neck has low damping, visible overshoot, whip momentum, and contact recoil. Head contacts use relative velocity with a padded, softer response and an 11.5 units/second outgoing speed cap. Human contact radius gains .25 units, or .35 during a swing. Forward and top contacts get moderate court-direction assistance and a lifted return arc; backward hits retain their direction. Mouse and headbutts still control the physical neck independently of camera turning.

Ball gravity is 12 rather than 18, and serves travel horizontally at 6.4 rather than 8.5 units/second. Test strikes reduced horizontal return speed by approximately 63% for an ordinary swing and 82% for an extreme whip. Player jump gravity is unchanged.

Physics runs at a fixed 120 Hz. Rendering interpolates body, ball, head, and neck poses between ticks, including on high-refresh displays. Inputs wait for the next physics tick instead of disappearing. Jump, dash, and headbutt also accept a short recovery buffer. Swept head and net contacts catch fast motion between ticks. Visual impact effects never slow movement or physics.

Movement has acceleration, friction, reduced air control, and regenerating dash energy. Dash commits to your movement direction (or neck aim when standing) with an eased boost. Human serves wait for input. Bots predict ball flight, brake into position, cover court lanes, and position their heads to make physical contact. Different bot levels change reaction, movement and error. First to 7, win by 2, cap at 11. Ground contact and out-of-bounds rules apply.

The ball has a highlighted silhouette, world-anchored locator rings visible through the player, a chevron, comet trail, and predicted landing marker. Even gentle hits produce clear contact rings and comic callouts such as “GOOD SAVE!” and “VOLLEY 3!” Longer rallies strengthen the ball aura and trail, and return notes rise with the volley count. Four pooled labels reuse prepainted textures. Missed swings use a smaller wind-up effect. Dashes, jumps, and points have their own effects. The system respects the operating system's reduced-motion preference for shake and heavy effects.

## Blender assets

The connected Blender MCP created, rigged, exported, and rendered the actual runtime assets in an isolated Blender session. The existing user scene was preserved.

- `Blender/neck-athlete.blend`: editable athlete and pavilion studio scenes.
- `Blender/athlete-preview.png`, `Blender/pavilion-preview.png`: rendered asset previews.
- `public/models/giraffe-athlete.glb`: 12,951 vertices, 21 skin joints, continuous weighted eight-bone neck, head, articulated legs, tail, eyes, ears, ossicones, irregular spots, and team scarf.
- `public/models/giraffe-rig.json`: rest transforms and runtime skeleton metadata.
- `public/models/meadow-pavilion.glb`: timber club pavilion with curved tiled roof, benches, lanterns, banners, and planters.

Runtime armatures follow the nine physical neck points; each leg uses two-bone IK. Skinning alignment was checked on extreme curved poses with finite bounds and exact head/neck positions. World art also includes Kenney vegetation and rocks, wooden tribunes, cheering spectators, pennants, paths, flowerbeds, clouds, birds, grass and hills. See `CREDITS.md`.

## Build and verification

- `npm run build`: production files in `dist/`.
- `npm run preview`: localhost preview of the production build.
- `npm test`: ball/head momentum, independent neck input, bounded chain length, overshoot, whip velocity, recoil, serving, buffered abilities, continuous contacts, pause/reset isolation, and identical physics across 30–240 Hz displays.
- `npm run test:simulation`: 120 complete bot matches across both modes and all difficulties; asserts completion and score validity.

The forgiving-ball update was compared against the prior release with the same seeded bot matches. Every match finished and both teams won in each mode/difficulty group:

| Foes | 1v1 hits/point, before → after | 2v2 hits/point, before → after |
| --- | --- | --- |
| Chill | 1.92 → 4.19 | 2.21 → 4.85 |
| Scrappy | 3.04 → 4.71 | 3.07 → 5.75 |
| Savage | 3.58 → 5.26 | 3.28 → 6.21 |

The longest new rally reached 25 hits. Separate regressions check contact forgiveness, bounded impact speed, forward-only assistance, pose interpolation, preserved input edges, pause buffers, capture request ordering, audio startup/disposal, bounded VFX resources, and outline geometry integrity.

The preceding cel-shading release was measured at 60 fps on the test machine, with 148 render calls versus 562 before batching. The new capture flow has ordering and rejection regression tests. The embedded preview reports “The root document of this element is not valid for pointer lock,” so native capture must be used in a supported desktop browser; no false locked state is displayed.

React + Vite + Three.js. All runtime assets and fonts are local. No online multiplayer, game backend, or remote telemetry. GitHub Pages hosts the static release.


## Publishing

Pushes to main run the pinned GitHub Actions workflow in .github/workflows/pages.yml. It installs dependencies, runs gameplay and 120-match simulation checks, builds the game, and deploys dist to GitHub Pages. Relative asset paths support the repository subdirectory and localhost.

