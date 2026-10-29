// startgame_test.cpp — mirrors startGame() on device; catches crash/OOM per game.
//
// Build from repo root (two-step: C files via gcc, C++ via g++):
//   gcc -std=c11 -DCOMBINED -DNO_TGMATH_H -I./upstream -I./src/puzzles -c \
//       upstream/combi.c upstream/divvy.c upstream/draw-poly.c \
//       upstream/drawing.c upstream/dsf.c upstream/findloop.c \
//       upstream/grid.c upstream/hat.c upstream/latin.c upstream/laydomino.c \
//       upstream/loopgen.c upstream/malloc.c upstream/matching.c \
//       upstream/midend.c upstream/misc.c upstream/penrose.c \
//       upstream/penrose-legacy.c upstream/printing.c upstream/ps.c \
//       upstream/random.c upstream/sort.c upstream/spectre.c \
//       upstream/tdq.c upstream/tree234.c upstream/version.c \
//       upstream/net.c upstream/mines.c upstream/solo.c upstream/lightup.c \
//       upstream/filling.c upstream/bridges.c upstream/unequal.c upstream/tents.c \
//       upstream/blackbox.c upstream/cube.c upstream/dominosa.c \
//       upstream/fifteen.c upstream/flip.c upstream/flood.c \
//       upstream/galaxies.c upstream/guess.c \
//       upstream/inertia.c upstream/keen.c upstream/loopy.c \
//       upstream/magnets.c upstream/map.c upstream/mosaic.c \
//       upstream/netslide.c upstream/palisade.c upstream/pattern.c \
//       upstream/pearl.c upstream/pegs.c upstream/range.c \
//       upstream/rect.c upstream/samegame.c upstream/signpost.c \
//       upstream/singles.c upstream/sixteen.c upstream/slant.c \
//       upstream/towers.c upstream/tracks.c \
//       upstream/twiddle.c upstream/undead.c upstream/unruly.c \
//       upstream/untangle.c \
//       src/puzzles/gamelist.c
//   g++ -std=c++17 -DCOMBINED -DNO_TGMATH_H -I./upstream -I./src/puzzles \
//       -c src/puzzles/startgame_test.cpp -o startgame_test.o
//   g++ -std=c++17 startgame_test.o *.o -o startgame_test -lm && ./startgame_test

#include <cassert>
#include <cstdarg>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <ctime>
#include <string>

extern "C" {
#include "puzzles.h"
}
#include "presets.h"     // presetFor() — same table the firmware applies in startGame
#include "params_ui.h"   // flattenPresets/applyPreset + config helpers (host-tested here)

// gamelist[] / gamecount come from src/puzzles/gamelist.c (linked separately).
// puzzles.h under -DCOMBINED already extern-declares them; no re-declaration needed.

// ---- stub types ----

struct frontend { bool timer_active; };
struct blitter  { int w, h; };          // no pixel buffer — drawing is a no-op

// ---- stub drawing_api (all no-ops) ----

static void s_text(drawing*, int, int, int, int, int, int, const char*) {}
static void s_rect(drawing*, int, int, int, int, int) {}
static void s_line(drawing*, int, int, int, int, int) {}
static void s_poly(drawing*, const int*, int, int, int) {}
static void s_circle(drawing*, int, int, int, int, int) {}
static void s_update(drawing*, int, int, int, int) {}
static void s_clip(drawing*, int, int, int, int) {}
static void s_unclip(drawing*) {}
static void s_start(drawing*) {}
static void s_end(drawing*) {}
static void s_status(drawing*, const char*) {}
static blitter* s_bl_new(drawing*, int w, int h) {
    blitter *bl = (blitter*)malloc(sizeof(blitter));
    bl->w = w; bl->h = h;
    return bl;
}
static void s_bl_free(drawing*, blitter *bl) { free(bl); }
static void s_bl_save(drawing*, blitter*, int, int) {}
static void s_bl_load(drawing*, blitter*, int, int) {}
static void s_linewidth(drawing*, float) {}
static void s_linedotted(drawing*, bool) {}
static char* s_textfallback(drawing*, const char *const *s, int n) {
    return strdup(s && n > 0 && s[0] ? s[0] : "");
}
static void s_thick(drawing*, float, float, float, float, float, int) {}

