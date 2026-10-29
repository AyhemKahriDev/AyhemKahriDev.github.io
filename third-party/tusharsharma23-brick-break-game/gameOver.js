var queryString = decodeURIComponent(window.location.search);
queryString = queryString.substring(1).split("&");
var st = queryString[0];
var score = queryString[1];

var gameOver = document.getElementById("game_over_part");
if(st == 0) {
    gameOver.innerHTML = "GAME OVER (^_^)";
    document.getElementById("gameStatus").src='images/itsOver.gif';
} else {
    gameOver.innerHTML = "YOU WIN!!!!"
    document.getElementById("gameStatus").src='images/win.gif';
}

var scoreSet = document.getElementById("score_at_end");
scoreSet.innerHTML = score;