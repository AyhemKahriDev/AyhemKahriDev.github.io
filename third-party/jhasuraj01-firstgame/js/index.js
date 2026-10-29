let canvas = document.getElementById('gameScreen');
let ctx = canvas.getContext('2d');

const GAME_WIDTH = canvas.width;
const GAME_HEIGHT = canvas.height;

ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
let game = new Game(GAME_WIDTH, GAME_HEIGHT);

let lastTime = 0;
let gameLoop = (timeStamp) => {
    let deltaTime = timeStamp - lastTime;
    lastTime = timeStamp;

    ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    game.update(deltaTime);
    game.draw(ctx);

    // call the function gameLoop when next frame is ready;
    requestAnimationFrame(gameLoop);
}
requestAnimationFrame(gameLoop);
