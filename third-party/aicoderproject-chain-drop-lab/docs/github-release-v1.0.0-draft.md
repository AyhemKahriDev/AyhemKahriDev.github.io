# GitHub Release Draft: v1.0.0

## Release Specification
- **Tag version**: `v1.0.0`
- **Release title**: `v1.0.0: Initial Stable Release with Full Accessibility & Zero Asset Risk`
- **Target branch**: `main`

---

## Summary
We are incredibly proud to present the official first release (`v1.0.0`) of **chain-drop-lab**.

This project provides a highly optimized, fully responsive, and entirely original cascading drop-match puzzle game designed in pure TypeScript + HTML5 Canvas. With absolutely zero runtime dependencies and zero external asset imports (all graphics dynamically rendered via Canvas, all audio synthesized procedurally using the Web Audio API), it is the ultimate risk-free reference template for educational OSS.

---

## Live Demo
Play the game instantly on your browser:
👉 [https://aicoderproject.github.io/chain-drop-lab/](https://aicoderproject.github.io/chain-drop-lab/)

---

## Features
- **Zero Asset Risk**: Safe for commercial redistribution and education. No images, no audio file dependencies, and 100% trademark-compliant.
- **Micro-interactions & Visual Polish**: Camera shake, multi-layered particle bursts, and floating 3D combos designed for ultimate gameplay satisfaction.
- **Audio Synthesizer**: Procedures dynamically generate pitch-shifting combos matching retro audio scales. Perfect session-wide mute settings.
- **Accessibility & Device Adaptability**: Supports `prefers-reduced-motion` at the OS level to ease visual fatigue. Fully responsive layout with mobile-first tap overlays.
- **Safe Offline Storage**: In-memory save state fallback prevents page crash on strictly private browsing profiles.

---

## Game Modes Included
1. **Normal Mode**: Strategic drop-matching under standard 5-color constraints.
2. **Chain Boost Mode**: Fast combos under a restricted 3-color palette (ideal for instant 10+ combo testings).
3. **Practice Mode**: Zero game-over boundaries with active instant quick drops (`ArrowUp`).
4. **Demo Chain Mode**: AI autoplay stacking calculated combos automatically.

---

## Quality Checks Passed
- **Vitest Unit Coverage**: 16 unit tests targeting BFS connection matrices, multi-level drops, color restricts, and Storage wrapper passing 100%.
- **Linter & Formatter**: 100% clean check under strict ESLint Flat Config rules.
- **Vite Production Bundler**: Successfully compiled into ultra-lightweight static chunks (< 25kB total assets).

---

## Known Limitations
- Singe-player local environment only (no online server matchups or leaderboard databases).
- Keyboard controls require window focus.
