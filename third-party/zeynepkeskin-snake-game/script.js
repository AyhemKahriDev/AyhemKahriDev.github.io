//img
let bodyImg = new Image, headImg = new Image, appleImg = new Image, count = 0;
bodyImg.src = "img/body.png";
headImg.src = "img/head.png";
appleImg.src = "img/apple.png";
//img

let canvas, ctx, width, height, blockSize, widthInBlocks, heightInBlocks;

// Set score to 0
let score = 0;

function resetSize() {
    canvas = document.querySelector(".canvas");
    canvas.width = $('body').width()
    canvas.height = $('body').height()
    ctx = canvas.getContext("2d");

    // Get the width and height from the canvas element
    width = canvas.width;
    height = canvas.height;

    // the width and height in blocks
    if(canvas.width > canvas.height){
        blockSize = height / 30;
        widthInBlocks = Math.ceil(width / blockSize);
        heightInBlocks = Math.ceil(height / blockSize);
    }
   else if(canvas.height > canvas.width){
    blockSize = height / 45;
    widthInBlocks = Math.ceil(width / blockSize);
    heightInBlocks = Math.ceil(height / blockSize);
   }
   else{
    blockSize = height / 40;
    widthInBlocks = Math.ceil(width / blockSize);
    heightInBlocks = Math.ceil(height / blockSize);
   }
}
resetSize();
$(window).resize(resetSize)

// Draw the border
let drawBorder = function () {
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, width, blockSize);
    ctx.fillRect(0, height - blockSize, width, blockSize);
    ctx.fillRect(0, 0, blockSize, height);
    ctx.fillRect(width - blockSize, 0, blockSize, height);
};

// Draw the score in the top-left corner
let drawScore = function () {
    ctx.font = "20px Courier";
    ctx.fillStyle = "Black";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("Score: " + score, blockSize, blockSize);
};



// Stop the interval and show Game Over 
let gameOver = function () {
    clearInterval(intervalId);
    gameOverText()
    document.getElementById("player").pause();
    document.getElementById("lose").play();
};
function gameOverText() {
    document.querySelector("#gameOver").style.visibility = "visible";
    document.querySelector("#playAgain").style.visibility = "visible";
}
function restart() {
    document.getElementById("button").play();
    setTimeout(function () { location.reload() }, 100);
}

// The Block constructor
let Block = function (col, row) {
    this.col = col;
    this.row = row;
};

Block.prototype.drawImage = function (i) {
    let x = this.col * blockSize;
    let y = this.row * blockSize;
    if (i === true) {
        ctx.drawImage(headImg, x, y, blockSize, blockSize);
    }
    else if (i === "apple") {
        ctx.drawImage(appleImg, x, y, blockSize, blockSize);
    }
    else {
        ctx.drawImage(bodyImg, x, y, blockSize, blockSize);
    }


};

// Draw a circle at the block's location
Block.prototype.drawCircle = function (color) {
    let centerX = this.col * blockSize + blockSize / 2;
    let centerY = this.row * blockSize + blockSize / 2;
    ctx.fillStyle = color;
    circle(centerX, centerY, blockSize / 2, true);
};

// Check if this block is in the same location as another block
Block.prototype.equal = function (otherBlock) {
    return this.col === otherBlock.col && this.row === otherBlock.row;
};

// The Snake constructor
let Snake = function () {
    this.segments = [
        new Block(7, 5),
        new Block(6, 5),
        new Block(5, 5)
    ];
    this.direction = "right";
    this.nextDirection = "right";
};

// Draw a square for each segment of the snake's body
Snake.prototype.draw = function () {
    for (let i = 0; i < this.segments.length; i++) {
        if (i === 0) {
            this.segments[i].drawImage(true);
        }
        else if (i % 2 == 0) {
            this.segments[i].drawImage(false);
        }
        else {
            this.segments[i].drawImage(false);
        }
    }
};

