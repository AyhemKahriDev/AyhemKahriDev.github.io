/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

// levels
var level1=[
	[1,0,1,0,1,0,1,0,1,0],
	[0,1,0,1,0,1,0,1,0,1],//20
	[1,0,1,0,1,0,1,0,1,0],
	[0,1,0,1,0,1,0,1,0,1]];

var level2=[
	[1,1,1,1,1,1,1,1,1,1],
	[0,0,0,0,1,1,0,0,0,0],//24
	[0,0,0,0,1,1,0,0,0,0],
	[1,1,1,1,1,1,1,1,1,1]];

var level3=[
	[1,0,0,1,0,0,1,0,0,1],
	[1,1,0,1,0,1,1,1,0,1],
	[1,0,1,1,1,0,1,0,1,1],//22
	[1,0,0,1,0,0,1,0,0,1]];

var level4=[
	[1,1,1,1,1,1,1,1,1,1],
	[0,1,1,1,1,1,1,1,1,0],//28
	[0,0,1,1,1,1,1,1,0,0],
	[0,0,0,1,1,1,1,0,0,0]];

var level5=[
	[0,0,0,1,1,1,1,0,0,0],
	[1,1,1,1,1,1,1,1,1,1],//26
	[0,0,0,1,1,1,1,0,0,0],
    [0,1,1,1,1,1,1,1,1,0]];

var level6=[
	[1,1,0,0,0,0,0,0,1,1],
	[0,0,1,1,0,0,1,1,0,0],
	[0,0,0,0,1,1,0,0,0,0],//18
	[0,0,1,1,0,0,1,1,0,0],
	[1,1,0,0,0,0,0,0,1,1]];




var canvas = document.getElementById("game_canvas");
var ctx = canvas.getContext("2d");

var displayScore = document.getElementById("score");
var displayLives = document.getElementById("lives");
var displayLevel = document.getElementById("level");



var score = 0;
var lives = 3;
var intervalset = 7;
var paused = false;
var resume = false;

document.addEventListener("keydown", keyDownEventHandler, false);
document.addEventListener("keyup", keyUpEventHandler, false);
document.addEventListener("mousemove", mouseMoveEventHandler, false);

var x = Math.floor(canvas.width/2);
var y = canvas.height - 30;

var ballRadius = 10;

var paddleHeight = 20;
var paddleWidth = 75;
var visibleWidth = paddleWidth  - 5;
var visibleHeight = 10;

var slopeBall;
var slopePaddle;


var brickHeight = 20;
var brickPadding = 10;
var brickOffsetTop = 30;
var brickOffsetLeft = 30;
var brickRowCount = 4;
var brickColumnCount = 10;
var brickWidth = Math.floor((canvas.width - brickOffsetLeft - brickColumnCount* brickPadding)/brickColumnCount);


var totalBrickCount=20;
var brickCount = 0;
var level = 1;
var maxLevel = 6;

var bugMode = false;

var bricks = [];
for(var i = 0; i < brickColumnCount; i++) {
    bricks[i] = [];
    for(var j = 0; j < brickRowCount; j++) {
        bricks[i][j] = { x:0, y:0, status:1};
        bricks[i][j].status = Math.floor(level1[j][i]);
    }
}

var interval = setInterval(handleInput, intervalset);

var dx = 1;
var dy = -1;

var paddleX = (canvas.width - paddleWidth)/2;
var paddleY = (canvas.height - paddleHeight);

var moveRight = false;
var moveLeft = false;

function drawBrick() {
    for(var i = 0; i < brickColumnCount; i++) {
        for(var j = 0; j < brickRowCount ; j++) {
            if (bricks[i][j].status === 1) {
                var brickX = (i*(brickWidth+brickPadding))+brickOffsetLeft;
                var brickY = (j*(brickHeight+brickPadding))+brickOffsetTop;
                bricks[i][j].x = brickX;
                bricks[i][j].y = brickY;
                ctx.beginPath();
                ctx.rect(brickX, brickY, brickWidth, brickHeight);
                ctx.fillStyle = "#ff7272";
                ctx.fill();
                ctx.closePath();
            }
        }
    }
}

