<h1 align="center">Space Invaders in Canvas</h1>

<div align="center">
  <a href="README.md"><img src="https://img.shields.io/badge/English-00d4ff?style=for-the-badge" alt="English"></a>
  <a href="README.es.md"><img src="https://img.shields.io/badge/Español-555555?style=for-the-badge" alt="Español"></a>

  
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
<div align="center"><img width="481" height="495" alt="image" src="https://github.com/user-attachments/assets/f9727ad1-ff04-4f7b-a1f7-0b4b0d421a4b" /></div>
<br>
<div align="center">
  <a href="https://space-invaders-canvas.vercel.app"><img src="https://img.shields.io/badge/🎮_Jugar_Ahora-00d4ff?style=for-the-badge" alt="Jugar Ahora"></a>
</div>
<br>
Una recreación del clásico Space Invaders construida con **HTML5 Canvas** y **JavaScript vanilla**. Presenta un menú principal con opciones, control por teclado y táctil, sistema de vidas, jefe final, efectos de partículas, música y soporte para 3 idiomas.

---

## Características

- **Nave jugador** con color personalizable desde el menú de opciones
- **Enemigos** con animación de tentáculos que descienden desde la parte superior
- **Jefe final** con barra de vida, 3 tipos de proyectiles y mecánica de oleadas
- **Sistema de vidas** con corazones recuperables (máximo 5)
- **Efectos visuales**: campo estelar animado, estrellas fugaces, partículas de explosión y curación
- **Sonido**: música de fondo looping y efectos para cada acción (disparo, daño, curación, game over)
- **Control táctil**: botones en pantalla para dispositivos móviles
- **3 idiomas**: English, Español, Français
- **Interfaz**: menú principal, menú de opciones, pantalla de créditos y pantalla de game over

---

## Cómo jugar

| Entrada | Acción |
|---------|--------|
| `←` `→` | Mover la nave |
| Disparo automático | Cada 500ms |
| `Botones < >` | Control táctil para móvil |

El objetivo es destruir enemigos para acumular puntos. Al alcanzar **250 puntos** aparece el jefe final. Derrota al jefe para ganar la partida.

---

## Jefe final

- Aparece cuando el jugador alcanza **250 puntos**.
- **Salud**: 500 puntos de vida.
- Cada impacto de bala resta **5 de salud**.
- Se mueve horizontalmente rebotando en los bordes.
- Dispara 3 tipos de proyectiles: izquierda, centro y derecha.
- **Recompensa**: 1000 puntos al derrotarlo.

---

## Tecnologías

| Tecnología | Uso |
|------------|-----|
| **HTML5** | Estructura de la página y menús |
| **CSS3** | Estilos, animaciones `@keyframes`, diseño responsive |
| **Canvas API** | Renderizado del juego, sprites, partículas |
| **JavaScript (ES6)** | Lógica del juego, física, colisiones, audio |
| **Google Fonts** | Tipografía retro "Press Start 2P" |

---

## Estructura del proyecto

```
📦 Space-Invaders-Canvas
├── assets/
│   ├── audio/          # Efectos de sonido y música
│   └── images/         # Sprites e iconos (corazones, etc.)
├── index.html          # Página principal con menús y canvas
├── logic.js            # Lógica completa del juego (~940 líneas)
├── styles.css          # Estilos y animaciones CSS
├── LICENSE             # Apache License 2.0
└── README.md
```

---

## Idiomas

| Código | Idioma |
|--------|--------|
| `EN` | English |
| `ES` | Español |
| `FR` | Français |

El idioma se puede cambiar desde el menú de opciones durante la partida.

---

## Controles y opciones

Desde el menú de opciones puedes ajustar:

- **Volumen** — Control deslizante para la música de fondo
- **Color de nave** — Selector de color hexadecimal
- **Idioma** — Cambia entre EN, ES, FR

---

## Créditos

| Rol | Nombre |
|-----|--------|
| **Desarrollo** | Ing. Martinez Anthony |
| **Testing** | Ing. Coronel Roysmar |

---

## Licencia

Distribuido bajo la licencia **Apache 2.0**. Consulta el archivo [`LICENSE`](LICENSE) para más información.
