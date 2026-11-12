# Cloud Club release validation

## Automated checks

- Physics, 30–240 Hz rendering equivalence, input buffering, capture, camera, touch ownership, device budgets, skinned alignment, full-body actions, VFX pools, audio, and profile transactions pass.
- 120 seeded full bot matches completed across both modes and three difficulties. Longest rally: 41 contacts. Mean contacts per point: chill 3.75/7.40, club 4.86/8.92, elite 5.83/10.62 for 1v1/2v2. Both teams won in every configuration.
- Real WebSocket tests cover private 1v1 and four-human 2v2, solo matchmaking, same-team duo queues, cancellation, input sequencing, authoritative scores, rejoin, forfeit celebration, origin/rate/payload/capacity checks, trusted-proxy address handling, and cleanup.
- Client tests cover 30 Hz buffered action edges, 90 ms interpolation, bounded 100 ms extrapolation, local movement/neck prediction, reconciliation, reordered snapshots, event deduplication, reconnect expiry and timer/socket disposal. Native WebSocket integration uses the real server.
- Production client builds successfully. Docker image builds and runs as a non-root user with a read-only filesystem and no capabilities. Its production-origin WebSocket handshake, room creation and health endpoint passed. Compose and Caddy configurations validate.

## Measured local server load

Seven-second run, eight courts / 32 real WebSocket clients:

| Metric | Result |
| --- | ---: |
| Physics per court | 119.9 Hz |
| Snapshots per client | 20 Hz |
| Mean server tick | 2.477 ms |
| Maximum tick | 54.466 ms |
| Event-loop p95 | 25.43 ms |
| Process RSS | 100.6 MB |
| Total outbound | 4.84 MB/s |
| Dropped simulation time | 0 ms |

Rounded snapshots reduced outbound traffic by roughly 44% from the initial implementation, to approximately 150 KB/s per client. This test runs server and simulated clients on one development PC. It is not an Oracle throughput guarantee or a long-duration soak test.

Two runs during Docker startup/shutdown and concurrent desktop work missed timing targets (roughly 95–100 Hz physics and 11–13 Hz snapshots). The quiet-host run above passed with unchanged timing assertions. Shared CPU contention matters: begin with fewer rooms on a busy VM, measure there, and increase capacity only after testing.

## Browser observations

- Tested desktop and 390×844 portrait layouts, skin purchase/equip, persistent power rolls, manual movement, mouse-driven neck/camera motion, serving, flop dive, and music scene loading.
- Two separate browser clients created/joined a private room, started an authoritative match, showed opposite-team shoulder cameras, served, scored, handled a leaving opponent, displayed results and returned to the party.
- Local browser observations reached 60 FPS, including the new court. Mobile-size observations were on desktop hardware, not a physical phone benchmark.
- The embedded browser refused native pointer lock, so drag fallback was verified there. Capture ordering/error-state tests pass; direct browser capture still needs an ordinary Chrome/Edge session outside that embedded restriction.
- Oracle provisioning, public DNS/certificate issuance, WAN multiplayer latency, and physical-device testing remain external handoff checks.

## Art and audio budget

New arena and lobby: approximately 2.2 MB, 39,562 combined triangles, 5/11 materials. Seven Quaternius models plus shared 512-pixel textures: approximately 4.33 MB. Total world asset bundle: approximately 8.36 MB before audio/fonts. Only the active world is rendered.

Mobile starts at a 1.25 DPR cap, four lobby giraffes, 7,000 grass instances and 1024-pixel shadows. Sustained slow frames reduce DPR as far as 0.75 and shadows to 512. Effects use bounded pools and reduced-motion variants.

Five generated music scenes and twelve generated effects total under 3 MiB. Scene loads and rapid transitions have race/disposal tests, a two-music-voice limit, and a 64-node transient ceiling. Stock/procedural fallbacks remain bundled. Credentials are absent from source, public assets and client bundles.
