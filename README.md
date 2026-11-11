# Neck & Neck: Meadow Mayhem

[Play on GitHub Pages](https://mindlesstruffle.github.io/neck-and-neck/) · [Source](https://github.com/MindlessTruffle/neck-and-neck)

A cartoon giraffe volleyball game: physical floppy necks, high shoulder camera, approachable mouse-only rallies, 1v1 and 2v2 with bots, and a new random power every point.

## Start locally

Double-click **Start Game.cmd**, or run:

```sh
npm install
npm run dev -- --port 5173
```

Open http://127.0.0.1:5173. Development binds to localhost. Requires Node.js 20.19+ or 22.12+ and WebGL2. All models, fonts, music and sounds are bundled locally.

## Play with a mouse

- Move the mouse to swing the physical neck. The high shoulder camera follows the actual neck with a small, bounded spring lag; there is no right-mouse camera mode.
- Click to bump or spike. Assisted footwork approaches the ball; a click near a reachable high ball can trigger a jump spike.
- Serve with two clicks: toss, then strike when the power meter reaches the highlighted zone. Missing the second click produces a gentle fallback serve.
- Hold left click for about half a second during a rally to use your round power.
- Alt toggles native mouse capture; a drawn cursor stays centered. Escape pauses.

Assisted footwork is enabled by default and can be disabled in the lobby or pause menu. WASD or the mobile stick overrides automatic movement immediately. Physical contact still depends on the moving neck; the game does not teleport the ball onto a scripted hit.

Native pointer lock is requested before fullscreen within the same gesture. Unsupported embedded previews show an honest capture prompt and support left-drag swings. Open directly in Chrome or Edge for native capture. F toggles fullscreen; leaving fullscreen preserves windowed play on resume.

## Optional controls

| Input | Action |
| --- | --- |
| WASD / arrows | Manual movement relative to the camera |
| Left click | Bump on ground / spike in air; toss / strike when serving |
| Q | Set on ground / block in air |
| E | Jump set |
| Ctrl | Diving save |
| Space / Shift | Jump / dash |
| X or hold left click | Activate round ability |
| Scroll / [ / ] | Extend or shorten neck |
| R / C | Recenter neck / reset view |
| J / L | Keyboard turning |
| Esc / P | Pause; P resumes |
| M / F | Mute / fullscreen |

On phones, drag the right field to swing and use the labeled return/action buttons. The left thumbstick overrides assisted footwork. Portrait and landscape layouts are supported; landscape shows more court. Touch controls can also be switched on for a touchscreen laptop. Controls use pointer capture, ownership tracking, cancel handling and safe-area spacing.

## Volleyball systems

The action grammar follows the [official Volleyball Legends controls](https://www.roblox.com/games/73956553001240/Volleyball-Legends): contextual bump/spike and set/block, dives, two-step serves and directional aiming. The sports UI uses a top score strip, team-touch pips, timed serve meter, contextual action deck and round-power reveal. Artwork, giraffe rig, audio selection and implementation are this game's own.

- Real bump, set, spike, block, jump-set and low diving contacts.
- Three touches per possession. Doubles alternate receivers; a block is exempt. Solo permits repeat touches. Lingering body overlap cannot cause accidental double-touch faults.
- Bots predict trajectories, cover lanes, set partners, attack openings, block and dive. They use all five powers.
- First to 7, win by 2, capped at 11. Modes are one local human plus bots, not network multiplayer.
- Ball radius .34, gravity 10.8, outgoing speed cap 11.5. Wider human contact margins, soft momentum transfer and forward-return assistance make rallies forgiving.
- Neck remains a nine-point physical spring chain with inertia, whip and recoil. Rigged Blender skin follows those joints.
- Fixed 120 Hz simulation and interpolated rendering. Inputs survive between display frames; movement and actions have recovery buffers.

## Random round powers

Every player receives one free, non-repeating random ability each point. One activation per point; bots follow the same rule.

| Power | Effect |
| --- | --- |
| Feather Float | Slower, lofted next return |
| Spring Step | Higher jump for an attack or block |
| Magnet Head | Wider receiving field |
| Rocket Hooves | Burst movement and extended diving reach |
| Iron Canopy | Broad blocking window |

World-space action callouts, ball highlights, landing locator, impact rings, colored trails and rising volley notes communicate contact and long rallies. VFX reuse bounded pools. Motion effects respect reduced-motion preferences.

## Art, stock audio and performance

Characters and scenery use cel shading and thick ink silhouettes. Blender-created weighted giraffes and pavilion sit among actual Kenney Nature Kit models: trees, bushes, flowers, rocks, fences, gate, signs, logs, stumps and mushrooms. Kenney input prompts appear in the action deck.

Stock music is **Chiptune Adventures — Stage 1** by Juhani Junkala / SubspaceAudio, under CC0. Eight stock effects come from Kenney Impact Sounds, Interface Sounds and Music Jingles. Original licenses and source filenames are included. See [CREDITS.md](CREDITS.md) and [audio sources](public/audio/SOURCES.md).

Audio totals approximately 2.38 MiB. The music loop has Ogg and MP3 copies for codec compatibility. Samples are decoded once and cached; music and sound switches are independent. A procedural fallback remains available when decoding fails. Disposal aborts pending requests and releases voices/buffers.

Device budgets cap pixel ratio at 1.25 on mobile, 1.4 on low-power desktop and 1.75 otherwise. Mobile starts with fewer grass blades, trees and spectators plus 1024px shadows. Sustained slow frames lower resolution and decoration density further. Instanced scenery and shared geometry reduce draw overhead. Camera hot paths reuse vectors. Portrait FOV expands to 85 degrees; wider screens use 65, with a smooth aspect-ratio transition on resize.

Browser QA checks desktop and phone-sized layouts; automated tests cover device budgets and quality adaptation. These are not benchmarks on every physical phone or GPU. WebGL context loss gives a recovery message, and losing visibility pauses play.

## Verification

```sh
npm test
npm run test:simulation
npm run build
npm run preview
```

Regression suites cover neck/ball physics, contact forgiveness, all six volleyball actions, timed serves and fallback, every ability, possession faults, round resets, input buffering, 30–240 Hz display equivalence, camera following, multi-pointer controls, adaptive rendering, asset geometry, stock audio, cleanup and bounded VFX.

The mechanics release completed 120 seeded bot matches across both modes and all three difficulties. Every configuration produced wins for both teams. Mean hits per point ranged from 3.81 to 10.39; longest rally was 51. Tests also counted actual sets, spikes, blocks, diving contacts and all five ability activations.

## Publishing

The GitHub Pages workflow on main installs dependencies, runs regression suites and all 120 simulation matches, builds the game and deploys dist. Relative asset paths support the repository subdirectory. Keep local preview available with Start Game.cmd.

