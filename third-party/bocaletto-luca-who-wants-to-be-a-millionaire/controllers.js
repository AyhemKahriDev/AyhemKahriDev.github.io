// Gestione degli input per tastiera, gamepad, mouse e touchscreen

// Per la tastiera: i tasti A, B, C, D per le risposte e 'q' per ritirarsi
document.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  if (["a", "b", "c", "d"].includes(key)) {
    const btn = document.querySelector(`button.answer-btn[data-answer="${key}"]`);
    if (btn) {
      btn.click();
    }
  } else if (key === 'q') {
    const quitBtn = document.getElementById("quitGame");
    if (quitBtn) {
      quitBtn.click();
    }
  }
});

// Gestione base del gamepad
window.addEventListener("gamepadconnected", (e) => {
  console.log("Gamepad connesso:", e.gamepad);
});

function pollGamepad() {
  const gp = navigator.getGamepads()[0];
  if (gp) {
    // Esempio: il pulsante 0 mappa alla risposta "a"
    if (gp.buttons[0].pressed) {
      const btn = document.querySelector(`button.answer-btn[data-answer="a"]`);
      if (btn) btn.click();
    }
    // Puoi estendere questo mapping per gli altri pulsanti (b, c, d)
  }
  requestAnimationFrame(pollGamepad);
}
requestAnimationFrame(pollGamepad);
