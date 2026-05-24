# Assets Log

Hackathon asset drop for chess lounge placeholders. Files were added only under `public/sounds/` and `public/models/kenney/`.

## Sources

- SoundSpool / Freesound "Piece Slide" by el_boss: https://soundspool.com/sounds/piece-slide
  - Downloaded preview: https://cdn.freesound.org/previews/546/546118_9129912-hq.mp3
  - License: CC0 / Public Domain
- SoundSpool / Freesound "Piece Capture" by el_boss: https://soundspool.com/sounds/piece-capture
  - Downloaded preview: https://cdn.freesound.org/previews/546/546120_9129912-hq.mp3
  - License: CC0 / Public Domain
- Kenney Interface Sounds: https://kenney.nl/assets/interface-sounds
  - Downloaded pack: https://kenney.nl/media/pages/assets/interface-sounds/fa43c1dd4d-1677589452/kenney_interface-sounds.zip
  - License: Creative Commons CC0
- OpenGameArt "Victory" by celestialghost8: https://opengameart.org/content/victory
  - Downloaded file: https://opengameart.org/sites/default/files/Victory_0.mp3
  - License: CC0
- OpenGameArt "Calm Loop" by wipics: https://opengameart.org/content/calm-loop
  - Downloaded file: https://opengameart.org/sites/default/files/Relaxing.mp3
  - License: CC0 / Public Domain
- OpenGameArt "Mini Character 1" by Kenney: https://opengameart.org/content/mini-character-1
  - Downloaded pack: https://opengameart.org/sites/default/files/kenney_mini-characters.zip
  - License: CC0
- Wikimedia Commons "Chessboard480.svg": https://commons.wikimedia.org/wiki/File:Chessboard480.svg
  - Downloaded file: https://commons.wikimedia.org/wiki/Special:Redirect/file/Chessboard480.svg
  - License: Creative Commons CC0 1.0 Universal Public Domain Dedication
- User-provided Meshy AI player character exports
  - Dropped into `public/models/maincharacter/`
  - License: user-provided for this hackathon project
- ambientCG Fabric018: https://ambientcg.com/view?id=Fabric018
  - Downloaded pack: https://ambientcg.com/get?file=Fabric018_1K-JPG.zip
  - License: Creative Commons CC0
- ambientCG Wood027: https://ambientcg.com/view?id=Wood027
  - Downloaded pack: https://ambientcg.com/get?file=Wood027_1K-JPG.zip
  - License: Creative Commons CC0
- ambientCG WoodFloor051: https://ambientcg.com/view?id=WoodFloor051
  - Downloaded pack: https://ambientcg.com/get?file=WoodFloor051_1K-JPG.zip
  - License: Creative Commons CC0
- Kenney Furniture Kit: https://kenney.nl/assets/furniture-kit
  - Downloaded pack: https://kenney.nl/media/pages/assets/furniture-kit/440e0608a4-1677580847/kenney_furniture-kit.zip
  - License: Creative Commons CC0
- OpenGameArt "3d chess pieces" by tunakron: https://opengameart.org/content/3d-chess-pieces
  - Downloaded pack: https://opengameart.org/sites/default/files/chess_pieces.zip
  - License: Creative Commons CC0
- OpenGameArt "Chess" by pjhanzlik: https://opengameart.org/content/chess
  - Downloaded pack: https://opengameart.org/sites/default/files/chess.zip
  - License: Creative Commons CC0
- OpenGameArt "Chess board & pieces" by KillGorack: https://opengameart.org/content/chess-board-pieces
  - Downloaded pack: https://opengameart.org/sites/default/files/wood_chess_board.zip
  - License: Creative Commons CC0

## Processing Notes

