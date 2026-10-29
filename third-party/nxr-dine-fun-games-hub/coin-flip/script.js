// Game state variables
let player1Choice = null;
let player2Choice = null;
let player1Score = 0;
let player2Score = 0;
let gameActive = true;

// DOM elements
const statusDisplay = document.getElementById("status");
const score1Display = document.getElementById("score-1");
const score2Display = document.getElementById("score-2");
const p1Selection = document.getElementById("p1-selection");
const p2Selection = document.getElementById("p2-selection");
const flipBtn = document.getElementById("flip-btn");
const newGameBtn = document.getElementById("new-game-btn");
const coin = document.getElementById("coin");

// Player 1 choice buttons
document
  .getElementById("p1-heads")
  .addEventListener("click", () => selectChoice("player1", "heads"));
document
  .getElementById("p1-tails")
  .addEventListener("click", () => selectChoice("player1", "tails"));

// Player 2 choice buttons
document
  .getElementById("p2-heads")
  .addEventListener("click", () => selectChoice("player2", "heads"));
document
  .getElementById("p2-tails")
  .addEventListener("click", () => selectChoice("player2", "tails"));

// Flip button and new game button
flipBtn.addEventListener("click", flipCoin);
newGameBtn.addEventListener("click", resetGame);

// Select choice function
function selectChoice(player, choice) {
  if (!gameActive) return;

  // Reset animation classes
  coin.classList.remove("animate-heads", "animate-tails");

  if (player === "player1") {
    player1Choice = choice;
    p1Selection.textContent = `Selected: ${
      choice.charAt(0).toUpperCase() + choice.slice(1)
    }`;

    // Update button states
    document
      .getElementById("p1-heads")
      .classList.toggle("selected", choice === "heads");
    document
      .getElementById("p1-tails")
      .classList.toggle("selected", choice === "tails");
  } else {
    player2Choice = choice;
    p2Selection.textContent = `Selected: ${
      choice.charAt(0).toUpperCase() + choice.slice(1)
    }`;

    // Update button states
    document
      .getElementById("p2-heads")
      .classList.toggle("selected", choice === "heads");
    document
      .getElementById("p2-tails")
      .classList.toggle("selected", choice === "tails");
  }

  // Enable flip button if both players have made choices
  flipBtn.disabled = !(player1Choice && player2Choice);

  // Update status
  if (player1Choice && player2Choice) {
    statusDisplay.textContent = "Ready to flip!";
  } else if (player1Choice) {
    statusDisplay.textContent = "Player 2, select heads or tails.";
  } else if (player2Choice) {
    statusDisplay.textContent = "Player 1, select heads or tails.";
  }
}

// Flip coin function
function flipCoin() {
  if (!gameActive || !player1Choice || !player2Choice) return;

  // Disable choices during animation
  gameActive = false;
  flipBtn.disabled = true;

  // Determine result (50/50 chance)
  const result = Math.random() < 0.5 ? "heads" : "tails";

  // Update status during flip
  statusDisplay.textContent = "Flipping...";

  // Animate coin flip
  coin.classList.add(`animate-${result}`);

  // Wait for animation to complete
  setTimeout(() => {
    // Determine winner
    let winner = null;
    if (player1Choice === result && player2Choice !== result) {
      winner = "player1";
      player1Score++;
      score1Display.textContent = player1Score;
      statusDisplay.textContent = "Player 1 wins!";
    } else if (player2Choice === result && player1Choice !== result) {
      winner = "player2";
      player2Score++;
      score2Display.textContent = player2Score;
      statusDisplay.textContent = "Player 2 wins!";
    } else if (player1Choice === result && player2Choice === result) {
      statusDisplay.textContent = "It's a tie!";
    } else {
      statusDisplay.textContent = "Nobody wins this round!";
    }

    // Reset for next round
    player1Choice = null;
    player2Choice = null;
    p1Selection.textContent = "";
    p2Selection.textContent = "";
    document
      .querySelectorAll(".choice-btn")
      .forEach((btn) => btn.classList.remove("selected"));

    // Re-enable game after delay
    setTimeout(() => {
      gameActive = true;
      statusDisplay.textContent = "Choose heads or tails for the next round!";
    }, 1500);
  }, 1000);
}

// Reset game function
function resetGame() {
  // Reset scores
  player1Score = 0;
  player2Score = 0;
  score1Display.textContent = player1Score;
  score2Display.textContent = player2Score;

  // Reset choices
  player1Choice = null;
  player2Choice = null;
  p1Selection.textContent = "";
  p2Selection.textContent = "";

  // Reset UI
  document
    .querySelectorAll(".choice-btn")
    .forEach((btn) => btn.classList.remove("selected"));
  coin.classList.remove("animate-heads", "animate-tails");
  flipBtn.disabled = true;

  // Reset status
  statusDisplay.textContent = "Choose heads or tails to start!";

  // Enable game
  gameActive = true;
}
