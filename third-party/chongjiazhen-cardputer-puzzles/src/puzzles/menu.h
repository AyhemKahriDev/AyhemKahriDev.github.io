#pragma once
#include "picker.h"
#include "frontend.h"   // gamelist[]/gamecount (puzzles.h) + M5.Display
#include "cardputer_hw.h"   // cardputer::battery()

namespace puz {

// Rows in display order: `order[row]` is the gamelist index shown on that row
// (starred games first -- see favorites.h), `fav[]` is indexed by GAME, not row.
// Rebuilt per draw: 40 pointer stores, far cheaper than the redraw itself.
inline void chooserRows(const int* order, const bool* fav,
                        const char** names, const char** suffix) {
  for (int r = 0; r < gamecount; r++) {
    int g = order[r];
    names[r]  = gamelist[g]->name;
    suffix[r] = fav[g] ? "*" : "";
  }
}

inline void drawChooser(int sel, const int* order, const bool* fav) {
  static char pos[12];
  static const char* names[64];
  static const char* suffix[64];
  chooserRows(order, fav, names, suffix);
  snprintf(pos, sizeof pos, "%d/%d", sel + 1, gamecount);
  drawPicker(names, gamecount, sel, "Puzzles", pos, suffix, 5);  // 5 rows: roomy after header+footer
  auto &d = M5.Display;                       // footer hint
  d.setTextSize(1); d.setTextColor(d.color565(0x67, 0x88, 0x99), TFT_BLACK);
  d.setTextDatum(bottom_left); d.drawString("Enter play  Ctrl+F star  Tab menu", 4, 133);

  // battery, bottom-right corner (free of the pos counter and footer hint)
  cardputer::Battery b = cardputer::battery();
  char bs[8];
  if (b.level < 0) snprintf(bs, sizeof bs, "--");
  else snprintf(bs, sizeof bs, "%s%d%%", b.charging ? "+" : "", b.level);
  uint16_t col = b.charging      ? TFT_CYAN
               : b.level < 0     ? d.color565(0x67, 0x88, 0x99)
               : b.level <= 15   ? TFT_RED
               : b.level <= 35   ? d.color565(0xd0, 0xb0, 0x30)
                                 : d.color565(0x67, 0x88, 0x99);
  d.setTextColor(col, TFT_BLACK);
  d.setTextDatum(bottom_right); d.drawString(bs, 236, 133);
}

}  // namespace puz