function redrawBricks() {
	for(var i = 0; i < brickColumnCount; i++) {
    	bricks[i] = [];
        for(var j = 0; j < brickRowCount; j++) {
            bricks[i][j] = { x:0, y:0, status:1};
            switch(level) {
                case 1:
                    bricks[i][j].status = Math.floor(level1[j][i]);
                    totalBrickCount=20;
                    break;
                case 2:
                    bricks[i][j].status = Math.floor(level2[j][i]);
                    totalBrickCount=24;
                    break;
                case 3:
                    bricks[i][j].status = Math.floor(level3[j][i]);
                    totalBrickCount=22;
                    break;
                case 4:
                    bricks[i][j].status = Math.floor(level4[j][i]);
                    totalBrickCount=28;
                    break;
                case 5:
                    bricks[i][j].status = Math.floor(level5[j][i]);
                    totalBrickCount=26;
                    break;
                case 6:
                    bricks[i][j].status = Math.floor(level6[j][i]);
                    totalBrickCount=18;
                    brickRowCount = 5;
                    break;
            }
        }
    }

	for(var i = 0; i < brickColumnCount; i++) {
        for(var j = 0; j < brickRowCount ; j++) {
        	if (status === 1) {
	            var brickX = (i*(brickWidth+brickPadding))+brickOffsetLeft;
	            var brickY = (j*(brickHeight+brickPadding))+brickOffsetTop;
	            bricks[i][j].x = brickX;
	            bricks[i][j].y = brickY;
	            ctx.beginPath();
	            ctx.rect(brickX, brickY, brickWidth, brickHeight);
	            ctx.fillStyle = "#0095DD";
	            ctx.fill();
	            ctx.closePath();
        	}
        }
    }
}

function drawBall() {
    ctx.beginPath();
    ctx.arc(x, y, ballRadius, 0, Math.PI*2);
    ctx.fillStyle = "#ceffe9";
    ctx.fill();
    ctx.closePath();
}

function drawPaddle() {
    ctx.beginPath();
    ctx.rect(paddleX, paddleY, visibleWidth, visibleHeight);
    ctx.fillStyle = "#0095DD";
    ctx.fill();
    ctx.closePath();
}

function detectCollision() {
    for(var i = 0; i < brickColumnCount; i++) {
        for(var j = 0; j < brickRowCount ; j++) {
            var brick = bricks[i][j];
            if (brick.status === 1) {
            	if (x>brick.x - ballRadius && x<brick.x+brickWidth+ballRadius && y>brick.y - ballRadius && y<brick.y+brickHeight+ballRadius) {
	                if (x>brick.x && x<brick.x+brickWidth) {
	                    if (y>brick.y-ballRadius || y<brick.y+brickHeight+ballRadius) {
	                    		dy = -dy;
	                    		checkIfGameOver(brick);
	                    } 
	                } else if (y>brick.y && y<brick.y+brickHeight) {
	                	if (x>brick.x-ballRadius && x<brick.x+brickWidth+ballRadius) {
	                    		dx = -dx;
	                    		checkIfGameOver(brick);
	                    }
	                } else if (diagonalCondition(brick)){
	                		dx = -dx;
	                		dy = -dy;
	                		checkIfGameOver(brick);
	                	}
	            	}
	        	}
        }
    }
}

function diagonalCondition(brick){
	if (x <= brick.x && y <= brick.y && dx>0 && dy>0) {
		return true;
	} else if (x <= brick.x && y >= brick.y + brickHeight && dx>0 && dy<0) {
		return true;
	} else if (x >= brick.x + brickWidth && y >= brick.y+ brickHeight && dx<0 && dy<0) {
		return true;
	} else if (x >= brick.x +brickWidth && y <= brick.y && dx<0 && dy>0) {
		return true;
	}
	return false;
}

function checkIfGameOver(brick) {
	brick.status = 0;
	score++;
	brickCount++;
                    if(brickCount === totalBrickCount) {
                    	if (level === maxLevel) {
                    		navigateToGameOver(1);
                                clearInterval(interval);
                    	}
                    	revertBackToNormal();
                        intervalset -= 1;
                        clearInterval(interval);
                        interval = setInterval(draw, intervalset);
                        level++;
                        brickCount = 0;
                        redrawBricks(level);
	}
}

function revertBackToNormal() {
    paused = true;
    x = paddleX + Math.floor(paddleWidth / 2);
	y = paddleY- ballRadius;
	dx = 1;
	dy = -1;
}

function pause() {
	if (resume) {
		clearInterval(interval);
		 interval = setInterval(draw, intervalset);
		 resume = false;
	}else if (paused) {
		ctx.font = "30px Arial";
		ctx.textAlign = "center";
		ctx.fillText("Press space to continue.", canvas.width/2, canvas.height/2 + 30);
		clearInterval(interval);
		interval = setInterval(pause, intervalset);
	}
}

function drawScore() {
    displayScore.innerHTML = "Score: " + score;
}

function drawLives() {
    displayLives.innerHTML = "Lives: " + lives;
}

