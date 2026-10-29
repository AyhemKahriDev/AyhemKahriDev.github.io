// smear_test.cpp - host repro for the frame-residue issues (#2 smear trails,
// #5 stale pixels after a cursor move).
//
// Emulates the device canvas (240x135, 8bpp indices, persistent across frames,
// LovyanGFX clip-rect semantics) plus the frontend's offX/offY centering, then
// for each move: plays the move, runs the animation to completion, snapshots the
// canvas (A), and compares it against a from-scratch midend_force_redraw on a
// cleared canvas (B). Any A != B pixel is residue the incremental path left behind.
//
// A runs main.cpp's ACTUAL draw policy, g_fullRedraw included - an input arms a
// full repaint, taken by the next frame that is neither animating nor mid-carry.
// Keep the two in step: a harness modelling an idealised loop grades a device
// that does not exist. Two consequences, both deliberate:
//   - tween frames (A tweening against a carried drawstate, B against one built
//     this frame) are counted separately and do NOT fail the run. They last one
//     frame each and never survive into the settled frame, which is graded hard.
//   - DRAG runs only for the split-drag games. Everywhere else the device turns a
//     press into an atomic press+release inside one frame, so a mid-drag frame is
//     never rendered and grading one reports a bug no player can reach.
//
// Build (host only). The *_test.cpp suffix is load-bearing: build_src_filter
// excludes it from the firmware, and without that suffix this file's fatal() /
// get_random_seed stubs collide with frontend.cpp at link time.
//   gcc -std=c11 -DCOMBINED -DNO_TGMATH_H -I./upstream -I./src/puzzles -c upstream/*.c src/puzzles/gamelist.c
//   g++ -std=c++17 -DCOMBINED -DNO_TGMATH_H -I./upstream -I./src/puzzles -c src/puzzles/params_ui.cpp src/puzzles/smear_test.cpp
//   g++ -std=c++17 *.o -o smear_test -lm && ./smear_test
#include <cstdarg>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <cmath>
#include <vector>
#include <string>

extern "C" {
#include "puzzles.h"
}
#include "presets.h"
#include "input.h"

// ---- canvas ----------------------------------------------------------------

static const int CW = 240, CH = 135;
static const unsigned char BG = 255;   // UI_BLACK

struct Canvas {
  unsigned char px[CW * CH];
  int cl, cr, ct, cb;   // clip rect, inclusive (LovyanGFX _clip_l/_clip_r/_clip_t/_clip_b)

