# Neck & Neck final release review

Independent review against the requested polished game presentation, readable controls, mobile fit, and clear return navigation. No game source was edited during review.

## Resolved

- Mobile home landmark cards use a 2×2 layout; supplied portrait capture showed no overlaps and kept the island center clear.
- Multiplayer shows username and 1v1/2v2/PARTY before connection. Parent verified auto-connect/cancel and party creation/join; the Pages `VITE_SERVER_URL` is configured.
- Loss copy says “MATCH LOST.” Help now maps the serve sequence, mouse/touch return, movement, set, jump-set, dive, jump, dash, power, pause, capture and neck stretch. Red back controls use the Kenney UI images.
- The 390×844 gameplay capture showed joystick and action targets inside the viewport. Score labels now retain tinted MEADOW/EMBER attribution at 16px in touch layout.
- Shop/powers portrait views fit horizontally, show large readable cards, avoid duplicate currency, and keep disabled text legible. No horizontal overflow or clipping stood out in supplied mobile captures.

## Remaining polish observations (non-blocking)

- **Finale effect readability:** `work/release-finale.png` shows match explosion terrain broken into large floating grass slabs. It can read like the island geometry failed instead of a celebratory finale. If the same impression holds during play, smaller debris accents with a clearer celebration focus would read better.
- **Point effect coverage:** `work/release-point.png` has vivid rings and streaks, but they cover much of the court during impact. Given the reported 0.4s freeze this may be intentional; review for readability in motion.
- **Desktop map sightline:** `work/release-home.png` still has some island figures occluded by destination signs. Mobile layout is clearer; desktop cards could move toward the perimeter while keeping their current target size.

The effects screenshots are from the visual-effects harness and include its overlay panel; they do not show the complete release UI. No source-level release blocker was found in this final pass. The parent reports the build and multiplayer interactions were verified; I did not rerun tests.