// Field order matches drawing_api in upstream/puzzles.h (26 members):
// version, draw_text, draw_rect, draw_line, draw_polygon, draw_circle,
// draw_update, clip, unclip, start_draw, end_draw, status_bar,
// blitter_new, blitter_free, blitter_save, blitter_load,
// begin_doc, begin_page, begin_puzzle, end_puzzle, end_page, end_doc,
// line_width, line_dotted, text_fallback, draw_thick_line
static const drawing_api stub_api = {
    1,
    s_text, s_rect, s_line, s_poly, s_circle,
    s_update, s_clip, s_unclip, s_start, s_end, s_status,
    s_bl_new, s_bl_free, s_bl_save, s_bl_load,
    nullptr, nullptr, nullptr, nullptr, nullptr, nullptr,
    s_linewidth, s_linedotted, s_textfallback, s_thick
};

// ---- required C callbacks (called by midend / puzzle backends) ----

extern "C" void fatal(const char *fmt, ...) {
    va_list ap; va_start(ap, fmt);
    fprintf(stderr, "FATAL: "); vfprintf(stderr, fmt, ap); fprintf(stderr, "\n");
    va_end(ap);
    abort();
}
extern "C" void frontend_default_colour(frontend*, float *out) {
    out[0] = out[1] = out[2] = 0.85f;
}
extern "C" void get_random_seed(void **seed, int *sz) {
    time_t *s = (time_t*)malloc(sizeof(time_t));  // midend_new calls sfree() on this
    *s = time(nullptr);
    *seed = s; *sz = (int)sizeof(time_t);
}
extern "C" void activate_timer(frontend *fe)   { fe->timer_active = true; }
extern "C" void deactivate_timer(frontend *fe) { fe->timer_active = false; }

// ---- test ----

