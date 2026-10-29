#include <M5Cardputer.h>
#undef PI   // puzzles.h (via params_ui.h) redefines PI with more precision
#include <cstdio>
#include <cstring>
#include <climits>
#include "params_ui.h"
#include "picker.h"
#include "rules_map.h"
#include "bugreport.h"
#include "settings.h"       // brightness ladder + Settings model (device settings screen)
#include "frontend.h"       // FW_VERSION
#include "cardputer_hw.h"   // cardputer::brightness (report screen pins the backlight)

namespace puz {

static UiCtx g_ui;
void uiBind(const UiCtx& c) { g_ui = c; }

// ---------------- rules viewer ----------------
static char* g_rulesText = nullptr;   // owned by caller (midend_get_config returns malloc'ed)
static int   g_rulesLine = 0;         // top line visible at scroll origin
static char kLines[18][64];           // mutable buffers, one per wrapped line
static int   g_linesN = 0;            // total wrapped lines
static const int RULES_CHARS_PER_LINE = 18;  // size-2 font ~12px wide => ~18 chars in 224px usable width

static void freeRules() { memset(kLines, 0, sizeof kLines); g_linesN = 0; g_rulesLine = 0; if (g_rulesText) sfree(g_rulesText), g_rulesText = nullptr; }

// Wrap `src` into lines that fit on a single row.
static const int MAX_LINES = 18;

static void wrapRules(const char* src) {
  freeRules();
  g_rulesText = strdup(src);
  int n = 0;
  const char *p = g_rulesText;
  while (*p && n < MAX_LINES) {
    // Find end of this paragraph: double newline or EOF
    const char* paraEnd = p;
    const char* nn = strstr(p, "\n\n");
    if (nn) paraEnd = nn;
    else paraEnd = p + strlen(p);

    // Trim trailing whitespace from paragraph body
    while (paraEnd > p && (*(paraEnd-1) == ' ' || *(paraEnd-1) == '\t' || *(paraEnd-1) == '\n'))
      paraEnd--;
    size_t plen = paraEnd - p;
    if (plen == 0) {
      p = (nn) ? nn + 2 : paraEnd;  // skip blank paragraph separator
      continue;
    }

    // Word-wrap this paragraph within RULES_CHARS_PER_LINE chars.
    const char* q = p;
    size_t qlen = plen;
    while (qlen > 0 && n < MAX_LINES) {
      int limit = (qlen < (size_t)RULES_CHARS_PER_LINE) ? (int)qlen : RULES_CHARS_PER_LINE;
      int cut = limit;
      if (cut < (int)qlen) {
        int space = -1;
        for (int i = 0; i < limit; i++) if (q[i] == ' ') space = i;
        if (space > 0) cut = space;
      }
      int copyLen = (cut > 63) ? 63 : cut;
      memcpy(kLines[n], q, copyLen);
      kLines[n][copyLen] = '\0';
      n++;
      q += cut;
      qlen -= cut;
      while (qlen > 0 && (*q == ' ' || *q == '\t')) { q++; qlen--; }
    }
    // Advance past consumed paragraph + separator
    p = (nn) ? nn + 2 : paraEnd;
    while (*p == '\n' || *p == ' ' || *p == '\t') p++;
  }
  g_linesN = n;
}

static const char* lookup_rule(const char* topic) {
    for (int i = 0; rules_map[i].topic != NULL; ++i) {
        if (strcmp(rules_map[i].topic, topic) == 0)
            return rules_map[i].text;
    }
    return NULL;
}

static void drawRules() {
  auto &d = M5.Display;
  d.fillScreen(TFT_BLACK);
  d.setTextSize(1); d.setTextColor(TFT_CYAN, TFT_BLACK);
  d.setTextDatum(top_left); d.drawString("Rules", 4, 2);
  d.drawFastHLine(0, 12, 240, d.color565(0x24, 0x40, 0x55));
  d.setTextColor(TFT_WHITE, TFT_BLACK);
  d.setTextSize(2);

  int y = 20;
  for (int i = g_rulesLine; i < g_linesN && y <= 130; i++, y += 18)
    d.drawString(kLines[i], 8, y);

  d.setTextSize(1);
  d.setTextColor(d.color565(0x67, 0x88, 0x99), TFT_BLACK);
  d.setTextDatum(bottom_left); d.drawString("` back", 4, 133);
}

void openRules() {      
  const char *topic = midend_which_game(g_ui.me)->htmlhelp_topic;
  const char *rule = lookup_rule(topic);
  const char *fallback = "No detailed rules available on this device.\nSee the online documentation for game-specific instructions.";
  const char *finalDesc = rule ? rule : fallback;
  wrapRules(finalDesc);
  g_ui.toRules();
  drawRules();
}

void ruleKey(InputEvent ev) {
  if (g_linesN == 0) { if (ev.kind == Ev::BackToChooser) { freeRules(); g_ui.resume(); } return; }
  switch (ev.kind) {
    case Ev::Up:   g_rulesLine = (g_rulesLine + g_linesN - 1) % g_linesN; drawRules(); break;
    case Ev::Down: g_rulesLine = (g_rulesLine + 1) % g_linesN;          drawRules(); break;
    case Ev::BackToChooser: freeRules(); g_ui.resume(); break;
    default: break;
  }
}

// ---------------- bug report ----------------
// A QR to this repo's new-issue page, prefilled with the firmware version and
// the id of the board on screen. The id is the reason the screen exists: with
// it a maintainer regenerates the exact position; without it a report is
// "Solo crashed sometimes". Filing over WiFi directly would need a GitHub token
// on the device, so the phone does the filing.
//
// Prefer the SEED form (midend_get_random_seed, "params#seed") over the full
// game id: it regenerates the same board, and it is short enough to survive
// inside a QR this panel can render at a scannable module size. Fall back to
// midend_get_game_id when the board came from an id rather than a seed (no
// seedstr -> NULL), and let buildBugUrl drop the body if even that is too long.
static std::string g_repId;      // board id, as shown and (usually) encoded
static std::string g_repUrl;     // the encoded URL, kept so a redraw needn't rebuild
static int  g_repVersion = 1;
static bool g_repHasId = false;

// Layout is driven entirely by module size. lgfx floors thickness to
// boxWidth/modules and centres the code in the box, so at a version-6 code
// (41 modules) a 110px box spent 14px per side on padding that bought nothing
// and rendered 2px modules. A 132px box spends 4px per side and renders 3px
// modules -- a 123px code against the old 82px. That is the whole scan fix:
// the quiet zone is not reduced so much as re-spent.
//
// It is also where reducing the margin stops paying. Thickness is an integer
// divide, so the next step up (4px) needs 41*4 = 164px, and this panel is 135px
// tall. Trimming quiet zone below what is here buys literally zero additional
// module pixels while making the finder patterns harder to isolate -- the code
// gets worse with no compensation. The floor is the ~2 modules of white left
// above and below; horizontally there is room for the full 4.
static const int QR_BOX = 132, QR_X = 8, QR_Y = 1;   // code lands at (12,5)-(135,128) at v6
static const int TXT_X = 152, TXT_COLS = 14;         // 86px right column at the size-1 font

static void drawBright();   // defined with the backlight state below

static void drawReport() {
  auto &d = M5.Display;
  d.fillScreen(TFT_BLACK);

  // Full-height white field behind the code: a black panel butting up against
  // the finder patterns defeats scanners, and the bezel beyond the screen edge
  // is dark, so the quiet zone has to be painted rather than assumed.
  d.fillRect(0, 0, 148, 135, TFT_WHITE);
  d.qrcode(g_repUrl.c_str(), QR_X, QR_Y, QR_BOX, (uint8_t)g_repVersion);

  d.setTextSize(1); d.setTextDatum(top_left);
  d.setTextColor(TFT_CYAN, TFT_BLACK);
  d.drawString("Report a bug", TXT_X, 4);

  // Where the code goes, read back off the URL that was actually encoded. A QR
  // on a handheld device pointing at an unrecognised domain reads as phishing,
  // and the destination is the one thing a scanner wants before tapping.
  d.setTextColor(d.color565(0x67, 0x88, 0x99), TFT_BLACK);
  d.drawString(("-> " + puz::urlHost(g_repUrl)).c_str(), TXT_X, 16);

  d.setTextColor(TFT_WHITE, TFT_BLACK);
  d.drawString(FW_VERSION, TXT_X, 28);
  d.drawString(midend_which_game(g_ui.me)->name, TXT_X, 40);

  // The id in plain text too: it is what makes the report reproducible, so it
  // must be transcribable when the QR won't scan (or didn't fit).
  d.setTextColor(g_repHasId ? d.color565(0x67, 0x88, 0x99) : TFT_RED, TFT_BLACK);
  d.drawString(g_repHasId ? "Board" : "Type this in", TXT_X, 54);
  d.setTextColor(TFT_WHITE, TFT_BLACK);
  int y = 66;
  for (const std::string& line : puz::wrapFixed(g_repId, TXT_COLS)) {
    // Leave the brightness row at 118 clear. The destination line above cost
    // 12px, so this is 5 wrapped lines (70 chars) where it was 6 (84) -- still
    // more than double the longest id the collection produces, and the size-1
    // font is 8px tall, so the last row here ends at 114 rather than butting
    // into the row below it the way the old bound did.
    if (y > 106) break;
    d.drawString(line.c_str(), TXT_X, y);
    y += 10;
  }

  drawBright();
  d.setTextColor(d.color565(0x67, 0x88, 0x99), TFT_BLACK);
  d.setTextDatum(bottom_left); d.drawString("` back", TXT_X, 133);
}

// Hold the backlight steady while the code is on screen, and let ,// tune it.
// Idle dimming starts at 30s and blanks at 90s (cardputer_hw), well inside the
// time someone spends aiming a phone, and a dimming panel mid-scan is exactly
// what makes a marginal code fail. brightness() counts as activity, so
// re-asserting it holds off both the dim and the light-sleep below it.
//
// The level defaults LOW (kRepBrightDefault -> 32) and stays adjustable, because
// brighter is not monotonically better here: measured on an ADV, 32 scans
// notably better than full brightness, which is the overexposure case -- a
// camera metering a small emissive panel clips the white modules and merges
// them. (Same reason a camera torch helps: it adds no contrast to an emissive
// display, it forces the camera down to a shorter exposure and gives autofocus
// something to lock onto.) The exact optimum is a property of the phone, so ,//
// still walks the ladder and the level stays on screen to be reported.
static uint8_t g_repPrevBright = 0;
static int     g_repBrightIdx = puz::kRepBrightDefault;
static uint32_t g_repLitMs = 0;
static uint8_t repBright() { return puz::kRepBright[g_repBrightIdx]; }

static void drawBright() {
  auto &d = M5.Display;
  char s[16];
  snprintf(s, sizeof s, ",/ light %d", (int)repBright());
  d.fillRect(TXT_X, 118, 240 - TXT_X, 10, TFT_BLACK);   // repaint just this row
  d.setTextSize(1); d.setTextDatum(top_left);
  d.setTextColor(d.color565(0x67, 0x88, 0x99), TFT_BLACK);
  d.drawString(s, TXT_X, 118);
}

void reportTick() {
  if ((uint32_t)(millis() - g_repLitMs) < 1000) return;   // a PWM write, not needed per frame
  g_repLitMs = millis();
  cardputer::brightness(repBright());
}

void openReport() {
  char* id = midend_get_random_seed(g_ui.me);
  if (!id) id = midend_get_game_id(g_ui.me);   // board came from an id, not a seed
  g_repId = id ? id : "";
  if (id) sfree(id);
  BugUrl b = buildBugUrl(midend_which_game(g_ui.me)->name, g_repId, FW_VERSION);
  g_repUrl = b.url; g_repVersion = b.version; g_repHasId = b.hasId;
  g_repPrevBright = cardputer::brightness();
  g_repBrightIdx = puz::kRepBrightDefault;
  g_repLitMs = millis() - 1000;   // assert the level on the first tick
  g_ui.toReport();
  drawReport();
}

void reportKey(InputEvent ev) {
  switch (ev.kind) {
    // ,// walk the backlight. Only the number needs repainting, but the code
    // itself is 123px of solid fill -- redrawing the whole screen per press is
    // visibly slow and pointlessly restates a QR that has not changed.
    case Ev::Left: case Ev::Right: {
      g_repBrightIdx = puz::repBrightStep(g_repBrightIdx, ev.kind == Ev::Right ? 1 : -1);
      cardputer::brightness(repBright());
      g_repLitMs = millis();
      drawBright();
      break;
    }
    case Ev::BackToChooser: case Ev::CommandMenu:
      g_repId.clear(); g_repUrl.clear();
      cardputer::brightness(g_repPrevBright);   // hand the panel back to the player's setting
      g_ui.resume();
      break;
    default: break;
  }
}

// ---------------- command menu ----------------
static const char* kCmdItems[]   = {"Size / Type","New game","Restart","Solve","Undo","Redo","Pointer","Recenter","Zoom 2x","Pan (zoom)","Rules","Report bug"};
static const char* kCmdSuffix[]  = {"",           "Ctrl+N",  "Ctrl+R", "",     "Ctrl+Z","Ctrl+Y","Ctrl+P","Ctrl+Sp", "Ctrl+L", "C+;,./",    "",     "QR"};
static const int   kCmdN = 12;
static int g_cmdSel = 0;

static void drawCommand() { drawPicker(kCmdItems, kCmdN, g_cmdSel, "Menu", "Tab", kCmdSuffix, 5); }
void openCommand() { g_cmdSel = 0; drawCommand(); }

void commandKey(InputEvent ev) {
  switch (ev.kind) {
    case Ev::Up:   g_cmdSel = (g_cmdSel + kCmdN - 1) % kCmdN; drawCommand(); break;
    case Ev::Down: g_cmdSel = (g_cmdSel + 1) % kCmdN;         drawCommand(); break;
    case Ev::BackToChooser: case Ev::CommandMenu: g_ui.resume(); break;
    case Ev::Select:
      switch (g_cmdSel) {
        case 0: g_ui.toType(); openTypeMenu(); break;
        case 1: midend_new_game(g_ui.me); g_ui.reloadResume(); break;
        case 2: midend_restart_game(g_ui.me); g_ui.resume(); break;
        case 3: midend_solve(g_ui.me); g_ui.resume(); break;
        case 4: midend_process_key(g_ui.me, 0, 0, UI_UNDO); g_ui.resume(); break;
        case 5: midend_process_key(g_ui.me, 0, 0, UI_REDO); g_ui.resume(); break;
        case 6: g_ui.togglePointer(); g_ui.resume(); break;
        case 7: g_ui.recenter(); g_ui.resume(); break;
        case 8: g_ui.toggleZoom(); g_ui.resume(); break;
        case 9: g_ui.resume(); break;   // Pan is a reference entry: panning is Ctrl+;,./ while zoomed
        case 10: g_ui.resume(); openRules(); break;
        case 11: g_ui.resume(); openReport(); break;
      }
      break;
    default: break;
  }
}

// ---------------- type (preset) menu ----------------
static PresetEntry g_presets[64];
static const char* g_titles[64];
static int g_presetN = 0, g_typeSel = 0;
static char g_typePos[12];

static void drawType() {
  for (int i = 0; i < g_presetN; i++) g_titles[i] = g_presets[i].title;
  snprintf(g_typePos, sizeof g_typePos, "%d/%d", g_typeSel + 1, g_presetN);
  drawPicker(g_titles, g_presetN, g_typeSel, "Type", g_typePos, nullptr, 5);
}

void openTypeMenu() {
  g_presetN = flattenPresets(g_ui.me, g_presets, 64);
  g_typeSel = 0;
  drawType();
}

void typeKey(InputEvent ev) {
  switch (ev.kind) {
    case Ev::Up:   g_typeSel = (g_typeSel + g_presetN - 1) % g_presetN; drawType(); break;
    case Ev::Down: g_typeSel = (g_typeSel + 1) % g_presetN;             drawType(); break;
    case Ev::BackToChooser: g_ui.resume(); break;
    case Ev::Select:
      if (g_presets[g_typeSel].id < 0) { g_ui.toConfig(); openConfig(); }   // "Custom..."
      else { applyPreset(g_ui.me, g_presets[g_typeSel].id); g_ui.reloadResume(); }
      break;
    default: break;
  }
}

// ---------------- custom config editor ----------------
static config_item* g_cfg = nullptr;
static char* g_cfgTitle = nullptr;
static int g_cfgN = 0, g_cfgSel = 0;
static const char* g_cfgErr = nullptr;

static int cfgCount(config_item* c) { int n = 0; while (c[n].type != C_END) n++; return n; }

// Extract the selected option name from a C_CHOICES ":a:b:c" string.
static void choiceName(const config_item* ci, char* out, int cap) {
  const char* cn = ci->u.choices.choicenames;
  char sep = cn[0];
  int want = ci->u.choices.selected, idx = 0;
  const char* start = cn + 1;
  const char* p = cn + 1;
  for (; *p; p++) {
    if (*p == sep) { if (idx == want) break; idx++; start = p + 1; }
  }
  int len = (int)(p - start); if (len > cap - 1) len = cap - 1;
  memcpy(out, start, len); out[len] = '\0';
}

static int choiceCount(const config_item* ci) {
  const char* cn = ci->u.choices.choicenames; char sep = cn[0]; int n = 0;
  for (const char* p = cn; *p; p++) if (*p == sep) n++;
  return n;
}

static void drawConfig() {
  auto &d = M5.Display;
  d.fillScreen(TFT_BLACK);
  d.setTextSize(1); d.setTextColor(TFT_CYAN, TFT_BLACK);
  d.setTextDatum(top_left); d.drawString("Custom", 4, 2);
  d.drawFastHLine(0, 12, 240, d.color565(0x24, 0x40, 0x55));
  for (int i = 0; i < g_cfgN; i++) {
    int y = 24 + i * 16;
    if (i == g_cfgSel) { d.fillRoundRect(2, y - 7, 236, 15, 2, TFT_WHITE); d.setTextColor(TFT_BLACK, TFT_WHITE); }
    else d.setTextColor(TFT_WHITE, TFT_BLACK);
    d.setTextDatum(middle_left); d.drawString(g_cfg[i].name, 8, y);
    char val[40];
    switch (g_cfg[i].type) {
      case C_STRING:  snprintf(val, sizeof val, "%s", g_cfg[i].u.string.sval); break;
      case C_BOOLEAN: snprintf(val, sizeof val, "%s", g_cfg[i].u.boolean.bval ? "on" : "off"); break;
      case C_CHOICES: choiceName(&g_cfg[i], val, sizeof val); break;
      default: val[0] = '\0';
    }
    d.setTextDatum(middle_right); d.drawString(val, 232, y);
  }
  d.setTextColor(d.color565(0x67, 0x88, 0x99), TFT_BLACK);
  d.setTextDatum(bottom_left);
  d.drawString(g_cfgErr ? g_cfgErr : ";/. field  type edit  Enter apply  ` cancel", 4, 133);
}

void openConfig() {
  if (g_cfg) configFree(g_cfg);
  free(g_cfgTitle); g_cfgTitle = nullptr;   // title is caller-owned; free prior fetch
  g_cfgErr = nullptr; g_cfgSel = 0;
  g_cfg = configBegin(g_ui.me, &g_cfgTitle);
  g_cfgN = cfgCount(g_cfg);
  drawConfig();
}

void configKey(InputEvent ev) {
  config_item* ci = &g_cfg[g_cfgSel];
  switch (ev.kind) {
    case Ev::Up:   g_cfgSel = (g_cfgSel + g_cfgN - 1) % g_cfgN; g_cfgErr = nullptr; drawConfig(); break;
    case Ev::Down: g_cfgSel = (g_cfgSel + 1) % g_cfgN;          g_cfgErr = nullptr; drawConfig(); break;
    case Ev::Left: case Ev::Right: {
      int dir = (ev.kind == Ev::Right) ? 1 : -1;
      if (ci->type == C_BOOLEAN) ci->u.boolean.bval = !ci->u.boolean.bval;
      else if (ci->type == C_CHOICES) {
        int n = choiceCount(ci);
        ci->u.choices.selected = (ci->u.choices.selected + dir + n) % n;
      }
      drawConfig(); break;
    }
    case Ev::Select2:
      if (ci->type == C_BOOLEAN) { ci->u.boolean.bval = !ci->u.boolean.bval; drawConfig(); }
      break;
    case Ev::Char:
      if (ci->type == C_STRING) {
        if (ev.ch == '\b') configStringEdit(ci, 0, true);
        else if (ev.ch >= ' ') configStringEdit(ci, ev.ch, false);
        drawConfig();
      }
      break;
    case Ev::Select: {   // apply all
      const char* err = configApply(g_ui.me, g_cfg);   // sets params only — must regenerate
      if (err) { g_cfgErr = err; drawConfig(); }
      else {
        midend_new_game(g_ui.me);   // generate a board at the new params (else stale grid
                                    // draws into a differently-sized background)
        configFree(g_cfg); g_cfg = nullptr; free(g_cfgTitle); g_cfgTitle = nullptr;
        g_ui.reloadResume();
      }
      break;
    }
    case Ev::BackToChooser:   // cancel
      configFree(g_cfg); g_cfg = nullptr; free(g_cfgTitle); g_cfgTitle = nullptr; g_ui.resume(); break;
    default: break;
  }
}

// ---------------- device settings ----------------
// Reached by Tab on the game list, so it runs with no midend bound -- it uses
// g_set, never g_ui. Two rows, both edited in place with ,// rather than by
// entering a sub-screen: there are two of them, and a value you change while
// looking at it is the whole point for brightness.
static SettingsCtx g_set;
static int  g_setSel = 0;
static int  g_setBrightIdx = kBrightDefault;
static bool g_setPointer = false;

void settingsBind(const SettingsCtx& c) { g_set = c; }

static void drawSettings() {
  static char bright[12];
  snprintf(bright, sizeof bright, "%d", (int)kBright[g_setBrightIdx]);
  const char* items[]  = { "Brightness", "Pointer" };
  const char* values[] = { bright, g_setPointer ? "Tilt" : "Cursor" };
  drawPicker(items, 2, g_setSel, "Settings", nullptr, values, 5);
  auto &d = M5.Display;
  d.setTextSize(1); d.setTextColor(d.color565(0x67, 0x88, 0x99), TFT_BLACK);
  d.setTextDatum(bottom_left); d.drawString(";/. row  ,// change  ` back", 4, 133);
}

void openSettings(uint8_t brightness, bool pointer) {
  g_setSel = 0;
  g_setBrightIdx = brightIndex(brightness);
  g_setPointer = pointer;
  drawSettings();
}

void settingsKey(InputEvent ev) {
  switch (ev.kind) {
    case Ev::Up:   g_setSel = (g_setSel + 1) % 2; drawSettings(); break;   // two rows: either way flips
    case Ev::Down: g_setSel = (g_setSel + 1) % 2; drawSettings(); break;
    case Ev::Left: case Ev::Right: {
      int dir = (ev.kind == Ev::Right) ? 1 : -1;
      if (g_setSel == 0) g_setBrightIdx = brightStep(g_setBrightIdx, dir);
      else               g_setPointer = !g_setPointer;
      if (g_set.apply) g_set.apply(kBright[g_setBrightIdx], g_setPointer);
      drawSettings();   // after apply: the redraw is what shows the new backlight
      break;
    }
    case Ev::Select2:   // Space toggles the row under the bar, for the boolean
      if (g_setSel == 1) {
        g_setPointer = !g_setPointer;
        if (g_set.apply) g_set.apply(kBright[g_setBrightIdx], g_setPointer);
        drawSettings();
      }
      break;
    case Ev::BackToChooser: case Ev::CommandMenu:
      if (g_set.commit) g_set.commit();
      break;
    default: break;
  }
}

}  // namespace puz
