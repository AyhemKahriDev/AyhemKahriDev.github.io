<h1 align="center">Space Invaders in Canvas</h1>

<div align="center">
<a href="README.md"><img src="https://img.shields.io/badge/English-555555?style=for-the-badge" alt="English"></a>
  <a href="README.es.md"><img src="https://img.shields.io/badge/Español-00d4ff?style=for-the-badge" alt="Español"></a>
</div>

<br>

<div align="center">
  <img src="https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white" alt="HTML5">
  <img src="https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white" alt="CSS3">
  <img src="https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black" alt="JavaScript">
  <img src="https://img.shields.io/badge/Canvas_API-00D4FF?style=for-the-badge&logo=html5&logoColor=white" alt="Canvas">
  <img src="https://img.shields.io/badge/License-Apache_2.0-blue?style=for-the-badge" alt="License">
</div>
<br>
<div align="center"><img width="481" height="495" alt="screenshot" src="https://github.com/user-attachments/assets/e0c87466-43da-4111-8bf9-008a588e7d8a" /></div>
<br>
<div align="center">
  <a href="https://space-invaders-canvas.vercel.app"><img src="https://img.shields.io/badge/🎮_Play_Now-00d4ff?style=for-the-badge" alt="Play Now"></a>
</div>
<br>
A recreation of the classic Space Invaders built with **HTML5 Canvas** and **vanilla JavaScript**. It features a main menu with options, keyboard and touch controls, a lives system, a final boss, particle effects, music, and 3-language support.

---

## Features

- **Player ship** with customizable color from the options menu
- **Enemies** with tentacle animation descending from the top
- **Final boss** with health bar, 3 projectile types, and wave mechanics
- **Lives system** with collectible hearts (max 5)
- **Visual effects**: animated starfield, shooting stars, explosion and healing particles
- **Sound**: looping background music and sound effects for every action
- **Touch controls**: on-screen buttons for mobile devices
- **3 languages**: English, Español, Français
- **Interface**: main menu, options menu, credits screen, and game over screen

---

## How to play

| Input | Action |
|-------|--------|
| `←` `→` | Move the ship |
| Auto-fire | Every 500ms |
| `<` `>` buttons | Touch controls for mobile |

Destroy enemies to earn points. When you reach **250 points** the final boss appears. Defeat the boss to win the game.

---

## Final boss

- Appears when the player reaches **250 points**.
- **Health**: 500 HP.
- Each bullet hit deals **5 damage**.
- Moves horizontally bouncing off the walls.
- Shoots 3 types of projectiles: left, center, and right.
- **Reward**: 1000 points upon defeat.

---

## Technologies

| Technology | Usage |
|------------|-------|
| **HTML5** | Page structure and menus |
| **CSS3** | Styles, `@keyframes` animations, responsive design |
| **Canvas API** | Game rendering, sprites, particles |
| **JavaScript (ES6)** | Game logic, physics, collisions, audio |
| **Google Fonts** | Retro "Press Start 2P" typography |

---

## Project structure

```
📦 Space-Invaders-Canvas
├── assets/
│   ├── audio/          # Sound effects and music
│   └── images/         # Sprites and icons (hearts, etc.)
├── index.html          # Main page with menus and canvas
├── logic.js            # Complete game logic (~940 lines)
├── styles.css          # CSS styles and animations
├── LICENSE             # Apache License 2.0
└── README.md
```

---

## Languages

| Code | Language |
|------|----------|
| `EN` | English |
| `ES` | Español |
| `FR` | Français |

The language can be changed from the options menu during the game.

---

## Controls and options

From the options menu you can adjust:

- **Volume** — Slider for background music
- **Ship color** — Hexadecimal color picker
- **Language** — Switch between EN, ES, FR

---

## Credits

| Role | Name |
|------|------|
| **Development** | Ing. Martinez Anthony |
| **Testing** | Ing. Coronel Roysmar |

---

## License

Distributed under the **Apache 2.0** license. See [`LICENSE`](LICENSE) for more information.
