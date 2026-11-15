# Mobile control review

Jump is the dominant 84px target. Bump is turquoise (68px); Dive is coral (64px landscape / 58px narrow portrait). Set, Jump Set, Dash and Power use quieter 48px targets with distinct glyphs. Landscape puts secondary actions beside the main cluster; portrait moves Dash and Power above it. Safe-area padding keeps controls away from device edges. The score remains background-free.

Input fires on pointer-down. Buttons capture their own pointer, ignore secondary mouse buttons and show immediate pressed feedback. Joystick thumb updates on initial contact and movement. Existing independent joystick/aim pointer ownership remains intact. Keyboard Dive is V; persisted Ctrl bindings migrate, and Ctrl/Command chords bypass gameplay and key rebinding.

## Guidance

- Apple touch-game guide: https://developer.apple.com/videos/play/wwdc2026/358/
- Android target-size guidance: https://developer.android.com/guide/topics/ui/accessibility/views/apps-views

Android recommends 48dp targets; this web implementation uses a 48 CSS-pixel minimum rather than claiming native dp equivalence.

## Validation

Browser visual review at 320x740, 390x844 and 844x390 CSS pixels. Inspected actual running game, target geometry, Jump and Dive animations. No control overlap in reviewed layouts; secondary actions at least 48x48. Controls remain icon-only with accessible labels. Use tests/responsive.html; toggle touch controls on when testing landscape with a desktop pointer. Resizing this harness now preserves the match.

Full npm test and production build passed. Regression coverage includes Ctrl migration, reserved browser chords and unique action glyphs. Physical-device multi-touch feel still needs real phone testing; browser review does not measure touchscreen latency.

Local preview: npm run dev:online
