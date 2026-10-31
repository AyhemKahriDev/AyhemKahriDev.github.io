// snake-script.js
document.addEventListener("DOMContentLoaded", function () {
  const canvas = document.getElementById("snake-canvas");
  const ctx = canvas.getContext("2d");
  const startButton = document.getElementById("start-btn");
  const scoreEl = document.getElementById("score");
  const highScoreEl = document.getElementById("high-score");

  // Game variables
  const gridSize = 20;
  const gridWidth = canvas.width / gridSize;
  const gridHeight = canvas.height / gridSize;

  let snake = [];
  let food = {};
  let direction = "";
  let nextDirection = "";
  let gameInterval;
  let gameSpeed = 130;
  let score = 0;
  let highScore = localStorage.getItem("snakeHighScore") || 0;
  let gameRunning = false;

  highScoreEl.textContent = highScore;

  // Initialize the game
  function init() {
    snake = [
      {
        x: Math.floor(gridWidth / 2) * gridSize,
        y: Math.floor(gridHeight / 2) * gridSize,
      },
    ];
    createFood();
    direction = "right";
    nextDirection = "right";
    score = 0;
    scoreEl.textContent = score;
    clearInterval(gameInterval);
    gameRunning = true;
    gameInterval = setInterval(gameLoop, gameSpeed);
  }

  // Create food at random position
  function createFood() {
    food = {
      x: Math.floor(Math.random() * gridWidth) * gridSize,
      y: Math.floor(Math.random() * gridHeight) * gridSize,
    };

    // Make sure food doesn't appear on snake
    for (let i = 0; i < snake.length; i++) {
      if (food.x === snake[i].x && food.y === snake[i].y) {
        createFood();
        break;
      }
    }
  }

  // Game loop
  function gameLoop() {
    update();
    draw();
  }

  // Update game state
  function update() {
    // Update direction
    direction = nextDirection;

    // Create new head based on direction
    const head = { x: snake[0].x, y: snake[0].y };

    switch (direction) {
      case "up":
        head.y -= gridSize;
        break;
      case "down":
        head.y += gridSize;
        break;
      case "left":
        head.x -= gridSize;
        break;
      case "right":
        head.x += gridSize;
        break;
    }

    // Check for wall collision
    if (
      head.x < 0 ||
      head.x >= canvas.width ||
      head.y < 0 ||
      head.y >= canvas.height
    ) {
      gameOver();
      return;
    }

    // Check for self collision
    for (let i = 0; i < snake.length; i++) {
      if (head.x === snake[i].x && head.y === snake[i].y) {
        gameOver();
        return;
      }
    }

    // Add new head to snake
    snake.unshift(head);

    // Check if food is eaten
    if (head.x === food.x && head.y === food.y) {
      score += 10;
      scoreEl.textContent = score;

      if (score > highScore) {
        highScore = score;
        highScoreEl.textContent = highScore;
        localStorage.setItem("snakeHighScore", highScore);
      }

      createFood();

      // Increase speed slightly
      if (score % 50 === 0) {
        clearInterval(gameInterval);
        gameSpeed = Math.max(50, gameSpeed - 10);
        gameInterval = setInterval(gameLoop, gameSpeed);
      }
    } else {
      // Remove tail if no food eaten
      snake.pop();
    }
  }

  // Draw everything
  function draw() {
    // Clear canvas
    ctx.fillStyle = "#f9f9f9";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw snake
    for (let i = 0; i < snake.length; i++) {
      // Head has different color
      if (i === 0) {
        ctx.fillStyle = "#2980b9";
      } else {
        ctx.fillStyle = "#3498db";
      }

      ctx.fillRect(snake[i].x, snake[i].y, gridSize, gridSize);

      // Draw border
      ctx.strokeStyle = "#f9f9f9";
      ctx.strokeRect(snake[i].x, snake[i].y, gridSize, gridSize);
    }

    // Draw food
    ctx.fillStyle = "#e74c3c";
    ctx.fillRect(food.x, food.y, gridSize, gridSize);
    ctx.strokeStyle = "#c0392b";
    ctx.strokeRect(food.x, food.y, gridSize, gridSize);
  }

  // Game over function
  function gameOver() {
    clearInterval(gameInterval);
    gameRunning = false;
    startButton.textContent = "Play Again";
  }

  // Event listeners
  startButton.addEventListener("click", function () {
    if (!gameRunning) {
      init();
      startButton.textContent = "Restart";
    }
  });

  // Keyboard controls
  document.addEventListener("keydown", function (e) {
    switch (e.key) {
      case "ArrowUp":
        if (direction !== "down") {
          nextDirection = "up";
        }
        break;
      case "ArrowDown":
        if (direction !== "up") {
          nextDirection = "down";
        }
        break;
      case "ArrowLeft":
        if (direction !== "right") {
          nextDirection = "left";
        }
        break;
      case "ArrowRight":
        if (direction !== "left") {
          nextDirection = "right";
        }
        break;
    }
  });

  // Initial draw
  draw();
});