// Create a new head and add it to the beginning of
// the snake to move the snake in its current direction
Snake.prototype.move = function () {
    let head = this.segments[0];
    let newHead;
    this.direction = this.nextDirection;
    if (this.direction === "right") {
        newHead = new Block(head.col + 1, head.row);
    } else if (this.direction === "down") {
        newHead = new Block(head.col, head.row + 1);
    } else if (this.direction === "left") {
        newHead = new Block(head.col - 1, head.row);
    } else if (this.direction === "up") {
        newHead = new Block(head.col, head.row - 1);
    }
    if (this.checkCollision(newHead)) {
        gameOver();
        return;
    }
    this.segments.unshift(newHead);
    if (newHead.equal(apple.position)) {
        score++;
        apple.move();
    } else {
        this.segments.pop();
    }
};
// Check if the snake's new head has collided with the wall or itself
Snake.prototype.checkCollision = function (head) {
    let leftCollision = (head.col === 0);
    let topCollision = (head.row === 0);
    let rightCollision = (head.col === widthInBlocks - 1);
    let bottomCollision = (head.row === heightInBlocks - 1);
    let wallCollision = leftCollision || topCollision ||
        rightCollision || bottomCollision;
    let selfCollision = false;

    for (let i = 0; i < this.segments.length; i++) {
        if (head.equal(this.segments[i])) {
            selfCollision = true;
        }
    }
    return wallCollision || selfCollision;

};


// Set the snake's next direction based on the keyboard
Snake.prototype.setDirection = function (newDirection) {
    if (this.direction === "up" && newDirection === "down") {
        return;
    } else if (this.direction === "right" && newDirection === "left") {
        return;
    } else if (this.direction === "down" && newDirection === "up") {
        return;
    } else if (this.direction === "left" && newDirection === "right") {
        return;
    }
    this.nextDirection = newDirection;
};

// The Apple constructor
let Apple = function () {
    this.position = new Block(10, 10);
};

// Draw a circle at the apple's location
Apple.prototype.draw = function () {
    this.position.drawImage("apple");
};

// Move the apple to a new random location
Apple.prototype.move = function () {
    let randomCol = Math.floor(Math.random() * (widthInBlocks - 2)) + 1;
    let randomRow = Math.floor(Math.random() * (heightInBlocks - 2)) + 1;
    for (let i = 0; i < snake.segments.length; i++) {
        if (randomCol == snake.col && randomRow == snake.row) {
            randomCol += 5;
            randomRow += 5;
            this.position = new Block(randomCol, randomRow);
            document.getElementById("bite").play();
            return
        }
        else {
            this.position = new Block(randomCol, randomRow);
            document.getElementById("bite").play();
            return;
        }
    }
};

// Create the snake and apple objects
let snake = new Snake();
let apple = new Apple();


// Pass an animation function to setInterval
let intervalId = 0;
function gameStart() {
    document.getElementById("button").play();
    document.getElementById("player").play();
    document.getElementById("start-btn").style.display = "none";
    intervalId = setInterval(function () {
        ctx.clearRect(0, 0, width, height);
        drawScore();
        snake.move();
        snake.draw();
        apple.draw();
        drawBorder();

    }, 100);
}


// Convert keycodes to directions
let directions = {
    37: "left",
    38: "up",
    39: "right",
    40: "down"
};

// The keydown handler for handling direction key presses
$("body").keydown(function (event) {
    let newDirection = directions[event.keyCode];
    if (newDirection !== undefined) {
        snake.setDirection(newDirection);
    }
});



//gestures


$(function () {
    var $pad = $(".canvas");
    $pad.touch({
        // Turn on document tracking so stuff works even if the cursor leaves the trackpad.
        trackDocument: true,

        // Normalize coordinates when/if the cursor leaves the trackpad.
        trackDocumentNormalize: true,

        // Prevent default events for drag/swipe (so the page doesn't scroll when you do those gestures).
        preventDefault: {
          drag: true,
          swipe: true,
        },
      })

      // Swipe events.
      .on("swipeUp", function (e, o) {
        let newDirection = directions[38];
            snake.setDirection(newDirection);
      })
      .on("swipeDown", function (e, o) {
        let newDirection = directions[40];
        snake.setDirection(newDirection);
      })
      .on("swipeLeft", function (e, o) {
        let newDirection = directions[37];
        snake.setDirection(newDirection);
      })
      .on("swipeRight", function (e, o) {
        let newDirection = directions[39];
        snake.setDirection(newDirection);
      });
  });



