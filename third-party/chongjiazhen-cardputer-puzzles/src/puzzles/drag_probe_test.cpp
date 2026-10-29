// drag_probe_test.cpp - which games are unplayable with the tilt pointer.
//
// The pointer sends LEFT_BUTTON and LEFT_RELEASE back to back at the SAME pixel
// (main.cpp, Ev::Select). A game whose move is only emitted on a release at a
// DIFFERENT pixel than the press sees that as a no-op, so the control reads dead.
//
// This measures the property directly instead of reading interpret_move by eye:
//   atomic = press+release at the same point, over a grid of points
//   drag   = press, four drag steps, release at a different point
// A move counts only if it changed the serialised game state, so cursor/UI-only
// changes don't register. atomic == 0 with drag > 0 means the game is reachable
// by dragging and unreachable by our pointer.
//
// Map is the control: it is the one game already known to need a split drag,
// so it MUST come out broken or the probe proves nothing.
//
// Build (host only). The *_test.cpp suffix is load-bearing: build_src_filter
// excludes it from the firmware, and without that suffix this file's fatal() /
// get_random_seed stubs collide with frontend.cpp at link time.
//   gcc -std=c11 -DCOMBINED -DNO_TGMATH_H -I./upstream -I./src/puzzles -c upstream/*.c src/puzzles/gamelist.c
//   g++ -std=c++17 -DCOMBINED -DNO_TGMATH_H -I./upstream -I./src/puzzles -c src/puzzles/params_ui.cpp src/puzzles/drag_probe_test.cpp
//   g++ -std=c++17 *.o -o drag_probe_test -lm && ./drag_probe_test
#include <cstdarg>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <string>

extern "C" {
#include "puzzles.h"
}
#include "presets.h"

struct frontend { bool timer_active; };
struct blitter  { int w, h; };

// Fold every draw call into a running hash. Two redraws with the same hash put
// the same picture on the panel, which is the thing the player can actually see
// - and it is what serialisation gets wrong, since a game may RECORD a move that
// changes nothing (Untangle dropping a vertex back where it was picked up).
static unsigned long long H = 1469598103934665603ULL;
static void hx(long long v) { H ^= (unsigned long long)v; H *= 1099511628211ULL; }
static void s_text(drawing*, int x, int y, int, int sz, int al, int c, const char *t) {
  hx(1); hx(x); hx(y); hx(sz); hx(al); hx(c);
  for (const char *p = t; p && *p; p++) hx(*p);
}
static void s_rect(drawing*, int x, int y, int w, int h, int c) { hx(2); hx(x); hx(y); hx(w); hx(h); hx(c); }
static void s_line(drawing*, int a, int b, int c, int d, int e) { hx(3); hx(a); hx(b); hx(c); hx(d); hx(e); }
static void s_poly(drawing*, const int *co, int n, int f, int o) {
  hx(4); hx(n); hx(f); hx(o);
  for (int i = 0; i < n * 2; i++) hx(co[i]);
}
static void s_circle(drawing*, int x, int y, int r, int f, int o) { hx(5); hx(x); hx(y); hx(r); hx(f); hx(o); }
static void s_update(drawing*, int, int, int, int) {}
static void s_clip(drawing*, int, int, int, int) {}
static void s_unclip(drawing*) {}
static void s_start(drawing*) {}
static void s_end(drawing*) {}
static void s_status(drawing*, const char*) {}
static blitter* s_bl_new(drawing*, int w, int h) {
  blitter *bl = (blitter*)malloc(sizeof(blitter)); bl->w = w; bl->h = h; return bl;
}
static void s_bl_free(drawing*, blitter *bl) { free(bl); }
static void s_bl_save(drawing*, blitter*, int, int) {}
static void s_bl_load(drawing*, blitter*, int, int) {}
static void s_linewidth(drawing*, float) {}
static void s_linedotted(drawing*, bool) {}
static char* s_textfallback(drawing*, const char *const *s, int n) {
  return strdup(s && n > 0 && s[0] ? s[0] : "");
}
static void s_thick(drawing*, float, float a, float b, float c, float d, int e) {
  hx(6); hx((long long)a); hx((long long)b); hx((long long)c); hx((long long)d); hx(e);
}

static const drawing_api api = {
  1, s_text, s_rect, s_line, s_poly, s_circle,
  s_update, s_clip, s_unclip, s_start, s_end, s_status,
  s_bl_new, s_bl_free, s_bl_save, s_bl_load,
  nullptr, nullptr, nullptr, nullptr, nullptr, nullptr,
  s_linewidth, s_linedotted, s_textfallback, s_thick
};

extern "C" void fatal(const char *fmt, ...) {
  va_list ap; va_start(ap, fmt);
  fprintf(stderr, "FATAL: "); vfprintf(stderr, fmt, ap); fprintf(stderr, "\n"); va_end(ap);
  abort();
}
extern "C" void frontend_default_colour(frontend*, float *o) { o[0] = o[1] = o[2] = 0.85f; }
extern "C" void get_random_seed(void **seed, int *sz) {
  unsigned *s = (unsigned*)malloc(2 * sizeof(unsigned));
  s[0] = 12345; s[1] = 6789;
  *seed = s; *sz = 2 * (int)sizeof(unsigned);
}
extern "C" void activate_timer(frontend *fe)   { fe->timer_active = true; }
extern "C" void deactivate_timer(frontend *fe) { fe->timer_active = false; }

