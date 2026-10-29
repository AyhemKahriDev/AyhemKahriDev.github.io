// logic_test.cpp — host tests for pure frontend logic (no midend, no Arduino).
// Build: g++ -std=c++17 -I./src/puzzles src/puzzles/logic_test.cpp -o logic_test && ./logic_test
#include <cassert>
#include <cstdio>
#include <vector>
#include "input.h"
#include "keymap.h"
#include "picker.h"
#include "power.h"
#include "favorites.h"
#include "settings.h"
#include "gamesize.h"

static int fails = 0;
#define CHECK(c) do { if(!(c)){ printf("FAIL %s:%d  %s\n",__FILE__,__LINE__,#c); fails++; } } while(0)

static void test_buildKeyPresses() {
    using namespace puz;
    auto a = buildKeyPresses({'z'}, true, false, false, false);
    CHECK(a.size()==1 && a[0].ch=='z' && a[0].ctrl==true);

    auto b = buildKeyPresses({'a','b'}, false, false, false, false);
    CHECK(b.size()==2 && b[0].ch=='a' && !b[0].ctrl && b[1].ch=='b');

    auto e = buildKeyPresses({}, false, true, false, false);
    CHECK(e.size()==1 && e[0].ch=='\r' && !e[0].ctrl);

    auto d = buildKeyPresses({}, false, false, true, false);
    CHECK(d.size()==1 && d[0].ch=='\b');

    auto t = buildKeyPresses({}, false, false, false, true);
    CHECK(t.size()==1 && t[0].ch=='\t');
}

static void test_eventForKey() {
    using namespace puz;
    CHECK(eventForKey({';',false}).kind == Ev::Up);
    CHECK(eventForKey({'/',false}).kind == Ev::Right);
    CHECK(eventForKey({'\r',false}).kind == Ev::Select);
    CHECK(eventForKey({' ',false}).kind == Ev::Select2);
    CHECK(eventForKey({'[',false}).kind == Ev::Char);   // brackets now fall through to the game
    CHECK(eventForKey({']',false}).kind == Ev::Char);
    CHECK(eventForKey({'\t',false}).kind == Ev::CommandMenu);
    CHECK(eventForKey({'`',false}).kind == Ev::BackToChooser);
    CHECK(eventForKey({'z',true}).kind == Ev::Undo);
    CHECK(eventForKey({'y',true}).kind == Ev::Redo);
    CHECK(eventForKey({'n',true}).kind == Ev::NewGame);
    CHECK(eventForKey({'r',true}).kind == Ev::Restart);
    CHECK(eventForKey({'p',true}).kind == Ev::TogglePointer);   // Ctrl+P toggles the tilt pointer
    CHECK(eventForKey({'p',false}).kind == Ev::Char);           // plain 'p' still belongs to the game
    CHECK(eventForKey({'f',true}).kind == Ev::ToggleFavorite);  // Ctrl+F stars a game on the list
    CHECK(eventForKey({'f',false}).kind == Ev::Char);           // plain 'f' still belongs to the game
    // plain letters/digits go to the game as Char (nothing stolen)
    InputEvent g = eventForKey({'l',false});
    CHECK(g.kind == Ev::Char && g.ch == 'l');
    CHECK(eventForKey({'5',false}).kind == Ev::Char);
    CHECK(eventForKey({'a',false}).kind == Ev::Char);
}

static void test_pickerWindow() {
    using namespace puz;
    PickerWindow a = pickerWindow(40, 0, 7);   // wrap at top
    CHECK(a.count==7 && a.selSlot==3 && a.idx[0]==37 && a.idx[3]==0 && a.idx[6]==3);

    PickerWindow b = pickerWindow(40, 39, 7);  // wrap at bottom
    CHECK(b.count==7 && b.selSlot==3 && b.idx[3]==39 && b.idx[4]==0);

    PickerWindow c = pickerWindow(3, 1, 7);    // fewer than rows: show all, no wrap
    CHECK(c.count==3 && c.selSlot==1 && c.idx[0]==0 && c.idx[2]==2);

    PickerWindow d = pickerWindow(40, 20, 7);  // middle
    CHECK(d.count==7 && d.idx[0]==17 && d.idx[3]==20 && d.idx[6]==23);
}

