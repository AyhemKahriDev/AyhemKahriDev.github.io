# GitHub Release Draft: v1.0.1

## Release Specification
- **Tag version**: `v1.0.1`
- **Release title**: `v1.0.1: Ultra-Responsive Keyboard Controls & Precision Focus Management`
- **Target branch**: `main`

---

## Summary
We are thrilled to release `v1.0.1` of **chain-drop-lab**, introducing massive quality-of-life enhancements for keyboard navigation, focus restoration, and input robustness.

This patch addresses critical key collision bugs and prevents unexpected browser behaviors during active, high-tempo cascading gameplay.

---

## Live Demo
Experience the polished gameplay:
👉 [https://aicoderproject.github.io/chain-drop-lab/](https://aicoderproject.github.io/chain-drop-lab/)

---

## Release Details

### ⌨️ Keyboard & Responsiveness Improvements
- **Enter & P-Key Shortcuts**: Supports `Enter` as an alternative to `Space` for starting/pausing/retrying. Added `P` key as a dedicated toggle for pausing and resuming gameplay.
- **Scroll Prevention**: Standard browser keys (arrows, space, enter) are intercepted immediately during active context to block default page scrolling, ensuring uninterrupted gameplay.

### 🔬 Focus Management & Focus Stabilization
- **Canvas Focusability**: Configured `tabindex="0"` on the HTML5 Canvas to support direct and robust keyboard targeting.
- **Auto Focus Restoration**: Click events on header buttons (Normal, Boost, Mute, etc.) now automatically blur the button and restore active focus back to the canvas element (`canvas.focus()`). This completely prevents the annoying bug where pressing Space or Enter would repeat the button click instead of operating the game.

### 🧪 Added Tests
- **Vitest Keyboard Simulation**: Added automated tests to `game.test.ts` to simulate key events (such as `ArrowLeft` for piece movements and `KeyP` for pausing), verifying 100% accurate key-state bindings.

### 🛠️ Quality Checks Passed
- ESLint checks pass with **0 warnings and 0 errors**.
- 17 unit tests pass 100%.
- Bundle size remains highly optimized (< 25kB).

---

## Upgrade Notes
No database migrations or external setup tweaks are required. Simply pull the latest `main` branch to experience the polished responsiveness.
