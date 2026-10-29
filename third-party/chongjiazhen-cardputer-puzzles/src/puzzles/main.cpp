#include <Arduino.h>
#include <FS.h>
#include <SD.h>
#include <SPI.h>
#include <LittleFS.h>
#include <string>
#include <vector>
#include "cardputer_hw.h"
#include "frontend.h"
#include "presets.h"
#include "menu.h"
#include "keymap.h"
#include "input.h"
#include "pointer.h"
#include "params_ui.h"
#include "favorites.h"
#include "settings.h"
#include "gamesize.h"

// Solo (and other backtracking generators) recurse deep during midend_new_game.
// Arduino's default loop-task stack is 8KB -> instant panic on generate despite
// ~300KB free heap. Give the loop task a roomy stack; heap has plenty to spare.
SET_LOOP_TASK_STACK_SIZE(32 * 1024);

static frontend g_fe;
static midend *g_me = nullptr;
static uint32_t g_last_ms;

static puz::Pointer g_ptr{120, 67};
static float g_tiltBiasX = 0, g_tiltBiasY = 0;   // tilt neutral (accel at last recenter); Ctrl+Space rezeros
static bool g_ptr_on = false;   // default cursor mode; Ctrl+P toggles the tilt pointer
static const char *g_curGameName = "-";   // current game name, for the crash-report context
static int g_curIdx = -1;                 // currently-loaded game; re-entering it resumes in-progress

enum class State { MENU, PLAYING, COMMAND, TYPE_MENU, CONFIG_EDIT, LIST_MENU, HELP, SETTINGS, RULES, REPORT };
static State g_state = State::MENU;
static int g_sel = 0;
static bool g_tab_seen = false;   // self-extinguishing splash flag (set on first Tab)

// --- callbacks the params_ui screens invoke (bound per game in startGame) ---
static void resumePlaying() { g_state = State::PLAYING; midend_force_redraw(g_me); g_last_ms = millis(); }
// Recompute board size and re-center on the 240x135 canvas. Must run after any
// midend_size-changing event (new game, preset/config apply); otherwise offX/offY
// go stale and both rendering and pointer-click translation use the old centering.
static void sizeAndCenter() {
  // Reserve an 11px bottom strip for the status bar on games that use one, so the
  // board centers above it instead of being overdrawn by the overlay (see d_end).
  // Games with no status bar keep the full 135px height. Clear any status text left
  // over from a previous game so it can't bleed onto a no-statusbar board.
  g_fe.statusbar = midend_wants_statusbar(g_me);
  g_fe.status[0] = '\0';
  int avail = g_fe.statusbar ? 135 - 11 : 135;
  int w = 240, h = avail;
  midend_size(g_me, &w, &h, true, 1.0);
  g_fe.offX = (240 - w) / 2; g_fe.offY = (avail - h) / 2;
}
static void rememberSize();
static void reloadResumePlaying() {
  rememberSize();   // params just changed (preset/custom apply) -> remember the new size
  frontend_load_colours(&g_fe, g_me);
  sizeAndCenter();
  { char *id = midend_get_game_id(g_me);   // params changed (preset/custom) -> refresh crash ctx
    frontend_set_crash(g_curGameName, id); sfree(id); }
  g_fe.canvas->fillSprite(UI_BLACK);
  resumePlaying();
}
static void toType()   { g_state = State::TYPE_MENU; }
static void toConfig() { g_state = State::CONFIG_EDIT; }
static void toRules()    { g_state = State::RULES; }
static void toReport()   { g_state = State::REPORT; }
static void togglePointer() { g_ptr_on = !g_ptr_on; }
// Zero the tilt neutral to the current hold pose (Ctrl+Space or the Tab menu).
// Captures even when the pointer is off -- harmless, applies when next enabled.
static void recenterPointer() {
  cardputer::Imu imu;
  if (cardputer::imuRead(imu)) { g_tiltBiasX = -imu.ax; g_tiltBiasY = imu.ay; }
}

// --- zoom (Ctrl+L): live 2x magnifier, game keeps playing ---
// d_end pushes the frame magnified around (zoomX,zoomY) while fe.zoom is set
// (see frontend_push), so every game redraw stays zoomed. Ctrl+;,./ pans;
// everything else reaches the game as usual.
static void clampZoom() {
  // Keep the 120x68 source window inside the 240x135 canvas.
  if (g_fe.zoomX < 60)  g_fe.zoomX = 60;  if (g_fe.zoomX > 180) g_fe.zoomX = 180;
  if (g_fe.zoomY < 34)  g_fe.zoomY = 34;  if (g_fe.zoomY > 101) g_fe.zoomY = 101;
}
static void toggleZoom() {
  g_fe.zoom = !g_fe.zoom;
  g_fe.zoomX = 120; g_fe.zoomY = 67;
  frontend_push(&g_fe);   // repaint immediately at the new magnification
}
static void panZoom(int dx, int dy) {
  if (!g_fe.zoom) return;
  g_fe.zoomX += dx; g_fe.zoomY += dy; clampZoom();
  frontend_push(&g_fe);
}
// Screen -> puzzle coords for pointer clicks, aware of the magnified view:
// screen pixel s shows canvas pixel zoomCentre + (s - screenCentre)/2.
static void ptrToPuzzle(int *px, int *py) {
  int sx = (int)g_ptr.x, sy = (int)g_ptr.y;
  if (g_fe.zoom) { sx = g_fe.zoomX + (sx - 120) / 2; sy = g_fe.zoomY + (sy - 67) / 2; }
  *px = sx - g_fe.offX; *py = sy - g_fe.offY;
}