static void test_idleBrightness() {
    using namespace puz;
    const uint32_t DIM = 30000, OFF = 90000; const uint8_t AWAKE = 200, LOW = 20;
    CHECK(idleBrightness(0,        AWAKE, DIM, OFF, LOW) == AWAKE);   // active
    CHECK(idleBrightness(DIM - 1,  AWAKE, DIM, OFF, LOW) == AWAKE);   // just before dim
    CHECK(idleBrightness(DIM,      AWAKE, DIM, OFF, LOW) == LOW);     // dim boundary
    CHECK(idleBrightness(OFF - 1,  AWAKE, DIM, OFF, LOW) == LOW);     // just before off
    CHECK(idleBrightness(OFF,      AWAKE, DIM, OFF, LOW) == 0);       // off boundary
}

static void test_favorites() {
    using namespace puz;
    const int N = 6;
    bool fav[N] = {false, false, true, false, true, false};
    int order[N];

    favOrder(fav, N, order);
    // Starred first, then the rest -- both groups in their original order.
    CHECK(order[0]==2 && order[1]==4);
    CHECK(order[2]==0 && order[3]==1 && order[4]==3 && order[5]==5);
    CHECK(favSlot(order, N, 4)==1 && favSlot(order, N, 5)==5);

    bool none[N] = {false,false,false,false,false,false};
    favOrder(none, N, order);                       // nothing starred: identity order
    for (int i = 0; i < N; i++) CHECK(order[i]==i);
    CHECK(favSlot(order, N, 3)==3);

    bool all[N] = {true,true,true,true,true,true};
    favOrder(all, N, order);                        // all starred: also identity
    for (int i = 0; i < N; i++) CHECK(order[i]==i);

    // An index outside the order lands on a valid row rather than out of bounds.
    CHECK(favSlot(order, N, 99)==0);

    // File format: one slug per line, tolerant of CRLF / blanks / no trailing \n.
    auto s = favSlugs("solo\nnet\n");
    CHECK(s.size()==2 && s[0]=="solo" && s[1]=="net");
    auto s2 = favSlugs("solo\r\n\r\nnet");
    CHECK(s2.size()==2 && s2[0]=="solo" && s2[1]=="net");
    CHECK(favSlugs("").empty());
    CHECK(favSlugs("\n\n").empty());
}

static void test_splitDragPolicy() {
    using namespace puz;
    // Table (measured by drag_probe_test.cpp; Guess from reading interpret_move).
    CHECK(needsSplitDrag("map"));
    CHECK(needsSplitDrag("pegs"));
    CHECK(needsSplitDrag("signpost"));
    CHECK(needsSplitDrag("guess"));
    CHECK(needsSplitDrag("untangle"));
    // Games where a plain click already moves the board keep the atomic click.
    CHECK(!needsSplitDrag("solo"));
    CHECK(!needsSplitDrag("keen"));
    CHECK(!needsSplitDrag("net"));
    CHECK(!needsSplitDrag("bridges"));
    CHECK(!needsSplitDrag("pearl"));
    CHECK(!needsSplitDrag("rect"));
    CHECK(!needsSplitDrag("tracks"));
    // Slug keys are exact: no prefix or substring match.
    CHECK(!needsSplitDrag("peg"));
    CHECK(!needsSplitDrag("pegsx"));
    CHECK(!needsSplitDrag(""));
    CHECK(!needsSplitDrag(nullptr));

    // The key that picks up is the key that drops; the other key cancels.
    CHECK(dragAction(0, PZ_LEFT_BUTTON)  == DragAct::PickUp);
    CHECK(dragAction(0, PZ_RIGHT_BUTTON) == DragAct::PickUp);
    CHECK(dragAction(PZ_LEFT_BUTTON,  PZ_LEFT_BUTTON)  == DragAct::Drop);
    CHECK(dragAction(PZ_RIGHT_BUTTON, PZ_RIGHT_BUTTON) == DragAct::Drop);
    CHECK(dragAction(PZ_LEFT_BUTTON,  PZ_RIGHT_BUTTON) == DragAct::Cancel);
    CHECK(dragAction(PZ_RIGHT_BUTTON, PZ_LEFT_BUTTON)  == DragAct::Cancel);
}

