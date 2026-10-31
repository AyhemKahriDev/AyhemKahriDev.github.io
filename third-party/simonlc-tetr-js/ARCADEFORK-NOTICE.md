# simonlc/tetr.js - vendored third-party game

- **Repository:** https://github.com/simonlc/tetr.js
- **Author:** simonlc
- **Licence:** MIT (see LICENSE in this folder)
- **Vendored by:** arcadefork (Ayhem Kahri)

The original MIT licence text ships in this folder and applies to its contents.

## Local repairs

- `index.html`: `<video id=bg src=bg.webm loop autoplay></video>` -> `<video id=bg loop autoplay></video>` (bg.webm was never committed upstream, so every load asked for a file that cannot exist)