// --- pointer-mode direct digit entry ---
// Digit-entry games (keen, solo, towers, ...) only accept a digit on a cell
// selected by a prior click, and hide the selection again after each digit
// (mouse-mode semantics in interpret_move). Requiring Enter before every digit
// is miserable on a handheld, so in pointer mode a digit auto-left-clicks the
// crosshair cell first. We track whether a selection is already active at the
// crosshair (from an explicit Enter/Space click) so that:
//  - Space (right-click) then digit gives PENCIL marks — no auto-left-click
//    stomping the pencil highlight;
//  - Enter then digit doesn't re-click (a second left-click on the selected
//    cell would toggle the selection OFF and swallow the digit).
enum class PtrSel { None, Fill, Pencil };
static PtrSel g_ptrSel = PtrSel::None;
static bool g_ptrHl = false;   // a click-made highlight is still showing (no digit since)
static float g_selPX = 0, g_selPY = 0;
static bool ptrNearSel() {
  // Only used to mirror the games' click-on-selected-cell toggle. Radius ~half
  // a typical tile; the IMU crosshair drifts a few px/s, so keep it generous.
  float dx = g_ptr.x - g_selPX, dy = g_ptr.y - g_selPY;
  return dx * dx + dy * dy < 144;   // within ~12px of the click
}
// Mirror the games' click-toggle: clicking the selected cell again deselects.
static void ptrTrackClick(PtrSel mode) {
  if (g_ptrSel == mode && g_ptrHl && ptrNearSel()) { g_ptrSel = PtrSel::None; g_ptrHl = false; }
  else { g_ptrSel = mode; g_ptrHl = true; g_selPX = g_ptr.x; g_selPY = g_ptr.y; }
}

// --- tilt-pointer split drag (source -> destination) ---
// Some games only ever emit a move on a RELEASE at a different pixel than the
// press: Map drops a colour, Pegs jumps a peg, Signpost chains two cells, Guess
// drops a peg into a slot, Untangle drags a vertex. The crosshair can't hold a
// button down, so an atomic click (press+release, same pixel) is a no-op and the
// control reads dead. Split the drag across two presses instead: press 1 = pick
// up (button down at source, held), press 2 = drop (button up at destination).
// While it's held, loop() streams a DRAG to the live crosshair every frame, so
// the carried thing tracks the pointer. The held button is remembered so the
// drop matches the pickup (Enter = fill, Space = pencil) regardless of which key
// ends it.
//
// Which games need it is policy, and lives in input.h so it can be host-tested
// (puz::needsSplitDrag). Games where a plain click already works keep the atomic
// click, so digit games' pencil/select semantics stay intact.
static const char *g_curSlug = "";
static int g_dragBtn = 0;                 // 0 idle, else held button (LEFT_/RIGHT_BUTTON)
static int g_dragPX = 0, g_dragPY = 0;    // pickup coords, for a clean cancel
static void cancelDrag();
// The key that picked it up is the key that drops it; the other key cancels.
// Without that rule press 2 reused whichever button was armed, so Space meant
// "drop here" in every game -- harmless in Pegs/Signpost/Guess, where a drop at
// the wrong place quantises to a no-op and reads as a cancel, but in Map the
// identical keystroke committed a fill. Same path, opposite consequence.
// Binding cancel to the OTHER key keeps both channels intact, which matters:
// Untangle's right button is DRAG_TOGGLE_EDGE against the left's
// DRAG_MOVE_POINT, so a global "Space = cancel" would have cost it a real move.
static void dragStep(int px, int py, int down) {
  if (puz::dragAction(g_dragBtn, down) == puz::DragAct::PickUp) {   // press 1: pick up at source
    midend_process_key(g_me, px, py, down);
    g_dragBtn = down; g_dragPX = px; g_dragPY = py;
    // Reflect which button is armed in the crosshair glyph, same axis as every
    // other game: right (pencil) -> blue X, left (fill) -> red +. Held only for
    // the drag's lifetime; cleared on drop/cancel below.
    g_ptrSel = (down == RIGHT_BUTTON) ? PtrSel::Pencil : PtrSel::Fill;
  } else if (puz::dragAction(g_dragBtn, down) == puz::DragAct::Cancel) {
    cancelDrag();                         // the other key: abandon the pickup
  } else {                                // press 2, same key: drop at destination
    int drag = (g_dragBtn == RIGHT_BUTTON) ? RIGHT_DRAG    : LEFT_DRAG;
    int up   = (g_dragBtn == RIGHT_BUTTON) ? RIGHT_RELEASE : LEFT_RELEASE;
    midend_process_key(g_me, px, py, drag);
    midend_process_key(g_me, px, py, up);
    g_dragBtn = 0;
    g_ptrSel = PtrSel::None;              // drop done: back to the neutral crosshair
  }
}
// Abort a half-finished drag by releasing at the source. Four of the five games
// quantise the release, so this is an exact no-op and they clear their own drag
// state: Map's drop region == source is discarded, Pegs and Signpost resolve
// back to the origin CELL (the pickup pixel is inside it, and the peg itself
// never moved -- only a blitter ghost followed the cursor), Guess releases over
// the palette instead of a slot.
//
// Untangle is the exception, because its vertex position is CONTINUOUS: the
// release coordinate IS the new position, with no grid to snap back to. So a
// cancel there drops the node at the pickup PIXEL, up to DRAG_THRESHOLD (12px)
// from where it actually sat. Accepted limitation, and self-limiting: 12px is
// the same radius that let you grab the node, so a cancel can never move it
// further than a plain click already could. Making it exact would mean
// release-then-undo, and midend_process_key returns PKR_SOME_EFFECT for a
// ui-only update and a recorded move alike (Untangle's release genuinely
// returns both, case-dependent), so a blind undo would sometimes pop the
// player's PREVIOUS real move -- a worse bug than the nudge.
static void cancelDrag() {
  if (!g_dragBtn) return;
  int up = (g_dragBtn == RIGHT_BUTTON) ? RIGHT_RELEASE : LEFT_RELEASE;
  midend_process_key(g_me, g_dragPX, g_dragPY, up);
  g_dragBtn = 0;
  g_ptrSel = PtrSel::None;   // abandoned drag: clear the armed-glyph too
}

