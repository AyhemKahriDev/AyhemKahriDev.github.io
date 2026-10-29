#pragma once
#include <cstdint>   // uint8_t in SettingsCtx; not guaranteed by puzzles.h on the host
extern "C" {
#include "puzzles.h"
}
#undef min   // puzzles.h defines min/max macros that clobber STL <vector>/<algorithm>
#undef max
#include "input.h"   // puz::InputEvent/KeyPress (pulls <vector>)

namespace puz {

struct PresetEntry { const char* title; int id; };   // id == -1 => "Custom..."

// Flatten the midend preset tree (depth-first leaves) + append "Custom...".
// Returns number of entries written (<= maxOut).
int flattenPresets(midend* me, PresetEntry* out, int maxOut);

// Apply a real preset by id (set_params + new_game). id<0 (Custom) returns false.
bool applyPreset(midend* me, int id);

// --- Custom config editor (CFG_SETTINGS) ---
config_item* configBegin(midend* me, char** title);      // = midend_get_config(CFG_SETTINGS)
const char*  configApply(midend* me, config_item* cfg);  // = midend_set_config; NULL ok, else err
void         configFree(config_item* cfg);               // = free_cfg
void         configStringEdit(config_item* ci, char c, bool backspace);  // grow/shrink C_STRING sval

// --- UI screens (defined in ui_screens.cpp, device-only) ---
// Frontend binds the active midend + callbacks before entering these states.
struct UiCtx {
  midend* me;
  void (*reloadResume)();   // colours+size reload, then resume PLAYING (after a regen)
  void (*resume)();         // resume PLAYING (no regen)
  void (*toType)();         // set g_state = TYPE_MENU
  void (*toConfig)();       // set g_state = CONFIG_EDIT
  void (*toRules)();        // set g_state = RULES
  void (*toReport)();       // set g_state = REPORT
  void (*togglePointer)();  // flip the tilt pointer
  void (*toggleZoom)();     // flip the 2x magnifier
  void (*recenter)();       // zero the tilt neutral to the current hold pose
};
void uiBind(const UiCtx& c);
void openCommand();  void commandKey(InputEvent ev);
void openTypeMenu(); void typeKey(InputEvent ev);
void openConfig();   void configKey(InputEvent ev);
void openRules();    void ruleKey(InputEvent ev);
void openReport();   void reportKey(InputEvent ev);

// --- device settings (Tab on the game list) ---
// Bound separately from UiCtx: the screen is reachable with no game loaded, so
// it must not touch g_ui.me. `apply` fires on every change (live feedback --
// brightness you cannot see while choosing it is not a control), `commit`
// persists and hands control back to the chooser.
struct SettingsCtx {
  void (*apply)(uint8_t brightness, bool pointer);
  void (*commit)();
};
void settingsBind(const SettingsCtx& c);
void openSettings(uint8_t brightness, bool pointer);
void settingsKey(InputEvent ev);
void reportTick();   // per-frame while REPORT: holds the backlight up for the camera

}  // namespace puz
