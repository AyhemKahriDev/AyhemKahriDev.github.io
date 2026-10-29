const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const scoreText = document.getElementById("score");

let box = 20;
let snake = [{x: 200, y: 200}];
let direction = "RIGHT";
let food = randomFood();
let score = 0;

document.addEventListener("keydown", changeDirection);

function changeDirection(e) {
  if (e.key === "ArrowUp" && direction !== "DOWN") direction = "UP";
  else if (e.key === "ArrowDown" && direction !== "UP") direction = "DOWN";
  else if (e.key === "ArrowLeft" && direction !== "RIGHT") direction = "LEFT";
  else if (e.key === "ArrowRight" && direction !== "LEFT") direction = "RIGHT";
}

function randomFood() {
  return {
    x: Math.floor(Math.random() * 20) * box,
    y: Math.floor(Math.random() * 20) * box
  };
}

function draw() {
  ctx.fillStyle = "#161b22";
  ctx.fillRect(0, 0, 400, 400);

  // draw food
  ctx.fillStyle = "#ff7b72";
  ctx.fillRect(food.x, food.y, box, box);

  // move snake
  let head = {...snake[0]};
  if (direction === "UP") head.y -= box;
  if (direction === "DOWN") head.y += box;
  if (direction === "LEFT") head.x -= box;
  if (direction === "RIGHT") head.x += box;

  // collision detection
  if (
    head.x < 0 || head.x >= 400 || head.y < 0 || head.y >= 400 ||
    snake.some(seg => seg.x === head.x && seg.y === head.y)
  ) {
    alert("Game Over! Score: " + score);
    snake = [{x:200,y:200}];
    direction = "RIGHT";
    score = 0;
    food = randomFood();
    return;
  }

  snake.unshift(head);

  if (head.x === food.x && head.y === food.y) {
    score++;
    food = randomFood();
    scoreText.textContent = "Score: " + score;
  } else {
    snake.pop();
  }

  // draw snake
  ctx.fillStyle = "#58a6ff";
  snake.forEach(s => ctx.fillRect(s.x, s.y, box-1, box-1));
}

setInterval(draw, 100);