static void test_settings() {
    using namespace puz;
    // Ladder: clamps at both ends, never wraps.
    CHECK(brightStep(0, -1) == 0);
    CHECK(brightStep(kBrightN - 1, 1) == kBrightN - 1);
    CHECK(brightStep(0, 1) == 1);
    CHECK(kBright[0] == 16);                       // legibility floor; 0 is not on the ladder
    CHECK(kBright[kBrightN - 1] == 255);           // full brightness still reachable
    CHECK(kBright[kBrightDefault] == 128);         // the pre-settings hardcoded level

    // Nearest-rung snap, so a level from another ladder still lands sensibly.
    CHECK(brightIndex(128) == kBrightDefault);
    CHECK(brightIndex(0) == 0);
    CHECK(brightIndex(255) == kBrightN - 1);
    CHECK(kBright[brightIndex(100)] == 96);

    // Round-trip.
    Settings a{ 64, true };
    Settings b = parseSettings(serializeSettings(a));
    CHECK(b.brightness == 64 && b.pointer == true);

    // Defaults for an absent/unknown/empty file.
    CHECK(parseSettings("").brightness == kBright[kBrightDefault]);
    CHECK(parseSettings("").pointer == false);
    CHECK(parseSettings("wat=3\n").brightness == kBright[kBrightDefault]);

    // Tolerant: CRLF, blank lines, no trailing newline, partial file.
    Settings c = parseSettings("\r\nbright=32\r\n\r\npointer=1");
    CHECK(c.brightness == 32 && c.pointer == true);
    CHECK(parseSettings("pointer=1\n").brightness == kBright[kBrightDefault]);

    // A stored 0 would persist a black screen with no way to see the control
    // that fixes it -- clamped up to the floor instead.
    CHECK(parseSettings("bright=0\n").brightness == kBright[0]);
    CHECK(parseSettings("bright=999\n").brightness == 255);
}

static void test_gamesize() {
    using namespace puz;

    // Round-trip, and a stored size is found by slug.
    std::vector<GameSize> v;
    CHECK(setSize(v, "solo", "3x3dt"));
    CHECK(setSize(v, "mines", "8x8n10"));
    CHECK(std::string(sizeFor(v, "solo")) == "3x3dt");
    CHECK(sizeFor(v, "net") == nullptr);          // never resized -> caller keeps presets.h

    // Re-applying the same size is not a write; a different one replaces in place.
    CHECK(!setSize(v, "solo", "3x3dt"));
    CHECK(setSize(v, "solo", "4x4de"));
    CHECK(v.size() == 2 && std::string(sizeFor(v, "solo")) == "4x4de");

    auto r = parseSizes(serializeSizes(v));
    CHECK(r.size() == 2 && std::string(sizeFor(r, "mines")) == "8x8n10");

    // A full game id must never be stored: replaying one would pin every fresh
    // generate to the same board forever.
    CHECK(!validSizeParams("8x8n10#123456"));
    CHECK(!validSizeParams("3x3:aBcD"));
    CHECK(!setSize(v, "mines", "8x8n10#12345"));
    CHECK(std::string(sizeFor(v, "mines")) == "8x8n10");
    CHECK(parseSizes("mines=8x8n10#12345\n").empty());

    // Tolerant: CRLF, blank lines, no trailing newline, junk rows skipped
    // rather than costing every other game its size. Last row wins on a dup.
    auto t = parseSizes("\r\nsolo=3x3dt\r\n\r\ngarbage\n=nokey\nmines=\nnet=5x5\nsolo=4x4de");
    CHECK(t.size() == 2);
    CHECK(std::string(sizeFor(t, "solo")) == "4x4de");
    CHECK(std::string(sizeFor(t, "net")) == "5x5");
    CHECK(sizeFor(t, "mines") == nullptr);        // empty params is not a size
    CHECK(parseSizes("").empty());
}

int main() {
    test_splitDragPolicy();
    test_buildKeyPresses();
    test_eventForKey();
    test_pickerWindow();
    test_idleBrightness();
    test_favorites();
    test_settings();
    test_gamesize();
    printf(fails ? "\n%d FAIL\n" : "\nlogic_test ok\n", fails);
    return fails ? 1 : 0;
}