// --- per-game save state: a write-through cache, RAM (g_saved) over flash ---
// Each of the 40 games keeps its full serialised state so switching titles (and
// power-cycling) resumes the exact board. g_saved is the hot cache; /<slug>.sav
// on LittleFS is the durable copy, lazily loaded on first entry (no boot scan).
static std::vector<std::string> g_saved;   // sized to gamecount in setup(); [idx] = serialised state or empty
// Chosen save backend: SD when a card is present (survives Launcher/app-only
// installs, which run under the Launcher's partition table with no LittleFS
// data partition), else internal LittleFS (full-flash installs). null = no
// durable store -> saves stay in RAM only.
static fs::FS *g_fs = nullptr;
static std::string g_saveDir;              // "/puzzles" on SD, "" (flat root) on LittleFS
static uint32_t g_dirtyMs = 0;             // millis() of last state-changing keystroke; 0 = clean. Autosave debounce.
static uint32_t g_selDirtyMs = 0;          // same, for the chooser's selection (see saveLastGame). 0 = clean.
static const uint32_t AUTOSAVE_MS = 3000;  // persist the open game this long after the last change
// Set by any in-game keystroke; consumed by the next non-animating redraw, which
// then repaints the whole board instead of only the tiles the game thinks changed.
// Several backends leave residue on the incremental path (a marker straddling a
// cell boundary whose neighbour is not redrawn, a lattice repainted over an
// error glyph). Repainting the frame the player actually looks at costs one full
// board draw per keypress and makes that class of bug unreachable for all 40
// games instead of game-by-game. Host-proven by smear_test.
static bool g_fullRedraw = false;
static void serWrite(void *ctx, const void *buf, int len) {
  ((std::string *)ctx)->append((const char *)buf, (size_t)len);
}
struct SerReadCtx { const std::string *s; size_t pos; };
static bool serRead(void *ctx, void *buf, int len) {
  SerReadCtx *r = (SerReadCtx *)ctx;
  if (r->pos + (size_t)len > r->s->size()) return false;
  memcpy(buf, r->s->data() + r->pos, (size_t)len);
  r->pos += (size_t)len;
  return true;
}
static std::string savePath(int idx) { return g_saveDir + "/" + gamelist[idx]->htmlhelp_topic + ".sav"; }

// --- picker resume: which title the chooser lands on at boot ---
// Stores the SLUG, not the index: gamelist order is generated, so an index
// would silently point at a different game if the set ever changes. Written on
// game entry, and on a chooser selection that has sat still for AUTOSAVE_MS --
// so browsing to a title and powering off there resumes it too. Debounced for
// the same reason the board autosave is: scrolling 40 titles must not be 40
// writes. The write itself is synchronous and dedup'd, so once it lands a reset
// (or a dead battery) can't lose it -- nothing is buffered.
static std::string lastPath() { return g_saveDir + "/last"; }
static void saveLastGame(int idx) {
  if (!g_fs || idx < 0 || idx >= gamecount) return;
  const char *slug = gamelist[idx]->htmlhelp_topic;
  File f = g_fs->open(lastPath().c_str(), "r");
  if (f) { String cur = f.readString(); f.close(); if (cur == slug) return; }   // unchanged: no write
  f = g_fs->open(lastPath().c_str(), "w");
  if (!f) return;
  f.write((const uint8_t *)slug, strlen(slug));
  f.close();
}
static int loadLastGame() {
  if (!g_fs) return 0;
  File f = g_fs->open(lastPath().c_str(), "r");
  if (!f) return 0;
  String s = f.readString();
  f.close();
  for (int i = 0; i < gamecount; i++)
    if (s == gamelist[i]->htmlhelp_topic) return i;
  return 0;   // unknown slug (renamed/removed game): fall back to the top of the list
}

// --- favourites: starred games pinned to the top of the chooser ---
// Ctrl+F on the list toggles a star. g_fav is indexed by GAME index; g_order
// maps a chooser ROW to the game shown on it (starred first, see favorites.h),
// so g_sel is a row from here on and every use converts through g_order.
// Durable copy is /favs, one slug per line, rewritten whole on each toggle --
// starring is a rare, explicit act, so it needs no autosave debounce.
static bool g_fav[64];
static int  g_order[64];
static std::string favPath() { return g_saveDir + "/favs"; }
static void rebuildOrder() { puz::favOrder(g_fav, gamecount, g_order); }
static void loadFavs() {
  if (!g_fs) return;
  File f = g_fs->open(favPath().c_str(), "r");
  if (!f) return;
  String s = f.readString();
  f.close();
  for (const std::string &slug : puz::favSlugs(std::string(s.c_str())))
    for (int i = 0; i < gamecount; i++)
      if (slug == gamelist[i]->htmlhelp_topic) { g_fav[i] = true; break; }   // unknown slug: dropped
}
static void saveFavs() {
  if (!g_fs) return;
  std::string blob;
  for (int i = 0; i < gamecount; i++)
    if (g_fav[i]) { blob += gamelist[i]->htmlhelp_topic; blob += "\n"; }
  File f = g_fs->open(favPath().c_str(), "w");
  if (!f) return;
  if (!blob.empty()) f.write((const uint8_t *)blob.data(), blob.size());
  f.close();
}
// --- device settings: backlight level + which pointer mode the device boots in ---
// Not per-game, so they have no home in a .sav blob: /settings, key=value lines
// (settings.h owns the format). Written on leaving the screen, not per keypress
// -- walking the brightness ladder is a handful of presses and none of them is
// the one the player meant to keep.
static puz::Settings g_settings = puz::defaultSettings();
static std::string settingsPath() { return g_saveDir + "/settings"; }
static void loadSettings() {
  if (!g_fs) return;
  File f = g_fs->open(settingsPath().c_str(), "r");
  if (!f) return;
  String s = f.readString();
  f.close();
  g_settings = puz::parseSettings(std::string(s.c_str()));
}
static void saveSettings() {
  if (!g_fs) return;
  std::string blob = puz::serializeSettings(g_settings);
  File f = g_fs->open(settingsPath().c_str(), "w");
  if (!f) return;
  f.write((const uint8_t *)blob.data(), blob.size());
  f.close();
}
// --- remembered per-game size ---
// A .sav carries its own params (midend_serialise stores them), so a resumed
// board already comes back at the size the player chose. This covers the other
// path: without it, a game whose save is missing or was dropped as corrupt
// regenerates at the shipped presets.h size, silently discarding that choice.
// /sizes, `slug=params` lines (gamesize.h owns the format). Written on a
// preset/custom apply -- a rare, explicit act, so no autosave debounce.
static std::vector<puz::GameSize> g_sizes;
static std::string sizesPath() { return g_saveDir + "/sizes"; }
static void loadSizes() {
  if (!g_fs) return;
  File f = g_fs->open(sizesPath().c_str(), "r");
  if (!f) return;
  String s = f.readString();
  f.close();
  g_sizes = puz::parseSizes(std::string(s.c_str()));
}
static void saveSizes() {
  if (!g_fs) return;
  std::string blob = puz::serializeSizes(g_sizes);
  File f = g_fs->open(sizesPath().c_str(), "w");
  if (!f) return;
  if (!blob.empty()) f.write((const uint8_t *)blob.data(), blob.size());
  f.close();
}
// The open game's params, in the game's own full encoding. full=true rather than
// midend_get_game_id's short form, which omits whatever the game considers
// non-persistent (Solo's difficulty, for one) -- exactly the settings a player
// who just picked a type would expect to come back. midend_get_params hands back
// a dup, so free it through the game's own free_params.
static std::string currentParams() {
  if (!g_me) return "";
  const game *g = midend_which_game(g_me);
  game_params *p = midend_get_params(g_me);
  char *enc = g->encode_params(p, true);
  std::string out = enc ? enc : "";
  sfree(enc);
  g->free_params(p);
  return out;
}
static void rememberSize() {
  if (puz::setSize(g_sizes, g_curSlug, currentParams())) saveSizes();
}

