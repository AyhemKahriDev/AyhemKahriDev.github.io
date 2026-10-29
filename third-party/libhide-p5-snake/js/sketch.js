'use strict';

var snake;
var scl = 20;
var food;
var highScore = 0;

function setup() {
  createCanvas(600, 600);
  snake = new Snake();
  frameRate(10);
  pickLocation();
  textSize(14);
}

function pickLocation() {
    var cols = floor(width / scl);
    var rows = floor(height / scl);
    var randX = floor(random(cols));
    var randY = floor(random(rows));
    food = createVector(randX, randY);
    food.mult(scl);
}

function draw() {
    background(51);

    if (snake.eat(food)) {
        pickLocation();
    }

    snake.death();
    snake.update();
    snake.show();

    fill(255, 0, 100);
    rect(food.x, food.y, scl, scl);

    if (snake.gameIsOver) {
        text("Game over. Press a direction to restart!", width - 260, 25);
    } else {
        text("Score: " + snake.total, width - 70, 25);
    }
    text("High Score: " + highScore, width - 102, 50);
}

function keyPressed() {
    if (keyCode === UP_ARROW) {
        snake.dir(0, -1);
    } else if (keyCode === DOWN_ARROW) {
        snake.dir(0, 1);
    } else if (keyCode === RIGHT_ARROW) {
        snake.dir(1, 0);
    } else if (keyCode === LEFT_ARROW) {
        snake.dir(-1, 0);
    }
}
