// rps-script.js
document.addEventListener("DOMContentLoaded", function () {
  const choiceButtons = document.querySelectorAll(".choice-btn");
  const playButton = document.getElementById("play-btn");
  const resetButton = document.getElementById("reset-btn");
  const p1Selection = document.getElementById("p1-selection");
  const p2Selection = document.getElementById("p2-selection");
  const resultDisplay = document.getElementById("result");
  const scoreP1 = document.getElementById("score-p1");
  const scoreP2 = document.getElementById("score-p2");
  const scoreTies = document.getElementById("score-ties");

  let p1Choice = null;
  let p2Choice = null;
  let scores = {
    p1: 0,
    p2: 0,
    ties: 0,
  };

  // Emoji mapping
  const emojiMap = {
    rock: "✊",
    paper: "✋",
    scissors: "✌️",
  };

  // Initialize game
  function init() {
    p1Choice = null;
    p2Choice = null;
    p1Selection.textContent = "?";
    p2Selection.textContent = "?";
    resultDisplay.textContent = "Choose your weapons!";

    // Reset selected buttons
    choiceButtons.forEach((btn) => {
      btn.classList.remove("selected");
    });
  }

  // Handle choice button click
  function handleChoiceClick(e) {
    const player = e.target.dataset.player;
    const choice = e.target.dataset.choice;

    // Deselect other buttons for this player
    document
      .querySelectorAll(`.choice-btn[data-player="${player}"]`)
      .forEach((btn) => {
        btn.classList.remove("selected");
      });

    // Select this button
    e.target.classList.add("selected");

    // Update player choice
    if (player === "1") {
      p1Choice = choice;
      p1Selection.textContent = emojiMap[choice];
    } else {
      p2Choice = choice;
      p2Selection.textContent = emojiMap[choice];
    }
  }

  // Determine winner
  function determineWinner(p1, p2) {
    if (p1 === p2) {
      return "tie";
    }

    if (
      (p1 === "rock" && p2 === "scissors") ||
      (p1 === "paper" && p2 === "rock") ||
      (p1 === "scissors" && p2 === "paper")
    ) {
      return "p1";
    } else {
      return "p2";
    }
  }

  // Play round
  function playRound() {
    // Check if both players made choices
    if (!p1Choice || !p2Choice) {
      resultDisplay.textContent = "Both players must make a choice!";
      return;
    }

    // Determine winner
    const winner = determineWinner(p1Choice, p2Choice);

    // Update scores and display result
    if (winner === "tie") {
      scores.ties++;
      resultDisplay.textContent = "It's a tie!";
      scoreTies.textContent = scores.ties;
    } else if (winner === "p1") {
      scores.p1++;
      resultDisplay.textContent = "Player 1 wins!";
      scoreP1.textContent = scores.p1;
    } else {
      scores.p2++;
      resultDisplay.textContent = "Player 2 wins!";
      scoreP2.textContent = scores.p2;
    }

    // Prepare for next round
    setTimeout(() => {
      p1Choice = null;
      p2Choice = null;
      p1Selection.textContent = "?";
      p2Selection.textContent = "?";

      // Reset selected buttons
      choiceButtons.forEach((btn) => {
        btn.classList.remove("selected");
      });

      resultDisplay.textContent = "Choose your weapons for the next round!";
    }, 2000);
  }

  // Reset game
  function resetGame() {
    init();
    scores = { p1: 0, p2: 0, ties: 0 };
    scoreP1.textContent = "0";
    scoreP2.textContent = "0";
    scoreTies.textContent = "0";
  }

  // Event listeners
  choiceButtons.forEach((button) => {
    button.addEventListener("click", handleChoiceClick);
  });

  playButton.addEventListener("click", playRound);
  resetButton.addEventListener("click", resetGame);

  // Initialize game
  init();
});