// Live-apply while the screen is open. Brightness goes straight to the panel
// (cardputer::brightness also feeds the idle dimmer's "awake" level, so the two
// can't disagree); the pointer flip takes effect immediately as well as at the
// next boot, so the setting is testable from where you set it.
static void applySettings(uint8_t bright, bool pointer);
static void commitSettings();

// Toggle the star on the game at chooser row `row`, and return the row that
// game moved to -- the selection follows the title across the reshuffle, so the
// player can see where it landed instead of the bar staying put over a
// different game.
static int toggleFav(int row) {
  if (row < 0 || row >= gamecount) return row;
  int g = g_order[row];
  g_fav[g] = !g_fav[g];
  rebuildOrder();
  saveFavs();
  return puz::favSlot(g_order, gamecount, g);
}

// Persist the currently-loaded game. Serialise, dedup against the cached copy
// (so idle/navigation re-saves and per-frame drags cost nothing), then update
// RAM and write the backend atomically (temp + rename -> a power-cut can't leave
// a half-written .sav). Cadence is deliberately save-on-leave + a ~3s autosave
// debounce, NOT per-move: that bounds flash/SD wear to hundreds of writes/day
// (100k erase cycles/sector + wear-levelling => effectively never). Do not move
// this to a per-keystroke write.
static void persistGame(int idx) {
  if (!g_fs || !g_me || idx < 0 || idx >= (int)g_saved.size()) return;
  std::string blob;
  midend_serialise(g_me, serWrite, &blob);
  if (blob == g_saved[idx]) return;                 // already durable (g_saved mirrors the backend)
  std::string path = savePath(idx), tmp = path + ".t";
  File f = g_fs->open(tmp.c_str(), "w");
  if (!f) return;                                   // backend unavailable: g_saved unchanged -> retried next time
  bool ok = f.write((const uint8_t *)blob.data(), blob.size()) == blob.size();
  f.close();
  if (!ok) { g_fs->remove(tmp.c_str()); return; }
  // Swap tmp over the live .sav. On littlefs rename-over-existing is one atomic
  // metadata commit; on FAT (SD) it won't overwrite, so fall back to remove+rename.
  if (!g_fs->rename(tmp.c_str(), path.c_str())) {
    g_fs->remove(path.c_str());
    if (!g_fs->rename(tmp.c_str(), path.c_str())) { g_fs->remove(tmp.c_str()); return; }
  }
  g_saved[idx] = std::move(blob);                   // durable now -> mirror in RAM (also the dedup baseline)
}
// Restore the freshly-created g_me for `idx`: cached RAM -> lazily-loaded backend
// -> report miss so the caller generates fresh. A blob that fails to deserialise
// (corrupt / version drift) is discarded, so restore degrades to a new game.
static bool restoreGame(int idx) {
  if (idx < 0 || idx >= (int)g_saved.size()) return false;
  if (g_saved[idx].empty() && g_fs) {               // lazy-load from the backend
    File f = g_fs->open(savePath(idx).c_str(), "r");
    if (f) {
      size_t n = f.size();
      g_saved[idx].resize(n);
      if (n) f.read((uint8_t *)g_saved[idx].data(), n);
      f.close();
    }
  }
  if (g_saved[idx].empty()) return false;
  SerReadCtx rc{ &g_saved[idx], 0 };
  if (midend_deserialise(g_me, serRead, &rc) == nullptr) return true;   // NULL == success
  g_saved[idx].clear();                             // corrupt: drop cache + file, fall back to fresh
  if (g_fs) g_fs->remove(savePath(idx).c_str());
  return false;
}

