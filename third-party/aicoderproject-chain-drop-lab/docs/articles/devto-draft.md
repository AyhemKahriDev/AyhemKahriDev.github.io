# Building a 100% Asset-Free Cascading Puzzle Game in Pure TypeScript + Canvas

Building games for the web is incredibly fun, but using trademarked names, copyrights, or heavy image/audio files can be a headache—especially if you want to publish your code as a clean, commercial-friendly open-source project.

To solve this, I built **`chain-drop-lab`**, a fully original, commercial-friendly cascading drop-match puzzle game written in pure TypeScript and HTML5 Canvas, completely free of external assets.

* **GitHub Repository**: [https://github.com/AICoderProject/chain-drop-lab](https://github.com/AICoderProject/chain-drop-lab)
* **Play the Live Demo**: [https://aicoderproject.github.io/chain-drop-lab/](https://aicoderproject.github.io/chain-drop-lab/)

Here is a look at the game in action:

![Gameplay Demo](../../docs/screenshots/gameplay-demo.webp)

---

## 🔬 Under the Hood: Key Architecture

### 1. Vector Rendering & Dynamic FX
Instead of loading static PNG/JPEG images, every element—from the glowing gems and chain-reaction particle explosions to the camera shake and floating 3D-styled combo text—is procedurally rendered on a 2D HTML5 Canvas. This results in instant load times (0 seconds asset load) and crisp rendering on any resolution.

### 2. Procedural Sound Synthesis via Web Audio API
Rather than importing audio files (`wav` or `mp3`), `chain-drop-lab` synthesizes all sound effects in real time using the **Web Audio API**. We construct oscillators and gain nodes programmatically. As you trigger combos, the game procedurally increases the synthesizer's pitch step-by-step (C-D-E-F-G-A-B-C), creating a satisfying sonic feedback loop.

### 3. Bulletproof Game Engine Testing
Cascade puzzle matching algorithms can be notoriously buggy. To prevent gems from floating or failing to drop correctly, we decoupled the grid logic from the renderer. We write unit tests for gem gravity, matching algorithms, and recursive chain processing using **Vitest**. Currently, 17/17 core suite tests run on every build.

---

## 🚀 What's New in v1.0.2

In the latest **v1.0.2** update, we focused on improving onboarding for first-time players exploring the GitHub Pages demo by adding a responsive **On-Screen Controls Panel**:

* **Responsive Glassmorphism Styling**: Styled as a clean, semi-transparent card at the bottom-right corner for desktop users, shifting to an inline block at the bottom of the container on mobile viewports.
* **No Horizontal Overflow**: Optimized the viewport layout so that it stays 100% scroll-free even at a narrow width of 390px (mobile layout).
* **Keyboard Safety**: Made sure the overlay does not steal focus from the game canvas.
* **Backward Compatibility**: Fully preserved the highly responsive control scheme established in v1.0.1 (Z/X to rotate, Space/Enter/P to start and pause).

---

## 🤝 Open Source & Contributions Welcome!

`chain-drop-lab` is licensed under the permissive **MIT License**, making it free to modify, distribute, or incorporate into educational and commercial projects.

We are currently polishing the repository for the **OpenAI Codex/OSS developer support program** and welcome contributions from developers worldwide!

* Suggesting new game modes (e.g., Time Attack)
* Polishing particles, visual animations, and CSS themes
* Tweaking touch controls for mobile viewports

If you like the project, please give it a **Star ⭐ on GitHub**! Feel free to open issues or send pull requests. Happy coding!
