// memory-script.js
document.addEventListener("DOMContentLoaded", function () {
  const gameBoard = document.getElementById("game-board");
  const startButton = document.getElementById("start-btn");
  const resetButton = document.getElementById("reset-btn");
  const movesDisplay = document.getElementById("moves");
  const pairsDisplay = document.getElementById("pairs");
  const timeDisplay = document.getElementById("time");

  let cards = [];
  let flippedCards = [];
  let matchedPairs = 0;
  let moves = 0;
  let gameStarted = false;
  let timer = null;
  let seconds = 0;
  let canFlip = true;

  // Card symbols (emojis)
  const symbols = ["🍎", "🍌", "🍒", "🍇", "🍊", "🍓", "🍉", "🍋"];

  // Initialize game
  function initGame() {
    // Clear previous game
    gameBoard.innerHTML = "";
    cards = [];
    flippedCards = [];
    matchedPairs = 0;
    moves = 0;
    seconds = 0;
    canFlip = true;

    // Update displays
    movesDisplay.textContent = moves;
    pairsDisplay.textContent = matchedPairs;
    timeDisplay.textContent = "00:00";

    // Create pairs of cards
    const cardPairs = [...symbols, ...symbols];

    // Shuffle cards
    const shuffledCards = shuffleArray(cardPairs);

    // Create card elements
    shuffledCards.forEach((symbol, index) => {
      const card = document.createElement("div");
      card.className = "card";
      card.dataset.cardIndex = index;
      card.dataset.symbol = symbol;

      // Create front and back of card
      const cardFront = document.createElement("div");
      cardFront.className = "card-front";
      cardFront.textContent = "?";

      const cardBack = document.createElement("div");
      cardBack.className = "card-back";
      cardBack.textContent = symbol;

      // Append to card
      card.appendChild(cardFront);
      card.appendChild(cardBack);

      // Add click event
      card.addEventListener("click", flipCard);

      // Add card to board and cards array
      gameBoard.appendChild(card);
      cards.push(card);
    });
  }

  // Shuffle array (Fisher-Yates algorithm)
  function shuffleArray(array) {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
  }

  // Start game
  function startGame() {
    if (!gameStarted) {
      gameStarted = true;
      startButton.textContent = "Game in Progress";
      startButton.disabled = true;

      // Start timer
      timer = setInterval(updateTimer, 1000);
    }
  }

  // Reset game
  function resetGame() {
    // Clear timer
    if (timer) {
      clearInterval(timer);
      timer = null;
    }

    gameStarted = false;
    startButton.textContent = "Start Game";
    startButton.disabled = false;

    // Reinitialize game
    initGame();
  }

  // Update timer
  function updateTimer() {
    seconds++;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    timeDisplay.textContent = `${minutes
      .toString()
      .padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}`;
  }

  // Flip card
  function flipCard() {
    if (!gameStarted) {
      startGame();
    }

    const selectedCard = this;

    // Check if card can be flipped
    if (
      !canFlip ||
      flippedCards.length === 2 ||
      selectedCard.classList.contains("flipped") ||
      selectedCard.classList.contains("matched")
    ) {
      return;
    }

    // Flip the card
    selectedCard.classList.add("flipped");
    flippedCards.push(selectedCard);

    // Check for match if 2 cards are flipped
    if (flippedCards.length === 2) {
      moves++;
      movesDisplay.textContent = moves;

      // Check for match
      if (flippedCards[0].dataset.symbol === flippedCards[1].dataset.symbol) {
        // Match found
        matchedPairs++;
        pairsDisplay.textContent = matchedPairs;

        // Mark cards as matched
        flippedCards.forEach((card) => {
          card.classList.add("matched");
        });

        // Reset flipped cards
        flippedCards = [];

        // Check if game is complete
        if (matchedPairs === symbols.length) {
          clearInterval(timer);
          setTimeout(() => {
            alert(
              `Congratulations! You completed the game in ${moves} moves and ${timeDisplay.textContent}!`
            );
            resetGame();
          }, 500);
        }
      } else {
        // No match
        canFlip = false;

        // Flip cards back after a delay
        setTimeout(() => {
          flippedCards.forEach((card) => {
            card.classList.remove("flipped");
          });
          flippedCards = [];
          canFlip = true;
        }, 1000);
      }
    }
  }

  // Event listeners
  startButton.addEventListener("click", startGame);
  resetButton.addEventListener("click", resetGame);

  // Initialize the game
  initGame();
});