static void serw(void *ctx, const void *buf, int len) {
  ((std::string*)ctx)->append((const char*)buf, (size_t)len);
}
static std::string snapshot(midend *me) {
  std::string s; midend_serialise(me, serw, &s); return s;
}
// What the panel would show. force_redraw so an incremental skip cannot hide a
// difference: the drawstate is rebuilt, then the whole picture is re-emitted.
// Settle any animation FIRST. A force_redraw taken the instant a move lands
// renders the animation's opening frame, which still shows the OLD board - so an
// unsettled hash makes every animated game look like nothing happened.
static frontend *g_fe = nullptr;
static unsigned long long picture(midend *me) {
  for (int i = 0; i < 200 && g_fe && g_fe->timer_active; i++) midend_timer(me, 0.05f);
  H = 1469598103934665603ULL;
  midend_force_redraw(me);
  return H;
}

// Did the interaction actually MOVE THE BOARD?
//
// Neither obvious metric survives alone. Serialisation counts a move that was
// merely RECORDED, and Untangle records dropping a vertex back where it was
// picked up. The rendered picture counts a SELECTION HIGHLIGHT, which is why a
// picture-only metric cleared Map, the one game already known to be broken.
//
// So: a move had to be recorded (else nothing happened at all), and undoing that
// move has to change the picture (else the move was a null one). Undo is only
// safe to call once we know this interaction pushed a move, otherwise it pops
// someone else's; redo puts it back either way.
static bool boardMoved(midend *me, const std::string &before) {
  if (snapshot(me) == before) return false;      // no move recorded
  unsigned long long after = picture(me);
  midend_process_key(me, 0, 0, UI_UNDO);
  bool moved = picture(me) != after;
  midend_process_key(me, 0, 0, UI_REDO);
  return moved;
}

// Fresh midend each probe: a move must not be able to enable or disable a later one.
static midend *fresh(const game *g, frontend *fe, int *w, int *h) {
  midend *me = midend_new(fe, g, &api, fe);
  const char *p = presetFor(g->name);
  if (p) midend_game_id(me, p);
  midend_new_game(me);
  *w = 240; *h = midend_wants_statusbar(me) ? 124 : 135;
  midend_size(me, w, h, true, 1.0);
  return me;
}

int main(int argc, char **argv) {
  putenv((char*)"PUZZLES_SHOW_CURSOR=y");
  const char *only = argc > 1 ? argv[1] : nullptr;
  printf("%-13s %7s %7s %7s %7s  %s\n",
         "game", "atomic", "drag", "atomPx", "dragPx", "verdict");

  for (int i = 0; i < gamecount; i++) {
    const game *g = gamelist[i];
    if (only && strcmp(g->name, only)) continue;
    frontend fe{};
    g_fe = &fe;
    int w, h;

    int atomic = 0, drag = 0;        // move RECORDED (serialisation changed)
    int atomicPix = 0, dragPix = 0;  // picture CHANGED (includes mere highlights)
    int atomicReal = 0, dragReal = 0;// board actually MOVED (the real criterion)

    // atomic: press + release at the same pixel, every 4px across the board
    {
      midend *me = fresh(g, &fe, &w, &h);
      for (int y = 0; y < h; y += 4) for (int x = 0; x < w; x += 4) {
        std::string before = snapshot(me);
        unsigned long long pb = picture(me);
        midend_process_key(me, x, y, LEFT_BUTTON);
        midend_process_key(me, x, y, LEFT_RELEASE);
        if (snapshot(me) != before) atomic++;
        if (picture(me) != pb) atomicPix++;
        if (boardMoved(me, before)) atomicReal++;
      }
      midend_free(me);
    }

    // drag: press, four interpolated drag steps, release somewhere else
    {
      midend *me = fresh(g, &fe, &w, &h);
      for (int y = 0; y < h; y += 8) for (int x = 0; x < w; x += 8) {
        for (int d = 0; d < 2; d++) {
          int tx = d ? x : (x + 24 < w ? x + 24 : x - 24);
          int ty = d ? (y + 24 < h ? y + 24 : y - 24) : y;
          if (tx < 0 || ty < 0) continue;
          std::string before = snapshot(me);
          unsigned long long pb = picture(me);
          midend_process_key(me, x, y, LEFT_BUTTON);
          for (int s = 1; s <= 4; s++)
            midend_process_key(me, x + (tx - x) * s / 4, y + (ty - y) * s / 4, LEFT_DRAG);
          midend_process_key(me, tx, ty, LEFT_RELEASE);
          if (snapshot(me) != before) drag++;
          if (picture(me) != pb) dragPix++;
          if (boardMoved(me, before)) dragReal++;
        }
      }
      midend_free(me);
    }

    const char *verdict =
        atomicReal ? "ok"
      : dragReal   ? (atomic ? "BROKEN drag-only: atomic click records a null move"
                             : "BROKEN drag-only: atomic click does nothing at all")
                   : "no mouse moves found by this probe";
    printf("%-13s %7d %7d %7d %7d  %s\n", g->name,
           atomicReal, dragReal, atomicPix, dragPix, verdict);
  }
  return 0;
}