function drawLevel() {
    displayLevel.innerHTML = "Level: " + level;
}

function paddleDynamics(){
        // bounce off on paddle
    var db = x - slopeBall;
    var dp = paddleX-  slopePaddle;
    if(dp*db < 0) {
        dx = 0.577*dx;  //30 degree phase shif
    }else if(dp*db > 0) {
        dx = 1.732*dx;
    }   
}

function diagonalConditionPaddle(){
	if (x <= paddleX && y <= paddleY) {
		return true;
	} else if (x <= paddleX && y >= paddleY + paddleHeight) {
		return true;
	} else if (x >= paddleX + paddleWidth && y >= paddleY+ paddleHeight) {
		return true;
	} else if (x >= paddleX +paddleWidth && y <= paddleY) {
		return true;
	}
	return false;
}

function handleFloorHit() {
	if (x>paddleX - ballRadius && x<paddleX+paddleWidth+ballRadius && y>paddleY - ballRadius && y<paddleY+paddleHeight+ballRadius) {
	        if (x>paddleX && x<paddleX+paddleWidth) {
	            if (y>paddleY-ballRadius || y<paddleY+paddleHeight+ballRadius) {
	            	dy = -dy;
	            	return true;
	          }
	        } else if (y>paddleY && y<paddleY+paddleHeight) {
	           if (x>paddleX-ballRadius && x<paddleX+paddleWidth+ballRadius) {
                        dx = -dx;
                        return true;
                    }
		} else if(diagonalConditionPaddle()) {
			dx = -dx;
			dy = -dy;
			return true;
		}
    }
    return false;
}

function draw() {
    var paddleExt = (ballRadius/Math.sqrt(2));
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawBall();
    drawPaddle();
    drawBrick();
    detectCollision();
    drawScore();
    drawLives();
    drawLevel();
    pause();
    
    
    if (y === canvas.height - paddleHeight- 2*ballRadius) {
    	slopeBall = x; // incoming direction
        slopePaddle = paddleX ; // initial position paddle
        
    }

    if (x > canvas.width-ballRadius || x < ballRadius) {
        dx = -dx;
    }
    if (y < ballRadius) {
        dy = -dy;
    }
    if (y > canvas.height-ballRadius- paddleHeight){
        if(!handleFloorHit()) {
            if (y > canvas.height - paddleHeight) {
                if (lives > 1) {
                    lives--;
                    revertBackToNormal();
            	} else {
                    navigateToGameOver(0);
                    clearInterval(interval);
            	}
            } else {
                bugMode = true;
            }
        } else {
            if(bugMode) {
                if (lives > 1) {
                    lives--;
                    y = canvas.height - ballRadius;
                    revertBackToNormal();
            	} else {
                    navigateToGameOver(0);
                    clearInterval(interval);
            	}
                bugMode = false;
            }
        }
    }
    if(moveRight && paddleX < canvas.width - paddleWidth) {
        paddleX += 3;
    } else if(moveLeft && paddleX > 0) {
        paddleX -= 3;
    }
    x += dx;
    y += dy;
}

function keyDownEventHandler(e) {
    if (e.key === "Right" || e.key === "ArrowRight") {
        moveRight = true;
    } else if (e.key === "Left" || e.key === "ArrowLeft"){
        moveLeft = true;
    }
}

function keyUpEventHandler(e) {
    if (e.key === "Right" || e.key === "ArrowRight") {
        moveRight = false;
    } else if (e.key === "Left" || e.key === "ArrowLeft"){
        moveLeft = false;
    }  else if (e.keyCode === 32) {
    	if (paused) {
    		resume = true;
    		paused = false;
    	} else {
    		paused = true;
    	}

    } else if (e.keyCode = 13) {
    	window.location.href = "homepage.html";
    }
}

function mouseMoveEventHandler(e) {
	var relativeX = e.clientX - canvas.offsetLeft;
	if (relativeX>0 && relativeX<canvas.width) {
		paddleX = relativeX - paddleWidth/2;
	}
}

function handleInput() {
    
	var queryString = decodeURIComponent(window.location.search);
	var currLevel = queryString.substring(1);
	if (currLevel == 0) {
		clearInterval(interval);
		interval = setInterval(draw, intervalset);
                
	} else {
		level = Math.floor(currLevel);
		maxLevel = Math.floor(currLevel);
                redrawBricks();
		clearInterval(interval);
		interval = setInterval(draw, intervalset);
	}
}

function navigateToGameOver(value) {
    window.location.href = "gameOver.html?" + value +"&"+score;
}


