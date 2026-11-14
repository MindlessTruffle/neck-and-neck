# Neck & Neck: Meadow Mayhem

[Play on GitHub Pages](https://mindlesstruffle.github.io/neck-and-neck/) · [Source](https://github.com/MindlessTruffle/neck-and-neck)

A cartoon giraffe volleyball game: physical floppy necks, high shoulder camera, manual movement, 1v1 and 2v2 with bots, a cloud lobby, eight skin palettes, and persistent equipped powers.

## Start locally

Double-click **Start Game.cmd**, or run:

```sh
npm install
npm run dev -- --port 5173
```

Open http://127.0.0.1:5173. Development binds to localhost. Requires Node.js 20.19+ or 22.12+ and WebGL2. All models, fonts, music and sounds are bundled locally.

## Relics, cosmetics and pixel menu release

- Five original Blender ability relics: equipped power enlarged in the centre, four pure-black silhouettes orbiting behind it.
- Pixel-art destination icons and cloud giraffe loading strip, illustrated circular bubble shortcuts, and crisp screen-resolution text anchored to the 3D signs.
- Live presence counts players in queues or matches (not idle menu connections); polls every 12 seconds while the menu is visible, with an honest offline state.
- Hats, sunglasses and backpack cosmetics persist, follow the physical character and travel with online loadouts. Purchases use earned clovers.
- Illustrated utility icons, mobile-safe sign positions, touch-sized controls and full-width phone sliders.
- Art sources and prompts: `RELIC_RELEASE_ART.md` and `PIXEL_MENU_ART.md`.

## Map and menu release

Release includes six Blender-authored worlds with bundled Kenney and Quaternius assets, painted skies, and illustrated menu destinations.

- Five randomly selected courts: meadow, jungle, beach, volcano and mountain. Online players receive the same server-selected map.
- Four clickable 3D island signs, an image-generated retro giraffe loading animation and a 3D power carousel.
- Longer dives before and during rallies, neck-segment contacts and a larger ball/contact window.
- Options cover mouse/touch sensitivity, inverted aim, camera distance, key bindings, volume, rendering, reduced motion and English/Spanish/French UI.
- Completed solo queue matches return to mode selection; real parties return to their idle lobby. Two-player parties can queue for 2v2 together.

For frontend plus local multiplayer, run `npm run dev:online`. To use the isolated backend port used for this review in PowerShell:

```powershell
$env:PORT = '8788'
npm run dev:online
```

Close existing local preview processes before restarting. In Multiplayer → Advanced, use `ws://127.0.0.1:8788` for that port (saved server choices take precedence).

Validation: unit/mechanics, network lifecycle, fixed-clock bot simulation, build, responsive browser checks and an eight-court local load test. Desktop load results are not an Oracle or physical-phone performance guarantee.

## Play with a mouse

- Move the mouse to swing the physical neck. The high shoulder camera follows the actual neck with a small, bounded spring lag; there is no right-mouse camera mode.
- Click to bump or spike. WASD moves; Space jumps. Your physical neck can also strike the ball.
- Serve with two clicks: toss, then strike when the power meter reaches the highlighted zone. Missing the second click produces a gentle fallback serve.
- Hold left click for about half a second during a rally to use your equipped power.
- Alt toggles native mouse capture; a drawn cursor stays centered. Escape pauses.

Movement is fully manual through WASD or the mobile stick. Gentle ball guidance favours playable court space while preserving physical misses and out-of-bounds shots. Physical contact still depends on the moving neck; the game does not teleport the ball onto a scripted hit.

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
| X or hold left click | Activate equipped ability |
| Scroll / [ / ] | Extend or shorten neck |
| R / C | Recenter neck / reset view |
| J / L | Keyboard turning |
| Esc / P | Pause; P resumes |
| M / F | Mute / fullscreen |

On phones, drag the right field to swing and use the circular action buttons. The control guide maps each symbol to its action. The left thumbstick moves your giraffe. Portrait and landscape layouts are supported; landscape shows more court. Touch controls can also be switched on for a touchscreen laptop. Controls use pointer capture, ownership tracking, cancel handling and safe-area spacing.

## Volleyball systems

The action grammar takes inspiration from [Volleyball Legends](https://www.roblox.com/games/73956553001240/Volleyball-Legends): contextual bump/spike and set/block, dives, two-step serves and directional aiming. The sports UI uses a top score strip, team-touch pips, a timed serve meter and contextual actions. The cloud lobby and giraffe game are original; licensed stock assets are credited below.

- Real bump, set, spike, block, jump-set and low diving contacts.
- Three touches per possession. Doubles alternate receivers; a block is exempt. Solo permits repeat touches. Lingering body overlap cannot cause accidental double-touch faults.
- Bots predict trajectories, cover lanes, set partners, attack openings, block and dive. They use all five powers.
- First to 7, win by 2, capped at 11. Practice uses one local human plus bots; online rooms and queues use two or four real humans.
- Ball radius .34, gravity 10.8, outgoing speed cap 11.5. Wider human contact margins, soft momentum transfer and forward-return assistance make rallies forgiving.
- Neck remains a nine-point physical spring chain with inertia, whip and recoil. Rigged Blender skin follows those joints.
- Fixed 120 Hz simulation and interpolated rendering. Inputs survive between display frames; movement and actions have recovery buffers.

## Skins and equipped powers

Visit the Dressing Cloud for eight skins. Use earned clovers at the Wishing Star to roll and equip powers; odds and duplicate refunds are shown before rolling. The equipped power persists across points and refreshes its charge each point. Bots select one power per match. Progress saves on this device, with no real-money purchases.

| Power | Effect |
| --- | --- |
| Feather Float | Slower, lofted next return |
| Spring Step | Higher jump for an attack or block |
| Magnet Head | Wider receiving field |
| Rocket Hooves | Burst movement and extended diving reach |
| Iron Canopy | Broad blocking window |

World-space action callouts, ball highlights, landing locator, impact rings, colored trails and rising volley notes communicate contact and long rallies. VFX reuse bounded pools. Motion effects respect reduced-motion preferences.

## Art, stock audio and performance

Characters and scenery use cel shading and thick ink silhouettes. Blender-created weighted giraffes play on a painted floating meadow; lounging giraffes inhabit a cloud-garden lobby with projected landmark buttons. The new arena and lobby total about 2.2 MB. Seven optimized Quaternius Nature models add textured foliage alongside actual Kenney Nature Kit scenery and Kenney control prompts. Blender source scenes and original painted texture are included.

Five original ElevenLabs instrumental themes cover lobby, skins, powers, matches and results, with twelve generated action sounds. They were generated through the owner's paid account and are not labelled CC0. The fallback music is **Chiptune Adventures — Stage 1** by Juhani Junkala / SubspaceAudio (CC0); eight fallback effects come from Kenney. See [CREDITS.md](CREDITS.md) and [audio sources](public/audio/SOURCES.md) for licenses, source filenames and generation provenance. No API credentials ship with the game.

Generated audio is under 3 MiB, with the earlier 2.38 MiB fallback bundle retained. Scene music loads on demand and crossfades with at most two music voices; transient sounds have a strict 64-node ceiling. Samples are decoded once and cached. Music and sound switches are independent, and a procedural fallback remains available. Disposal aborts pending requests and releases voices/buffers.

Device budgets cap pixel ratio at 1.25 on mobile, 1.4 on low-power desktop and 1.75 otherwise. Mobile starts with fewer grass blades, trees and spectators plus 1024px shadows. Sustained slow frames lower resolution and decoration density further. Instanced scenery and shared geometry reduce draw overhead. Camera hot paths reuse vectors. Portrait FOV expands to 85 degrees; wider screens use 65, with a smooth aspect-ratio transition on resize.

Browser QA checks desktop and phone-sized layouts; automated tests cover device budgets and quality adaptation. These are not benchmarks on every physical phone or GPU. WebGL context loss gives a recovery message. Losing visibility pauses solo play and neutralizes online input; an online match keeps running.

## Online parties and queues

Run `npm run dev:online` or double-click `Start Online.cmd` for a localhost client and server. Party Post supports private room codes, host mode/team selection, 1v1 and 2v2 queues, and two-person parties that queue on the same team. There is no online bot fill.

The Node WebSocket server owns all physics and scoring. It simulates at 120 Hz, sends snapshots at 20 Hz, and accepts buffered 30 Hz inputs. The browser predicts its own movement and neck, interpolates remote poses by about 90 ms, and caps extrapolation at 100 ms. Rejoin grace is 15 seconds. Guest names and room state live on the server; clovers and cosmetics stay on the local device.

See [ORACLE_SETUP.md](ORACLE_SETUP.md) for the complete VM handoff, Docker/Caddy deployment, TLS, origin settings and operations. No Oracle account or VM has been created. Until one is provisioned, use localhost or enter your own secure server address in Party Post.

## Verification

```sh
npm test
npm run test:simulation
npm run test:network
npm run test:load
npm run build
npm run preview
```

Regression suites cover neck/ball physics, contact forgiveness, all six volleyball actions, timed serves and fallback, every ability, possession faults, round resets, input buffering, 30–240 Hz display equivalence, camera following, multi-pointer controls, adaptive rendering, asset geometry, stock audio, cleanup and bounded VFX.

This release completed 120 seeded bot matches across both modes and all three difficulties. Every configuration produced wins for both teams. Mean hits per point ranged from 3.75 to 10.62; longest rally was 41. Real WebSocket tests cover rooms, queues, four-player inputs, reconnect, forfeits, malformed messages and capacity limits. See [RELEASE_VALIDATION.md](RELEASE_VALIDATION.md) for measurements and practical limits.

## Publishing

The GitHub Pages workflow on main installs dependencies, runs regression suites and all 120 simulation matches, builds the game and deploys dist. Relative asset paths support the repository subdirectory. Keep local preview available with Start Game.cmd.


### Kenney map restoration
Five arenas rebuilt with the original Kenney Nature Kit silhouettes, camp props, pavilion and cel palette. Expanded movement bounds, abilities, queues and menu behavior are preserved. Blender source: `Blender/kenney-restored-worlds.blend`; builder: `Blender/restore_kenney_worlds.py`. Arena GLBs total about 4.6 MiB, with 11–23 material batches each. The lobby remains independently authored.

The supplied circular bubble contains either the equipped retro imagegen power icon or the live online-player count. Power icons and rolling-menu currency art retain their correct aspect ratios.
