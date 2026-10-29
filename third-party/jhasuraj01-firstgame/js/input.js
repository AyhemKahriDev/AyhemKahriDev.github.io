class InputHandler {
    constructor(paddle, game) {
        document.addEventListener('keydown', event => {
            switch (event.keyCode) {
                case 37: // left arrow
                    paddle.moveLeft();
                    break;
                case 39: // right Arrow
                    paddle.moveRight();
                    break;
                case 80: // p button
                    game.togglePause();
                    break;
                case 32: //spacebar
                    game.start();
                    break;
            }
        });
        document.addEventListener('keyup', event => {
            switch (event.keyCode) {
                case 37:
                    if (paddle.speed < 0) paddle.stop();
                    break;
                case 39:
                    if (paddle.speed > 0) paddle.stop();
                    break;
            }
        });
    }
}