static void startGame(int idx) {
  g_dragBtn = 0;   // drop any half-finished drag from the previous game
  g_ptrSel = PtrSel::None; g_ptrHl = false;   // neutral crosshair for the new game (no armed-glyph carryover)
  persistGame(g_curIdx);   // flush the outgoing game (RAM + flash) before freeing it
  g_dirtyMs = 0;
  if (g_me) { midend_free(g_me); g_me = nullptr; }
  g_me = midend_new(&g_fe, gamelist[idx], &cardputer_drawing_api, &g_fe);
  if (!g_me) return;
  g_curIdx = idx;
  g_curGameName = gamelist[idx]->name;
  g_curSlug = gamelist[idx]->htmlhelp_topic;   // unique lowercase slug; keys the split-drag table
  g_fe.zoom = false;   // fresh game starts unmagnified
  // Restore a saved board (RAM or flash) if we have one; else generate fresh.
  frontend_set_crash(g_curGameName, "restore");
  bool restored = restoreGame(idx);
  if (!restored) {
    // Prefer the size this game was last played at; presets.h is only the
    // first-run default. midend_game_id is all-or-nothing (it validates into a
    // scratch params set before touching the midend), so a stored string that no
    // longer decodes -- an upstream params change, a hand-edited /sizes -- leaves
    // params untouched and we fall back to the preset rather than to nothing.
    const char *p = puz::sizeFor(g_sizes, g_curSlug);
    if (p && midend_game_id(g_me, p) != nullptr) p = nullptr;   // rejected: not this game's params any more
    if (!p) {
      p = presetFor(g_curGameName);
      if (p) midend_game_id(g_me, p);  // returns nullptr on success; on error params stay default
    }
    frontend_set_crash(g_curGameName, p);   // crash ctx before generation (name + size/preset/default)
    midend_new_game(g_me);
  }
  { char *id = midend_get_game_id(g_me);   // refine with the resolved game-id (desc exists now)
    frontend_set_crash(g_curGameName, id); sfree(id); }
  frontend_load_colours(&g_fe, g_me);
  sizeAndCenter();
  g_fe.canvas->fillSprite(UI_BLACK);   // clear stale pixels from the previous game
  midend_force_redraw(g_me);
  puz::uiBind({ g_me, &reloadResumePlaying, &resumePlaying, &toType, &toConfig, &toRules, &toReport, &togglePointer, &toggleZoom, &recenterPointer });
  // One-shot discoverability splash: shown on the first game entry per boot, then never again.
  if (!g_tab_seen) {
    auto &d = M5.Display;
    d.fillScreen(TFT_BLACK);
    d.setTextSize(2); d.setTextColor(TFT_CYAN, TFT_BLACK); d.setTextDatum(middle_center);
    d.drawString("Tab = menu", 120, 58);
    d.setTextSize(1); d.setTextColor(d.color565(0x88, 0x99, 0xaa), TFT_BLACK);
    d.drawString("options, size, undo...", 120, 82);
    delay(1100);
    g_tab_seen = true;   // shown once; don't nag again this session
  }
  g_state = State::PLAYING;
  g_last_ms = millis();
}

static void openMenu() {
  persistGame(g_curIdx);   // parking a game -> flush RAM+flash now (autosave loop won't run in MENU)
  g_dirtyMs = 0;
  g_selDirtyMs = 0;   // g_sel is the game we just left, already the saved one
  g_state = State::MENU;
  puz::drawChooser(g_sel, g_order, g_fav);
}

static void applySettings(uint8_t bright, bool pointer) {
  g_settings.brightness = bright;
  g_settings.pointer = pointer;
  cardputer::brightness(bright);
  g_ptr_on = pointer;
}
static void commitSettings() { saveSettings(); openMenu(); }

// --- the game list's Tab menu ---
// In a game Tab opens a picker of commands; on the list it opens this one, so
// the key means the same thing in both places. Two entries only, which is why
// it is a picker rather than a screen: Settings needs somewhere to live, and
// hanging it off a second modifier would be a hotkey nobody finds.
static const char *kListItems[] = { "Help", "Settings" };
static int g_listSel = 0;
static void drawListMenu() { puz::drawPicker(kListItems, 2, g_listSel, "Menu", "Tab", nullptr, 5); }
static void drawHelp();
static void openListMenu() { g_listSel = 0; g_state = State::LIST_MENU; drawListMenu(); }

// Selecting a game from the chooser: if it's the game already loaded, resume it
// in progress (so an accidental ` back to the menu doesn't lose a puzzle) instead
// of regenerating. Switching to a different title starts that one fresh.
static void enterGame(int idx) {
  saveLastGame(idx); g_selDirtyMs = 0;   // the chooser reopens here after a power-cycle; supersedes a pending browse-write
  if (g_me && idx == g_curIdx) { resumePlaying(); return; }
  startGame(idx);
}

void setup() {
  Serial.begin(115200);
  cardputer::begin();

  // Start every cursor game with its keyboard cursor already visible. Without
  // this, upstream inits cur_visible=false (getenv_bool default) and the FIRST
  // CURSOR_SELECT only reveals the cursor at region 0 instead of acting -- so
  // Enter/Space feel dead / off-by-one until an arrow or a wasted press wakes
  // it. 35 games honour this flag (incl. Map's pipette pickup). Value must lead
  // with y/Y/t/T -- getenv_bool (upstream misc.c) tests only the first char.
  setenv("PUZZLES_SHOW_CURSOR", "y", 1);
  g_saved.resize(gamecount);   // one save slot per game
  // Pick a save backend. Prefer the SD card: it survives Launcher/app-only
  // installs (which run under the Launcher's partition table -- no LittleFS data
  // partition). Fall back to internal LittleFS for full-flash installs with no
  // card. SD pins are the Cardputer's SPI: SCK 40 / MISO 39 / MOSI 14 / CS 12.
  SPI.begin(40, 39, 14, 12);
  if (SD.begin(12, SPI, 25000000)) {
    g_fs = &SD; g_saveDir = "/puzzles"; SD.mkdir("/puzzles");
  } else if (LittleFS.begin(false) || LittleFS.begin(true)) {
    g_fs = &LittleFS; g_saveDir = "";               // flat root on the internal partition
  }

  g_fe.canvas = new M5Canvas(&M5.Display);
  g_fe.canvas->setColorDepth(lgfx::color_depth_t::palette_8bit);   // 8bpp palette: 32KB vs 64KB at 16bpp
                                                                   // (plain 8 = rgb332, no palette -> wrong colours)
  if (!g_fe.canvas->createSprite(240, 135))   // auto-allocates the 256-entry palette
    fatal("canvas createSprite failed - not enough SRAM");
  g_fe.canvas->setPaletteColor(UI_WHITE, 255, 255, 255);   // reserved UI chrome
  g_fe.canvas->setPaletteColor(UI_BLACK, 0, 0, 0);
  g_fe.canvas->setPaletteColor(UI_RED, 255, 0, 0);         // pointer crosshair (fill)
  g_fe.canvas->setPaletteColor(UI_BLUE, 0, 0, 255);        // pointer crosshair (pencil)
  g_fe.ncolours = 0; g_fe.timer_active = false;
  g_fe.statusbar = false;
  g_fe.status[0] = '\0';
  g_fe.zoom = false; g_fe.zoomX = 120; g_fe.zoomY = 67;

  // Settings before the first draw: the backlight the player chose should be the
  // level the boot screen comes up at, not a flash of the default then a jump.
  loadSettings();
  cardputer::brightness(g_settings.brightness);
  g_ptr_on = g_settings.pointer;
  puz::settingsBind({ &applySettings, &commitSettings });

  loadFavs();
  loadSizes();
  rebuildOrder();          // identity order when nothing is starred (and when there's no backend)
  // Land on the last title played, not always the top row -- and on its ROW,
  // since starred games have moved the rows around.
  g_sel = puz::favSlot(g_order, gamecount, loadLastGame());
  openMenu();
}

