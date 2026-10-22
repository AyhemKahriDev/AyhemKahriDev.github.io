# Release Notes: v1.0.1 (Keyboard Responsiveness Polish)

We are excited to release **v1.0.1**, focusing on keyboard input latency improvements, focus recovery, browser scrolling preventions, and automated input simulation tests.

### 🌐 Play Live Demo
The game is hosted and ready to play on GitHub Pages:
[https://aicoderproject.github.io/chain-drop-lab/](https://aicoderproject.github.io/chain-drop-lab/)

---

# Release Notes: v1.0.0 (Initial Public Release)

We are proud to announce the initial release of **chain-drop-lab**, a highly optimized, commercial-friendly cascading puzzle browser game built in pure TypeScript + HTML5 Canvas.

This release marks the baseline stable version of the code, designed to serve both as a highly engaging browser game and a pristine educational template for developers studying object-oriented programming in web ecosystems.

### 🌐 Play Live Demo
The game is successfully hosted and ready to play on GitHub Pages:
[https://aicoderproject.github.io/chain-drop-lab/](https://aicoderproject.github.io/chain-drop-lab/)

---

## What's New

### 🎮 Gameplay & Features
- **Original Matching Logic**: Circular colored gemstones that collapse dynamically when 4 or more adjacent cells connect.
- **4 Custom Game Modes**:
  - **Normal Mode**: Standard strategic puzzle play with 5 colors.
  - **Chain Boost Mode**: Speed and color restriction (3 colors only) tailored for beginners to easily trigger 10+ combo cascades.
  - **Practice Mode**: Zero game-over state. Learn patterns at your own pace with instant quick drop (`ArrowUp`).
  - **Demo Chain Mode**: Auto-play demonstration of calculated combinations resulting in huge chains.
- **Procedural Synthesized SFX**: Sound effects generated dynamically via Web Audio API. Zero external audio file lag, with perfect session-wide Mute toggles.

### 🌟 Graphics & Visual Polish
- **Dynamic Particles**: Vivid particle bursts matching the colors of cleared gems.
- **Screen Shake**: Camera shake intensity based on the cascade count to maximize puzzle gratification.
- **Micro-animations**: Dynamic bounce, smooth landing lerps, and floating 3D combos.

### 🛠️ Developer & System Infrastructure
- **Clean Architecture**: Separation of concerns between grid storage, synthesizer, and canvas drawing layers.
- **A11y (Accessibility)**: Automatic optimization respecting user's `prefers-reduced-motion` settings.
- **Storage Resilience**: Custom memory-fallback wrapping for sessions where `localStorage` is restricted.
- **100% Core Logic Coverage**: Fully covered by Vitest suites.
