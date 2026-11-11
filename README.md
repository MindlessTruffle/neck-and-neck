# Neck & Neck: Meadow Mayhem

[Play on GitHub Pages](https://mindlesstruffle.github.io/neck-and-neck/) · [Source repository](https://github.com/MindlessTruffle/neck-and-neck)

A local 3D giraffe volleyball game with a close shoulder camera, independently controlled floppy neck, actual Blender-skinned athletes, a rebuilt meadow stadium, Kenney assets, and dramatic world-space effects. Both 1v1 and 2v2 use physical bots. No gameplay HUD: only the world, highlighted ball, and physical scoreboard.

## Start

Double-click **Start Game.cmd**, or run `npm run dev -- --port 5173` in this folder and open http://127.0.0.1:5173. Requires Node.js 20.19+ or 22.12+ and a WebGL-capable browser. Run `npm install` if dependencies are missing. Local development serves on localhost. The public release is deployed to GitHub Pages. No game account is required.

## Cartoon game interface

Original hand-inked giraffe illustrations, a chunky title crest, ragged parchment, wooden foe selector, red cloth banners, hard shadows, and tactile game buttons replace the former card interface. Start, pause, victory, defeat, controls, sound and fullscreen screens share the same illustrated style. Arrow keys browse menus; Enter chooses; H opens controls; F toggles fullscreen. Starting or resuming requests fullscreen when supported. Gameplay stays free of interface overlays.

## PC controls

| Input | Action |
| --- | --- |
| Mouse | Swing and bend your neck independently of the camera |
| Left click | Headbutt / serve |
| Right mouse held + move | Orbit the camera without changing neck aim |
| Alt | Toggle mouse capture / release |
| WASD / arrows | Move relative to the camera |
| Scroll / Q and E | Shorten / extend neck |
| Right mouse + scroll | Change camera distance |
| Space / Shift | Jump / dash |
| R / C | Center neck / reset camera |
| I J K L | Keyboard camera orbit alternative |
| Esc / P | Pause; P also resumes |
| M | Toggle audio |

Native pointer lock depends on browser support. Embedded previews may refuse it. In that case Alt toggles a focused mouse fallback: the cursor is hidden over the canvas, keyboard stays in the game, and mouse motion swings the neck while it remains in the preview. Left-drag also swings the neck without capture. Right-drag remains camera-only. Use the launcher to open the game in your desktop browser for native pointer lock.

Touch stays free of on-screen buttons: left drag moves, right drag swings the neck, tap bonks, two fingers jump, three fingers pause.

## Physics and play

Nine physical neck joints use damped springs, inertia, and iterative distance constraints. The human neck has low damping, visible overshoot, whip momentum, and contact recoil. The head collides with the ball using the contact normal and relative velocity. Flicking your mouse transfers momentum through the neck; headbutting adds a physical lunge. Camera orbit is independent of all neck controls. There is no target-based shot steering.

Movement has acceleration, friction, reduced air control, and regenerating dash energy. Human serves wait for input. Bots predict ball flight, cover court lanes, and position their heads to make physical contact. Different bot levels change reaction, movement and error. First to 7, win by 2, cap at 11. Ground contact and out-of-bounds rules apply.

The ball has an amber silhouette, world-anchored locator rings visible through the player, a chevron, comet trail, and predicted landing marker. Hits produce pooled 3D shock rings, slashes, lightning, sparks, camera impulses, layered impact sound, and brief hit-stop. Dashes, jumps, and points have their own effects. The system respects the operating system's reduced-motion preference for shake and heavy effects.

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
- `npm test`: ball/head momentum, independent neck input, bounded chain length, overshoot, whip velocity, recoil, serving, movement, net contact and substep stability.
- `npm run test:simulation`: 120 complete bot matches across both modes and all difficulties; asserts completion and score validity.

Browser checks confirmed zero gameplay UI, visible full player/neck, independent neck and camera controls, highlighted ball, live physics, and 60 fps on the test machine. The native desktop Alt capture check could not finish: Computer Use stopped because it could not verify the desktop browser URL. Embedded preview capture refusal is handled by the focus fallback; native capture must still be checked in a supported desktop browser.

React + Vite + Three.js. All runtime assets and fonts are local. No online multiplayer, game backend, or remote telemetry. GitHub Pages hosts the static release.


## Publishing

Pushes to main run the pinned GitHub Actions workflow in .github/workflows/pages.yml. It installs dependencies, runs gameplay and 120-match simulation checks, builds the game, and deploys dist to GitHub Pages. Relative asset paths support the repository subdirectory and localhost.

