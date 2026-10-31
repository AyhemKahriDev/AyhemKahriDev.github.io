"use strict";

if (sessionStorage.getItem("gameEnded") === "yes"){ // Permitir visualizar esta página sólo una vez.
  sessionStorage.removeItem("gameEnded");
} else {
  window.location.href = "start.html";
}

const operationList = document.getElementById("operation-log");
const players = JSON.parse(sessionStorage.getItem("currentPlayers"));
const targetNumber = Number(sessionStorage.getItem("targetNumber"));
const playerNames = document.querySelectorAll(".game-over-player-name");
const playerResults = document.querySelectorAll(".player-result");
const winnerOverlay = document.getElementById("winner-overlay");
const winnerScreen = document.querySelector(".winner-screen");
const title = document.getElementById("title");

// Event Listeners de modal y overlay
document.getElementById("overlay").addEventListener("dblclick", () => {
  document.getElementById("overlay").classList.remove("is-visible");
  document.getElementById("operation-log-modal").classList.remove("is-visible");
  emptyOperationLog();
});

winnerScreen.addEventListener("dblclick", () => {
  winnerOverlay.classList.remove("is-visible");
  winnerScreen.classList.remove("is-visible");
  title.style.animationPlayState = "running";
});

document
  .getElementById("operation-log-close-btn")
  .addEventListener("click", () => {
    document.getElementById("overlay").classList.remove("is-visible");
    document
      .getElementById("operation-log-modal")
      .classList.remove("is-visible");
    emptyOperationLog();
  });

const operationLogButtons = document.querySelectorAll(".view-operations");
operationLogButtons.forEach((button) => {
  button.addEventListener("click", (e) => {
    showOperationLog(e.target.parentElement.id);
  });
});

// Event Listeners de redirección.
document.getElementById("ranking-btn").addEventListener("click", () => {
  setSoundtrackTime();
  setTimeout(() => {
    window.location.href = "ranking.html";
  }, 450);
});

document.getElementById("home-btn").addEventListener("click", () => {
  setTimeout(() => {
    window.location.href = "../index.html";
  }, 450);
});

document.getElementById("play-btn").addEventListener("click", () => {
  setSoundtrackTime();
  sessionStorage.setItem("playAgain", "yes");
  setTimeout(() => {
    window.location.href = "start.html";
  }, 450);
});

setResults();

if (getWinner() !== null) {
  displayWinnerScreen(getWinner());
}

function calculateScore(player) {
  const result = Number(sessionStorage.getItem(`player${player}_result`));
  let score = 10;
  let difference = 0;
  if (result !== targetNumber) {
    if (
      JSON.parse(sessionStorage.getItem(`player${player}_operations`))
        .length !== 0
    ) {
      difference = Math.abs(targetNumber - result);
      for (let i = 0; i < difference && i < 9; i++) {
        score -= 1;
      }
    } else {
      score = 0;
    }
  }
  saveScore(players[player]["name"], Number(score));
  return score;
}

function setResults() {
  const results = [
    sessionStorage.getItem("player0_result"),
    sessionStorage.getItem("player1_result"),
  ];
  const playerScores = document.querySelectorAll(".player-score");
  const playerIcons = document.querySelectorAll(".game-over-player-icon");
  document.getElementById("target-number").textContent = `(${targetNumber})`;
  for (let i = 0; i <= 1; i++) {
    playerIcons[i].style.fill = players[i]["color"];
    playerNames[i].textContent = players[i]["name"];
    playerScores[i].textContent = `+${calculateScore(i)}`;
    playerResults[i].textContent = results[i];
  }
}

function showOperationLog(player) {
  const playerName = players[Number(player.substr(-1)) - 1]["name"];
  const playerOperations = JSON.parse(
    sessionStorage.getItem(`player${Number(player.substr(-1)) - 1}_operations`)
  );
  if (playerOperations.length > 0) {
    operationList.removeChild(operationList.firstElementChild);
    playerOperations.forEach((op) => {
      operationList.insertAdjacentHTML("beforeend", `<li>${op}</li>`);
    });
  }
  document.getElementById("overlay").classList.add("is-visible");
  document.getElementById("operation-log-modal").classList.add("is-visible");
  document.getElementById("player-log").textContent = playerName;
}

function emptyOperationLog() {
  while (operationList.firstElementChild) {
    operationList.removeChild(operationList.firstElementChild);
  }
  operationList.insertAdjacentHTML(
    "beforeend",
    `<span>No ha hecho nada.</span>`
  );
}

function saveScore(playerName, score) {
  const ranking = JSON.parse(localStorage.getItem("ranking"));
  if (!ranking.some((p) => p.player === playerName)) {
    const player = {
      player: playerName,
      score: score,
    };
    ranking.push(player);
  } else {
    const playerIndex = ranking.findIndex((p) => p.player === playerName);
    ranking[playerIndex].score += score;
  }

  localStorage.setItem("ranking", JSON.stringify(ranking));
  sortRanking();
}

function sortRanking() {
  const ranking = JSON.parse(localStorage.getItem("ranking"));
  ranking.sort((a, b) => b.score - a.score);
  localStorage.setItem("ranking", JSON.stringify(ranking));
}

function getWinner() {
  let winner = null;
  if (
    Math.abs(Number(playerResults[0].textContent) - targetNumber) <
    Math.abs(Number(playerResults[1].textContent) - targetNumber)
  ) {
    winner = playerNames[0].textContent;
  } else if (
    Math.abs(Number(playerResults[1].textContent) - targetNumber) <
    Math.abs(Number(playerResults[0].textContent) - targetNumber)
  ) {
    winner = playerNames[1].textContent;
  }
  return winner;
}

function displayWinnerScreen(winner) {
  const player = document.getElementById("winner");
  player.textContent = winner;
  title.style.animationPlayState = "paused";
  winnerOverlay.classList.add("is-visible");
  winnerScreen.classList.add("is-visible");
}

// Sonido ganador
const winnerSound = new Audio("../game/assets/audio/winner.wav");
winnerScreen.addEventListener("click", playWinnerSound);
function playWinnerSound() {
  winnerSound.volume = 0.75;
  winnerSound.play();
  winnerScreen.removeEventListener("click", playWinnerSound);
}
