# OpenAI Codex and AI-Assisted Development Policy for OSS Applications

This document describes the design principles, OpenAI Codex integration plans, and roadmap for **chain-drop-lab**. It serves as official documentation for developer-support programs and open-source applications.

---

## 1. Project Description
**chain-drop-lab** is an entirely original, commercial-friendly cascading puzzle browser game written in pure TypeScript + HTML5 Canvas. The goal of the game is to match falling circular colored gems in connected groups of four or more. 
To prioritize educational value and legal compliance, the project contains absolutely no third-party media assets (no images or audio files). Instead, all graphics are dynamically rendered via the HTML5 Canvas API, and all sound effects are procedurally synthesized using the Web Audio API.

---

## 2. Why this Repository is Useful as Open Source
This repository provides a highly accessible, complete template for developers learning modern game development.
- **Educational Value**: Demonstrates object-oriented TypeScript design, particle physics, game state machines, and canvas rendering loops.
- **Zero Runtime Dependencies**: The running game has zero dependencies (only devDependencies like Vite, Vitest, ESLint, and Prettier are used), ensuring fast loading times and minimal security risks.
- **Clean License Compliance**: Zero risk of trademark infringement (such as "Puyo Puyo" or "SEGA"). No copyrighted files make it a safe reference for creators building their own derivatives.

---

## 3. How Codex / Large Language Models Help Maintain the Project
AI systems and OpenAI Codex are integral to the longevity of **chain-drop-lab**:
- **Automated Refactoring**: Codex helps safely modify the board state traversal algorithm (BFS) and suggest performance optimizations.
- **Test Generation**: Generating high-coverage test cases for edge cases in the physics/gravity drop sequences.
- **Visual Synthesis Tuning**: Recommending dynamic adjustments to Canvas gradient colors, particle velocity vectors, and retro synth sound frequencies.

---

## 4. How API Credits and Credits would be Used
If granted OpenAI developer credits, they will be utilized to:
1. **Automate QA Scenarios**: Drive browser-based testing agents to simulate hours of human gameplay to find memory leaks or frame rate dips.
2. **Translate Documentation**: Automatically translate the code comments, rules, and architecture specs to multi-lingual standards (Japanese, English, Spanish, German, etc.).
3. **Enhance AI Autoplay Engine**: Teach the autoplay agent (Demo Mode) advanced puzzle tricks (like stacking combos and smart rotations) using heuristic models.

---

## 5. Roadmap
- [x] **v1.0.0**: Core board physics, 4 game modes, synthesized audio, basic particles, offline storage safety, responsive UI.
- [ ] **v1.1.0**: Custom seed generation for combo decks in Practice Mode.
- [ ] **v1.2.0**: Advanced keyboard layout custom settings.
- [ ] **v1.3.0**: Fully offline-playable PWA (Progressive Web App) support.

---

## 6. Current Limitations
- **No Multiplayer Mode**: The game runs entirely on a single-player client thread.
- **Graphics Performance**: Very high particle counts on low-end smartphones might experience slight frame drops (mitigated via accessibility toggles).

---

## 7. Maintainer Workflow
1. **Branch Protection**: Code commits are pushed to feature branches.
2. **CI Check**: GitHub Actions triggers ESLint linting, Vitest unit testing, and Vite production builds.
3. **Automatic Deployment**: Successfully validated code on the `main` branch is instantly deployed to GitHub Pages.

---

## 8. Testing and Quality Policy
We enforce a strict high-coverage testing target:
- **100% Core Logic Coverage**: Board connectivity, chain reactions, scoring coefficients, game-over, and SafeStorage fallbacks must pass unit tests before release.
- **Lint Conformity**: Strictly zero ESLint warnings or errors allowed on release branches.

---

## 9. Accessibility Plan
- **Reduced Motion**: Respects `prefers-reduced-motion` at the operating system level, automatically disabling camera shakes and minimizing particle calculations.
- **Keyboard-only Navigation**: Complete gameplay loop playable using purely keyboard layouts.
- **Volume Toggles**: Interactive mute controls with state persistence across sessions.

---

## 10. Security and Privacy Policy
- **Zero Backend Communications**: No tracking cookies, telemetry, or server database integrations.
- **Absolute Privacy**: All player records (such as high scores) are stored exclusively in the client's local browser context via safe storage mechanisms.