- `move.mp3` was trimmed from the Piece Slide source to 0.16s with a short fade-out.
- `capture.mp3` was trimmed from the Piece Capture source to 0.22s.
- `check.mp3` was converted from Kenney `Audio/error_003.ogg`.
- `game-start.mp3` was converted from Kenney `Audio/confirmation_002.ogg`.
- `checkmate.mp3` was trimmed from OpenGameArt `Victory_0.mp3` to 1.10s with fade-out.
- `ambient.mp3` was looped from OpenGameArt `Relaxing.mp3` to 30.0s, attenuated to quiet playback, and faded in/out.
- Character models were extracted from Kenney `Models/GLB format/` without modification.
- `wikimedia-chessboard480.svg` is used as a subtle board-frame texture/reference layer behind the CSS-skinned interactive board.
- Meshy player GLBs were integrated as provided. Walk root-position tracks are stripped at runtime so code-driven movement stays in place.
- ambientCG packs were reduced to 1K JPG runtime maps under `public/assets/materials/`; source archives and non-runtime formats were discarded.
- Selected Kenney Furniture Kit GLBs were copied to `public/models/furniture/` without modification.
- OpenGameArt chess-piece GLBs were extracted to `public/models/chess/cc0-pieces/gltf/` and used as decorative table pieces.
- OpenGameArt chess ZIPs were retained under `public/assets/vendor/opengameart/` as raw CC0 source/reference assets.

## Verification

- MP3 files verified with `ffprobe`: all open as MP3 audio streams and are larger than 1KB.
- GLB files verified by header: magic `glTF`, version `2`, declared length matches file size, and all are larger than 1KB.

## Final Summary

| File | Size | Duration | Source | License |
| --- | ---: | ---: | --- | --- |
| `public/sounds/move.mp3` | 5,228 B | 0.160s | https://soundspool.com/sounds/piece-slide | CC0 / Public Domain |
| `public/sounds/capture.mp3` | 6,956 B | 0.220s | https://soundspool.com/sounds/piece-capture | CC0 / Public Domain |
| `public/sounds/check.mp3` | 13,835 B | 0.520s | https://kenney.nl/assets/interface-sounds | Creative Commons CC0 |
| `public/sounds/checkmate.mp3` | 28,255 B | 1.100s | https://opengameart.org/content/victory | CC0 |
| `public/sounds/game-start.mp3` | 14,462 B | 0.539s | https://kenney.nl/assets/interface-sounds | Creative Commons CC0 |
| `public/sounds/ambient.mp3` | 601,663 B | 30.000s | https://opengameart.org/content/calm-loop | CC0 / Public Domain |
| `public/models/kenney/character-female-a.glb` | 273,448 B | n/a | https://opengameart.org/content/mini-character-1 | CC0 |
| `public/models/kenney/character-female-b.glb` | 252,140 B | n/a | https://opengameart.org/content/mini-character-1 | CC0 |
| `public/models/kenney/character-female-c.glb` | 252,040 B | n/a | https://opengameart.org/content/mini-character-1 | CC0 |
| `public/models/kenney/character-male-a.glb` | 246,916 B | n/a | https://opengameart.org/content/mini-character-1 | CC0 |
| `public/models/kenney/character-male-b.glb` | 247,332 B | n/a | https://opengameart.org/content/mini-character-1 | CC0 |
| `public/boards/wikimedia-chessboard480.svg` | 230 B | n/a | https://commons.wikimedia.org/wiki/File:Chessboard480.svg | CC0 1.0 |
| `public/models/maincharacter/Meshy_AI_Animation_Idle_3_withSkin.glb` | 7,118,500 B | n/a | User-provided Meshy export | User-provided |
| `public/models/maincharacter/Meshy_AI_Animation_Sit_to_Stand_Transition_F_withSkin.glb` | 7,065,296 B | n/a | User-provided Meshy export | User-provided |
| `public/models/maincharacter/Meshy_AI_Animation_walking_2_withSkin.glb` | 7,021,704 B | n/a | User-provided Meshy export | User-provided |
| `public/assets/materials/Fabric018/*.jpg` | varies | n/a | https://ambientcg.com/view?id=Fabric018 | CC0 |
| `public/assets/materials/Wood027/*.jpg` | varies | n/a | https://ambientcg.com/view?id=Wood027 | CC0 |
| `public/assets/materials/WoodFloor051/*.jpg` | varies | n/a | https://ambientcg.com/view?id=WoodFloor051 | CC0 |
| `public/models/furniture/*.glb` | varies | n/a | https://kenney.nl/assets/furniture-kit | CC0 |
| `public/models/chess/cc0-pieces/gltf/*.glb` | varies | n/a | https://opengameart.org/content/3d-chess-pieces | CC0 |
| `public/assets/vendor/opengameart/*.zip` | varies | n/a | OpenGameArt CC0 chess sources listed above | CC0 |
