#pragma once
#include <vector>
namespace puz {

// A modifier-aware keypress. ch is a printable char, or one of the control
// sentinels '\r' (enter), '\b' (del/backspace), '\t' (tab).
struct KeyPress { char ch; bool ctrl; };

// Build the per-keypress list from a raw M5Cardputer KeysState snapshot.
// Printable chars carry the live ctrl flag; enter/del/tab become sentinels.
inline std::vector<KeyPress> buildKeyPresses(const std::vector<char>& word,
                                             bool ctrl, bool enter,
                                             bool del, bool tab) {
  std::vector<KeyPress> out;
  for (char c : word) out.push_back({c, ctrl});
  if (enter) out.push_back({'\r', false});
  if (del)   out.push_back({'\b', false});
  if (tab)   out.push_back({'\t', false});
  return out;
}

// Mirror of puzzles.h button constants (verified against pinned upstream,
// upstream/puzzles.h lines 32-63).
// LEFT_BUTTON=0x0200 counting up by 1:
//   0x0200 LEFT_BUTTON  0x0201 MIDDLE_BUTTON  0x0202 RIGHT_BUTTON
//   0x0203 LEFT_DRAG    0x0204 MIDDLE_DRAG    0x0205 RIGHT_DRAG
//   0x0206 LEFT_RELEASE 0x0207 MIDDLE_RELEASE 0x0208 RIGHT_RELEASE
//   0x0209 CURSOR_UP    0x020a CURSOR_DOWN    0x020b CURSOR_LEFT
//   0x020c CURSOR_RIGHT 0x020d CURSOR_SELECT  0x020e CURSOR_SELECT2
//   0x020f UI_LOWER_BOUND 0x0210 UI_QUIT      0x0211 UI_NEWGAME
//   0x0212 UI_SOLVE     0x0213 UI_UNDO        0x0214 UI_REDO
enum {
  PZ_LEFT_BUTTON    = 0x0200,
  PZ_MIDDLE_BUTTON,
  PZ_RIGHT_BUTTON,
  PZ_LEFT_DRAG,
  PZ_MIDDLE_DRAG,
  PZ_RIGHT_DRAG,
  PZ_LEFT_RELEASE,
  PZ_MIDDLE_RELEASE,
  PZ_RIGHT_RELEASE,
  PZ_CURSOR_UP,      // 0x0209
  PZ_CURSOR_DOWN,    // 0x020a
  PZ_CURSOR_LEFT,    // 0x020b
  PZ_CURSOR_RIGHT,   // 0x020c
  PZ_CURSOR_SELECT,  // 0x020d
  PZ_CURSOR_SELECT2, // 0x020e
  PZ_UI_LOWER_BOUND, // 0x020f
  PZ_UI_QUIT,        // 0x0210
  PZ_UI_NEWGAME,     // 0x0211
  PZ_UI_SOLVE,       // 0x0212
  PZ_UI_UNDO,        // 0x0213
  PZ_UI_REDO         // 0x0214
};

enum class Ev {
  None, Up, Down, Left, Right,
  Select, Select2,
  Char,
  Undo, Redo, NewGame, Solve, Restart,
  Menu,            // legacy (` in old loop) — superseded by BackToChooser; removed in Task 7
  BackToChooser, CommandMenu,
  ClickL, ClickR, TogglePointer, RecenterPointer,
  ZoomPeek, PanUp, PanDown, PanLeft, PanRight,
  ToggleFavorite   // Ctrl+F, chooser only (ignored in a game: midendButton -> -1)
};

struct InputEvent { Ev kind; char ch; };

inline int midendButton(const InputEvent& e) {
  switch (e.kind) {
    case Ev::Up:      return PZ_CURSOR_UP;
    case Ev::Down:    return PZ_CURSOR_DOWN;
    case Ev::Left:    return PZ_CURSOR_LEFT;
    case Ev::Right:   return PZ_CURSOR_RIGHT;
    case Ev::Select:  return PZ_CURSOR_SELECT;
    case Ev::Select2: return PZ_CURSOR_SELECT2;
    case Ev::Undo:    return PZ_UI_UNDO;
    case Ev::Redo:    return PZ_UI_REDO;
    case Ev::NewGame: return PZ_UI_NEWGAME;
    case Ev::Solve:   return PZ_UI_SOLVE;
    case Ev::Char:    return static_cast<int>(static_cast<unsigned char>(e.ch));
    default:          return -1;  // None, Menu
  }
}

// --- tilt-pointer split drag ---
// The crosshair can't hold a button down, so games whose move is only emitted
// on a RELEASE at a different pixel than the press are unreachable with an
// atomic click. Those get a drag split across two presses instead; main.cpp
// drives the midend, this header owns the policy so it can be host-tested.
//
// Table is measured, not guessed: drag_probe_test.cpp fires press+release at
// every 4px point and press/drag/release at every 8px point and asks whether
// the board actually moved, with Map as its control. Re-run it when upstream
// moves. Guess is here from a read of its interpret_move instead -- it stages
// moves in the ui rather than pushing them, which the probe cannot see.
// Keyed on ->htmlhelp_topic, the unique lowercase slug, never ->name.
inline bool needsSplitDrag(const char *slug) {
  static const char *const kGames[] = { "map", "pegs", "signpost", "guess", "untangle" };
  if (!slug) return false;
  for (const char *g : kGames) {
    const char *a = slug, *b = g;
    while (*a && *a == *b) { a++; b++; }
    if (!*a && !*b) return true;
  }
  return false;
}

// What a press means while a split drag may be in flight. The key that picked
// it up is the key that drops it; the other key cancels. Without that rule
// press 2 reuses whichever button was armed, so Space means "drop here"
// everywhere -- a no-op in the games that quantise the release, but a committed
// fill in Map. Cancelling on the other key also keeps both mouse channels
// usable, which Untangle needs (RIGHT is DRAG_TOGGLE_EDGE, LEFT is
// DRAG_MOVE_POINT).
enum class DragAct { PickUp, Drop, Cancel };
inline DragAct dragAction(int armedBtn, int pressedBtn) {
  if (!armedBtn) return DragAct::PickUp;
  return pressedBtn == armedBtn ? DragAct::Drop : DragAct::Cancel;
}

} // namespace puz