  void clearAll() { memset(px, BG, sizeof px); clearClip(); }
  void clearClip() { cl = 0; ct = 0; cr = CW - 1; cb = CH - 1; }
  // mirrors LGFXBase::setClipRect
  void setClip(int x, int y, int w, int h) {
    if (x < 0) { w += x; x = 0; }
    if (w > CW - x) w = CW - x;
    if (w < 1) { x = 0; w = 0; }
    cl = x; cr = x + w - 1;
    if (y < 0) { h += y; y = 0; }
    if (h > CH - y) h = CH - y;
    if (h < 1) { y = 0; h = 0; }
    ct = y; cb = y + h - 1;
  }
  inline void put(int x, int y, unsigned char c) {
    if (x < cl || x > cr || y < ct || y > cb) return;
    if (x < 0 || x >= CW || y < 0 || y >= CH) return;
    noteWrite(x, y);
    px[y * CW + x] = c;
  }
  void noteWrite(int x, int y);
  inline unsigned char get(int x, int y) const {
    if (x < 0 || x >= CW || y < 0 || y >= CH) return BG;
    return px[y * CW + x];
  }
  void fillRect(int x, int y, int w, int h, unsigned char c) {
    for (int j = 0; j < h; j++) for (int i = 0; i < w; i++) put(x + i, y + j, c);
  }
  void line(int x0, int y0, int x1, int y1, unsigned char c) {
    int dx = abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
    int dy = -abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
    int err = dx + dy;
    for (;;) {
      put(x0, y0, c);
      if (x0 == x1 && y0 == y1) break;
      int e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }
  void fillCircle(int cx, int cy, int r, unsigned char c) {
    for (int j = -r; j <= r; j++) for (int i = -r; i <= r; i++)
      if (i * i + j * j <= r * r) put(cx + i, cy + j, c);
  }
  void drawCircle(int cx, int cy, int r, unsigned char c) {
    for (int j = -r; j <= r; j++) for (int i = -r; i <= r; i++) {
      int d2 = i * i + j * j;
      if (d2 <= r * r && d2 > (r - 1) * (r - 1)) put(cx + i, cy + j, c);
    }
  }
};

// ---- frontend --------------------------------------------------------------

struct frontend {
  Canvas *cv;
  int offX, offY;
  bool timer_active;
  bool statusbar;
  char status[128];
};

static inline frontend *FE(drawing *dr) { return (frontend *)GET_HANDLE_AS_TYPE(dr, frontend); }

static void d_rect(drawing *dr, int x, int y, int w, int h, int c) {
  frontend *fe = FE(dr);
  fe->cv->fillRect(x + fe->offX, y + fe->offY, w, h, (unsigned char)c);
}
static void d_line(drawing *dr, int x1, int y1, int x2, int y2, int c) {
  frontend *fe = FE(dr);
  fe->cv->line(x1 + fe->offX, y1 + fe->offY, x2 + fe->offX, y2 + fe->offY, (unsigned char)c);
}
static void d_circle(drawing *dr, int cx, int cy, int r, int fill, int outline) {
  frontend *fe = FE(dr);
  cx += fe->offX; cy += fe->offY;
  if (fill >= 0) fe->cv->fillCircle(cx, cy, r, (unsigned char)fill);
  fe->cv->drawCircle(cx, cy, r, (unsigned char)outline);
}
static void d_poly(drawing *dr, const int *coords, int np, int fill, int outline) {
  if (np < 3) return;
  draw_polygon_fallback(dr, coords, np, fill, outline);   // re-enters via d_line/d_rect
}
static void d_thick(drawing *dr, float th, float x1, float y1, float x2, float y2, int c) {
  (void)th; d_line(dr, (int)x1, (int)y1, (int)x2, (int)y2, c);
}
// Approximation of M5GFX text: a filled glyph box per character, same metrics the
// frontend picks (TomThumb 3x5 under fontsize 7, else Font0 6x8 scaled).
static void d_text(drawing *dr, int x, int y, int fonttype, int fontsize,
                   int align, int colour, const char *text) {
  (void)fonttype;
  frontend *fe = FE(dr);
  int cwid, chgt;
  if (fontsize <= 6) { cwid = 4; chgt = 6; }
  else { int sz = (fontsize + 4) / 8; if (sz < 1) sz = 1; cwid = 6 * sz; chgt = 8 * sz; }
  int n = (int)strlen(text);
  int w = n * cwid, h = chgt;
  int px = x + fe->offX, py = y + fe->offY;
  if (align & ALIGN_HCENTRE)     px -= w / 2;
  else if (align & ALIGN_HRIGHT) px -= w;
  if (align & ALIGN_VCENTRE) py -= h / 2;
  else                       py -= h;            // baseline_*
  // A real glyph is sparse and drawn with a TRANSPARENT background (M5GFX treats
  // fore == back, which setTextColor(colour) sets, as "no bg fill" - see
  // lgfx_fonts.cpp `fillbg`). Model that: a plus-shaped stroke inside each cell,
  // never a solid box, so the harness cannot mask residue by over-painting.
  for (int i = 0; i < n; i++) {
    int gx = px + i * cwid, gy = py;
    for (int j = 1; j < h - 1; j++)      fe->cv->put(gx + cwid / 2, gy + j, (unsigned char)colour);
    for (int k = 1; k < cwid - 1; k++)   fe->cv->put(gx + k, gy + h / 2, (unsigned char)colour);
  }
}
static void d_clip(drawing *dr, int x, int y, int w, int h) {
  FE(dr)->cv->setClip(x + FE(dr)->offX, y + FE(dr)->offY, w, h);
}
static void d_unclip(drawing *dr) { FE(dr)->cv->clearClip(); }
static void d_start(drawing *dr)  { FE(dr)->cv->clearClip(); }
static void d_end(drawing *dr) {
  frontend *fe = FE(dr);
  if (fe->statusbar) fe->cv->fillRect(0, 124, 240, 11, BG);   // strip repainted every frame
}
static void d_update(drawing *, int, int, int, int) {}
static void d_status(drawing *dr, const char *t) {
  strncpy(FE(dr)->status, t ? t : "", sizeof FE(dr)->status - 1);
  FE(dr)->status[sizeof FE(dr)->status - 1] = '\0';
}

struct blitter { int w, h, x, y; unsigned char *buf; };
static blitter *bl_new(drawing *, int w, int h) {
  blitter *bl = (blitter *)malloc(sizeof(blitter));
  bl->w = w; bl->h = h; bl->x = bl->y = -1;
  bl->buf = (unsigned char *)malloc((size_t)w * h);
  return bl;
}
static void bl_free(drawing *, blitter *bl) { free(bl->buf); free(bl); }
static void bl_save(drawing *dr, blitter *bl, int x, int y) {
  frontend *fe = FE(dr);
  bl->x = x; bl->y = y;
  for (int j = 0; j < bl->h; j++) for (int i = 0; i < bl->w; i++)
    bl->buf[j * bl->w + i] = fe->cv->get(x + fe->offX + i, y + fe->offY + j);
}
static void bl_load(drawing *dr, blitter *bl, int x, int y) {
  frontend *fe = FE(dr);
  if (x == -1) x = bl->x;
  if (y == -1) y = bl->y;
  for (int j = 0; j < bl->h; j++) for (int i = 0; i < bl->w; i++)
    fe->cv->put(x + fe->offX + i, y + fe->offY + j, bl->buf[j * bl->w + i]);
}
static void d_linewidth(drawing *, float) {}
static void d_linedotted(drawing *, bool) {}
static char *d_textfallback(drawing *, const char *const *s, int n) {
  const char *pick = nullptr;
  for (int i = 0; s && i < n; i++) {
    if (!s[i]) continue;
    bool ascii = true;
    for (const char *p = s[i]; *p; p++) if ((unsigned char)*p >= 0x80) { ascii = false; break; }
    if (ascii) { pick = s[i]; break; }
    if (!pick) pick = s[i];
  }
  return strdup(pick ? pick : "");
}

static const drawing_api api = {
  1, d_text, d_rect, d_line, d_poly, d_circle,
  d_update, d_clip, d_unclip, d_start, d_end, d_status,
  bl_new, bl_free, bl_save, bl_load,
  nullptr, nullptr, nullptr, nullptr, nullptr, nullptr,
  d_linewidth, d_linedotted, d_textfallback, d_thick
};

extern "C" void fatal(const char *fmt, ...) {
  va_list ap; va_start(ap, fmt);
  fprintf(stderr, "FATAL: "); vfprintf(stderr, fmt, ap); fprintf(stderr, "\n"); va_end(ap);
  abort();
}
extern "C" void frontend_default_colour(frontend *, float *out) { out[0] = out[1] = out[2] = 0.85f; }
extern "C" void get_random_seed(void **seed, int *sz) {
  unsigned *s = (unsigned *)malloc(2 * sizeof(unsigned));
  s[0] = 12345; s[1] = 6789;                     // fixed seed: reproducible runs
  *seed = s; *sz = 2 * (int)sizeof(unsigned);
}
extern "C" void activate_timer(frontend *fe)   { fe->timer_active = true; }
extern "C" void deactivate_timer(frontend *fe) { fe->timer_active = false; }


// Bleed tracking: a write landing outside the puzzle's own winwidth x winheight
// is a pixel NO game and NO midend clear will ever repaint (they only ever cover
// their own area), so it stays on the canvas forever.
struct BoardRect { int x0, y0, x1, y1; bool on; };
static BoardRect g_board{ 0, 0, 239, 134, false };
static int g_bleed = 0, g_bleedMinX = 999, g_bleedMinY = 999, g_bleedMaxX = -1, g_bleedMaxY = -1;
void Canvas::noteWrite(int x, int y) {
  if (!g_board.on) return;
  if (x >= g_board.x0 && x <= g_board.x1 && y >= g_board.y0 && y <= g_board.y1) return;
  g_bleed++;
  if (x < g_bleedMinX) g_bleedMinX = x;
  if (y < g_bleedMinY) g_bleedMinY = y;
  if (x > g_bleedMaxX) g_bleedMaxX = x;
  if (y > g_bleedMaxY) g_bleedMaxY = y;
}

// ---- driver ----------------------------------------------------------------
//
// Two identical midends, fed byte-identical input (get_random_seed is fixed, so
// both generate the same puzzle):
//   A = incremental, exactly like the device: one persistent canvas, redraw each
//       frame, drawstate carried across frames.
//   B = reference: canvas cleared and midend_force_redraw()d at every frame, so
//       its drawstate is always fresh. B is what the frame SHOULD look like.
// Any A != B pixel at any frame (animation frames included) is residue the
// incremental path failed to repaint.

static Canvas g_cvA, g_cvB;
static frontend g_feA, g_feB;

static unsigned rngState = 1;
static unsigned rnd(unsigned n) { rngState = rngState * 1103515245u + 12345u; return (rngState >> 16) % n; }

struct Board { int w, h; };   // puzzle size; canvas coords are +offX/+offY

static Board sizeAndCenter(midend *me, frontend &fe) {
  fe.statusbar = midend_wants_statusbar(me);
  fe.status[0] = '\0';
  int avail = fe.statusbar ? 135 - 11 : 135;
  int w = 240, h = avail;
  midend_size(me, &w, &h, true, 1.0);
  fe.offX = (240 - w) / 2; fe.offY = (avail - h) / 2;
  return Board{ w, h };
}

struct Diff { int n, minx, miny, maxx, maxy, outside; };

static Board g_bd;

static Diff compare() {
  Diff d{ 0, CW, CH, -1, -1, 0 };
  for (int y = 0; y < CH; y++) for (int x = 0; x < CW; x++) {
    if (g_cvA.px[y * CW + x] == g_cvB.px[y * CW + x]) continue;
    d.n++;
    if (x < d.minx) d.minx = x;
    if (y < d.miny) d.miny = y;
    if (x > d.maxx) d.maxx = x;
    if (y > d.maxy) d.maxy = y;
    bool in = x >= g_feA.offX && x < g_feA.offX + g_bd.w &&
              y >= g_feA.offY && y < g_feA.offY + g_bd.h;
    if (!in) d.outside++;
  }
  return d;
}

static void dumpDiff(const Diff &d) {
  printf("      bbox x=%d..%d y=%d..%d   board x=%d..%d y=%d..%d\n",
         d.minx, d.maxx, d.miny, d.maxy,
         g_feA.offX, g_feA.offX + g_bd.w - 1, g_feA.offY, g_feA.offY + g_bd.h - 1);
  int x0 = d.minx, x1 = d.maxx, y0 = d.miny, y1 = d.maxy;
  if (x1 - x0 > 76) x1 = x0 + 76;
  if (y1 - y0 > 20) y1 = y0 + 20;
  for (int y = y0; y <= y1; y++) {
    printf("      ");
    for (int x = x0; x <= x1; x++)
      putchar(g_cvA.px[y * CW + x] == g_cvB.px[y * CW + x] ? '.' : '#');
    putchar('\n');
  }
  int shown = 0;
  for (int y = d.miny; y <= d.maxy && shown < 6; y++)
    for (int x = d.minx; x <= d.maxx && shown < 6; x++)
      if (g_cvA.px[y * CW + x] != g_cvB.px[y * CW + x]) {
        printf("      stale (%d,%d) canvas=%u want=%u  [puzzle %d,%d]\n", x, y,
               g_cvA.px[y * CW + x], g_cvB.px[y * CW + x],
               x - g_feA.offX, y - g_feA.offY);
        shown++;
      }
}

// Render the reference frame for the current state of meB.
static void refFrame(midend *meB) {
  g_cvB.clearAll();
  midend_force_redraw(meB);
}

static int g_bad = 0, g_frames = 0, g_animFrames = 0, g_animBad = 0;
static const char *g_phase = "";
static int g_move = 0;
// True while the frame just drawn was one of an animation's tween frames. Those
// are graded separately: A tweens against a drawstate carried from the move that
// started the animation, B against one built this frame, so a sub-pixel step
// difference is expected and lasts one frame. Residue that survives INTO the
// settled frame is the bug worth failing on.
static bool g_frameAnimated = false;
static int g_totalAnimBad = 0;

static void checkFrame(midend *meB, const char *what) {
  refFrame(meB);
  g_frames++;
  Diff d = compare();
  if (!d.n) return;
  if (g_frameAnimated) {
    g_animBad++;
    if (g_animBad <= 1) {
      printf("   move %d %s (anim tween): %d px differ -- graded informational (#2)\n",
             g_move, what, d.n);
      dumpDiff(d);
    }
    return;
  }
  g_bad++;
  if (g_bad <= 3) {
    printf("   move %d %s (%s): %d stale px (%d outside board)\n",
           g_move, what, g_phase, d.n, d.outside);
    dumpDiff(d);
  }
}

// Mirrors main.cpp's g_fullRedraw: an input arms a full repaint, taken by the
// next frame on which nothing is animating. Keep the two in step -- the point of
// this harness is that A is the device's draw policy, not an idealised one.
static bool g_fullRedraw = false;
static bool g_dragging = false;   // main.cpp's g_dragBtn: a carry is in flight

// One step of the device loop, applied to both midends.
static void step(midend *meA, midend *meB, float dt) {
  bool wasAnimating = g_feA.timer_active;
  if (g_feA.timer_active) { midend_timer(meA, dt); g_animFrames++; }
  if (wasAnimating && !g_feA.timer_active) g_fullRedraw = true;
  bool forced = g_fullRedraw && !g_feA.timer_active && !g_dragging;
  // A frame that ended its animation is repainted in full, so it grades strictly.
  g_frameAnimated = wasAnimating && !forced;
  if (forced) { g_fullRedraw = false; midend_force_redraw(meA); }
  else if (g_feA.timer_active || g_dragging || g_fullRedraw) midend_redraw(meA);
  // else: an idle frame draws nothing at all, same as loop().
  if (g_feB.timer_active) midend_timer(meB, dt);
}

static void sendKey(midend *meA, midend *meB, int x, int y, int b) {
  midend_process_key(meA, x, y, b);
  midend_process_key(meB, x, y, b);
  if (b == LEFT_BUTTON || b == RIGHT_BUTTON) g_dragging = true;
  else if (b == LEFT_RELEASE || b == RIGHT_RELEASE) g_dragging = false;
  g_fullRedraw = true;
}

enum Mode { CLICK, KEY, DRAG, SOLVE };

static int runGame(const game *g, int moves, Mode mode) {
  static const char *modename[] = { "click", "key", "drag", "solve" };
  printf("%-12s %-5s ", g->name, modename[mode]); fflush(stdout);
  g_feA.cv = &g_cvA; g_feA.timer_active = false;
  g_feB.cv = &g_cvB; g_feB.timer_active = false;
  midend *meA = midend_new(&g_feA, g, &api, &g_feA);
  midend *meB = midend_new(&g_feB, g, &api, &g_feB);
  const char *p = presetFor(g->name);
  if (p) { midend_game_id(meA, p); midend_game_id(meB, p); }
  midend_new_game(meA); midend_new_game(meB);
  g_bd = sizeAndCenter(meA, g_feA); sizeAndCenter(meB, g_feB);
  g_cvA.clearAll();
  g_board = BoardRect{ g_feA.offX, g_feA.offY,
                       g_feA.offX + g_bd.w - 1, g_feA.offY + g_bd.h - 1, true };
  g_bleed = 0; g_bleedMinX = g_bleedMinY = 999; g_bleedMaxX = g_bleedMaxY = -1;
  g_fullRedraw = false; g_dragging = false;
  midend_force_redraw(meA);

  g_bad = 0; g_frames = 0; g_animFrames = 0; g_animBad = 0;
  g_frameAnimated = false;
  checkFrame(meB, "initial");

  for (int m = 0; m < moves; m++) {
    g_move = m;
    if (mode == CLICK) {
      int px = (int)rnd((unsigned)g_bd.w), py = (int)rnd((unsigned)g_bd.h);
      sendKey(meA, meB, px, py, LEFT_BUTTON);
      sendKey(meA, meB, px, py, LEFT_RELEASE);
    } else if (mode == SOLVE) {
      if (m > 0) break;
      midend_solve(meA); midend_solve(meB);
      g_fullRedraw = true;
    } else if (mode == KEY) {
      static const int keys[] = { CURSOR_UP, CURSOR_DOWN, CURSOR_LEFT, CURSOR_RIGHT, CURSOR_SELECT };
      sendKey(meA, meB, 0, 0, keys[rnd(5)]);
    } else {   // DRAG: press, several drag steps, release (untangle / map style)
      int px = (int)rnd((unsigned)g_bd.w), py = (int)rnd((unsigned)g_bd.h);
      int qx = (int)rnd((unsigned)g_bd.w), qy = (int)rnd((unsigned)g_bd.h);
      sendKey(meA, meB, px, py, LEFT_BUTTON);
      g_phase = "drag";
      for (int s = 1; s <= 6; s++) {
        sendKey(meA, meB, px + (qx - px) * s / 6, py + (qy - py) * s / 6, LEFT_DRAG);
        step(meA, meB, 0.016f);
        checkFrame(meB, "frame");
      }
      sendKey(meA, meB, qx, qy, LEFT_RELEASE);
    }
    // Frame-by-frame through the animation, checking every frame.
    g_phase = "anim";
    for (int i = 0; i < 400; i++) {
      bool was = g_feA.timer_active;
      step(meA, meB, 0.016f);
      checkFrame(meB, "frame");
      if (!was) break;
    }
    g_phase = "settled";
    // Idle frames. loop() runs a redraw every ~16ms whether or not anything
    // happened, and a game that repaints unconditional furniture (tents redraws
    // its whole grid lattice every frame -- ds->started is never set true) but no
    // tiles will scribble over its own output on the very next idle frame. So a
    // policy graded only at the instant of input grades a frame the player sees
    // for 16ms and never again.
    g_phase = "idle";
    for (int i = 0; i < 3; i++) { step(meA, meB, 0.016f); checkFrame(meB, "idle"); }
  }
  printf("   %s %s %s: %d frames (%d animated), %d bad, %d tween, board %dx%d at %d,%d\n",
         g->name, modename[mode], g_bad ? "SMEAR" : "clean", g_frames, g_animFrames,
         g_bad, g_animBad, g_bd.w, g_bd.h, g_feA.offX, g_feA.offY);
  g_totalAnimBad += g_animBad;
  midend_free(meA); midend_free(meB);
  return g_bad;
}

int main(int argc, char **argv) {
  putenv((char *)"PUZZLES_SHOW_CURSOR=y");   // same as the firmware
  const char *only = argc > 1 ? argv[1] : nullptr;
  int total = 0;
  for (int i = 0; i < gamecount; i++) {
    if (only && strcmp(gamelist[i]->name, only)) continue;
    rngState = 1; total += runGame(gamelist[i], 10, CLICK);
    rngState = 7; total += runGame(gamelist[i], 10, KEY);
    // A held button across frames only exists in the split-drag games: every other
    // game gets an atomic press+release inside one frame, so a mid-drag frame is
    // never rendered on the device and grading one would report an unreachable bug.
    if (puz::needsSplitDrag(gamelist[i]->htmlhelp_topic)) {
      rngState = 3; total += runGame(gamelist[i], 10, DRAG);
    }
    rngState = 5; total += runGame(gamelist[i], 1, SOLVE);
  }
  if (g_totalAnimBad)
    printf("\n%d animation tween frames differ - informational, issue #2\n", g_totalAnimBad);
  printf("\n%s\n", total ? "SMEAR DETECTED" : "no settled-frame smear detected");
  return total ? 1 : 0;
}