int main() {
    int pass = 0, fail = 0;

    for (int i = 0; i < gamecount; i++) {
        printf("%-16s ", gamelist[i]->name);
        fflush(stdout);

        frontend fe{};
        midend *me = midend_new(&fe, gamelist[i], &stub_api, &fe);
        if (!me) {
            printf("FAIL (midend_new returned null)\n");
            fail++;
            continue;
        }

        // Apply the same screen-fit preset the firmware uses, and prove it
        // parses. midend_new_game() below then proves it actually generates
        // (a bad size would loop forever or assert — caught here, not on device).
        const char *preset = presetFor(gamelist[i]->name);
        if (preset) {
            const char *err = midend_game_id(me, preset);
            if (err) {
                printf("FAIL (game_id \"%s\": %s)\n", preset, err);
                fail++;
                midend_free(me);
                continue;
            }
        }

        midend_new_game(me);

        int w = 240, h = 135;
        midend_size(me, &w, &h, true, 1.0f);

        int ncolours = 0;
        float *fl = midend_colours(me, &ncolours);
        free(fl);

        midend_force_redraw(me);
        midend_free(me);

        if (preset) printf("ok  (size %dx%d, %d colours, preset=%s)\n", w, h, ncolours, preset);
        else        printf("ok  (size %dx%d, %d colours)\n", w, h, ncolours);
        pass++;
    }

    // ---- re-entry stress ----
    // The "re-enter Mines and nothing works" bug only shows on the 2nd+ entry.
    // Mirror startGame's free->new->game_id->new_game cycle repeatedly, with
    // simulated play (incl. a losing click) between, to catch leaks / heap
    // corruption (crash) or a fatal()-style hang (caught by the run timeout).
    printf("\n-- re-entry stress --\n");
    for (int g = 0; g < gamecount; g++) {
        const char *name = gamelist[g]->name;
        // Focus on the games most likely to leave stale state: Mines + a few
        // that generate on first input or use blitters.
        if (strcmp(name,"Mines") && strcmp(name,"Solo") && strcmp(name,"Net") &&
            strcmp(name,"Untangle") && strcmp(name,"Flood"))
            continue;

        frontend fe{};
        midend *me = nullptr;
        for (int cyc = 0; cyc < 25; cyc++) {
            if (me) midend_free(me);                 // startGame: free previous entry
            me = midend_new(&fe, gamelist[g], &stub_api, &fe);
            const char *preset = presetFor(name);
            if (preset) {
                const char *err = midend_game_id(me, preset);
                if (err) { printf("%-12s cyc %d game_id FAIL: %s\n", name, cyc, err); fail++; break; }
            }
            midend_new_game(me);
            int w = 240, h = 135;
            midend_size(me, &w, &h, true, 1.0f);
            // simulate play: move cursor + select twice (Mines lays mines on the
            // first select and can put the game into a lost state)
            midend_process_key(me, 0, 0, CURSOR_SELECT);
            midend_process_key(me, 0, 0, CURSOR_DOWN);
            midend_process_key(me, 0, 0, CURSOR_RIGHT);
            midend_process_key(me, 0, 0, CURSOR_SELECT);
            midend_process_key(me, 0, 0, CURSOR_SELECT2);  // flag/right-click
            midend_force_redraw(me);
        }
        if (me) midend_free(me);
        printf("%-12s ok (25 re-entry cycles)\n", name);
    }

    // ---- preset flatten + apply ----
    printf("\n-- presets --\n");
    for (int g = 0; g < gamecount; g++) {
        frontend fe{};
        midend *me = midend_new(&fe, gamelist[g], &stub_api, &fe);
        puz::PresetEntry pe[64];
        int np = puz::flattenPresets(me, pe, 64);
        if (np < 2) { printf("%-12s FAIL (<2 entries incl Custom)\n", gamelist[g]->name); fail++; midend_free(me); continue; }
        if (pe[np-1].id != -1) { printf("%-12s FAIL (last not Custom)\n", gamelist[g]->name); fail++; midend_free(me); continue; }
        bool ok = true;
        for (int k = 0; k < np - 1; k++)               // every real preset applies + generates
            if (!puz::applyPreset(me, pe[k].id)) { ok = false; break; }
        if (!ok) { printf("%-12s FAIL (applyPreset)\n", gamelist[g]->name); fail++; midend_free(me); continue; }
        printf("%-12s ok (%d presets + Custom)\n", gamelist[g]->name, np - 1);
        midend_free(me);
    }

    // ---- config round-trip ----
    printf("\n-- config --\n");
    for (int g = 0; g < gamecount; g++) {
        frontend fe{};
        midend *me = midend_new(&fe, gamelist[g], &stub_api, &fe);
        midend_new_game(me);
        char *title = nullptr;
        config_item *cfg = puz::configBegin(me, &title);
        if (!cfg) { printf("%-12s FAIL (no config)\n", gamelist[g]->name); fail++; midend_free(me); continue; }
        const char *err = puz::configApply(me, cfg);   // unchanged -> must validate
        if (err) { printf("%-12s FAIL (apply: %s)\n", gamelist[g]->name, err); fail++; puz::configFree(cfg); midend_free(me); continue; }
        midend_new_game(me);
        puz::configFree(cfg);
        printf("%-12s ok\n", gamelist[g]->name);
        midend_free(me);
    }

    // ---- Loopy keyboard cursor (patches/loopy-keyboard-cursor.patch) ----
    // Loopy is mouse-only upstream, which makes it unplayable on a board with
    // no pointing device. The patch adds an edge cursor; these cases pin the
    // behaviour that matters, through the public midend API only.
    printf("\n-- loopy keyboard cursor --\n");
    {
        const game *loopy = nullptr;
        for (int g = 0; g < gamecount; g++)
            if (!strcmp(gamelist[g]->name, "Loopy")) { loopy = gamelist[g]; break; }

        if (!loopy) { printf("FAIL (Loopy not in gamelist)\n"); fail++; }
        else {
            // Play a key sequence on a board fixed by game id, and return the
            // serialised result, so two sequences can be compared exactly.
            struct Cap {
                std::string s;
                static void put(void *ctx, const void *buf, int len) {
                    ((Cap*)ctx)->s.append((const char*)buf, len);
                }
            };
            auto play = [&](const char *id, const int *keys, int nkeys,
                            bool *can_undo_out) {
                frontend fe{};
                midend *me = midend_new(&fe, loopy, &stub_api, &fe);
                const char *err = midend_game_id(me, id);
                if (err) { printf("FAIL (game_id: %s)\n", err); fail++; }
                midend_new_game(me);
                int w = 240, h = 135;
                midend_size(me, &w, &h, true, 1.0f);
                for (int k = 0; k < nkeys; k++)
                    midend_process_key(me, 0, 0, keys[k]);
                if (can_undo_out) *can_undo_out = midend_can_undo(me);
                Cap cap;
                midend_serialise(me, Cap::put, &cap);
                midend_free(me);
                return cap.s;
            };

            frontend fe0{};
            midend *me0 = midend_new(&fe0, loopy, &stub_api, &fe0);
            midend_new_game(me0);
            char *idbuf = midend_get_game_id(me0);
            std::string id = idbuf ? idbuf : "";
            sfree(idbuf);
            midend_free(me0);

            // 1. The first cursor key only reveals the cursor, and a move alone
            //    is a UI update, not an undoable game move.
            const int k_reveal[]      = { CURSOR_UP };
            const int k_reveal_move[] = { CURSOR_UP, CURSOR_RIGHT, CURSOR_DOWN };
            bool undo_reveal = true, undo_move = true;
            std::string s_reveal = play(id.c_str(), k_reveal, 1, &undo_reveal);
            std::string s_move   = play(id.c_str(), k_reveal_move, 3, &undo_move);
            if (undo_reveal || undo_move) {
                printf("FAIL (cursor movement registered as a game move)\n"); fail++;
            } else printf("move-is-not-a-move  ok\n");

            // 2. Select on the cursor edge IS a game move.
            const int k_sel[] = { CURSOR_UP, CURSOR_SELECT };
            bool undo_sel = false;
            std::string s_sel = play(id.c_str(), k_sel, 2, &undo_sel);
            if (!undo_sel) { printf("FAIL (select did not make a move)\n"); fail++; }
            else printf("select-toggles-edge ok\n");

            // 3. Moving first lands on a DIFFERENT edge: same board, same
            //    select, different result. This is the case a cursor that
            //    silently refuses to move would still pass every check above.
            const int k_movesel[] = { CURSOR_UP, CURSOR_RIGHT, CURSOR_SELECT };
            std::string s_movesel = play(id.c_str(), k_movesel, 3, nullptr);
            if (s_movesel == s_sel) {
                printf("FAIL (cursor did not move: same edge toggled)\n"); fail++;
            } else printf("arrows-move-cursor  ok\n");

            // 4. select2 marks LINE_NO where select marks LINE_YES.
            const int k_sel2[] = { CURSOR_UP, CURSOR_SELECT2 };
            std::string s_sel2 = play(id.c_str(), k_sel2, 2, nullptr);
            if (s_sel2 == s_sel) {
                printf("FAIL (select2 same as select)\n"); fail++;
            } else printf("select2-marks-no    ok\n");

            // 5. Walking the cursor far in every direction must not wander off
            //    the grid or crash (aperiodic grids have irregular degree).
            int walk[64]; int n = 0;
            const int dirs[] = { CURSOR_UP, CURSOR_RIGHT, CURSOR_DOWN, CURSOR_LEFT };
            for (int d = 0; d < 4; d++)
                for (int r = 0; r < 15; r++) walk[n++] = dirs[d];
            walk[n++] = CURSOR_SELECT;
            std::string s_walk = play(id.c_str(), walk, n, nullptr);
            printf("long-walk           ok\n");
        }
    }

    printf("\n%d/%d passed\n", pass, gamecount);
    return fail ? 1 : 0;
}
