# Release validation — 12 November 2026

## Automated checks

- Gameplay, frame-rate independence (30–240 Hz), neck control, input buffering, pointer capture, mobile stick ownership, camera, device budgets, skinned rig alignment, pooled VFX, audio, and profile transactions pass.
- Full-body celebration tests now check that rendered neck joints and head follow the torso tumble without changing authoritative physics points.
- 120 seeded complete matches cover 1v1/2v2 and all three bot levels. Both teams win in each configuration; longest rally is 41 contacts. All five powers and bump/set/spike/block/dive actions occur.
- Real WebSocket checks cover private parties, solo and duo queues, cancellation, authoritative scoring, reconnect/rejoin, expired sessions, payload/origin/rate/capacity limits, health telemetry, and the recovery watchdog.
- Production build passes. Visual fixture at `/tests/visual.html` is development-only and excluded from production entry points.

## Server measurements

Local four-second load check: eight courts, 32 WebSocket clients, 119.7 Hz physics per court, 20 Hz snapshots, 1.85 ms mean tick, 8.757 ms maximum tick, 22.36 ms event-loop p95, 99.7 MB process RSS, and no dropped simulation time. This is a development-PC measurement, not an E2 capacity claim.

The deployed Oracle E2 remains capped at two simultaneous courts. Public TLS tests pass for private 1v1/2v2, both public queues, and two simultaneous four-player 2v2 courts. The simultaneous-court test measured 20–20.2 snapshots per second for all eight clients. These short checks do not establish long-duration WAN latency or performance on every device.

## Presentation and device checks

- Independent cheaper-model reviewer inspected source and desktop/phone captures; feedback drove direct matchmaking, larger control guides, clear loss wording, mobile sign layout, readable shop contrast, and team identity on the compact HUD.
- Browser checks cover the home menu, skins and power shops, power rolling, match setup, queue/cancel, party creation, and portrait/landscape touch HUDs.
- Loading progress comes from the actual local asset queue. The generated four-frame mascot animates with CSS; reduced-motion uses a still frame.
- Mobile starts with 3,200 grass instances, 14 trees, eight flags per side, six fans per stand, and 512-pixel shadows. Adaptive resolution remains bounded at 0.75–1.25 DPR on phones. Scene props have fewer shadow casters.
- Score effects use connected full-body tumble, orange pooled particles, and action-start feedback distinct from ball impact. Final map pieces launch upward; finale framing uses a repeatable freeze-frame fixture for inspection.
- Device-size checks run on desktop hardware. Physical-phone thermal, battery and prolonged multiplayer testing remain unverified. Embedded browser pointer-lock restrictions still require direct Chrome/Edge play for native capture validation.

## Local preview

Run `npm run dev:online`, or double-click `Start Online.cmd`. Development binds to localhost. Use `Start Game.cmd` for solo preview.
