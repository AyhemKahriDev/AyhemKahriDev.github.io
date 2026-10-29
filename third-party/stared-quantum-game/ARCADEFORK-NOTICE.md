# stared/quantum-game - vendored third-party game

- **Repository:** https://github.com/stared/quantum-game
- **Author:** stared
- **Licence:** MIT (see LICENSE.md in this folder)
- **Vendored by:** arcadefork (Ayhem Kahri)

The original MIT licence text ships in this folder and applies to its contents.

## Local repairs

- `index_alt.html`: / -> ./
- `index_alt.html`: removed a dead <script> tag for `jspm_packages/system.js`
- `js/sound_service.js`: ``/sounds/${def.file}`` -> ``sounds/${def.file}`` (the sound paths are built at runtime, so the generic rules cannot see them)
- `build.js`: `"/sounds/"+` -> `"sounds/"+` (the bundled build has the same runtime-built sound paths)
