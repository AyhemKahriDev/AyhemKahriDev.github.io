const soundtrack = document.getElementById("soundtrack");
const audioControl = document.querySelector("#audio-control input");
let playedOnce = false;
audioControl.addEventListener("change", (e) => {
  if (!e.target.checked) {
    soundtrack.pause();
  } else {
    soundtrack.play();
    if (!playedOnce && !window.location.href.includes("index")) {
      soundtrack.currentTime = Number(sessionStorage.getItem("soundtrackTime"));
      playedOnce = true;
    }
    soundtrack.volume = 0.1;
  }
});

function setSoundtrackTime() {
  sessionStorage.setItem("soundtrackTime", soundtrack.currentTime)
}

// Sonido interruptor
const switchSound = document.getElementById("switch-sound");
switchSound.volume = 0.85;
document.querySelector(".switch").addEventListener("click", () => {
  switchSound.play();
});

// Sonido pulsación
const clickSound = document.getElementById("click-sound");
clickSound.volume = 0.8;
document.querySelectorAll(".click").forEach((element) => {
  element.addEventListener("click", () => {
    clickSound.play();
  });
})

// Sonido alerta
const alertSound = document.getElementById("alert-sound");
function playAlertSound() {
  alertSound.volume = 0.8;
  alertSound.play();
}

// Sonido error
const errorSound = document.getElementById("error-sound");
function playErrorSound() {
  errorSound.volume = 0.6;
  errorSound.play();
}

// Sonido hover
const hoverSound = document.getElementById("hover-sound");
hoverSound.volume = 0.8;
document.querySelectorAll(".hover").forEach((element) => {
  element.addEventListener("mouseenter", () => {
    hoverSound.play();
  });
})


