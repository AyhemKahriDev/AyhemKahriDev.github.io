# yongchaofan/jsBlockout - vendored third-party game

- **Repository:** https://github.com/yongchaofan/jsBlockout
- **Author:** yongchaofan
- **Licence:** GPL-3.0 (see LICENSE in this folder)
- **Vendored by:** arcadefork (Ayhem Kahri)

The original GPL-3.0 licence text ships in this folder and applies to its contents.

## Local repairs

- `Ding.mp3`, `Dong.mp3`, `Dang.mp3`, `Game.mp3`: **added, not upstream.** The
  page loads four sound files the author never committed, so every load threw
  four 404s and the game was silent. Four short tones were generated with
  ffmpeg (sine waves, no third-party audio) so the sound effects work and the
  page makes no failing requests. Nothing else in the game was changed.