static void drawHelp() {
  auto &d = M5.Display;
  d.fillScreen(TFT_BLACK);
  d.setTextSize(1); d.setTextColor(TFT_CYAN, TFT_BLACK);
  d.setTextDatum(top_left); d.drawString("Controls", 4, 2);
  d.drawFastHLine(0, 12, 240, d.color565(0x24, 0x40, 0x55));
  d.setTextColor(TFT_WHITE, TFT_BLACK);
  const char *L[] = {";,./        move cursor", "Enter/Space select / mark",
                     "Ctrl+Z / Y  undo / redo", "Ctrl+N / R  new / restart",
                     "Tab         menu (in game)", "Ctrl+P/Sp   pointer/recenter",
                     "Ctrl+L zoom  Ctrl+;,./ pan"};
  for (int i = 0; i < 7; i++) d.drawString(L[i], 6, 20 + i * 16);
  d.setTextColor(d.color565(0x67, 0x88, 0x99), TFT_BLACK);
  d.setTextDatum(bottom_left);  d.drawString("` back", 4, 133);
  d.setTextDatum(bottom_right); d.drawString(FW_VERSION, 236, 133);
}

static void handlePlaying(puz::InputEvent ev) {
  using puz::Ev;
  switch (ev.kind) {
    case Ev::BackToChooser: cancelDrag(); openMenu(); return;
    // cancelDrag before the menu takes over: leaving PLAYING with a pickup still
    // armed strands it, and coming back the next press reads as the DROP half of
    // a drag the player has forgotten starting.
    case Ev::CommandMenu:   cancelDrag(); g_tab_seen = true; g_state = State::COMMAND; puz::openCommand(); return;
    case Ev::Select:        // Enter: pointer-click at crosshair if pointer on, else cursor-select
      if (g_ptr_on) {
        int px, py; ptrToPuzzle(&px, &py);   // screen -> puzzle coords (zoom-aware)
        if (puz::needsSplitDrag(g_curSlug)) { dragStep(px, py, LEFT_BUTTON); return; }   // pick up / drop
        midend_process_key(g_me, px, py, LEFT_BUTTON);
        midend_process_key(g_me, px, py, LEFT_RELEASE);
        ptrTrackClick(PtrSel::Fill);
      } else midend_process_key(g_me, 0, 0, CURSOR_SELECT);
      return;
    case Ev::Select2:       // Space: pointer right-click if pointer on, else cursor-select2
      if (g_ptr_on) {
        int px, py; ptrToPuzzle(&px, &py);
        if (puz::needsSplitDrag(g_curSlug)) { dragStep(px, py, RIGHT_BUTTON); return; }  // pick up / pencil-drop
        midend_process_key(g_me, px, py, RIGHT_BUTTON);
        midend_process_key(g_me, px, py, RIGHT_RELEASE);
        ptrTrackClick(PtrSel::Pencil);
      } else midend_process_key(g_me, 0, 0, CURSOR_SELECT2);
      return;
    case Ev::Restart: cancelDrag(); midend_restart_game(g_me); return;
    case Ev::TogglePointer: cancelDrag(); g_ptr_on = !g_ptr_on; g_ptrSel = PtrSel::None; g_ptrHl = false; return;   // Ctrl+P (plain 'p' belongs to the game)
    case Ev::RecenterPointer: recenterPointer(); return;   // Ctrl+Space
    case Ev::ZoomPeek: toggleZoom(); return;                // Ctrl+L: toggle live 2x magnifier
    case Ev::PanUp:    panZoom(0, -16); return;             // Ctrl+;,./ pan the zoom window
    case Ev::PanDown:  panZoom(0,  16); return;
    case Ev::PanLeft:  panZoom(-16, 0); return;
    case Ev::PanRight: panZoom( 16, 0); return;
    case Ev::NewGame:
      cancelDrag();
      midend_new_game(g_me); frontend_load_colours(&g_fe, g_me);
      sizeAndCenter();
      midend_force_redraw(g_me); return;
    default: {
      // Pointer-mode direct entry: a digit (or backspace = clear) lands on the
      // crosshair cell without a prior Enter. Auto-left-click first unless a
      // selection is already active there (explicit Enter/Space click) — see
      // PtrSel above. Only digits/backspace: letters can be global commands in
      // some games (Map's 'l', Undead's monsters), where a stray click moves.
      if (g_ptr_on && (ev.kind == puz::Ev::Char) &&
          ((ev.ch >= '0' && ev.ch <= '9') || ev.ch == '\b')) {
        if (g_ptrHl) {
          // A click-made highlight is still showing: send the digit straight to
          // it. The game keyed the selection to the clicked CELL, so crosshair
          // drift since the click doesn't matter — and an extra click here
          // would toggle the selection off / stomp a pencil highlight.
          midend_process_key(g_me, 0, 0, (unsigned char)ev.ch);
          g_ptrHl = false;                              // game hides it after the digit
          if (g_ptrSel == PtrSel::Fill) g_ptrSel = PtrSel::None;
          // Pencil stays armed: see below.
        } else {
          // No live highlight: click first, then the digit. Pencil mode is
          // sticky — Space arms it, and each digit re-right-clicks so marks
          // keep appending (games hide the pencil highlight after every digit;
          // pencil_keep_highlight defaults off upstream). Enter/Space exits.
          int px, py; ptrToPuzzle(&px, &py);
          int btn = (g_ptrSel == PtrSel::Pencil) ? RIGHT_BUTTON : LEFT_BUTTON;
          int rel = (g_ptrSel == PtrSel::Pencil) ? RIGHT_RELEASE : LEFT_RELEASE;
          midend_process_key(g_me, px, py, btn);
          midend_process_key(g_me, px, py, rel);
          midend_process_key(g_me, 0, 0, (unsigned char)ev.ch);
        }
        return;
      }
      int btn = puz::midendButton(ev);   // cursor/select/select2/char/undo/redo/solve
      if (btn >= 0) midend_process_key(g_me, 0, 0, btn);
      return;
    }
  }
}

