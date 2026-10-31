# Battle City (Tank Game)

A browser-based recreation of the classic **Battle City** arcade game, built with HTML5 Canvas and JavaScript.

---

## 🎮 Demo

Open `index.html` in a supported browser to start playing immediately — no build step or server required.

---

## 🕹️ Controls

| Action | Player 1 | Player 2 |
|--------|----------|----------|
| Move Up | `W` | `↑` |
| Move Down | `S` | `↓` |
| Move Left | `A` | `←` |
| Move Right | `D` | `→` |
| Shoot | `SPACE` | `ENTER` |
| Next Level | `N` | — |
| Previous Level | `P` | — |

At the menu, press `ENTER` to start. Use `↑` / `↓` to choose **1 Player** or **2 Players**.

---

## 🗂️ Project Structure

```
Battle-Tank/
├── index.html          # Entry point
├── README.md           # This file
├── css/
│   └── default.css     # Basic page styles
├── images/
│   ├── menu.gif        # Menu background image
│   └── tankAll.gif     # Main spritesheet (tanks, tiles, bullets, HUD)
├── audio/
│   ├── start.mp3       # Stage intro sound
│   ├── move.mp3        # Tank movement sound
│   ├── attack.mp3      # Player shoot sound
│   ├── bulletCrack.mp3 # Bullet explosion sound
│   ├── tankCrack.mp3   # Enemy tank destroyed sound
│   ├── playerCrack.mp3 # Player tank destroyed sound
│   └── prop.mp3        # Power-up pickup sound
└── js/
    ├── const.js          # Global constants, game states, asset references
    ├── level.js          # Map data for all 21 levels
    ├── Helper.js         # Array utility extensions (remove, contains)
    ├── keyboard.js       # Keyboard key-code constants
    ├── Collision.js      # Collision detection functions
    ├── bullet.js         # Bullet class
    ├── tank.js           # Tank base class + Player/Enemy subclasses
    ├── crackAnimation.js # Explosion animation class
    ├── prop.js           # Power-up (prop) class
    ├── num.js            # Number sprite renderer
    ├── menu.js           # Main menu class
    ├── map.js            # Map rendering & HUD class
    ├── stage.js          # Stage transition (curtain) class
    ├── main.js           # Game loop, initialisation, input handling
    └── jquery.min.js     # jQuery 1.6.2 (UI events)
```

---

## 🚀 How to Run

1. Clone or download this repository.
2. Open `index.html` in **Chrome**, **Firefox**, **Opera**, or any modern browser.

> **Note:** Some browsers block `Audio` autoplay or local file access. If audio does not work, try serving the files through a local HTTP server (e.g., `python3 -m http.server` and open `http://localhost:8000`).

---

## 🗺️ Map Tile Reference

| Value | Tile |
|-------|------|
| `0` | Empty |
| `1` | Brick wall (destructible) |
| `2` | Steel wall (indestructible) |
| `3` | Grass (conceals tanks) |
| `4` | Water (impassable) |
| `5` | Ice (slippery) |
| `9` | Home base (protect this!) |

---

## 👾 Enemy Types

| Class | Lives | Speed | Description |
|-------|-------|-------|-------------|
| `EnemyOne` | 1 | 1.5 | Fast, weak |
| `EnemyTwo` | 2 | 1.0 | Standard |
| `EnemyThree` | 3 | 0.5 | Slow but armoured |

Up to **5 enemies** can be on screen at a time. A total of **20 enemies** per level must be destroyed to win.

---

## 🏆 Game States

| State | Description |
|-------|-------------|
| `GAME_STATE_MENU` | Main menu / player select |
| `GAME_STATE_INIT` | Stage intro curtain |
| `GAME_STATE_START` | Active gameplay |
| `GAME_STATE_WIN` | All enemies defeated → next level |
| `GAME_STATE_OVER` | All lives lost or home base destroyed |

---

## 🌐 Browser Compatibility

Chrome · Firefox · Opera · CocCoc · IE8+

---

## 📄 License

This project is a fan/educational recreation of the original **Battle City** game by Namco (1985). All original game assets remain the intellectual property of their respective owners.
