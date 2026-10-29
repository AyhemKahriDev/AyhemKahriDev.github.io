'use strict'

console.log("This is Pong!");

//Var & Const
var canvas;
var canvasContext;
var ballX = 50;
var ballY = 50;
var ballSpeedX = 10;
var ballSpeedY = 4;

var player1Score = 0;
var player2Score = 0;
const WINNING_SCORE = 3;

var showingWinScreen = false;

var paddle1Y = 250;
var paddle2Y = 250;
const PADDLE_HEIGHT = 100;
const PADDLE_WIDTH = 20;
const BALL_RAD = 20;

//Mouse position
function calculateMousePos(evt){
    var rect = canvas.getBoundingClientRect();
    var root = document.documentElement;
    var mouseX = evt.clientX - rect.left - root.scrollLeft;
    var mouseY = evt.clientY - rect.top - root.scrollTop;
    return{
        x: mouseX,
        y: mouseY
    };
}

//Load
function handleMouseClick(evt){
    if(showingWinScreen){
        player1Score = 0;
        player2Score = 0;
        showingWinScreen = false;
    }
}

window.onload = function(){
    canvas = document.getElementById("gameCanvas");
    canvasContext = canvas.getContext("2d");
    canvasContext.font = "30px Helvetica";

    var framesPerSecond = 30;
    setInterval(function(){
        moveEverything();
        drawEverything();
    }, 1000/framesPerSecond);

    canvas.addEventListener("mousedown", handleMouseClick);

    canvas.addEventListener('mousemove', function(evt){
        var mousePos = calculateMousePos(evt);
        paddle1Y = mousePos.y-(PADDLE_HEIGHT/2);
    });
}

//Ball Reset
function ballReset(){
    if(player1Score >= WINNING_SCORE ||
        player2Score >= WINNING_SCORE){
            showingWinScreen = true;
        }

    ballSpeedX = -ballSpeedX;
    ballX = canvas.width/2;
    ballY = canvas.height/2;
}

//AI Computer
function computerMovement(){
    var paddle2YCenter = paddle2Y + (PADDLE_HEIGHT/2);
    if(paddle2YCenter < ballY-35){
        paddle2Y += 6;
    }else if(paddle2YCenter > ballY+35){
        paddle2Y -= 6;
    }
}

//Movement
function moveEverything(){
    if(showingWinScreen){
        return;
    }

    computerMovement();
    ballX += ballSpeedX;
    ballY += ballSpeedY;

    if(ballX < 0){
        if(ballY > paddle1Y &&
            ballY < paddle1Y+PADDLE_HEIGHT){
                ballSpeedX = -ballSpeedX;
                var deltaY = ballY-(paddle1Y+PADDLE_HEIGHT/2);
                ballSpeedY = deltaY * 0.35;

            }else{
                player2Score++; //Must be before the reset
                ballReset();
            }
    }

    if(ballX > canvas.width){
        if(ballY > paddle2Y &&
            ballY < paddle2Y+PADDLE_HEIGHT){
                ballSpeedX = -ballSpeedX;
                var deltaY = ballY-(paddle2Y+PADDLE_HEIGHT/2);
                ballSpeedY = deltaY * 0.35;
            }else{
                player1Score++; //Must be before the reset
                ballReset();
            }
    }
    if(ballY < 0){
        ballSpeedY = -ballSpeedY;
    }
    if(ballY > canvas.height){
        ballSpeedY = -ballSpeedY;
    }
}

//Element Draw
function drawNet(){
    for(var i=0; i<canvas.height; i+=40){
        colorRect(canvas.width/2-1, i, 2, 20,'white');
    }
}

function drawEverything(){
    //Black screen
    colorRect(0,0,canvas.width,canvas.height,'black');

    if(showingWinScreen){
        canvasContext.fillStyle = "white";

        if(player1Score >= WINNING_SCORE){
            canvasContext.fillText("You won!", 320,200);
        } else if(player2Score >= WINNING_SCORE){
            canvasContext.fillText("You loose!", 320,200);
        }

        canvasContext.fillText("Click to Continue", 280,500);
        return;
    }

    //Net
    drawNet();

    //Left player paddle
    colorRect(0,paddle1Y,PADDLE_WIDTH,PADDLE_HEIGHT, 'white');
    //Right paddle
    colorRect(canvas.width-PADDLE_WIDTH,paddle2Y,PADDLE_WIDTH,PADDLE_HEIGHT, 'white');
    //Ball
    colorRect(ballX, ballY, BALL_RAD, BALL_RAD, 'white');

    canvasContext.fillText(player1Score, 100,100);
    canvasContext.fillText(player2Score, canvas.width-100,100);
}

//Color Fill
function colorRect(leftX, topY, width, height, drawColor){
    canvasContext.fillStyle = drawColor;
    canvasContext.fillRect(leftX, topY, width, height);
}