void loop() {
  cardputer::update();

  if (g_state == State::MENU) {
    for (auto k : cardputer::keysJustPressedEx()) {
      puz::InputEvent ev = puz::eventForKey(k);
      if (ev.kind == puz::Ev::Up)   { g_sel = (g_sel + gamecount - 1) % gamecount; puz::drawChooser(g_sel, g_order, g_fav); }
      if (ev.kind == puz::Ev::Down) { g_sel = (g_sel + 1) % gamecount;             puz::drawChooser(g_sel, g_order, g_fav); }
      // ',' / '/' page by the window height (5 rows) -- 40 titles is 20 presses
      // of ';' end to end, and the arrow cluster's left/right are otherwise idle
      // in the chooser.
      if (ev.kind == puz::Ev::Left)  { g_sel = (g_sel + gamecount - 5) % gamecount; puz::drawChooser(g_sel, g_order, g_fav); }
      if (ev.kind == puz::Ev::Right) { g_sel = (g_sel + 5) % gamecount;             puz::drawChooser(g_sel, g_order, g_fav); }
      if (ev.kind == puz::Ev::Up || ev.kind == puz::Ev::Down ||
          ev.kind == puz::Ev::Left || ev.kind == puz::Ev::Right) g_selDirtyMs = millis();   // arm the browse-write
      // Ctrl+F: star / unstar. The rows reshuffle, so the pending browse-write
      // is re-armed against the row the title moved TO, not the row index the
      // player was sitting on.
      if (ev.kind == puz::Ev::ToggleFavorite) {
        g_sel = toggleFav(g_sel); puz::drawChooser(g_sel, g_order, g_fav); g_selDirtyMs = millis();
      }
      if (ev.kind == puz::Ev::Select)      enterGame(g_order[g_sel]);
      if (ev.kind == puz::Ev::CommandMenu) openListMenu();
      if (g_state != State::MENU) break;
    }
    // Selection parked long enough -> remember it, so powering off while just
    // browsing resumes here too. saveLastGame dedups, so a scroll that returns
    // to where it started costs no write.
    if (g_state == State::MENU && g_selDirtyMs &&
        (uint32_t)(millis() - g_selDirtyMs) >= AUTOSAVE_MS) { saveLastGame(g_order[g_sel]); g_selDirtyMs = 0; }
    delay(16); return;
  }
  if (g_state == State::LIST_MENU) {
    for (auto k : cardputer::keysJustPressedEx()) {
      puz::InputEvent ev = puz::eventForKey(k);
      if (ev.kind == puz::Ev::Up || ev.kind == puz::Ev::Down) { g_listSel = (g_listSel + 1) % 2; drawListMenu(); }
      if (ev.kind == puz::Ev::BackToChooser || ev.kind == puz::Ev::CommandMenu) { openMenu(); break; }
      if (ev.kind == puz::Ev::Select) {
        if (g_listSel == 0) { g_state = State::HELP; drawHelp(); }
        else { g_state = State::SETTINGS; puz::openSettings(g_settings.brightness, g_settings.pointer); }
        break;
      }
    }
    delay(16); return;
  }
  if (g_state == State::HELP) {
    for (auto k : cardputer::keysJustPressedEx())
      if (puz::eventForKey(k).kind == puz::Ev::BackToChooser) openMenu();
    delay(16); return;
  }
  if (g_state == State::SETTINGS) {
    // settingsKey commits through commitSettings(), which returns to the chooser.
    for (auto k : cardputer::keysJustPressedEx()) { puz::settingsKey(puz::eventForKey(k)); if (g_state != State::SETTINGS) break; }
    delay(16); return;
  }
  if (g_state == State::COMMAND) {
    for (auto k : cardputer::keysJustPressedEx()) { puz::commandKey(puz::eventForKey(k)); if (g_state != State::COMMAND) break; }
    delay(16); return;
  }
  if (g_state == State::TYPE_MENU) {
    for (auto k : cardputer::keysJustPressedEx()) { puz::typeKey(puz::eventForKey(k)); if (g_state != State::TYPE_MENU) break; }
    delay(16); return;
  }
  if (g_state == State::CONFIG_EDIT) {
    for (auto k : cardputer::keysJustPressedEx()) { puz::configKey(puz::eventForKey(k)); if (g_state != State::CONFIG_EDIT) break; }
    delay(16); return;
  }
  if (g_state == State::RULES) {
    for (auto k : cardputer::keysJustPressedEx()) { puz::ruleKey(puz::eventForKey(k)); if (g_state != State::RULES) break; }
    delay(16); return;
  }
  if (g_state == State::REPORT) {
    for (auto k : cardputer::keysJustPressedEx()) { puz::reportKey(puz::eventForKey(k)); if (g_state != State::REPORT) break; }
    if (g_state == State::REPORT) puz::reportTick();   // keep the panel lit for the camera
    delay(16); return;
  }

  // PLAYING
  uint32_t now = millis();
  float dt = (now - g_last_ms) / 1000.0f;

  cardputer::Imu imu;
  if (g_ptr_on && cardputer::imuRead(imu)) {
    // Subtract the recentred neutral so any comfortable hold angle reads as
    // level -- without it the rate-control crosshair drifts unless held flat.
    puz::pointerStep(g_ptr, -imu.ax - g_tiltBiasX, imu.ay - g_tiltBiasY, dt, 240, 135);  // ADV accel X inverted vs screen
    if (g_fe.zoom) {
      // Edge-pan: crosshair pushed against a screen edge drags the zoom window
      // along, so the pointer can reach the whole board without Ctrl+panning.
      const int margin = 8, speed = 3;
      int dx = 0, dy = 0;
      if (g_ptr.x < margin) dx = -speed; else if (g_ptr.x > 240 - margin) dx = speed;
      if (g_ptr.y < margin) dy = -speed; else if (g_ptr.y > 135 - margin) dy = speed;
      if (dx || dy) { g_fe.zoomX += dx; g_fe.zoomY += dy; clampZoom(); }
      // (no push here: the pointer-mode push below repaints every frame)
    }
  }

  for (auto k : cardputer::keysJustPressedEx()) {
    handlePlaying(puz::eventForKey(k));   // Ctrl+P → Ev::TogglePointer, handled in handlePlaying
    if (g_state != State::PLAYING) return;   // a handler changed state
    g_dirtyMs = now;   // an in-game keystroke -> arm autosave (persistGame dedups no-op changes)
    g_fullRedraw = true;
  }

  // Mid-drag on Map: stream the held button as a DRAG to the live crosshair so
  // the carried-colour blob tracks the pointer (upstream draws it at ui->dragx).
  // Frame-driven (not a keystroke) so it never arms autosave.
  if (g_ptr_on && g_dragBtn) {
    int px, py; ptrToPuzzle(&px, &py);
    midend_process_key(g_me, px, py, g_dragBtn == RIGHT_BUTTON ? RIGHT_DRAG : LEFT_DRAG);
  }

  // Autosave the open game once it's been idle AUTOSAVE_MS since the last change,
  // so a power-off (no shutdown hook exists) loses at most a few seconds. Deduped.
  if (g_dirtyMs && (uint32_t)(now - g_dirtyMs) >= AUTOSAVE_MS) { persistGame(g_curIdx); g_dirtyMs = 0; }

  // An animation owns the frame while it runs: force-redrawing mid-animation would
  // throw away the drawstate the game is tweening against. Hold the flag until the
  // timer stops, then repaint once -- the settled frame is the one that persists.
  bool wasAnimating = g_fe.timer_active;
  if (g_fe.timer_active) midend_timer(g_me, dt);
  if (wasAnimating && !g_fe.timer_active) g_fullRedraw = true;
  // Nor mid-drag: force_redraw discards the drawstate, and the split-drag games
  // (Pegs, Signpost, ...) keep the background under the carried piece in a
  // blitter that lives there. Losing it mid-carry smears far worse than the
  // residue this is fixing. The drop is a keystroke, so the flag survives to it.
  // A frame with no input, no animation and no carry has nothing to say, and
  // redrawing it is not free of consequence: tents repaints its whole grid lattice
  // every single frame (upstream never sets ds->started) while redrawing no tiles,
  // so an idle redraw draws black lines straight over the error markers the
  // previous frame got right. Skip it -- the canvas already holds the frame, and
  // nothing outside the midend draws into the board while playing. (Pointer mode
  // pushes its own crosshair frame below, so the panel still tracks the pointer.)
  bool carrying = (g_ptr_on && g_dragBtn);
  if (g_fullRedraw && !g_fe.timer_active && !g_dragBtn) { g_fullRedraw = false; midend_force_redraw(g_me); }
  else if (g_fe.timer_active || carrying || g_fullRedraw) midend_redraw(g_me);

  if (g_ptr_on) {
    // Composite the crosshair INTO the canvas so it pushes atomically with the
    // frame — drawing straight to the panel after the push both flickers (the
    // next push overwrites it for a few ms) and smears (pushRotateZoom doesn't
    // repaint the outermost rows, so panel-drawn pixels survive at the edges).
    // Save-draw-push-restore, same trick as the midend blitter.
    int cx = (int)g_ptr.x, cy = (int)g_ptr.y;
    if (g_fe.zoom) {   // screen -> canvas coords; magnification bolds it back up
      cx = g_fe.zoomX + (cx - 120) / 2;
      cy = g_fe.zoomY + (cy - 67) / 2;
    }
    if (cx < 4) cx = 4; if (cx > 235) cx = 235;   // keep the 9x9 patch on-canvas
    if (cy < 4) cy = 4; if (cy > 130) cy = 130;
    // Save/restore per-pixel via readPixelValue/drawPixel: those speak raw
    // palette indices. readRect/pushImage do NOT round-trip indices on a
    // palette sprite (they colour-convert), which corrupts the board.
    static uint8_t saved[9 * 9];
    M5Canvas *cv = g_fe.canvas;
    for (int dy = 0; dy < 9; dy++)
      for (int dx = 0; dx < 9; dx++)
        saved[dy * 9 + dx] = (uint8_t)cv->readPixelValue(cx - 4 + dx, cy - 4 + dy);
    if (g_dragBtn) {
      // Carrying something: a box with a centre dot, deliberately unlike the +
      // and X. Those two mean "a cell is selected"; this means "a pickup is live
      // and the next press of this same key drops it", which is a different
      // state the player has to be able to see. Colour still says which key is
      // armed (red = Enter, blue = Space), so the drop/cancel pair stays legible.
      uint8_t c = (g_dragBtn == RIGHT_BUTTON) ? UI_BLUE : UI_RED;
      cv->drawRect(cx - 3, cy - 3, 7, 7, c);
      cv->drawPixel(cx, cy, c);
    } else if (g_ptrSel == PtrSel::Pencil) {
      // Pencil mode: blue diagonal X so the mode is visible at a glance.
      cv->drawLine(cx - 3, cy - 3, cx + 3, cy + 3, UI_BLUE);
      cv->drawLine(cx - 3, cy + 3, cx + 3, cy - 3, UI_BLUE);
    } else {
      cv->drawLine(cx - 4, cy, cx + 4, cy, UI_RED);
      cv->drawLine(cx, cy - 4, cx, cy + 4, UI_RED);
    }
    frontend_push(&g_fe);
    for (int dy = 0; dy < 9; dy++)   // restore the game's pixels
      for (int dx = 0; dx < 9; dx++)
        cv->drawPixel(cx - 4 + dx, cy - 4 + dy, saved[dy * 9 + dx]);
  }

  g_last_ms = now;
  delay(16);
}
