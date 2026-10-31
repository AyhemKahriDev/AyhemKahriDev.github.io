sessionStorage.clear();

if (localStorage.getItem("ranking") === null) {
  localStorage.setItem("ranking", "[]");
}

// Modal de ayuda
document.getElementById("help-modal-btn").addEventListener("click", () => {
  document.getElementById("overlay").classList.add("is-visible");
  document.getElementById("help-modal").classList.add("is-visible");
});

document.getElementById("overlay").addEventListener("click", () => {
  document.getElementById("overlay").classList.remove("is-visible");
  document.getElementById("help-modal").classList.remove("is-visible");
});

document.getElementById("help-close-btn").addEventListener("click", () => {
  document.getElementById("overlay").classList.remove("is-visible");
  document.getElementById("help-modal").classList.remove("is-visible");
});

document.getElementById("ranking-btn").addEventListener("click", () => {
  setSoundtrackTime();
  setTimeout(() => {
    window.location.href = "game/ranking.html";
  }, 450);
});

document.getElementById("play-btn").addEventListener("click", () => {
  setSoundtrackTime();
  setTimeout(() => {
    window.location.href = "game/start.html";
  }, 450);
});