#pragma once
#include <cstdint>
#include <cstdlib>
#include <string>

// Device-wide settings: the handful of preferences that are not per-game and so
// have no home in a `.sav` blob. Model + on-disk format live here so both are
// host-testable; main.cpp owns the file I/O and ui_screens.cpp the screen.
//
// No volume setting: this frontend never touches the speaker (nothing in
// src/ or lib/ calls M5.Speaker beyond the wrapper's setter), so a volume row
// would be a control wired to nothing.
namespace puz {

// Backlight ladder for the settings screen, dimmest first. Doubling-ish rather
// than linear because perceived brightness is roughly logarithmic -- a linear
// ladder spends most of its rungs in a range the eye reads as "bright", and none
// where the useful resolution is. Distinct from the report screen's ladder
// (bugreport.h), which is tuned for a phone camera, not for a human reading a
// board, and deliberately tops out lower down the useful range.
//
// The floor is 16 for the same reason the report ladder's is: at 8 the panel is
// unreadable indoors, and a screen you cannot read is a screen you cannot use to
// walk the level back up. 0 is not on the ladder at all.
inline const uint8_t kBright[] = { 16, 32, 64, 96, 128, 160, 208, 255 };
inline const int kBrightN = 8;
inline const int kBrightDefault = 4;   // -> 128, the level the firmware used before this screen existed

// Step the ladder, clamping at both ends. Does not wrap: walking off the dim end
// into full brightness (or the bright end into near-black) is indistinguishable
// from a bug on a screen whose only feedback is its own brightness.
inline int brightStep(int idx, int dir) {
  int n = idx + dir;
  if (n < 0) return 0;
  if (n >= kBrightN) return kBrightN - 1;
  return n;
}

// Nearest rung to an arbitrary stored level. A settings file written by an older
// (or newer) ladder still lands somewhere sensible instead of snapping to the
// default and silently discarding the player's choice.
inline int brightIndex(uint8_t level) {
  int best = 0, bestD = 256;
  for (int i = 0; i < kBrightN; i++) {
    int d = (int)level - (int)kBright[i];
    if (d < 0) d = -d;
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}

struct Settings {
  uint8_t brightness;   // backlight level the idle dimmer treats as "awake"
  bool    pointer;      // true = boot into tilt-pointer mode, false = keyboard cursor
};

inline Settings defaultSettings() { return Settings{ kBright[kBrightDefault], false }; }

// key=value, one per line. Text rather than a packed struct so a hand-edit on
// the SD card is possible and a format change stays readable.
inline std::string serializeSettings(const Settings& s) {
  return "bright=" + std::to_string((int)s.brightness) +
         "\npointer=" + std::string(s.pointer ? "1" : "0") + "\n";
}

// Tolerant parser: CRLF, blank lines, a missing trailing newline, unknown keys
// and missing keys all degrade to the default for that field rather than
// throwing the whole file away. A brightness outside the ladder is clamped into
// it -- notably 0, which would otherwise persist a black screen with no way to
// see the control that fixes it.
inline Settings parseSettings(const std::string& blob) {
  Settings s = defaultSettings();
  std::string line;
  size_t i = 0;
  while (i <= blob.size()) {
    char c = (i < blob.size()) ? blob[i] : '\n';
    i++;
    if (c != '\n' && c != '\r') { line += c; continue; }
    size_t eq = line.find('=');
    if (eq != std::string::npos) {
      std::string k = line.substr(0, eq), v = line.substr(eq + 1);
      if (k == "bright") {
        int n = atoi(v.c_str());
        if (n < kBright[0]) n = kBright[0];
        if (n > 255) n = 255;
        s.brightness = (uint8_t)n;
      } else if (k == "pointer") {
        s.pointer = (v == "1" || v == "y" || v == "true");
      }
    }
    line.clear();
  }
  return s;
}

}  // namespace puz
