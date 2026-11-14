# Pixel menu update 

Generated with the built-in imagegen tool. Original outputs remain in the Codex generated-images directory; runtime copies are bundled in this repository.

## Assets and prompts

- `public/ui/destination-pixel-atlas.png`
  - Create production pixel-art game menu icon atlas, square image, transparent background. Exactly 4 equal quadrants in 2 by 2 grid with broad transparent padding. TOP LEFT: white and golden volleyball with little golden wings. TOP RIGHT: coral varsity jacket with cream sleeves. BOTTOM LEFT: bright purple crystal with golden orbit. BOTTOM RIGHT: two cute smiling golden giraffe heads wearing mint scarves. Authentic exquisite 16-bit SNES pixel art, visible large square pixel clusters, crisp hard stepped outlines, limited vibrant palette, dark purple 2-pixel outline, carefully hand-dithered shading. NOT smooth illustration, NOT vector, NO antialiasing, NO text, NO panels, NO baked shadows. All icons centered in respective quadrant, equal size and generous empty padding, no overlap. Pixel art drawn at apparent 64x64 pixels per icon and enlarged nearest-neighbor.
- `public/ui/giraffe-pixel-clouds.png`
  - Create a production retro pixel-art loading animation sprite sheet. WIDE 3:1 image containing exactly FOUR equal-width frames horizontally; each frame is portrait 3:4. Every frame shows same adorable golden giraffe with teal scarf playing volleyball atop a fluffy white peach-shaded CLOUD, entire giraffe, ball and cloud fully within frame, consistent scale, transparent background around each character-cloud vignette. Frame1 ball up above head, frame2 giraffe leans left as ball lowers, frame3 head bumps ball upward, frame4 giraffe smiles as ball rises. Giraffe has cute small body, long neck, brown spots, tiny horns. Authentic detailed 16-bit pixel art: clearly visible large square pixel clusters and crisp stepped dark plum outlines, limited warm golden palette, teal highlights, pastel cloud dithering, NO smooth brush illustration, NO antialiasing, NO text, NO grid or borders. Each frame looks like a beautifully hand-crafted 96x128 sprite enlarged nearest neighbor. Clouds must be beautiful plump pixel-art clouds with blue lavender shadow and creamy peach edges, aligned same baseline across all frames.

Menu textures use nearest-neighbor sampling and separate offset translucent silhouettes for real-time drop shadows. The loading strip uses four CSS animation frames, pixelated sampling, and a blue sky stage; its clouds are in the generated art.

## Rolling screen reference

Layout reference: [Volleyball Legends ability screen](https://progameguides.com/roblox/how-to-get-shield-breaker-in-volleyball-legends/). Center showcase and green spin button, power collection on the left, visible odds on the right, and red lobby return. Uses this game's five abilities, real roll probabilities, clover cost and duplicate refund; no placeholder lucky-spins or pity controls.

Run `npm run dev:online` and open localhost:5173.
