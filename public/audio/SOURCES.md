# Local stock audio sources

All assets in this folder are served from the game's own origin. No third-party requests occur while playing.

## Background loop

**Juhani Junkala / SubspaceAudio — Chiptune Adventures, 1. Stage 1**

- Creator's release: https://opengameart.org/content/4-chiptunes-adventure
- Creator: https://juhanijunkala.com/
- Downloaded collection: `Juhani Junkala [Chiptune Adventures] OGG.zip`
- Original file: `Juhani Junkala [Chiptune Adventures] 1. Stage 1.ogg`
- Original seamless loop length: 41.14288 seconds.
- `adventure-stage1.ogg` is the original recording; `adventure-stage1.mp3` is a 128 kbps MP3 compatibility conversion made with FFmpeg.
- License: Creative Commons Zero (CC0), explicitly stated by the composer in the archive's `INFO.txt`. That original statement is included at `licenses/Juhani-Junkala-CC0.txt`.

## Kenney recordings

These recordings are CC0. Their original license files are bundled in `licenses/`.

| Local WAV | Creator's source recording | Pack |
| --- | --- | --- |
| click.wav | Audio/click_001.ogg | Kenney Interface Sounds 1.0 |
| ability.wav | Audio/confirmation_001.ogg | Kenney Interface Sounds 1.0 |
| bump.wav | Audio/impactSoft_medium_002.ogg | Kenney Impact Sounds 1.0 |
| set.wav | Audio/impactGeneric_light_002.ogg | Kenney Impact Sounds 1.0 |
| spike.wav | Audio/impactPunch_medium_001.ogg | Kenney Impact Sounds 1.0 |
| block.wav | Audio/impactSoft_heavy_001.ogg | Kenney Impact Sounds 1.0 |
| dive.wav | Audio/footstep_grass_001.ogg | Kenney Impact Sounds 1.0 |
| point.wav | Audio/Pizzicato jingles/jingles_PIZZI11.ogg | Kenney Music Jingles |

- https://kenney.nl/assets/impact-sounds
- https://kenney.nl/assets/interface-sounds
- https://kenney.nl/assets/music-jingles
- CC0: https://creativecommons.org/publicdomain/zero/1.0/

The eight sound effects were converted using FFmpeg to mono, 22,050 Hz, 16-bit PCM WAV. The music and effects are cached once per audio context, music loops through its own gain bus, and synthesis remains available if a local asset cannot load or decode.
