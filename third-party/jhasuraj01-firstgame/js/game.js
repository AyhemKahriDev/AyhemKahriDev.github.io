const GAMESTATE = {
    PAUSED: 0,
    RUNNING: 1,
    MENU: 2,
    GAMEOVER: 3,
    WON_LEVEL: 4
};
class Game {
    constructor(gameWidth, gameHeight) {
        this.gameWidth = gameWidth;
        this.gameHeight = gameHeight;
        this.gamestate = GAMESTATE.MENU;
        this.gameObject = [];
        this.bricks = [];
        this.lives = 3;

        this.levels = [level1, level2];
        this.currentLevel = 0;

        this.ball = new Ball(this);
        this.paddle = new Paddle(this);
        new InputHandler(this.paddle, this);
    }
    start() {
        if(this.gamestate !== GAMESTATE.MENU && this.gamestate !== GAMESTATE.WON_LEVEL ) return;
        this.gamestate = GAMESTATE.RUNNING;
        this.bricks = buildLevel(this, this.levels[this.currentLevel]);
        this.ball.reset();
        this.gameObject = [this.paddle, this.ball];
    }
    update(deltaTime) {
        if(this.lives === 0) this.gamestate = GAMESTATE.GAMEOVER;
        if(this.gamestate === GAMESTATE.PAUSED || this.gamestate === GAMESTATE.MENU || this.gamestate === GAMESTATE.GAMEOVER) return;

        if (this.bricks.length === 0) {
            this.currentLevel++;
            this.gamestate = GAMESTATE.WON_LEVEL;
            this.start();
        }
        [...this.gameObject, ...this.bricks].forEach((object) => object.update(deltaTime));
        this.bricks = this.bricks.filter(brick => !brick.deletion_mark);
    }
    draw(ctx) {
        [...this.gameObject, ...this.bricks].forEach((object) => object.draw(ctx));

        if(this.gamestate === GAMESTATE.PAUSED) {
            ctx.rect(0,0,this.gameWidth,this.gameHeight);
            ctx.fillStyle = 'rgba(0,0,0,0.3)';
            ctx.fill();

            ctx.font = "30px Arial";
            ctx.fillStyle = "white";
            ctx.textAlign = "center";
            ctx.fillText("Paused", this.gameWidth/2, this.gameHeight/2);
        } else if(this.gamestate === GAMESTATE.MENU) {
            ctx.rect(0,0,this.gameWidth,this.gameHeight);
            ctx.fillStyle = 'rgb(0,0,0)';
            ctx.fill();

            ctx.font = "30px Arial";
            ctx.fillStyle = "white";
            ctx.textAlign = "center";
            ctx.fillText("press spacebar to start the game", this.gameWidth/2, this.gameHeight/2);
        } else if(this.gamestate === GAMESTATE.GAMEOVER) {
            ctx.rect(0,0,this.gameWidth,this.gameHeight);
            ctx.fillStyle = 'rgb(0,0,0)';
            ctx.fill();

            ctx.font = "30px Arial";
            ctx.fillStyle = "white";
            ctx.textAlign = "center";
            ctx.fillText("Game Over", this.gameWidth/2, this.gameHeight/2);
        }
    }
    togglePause() {
        if(this.gamestate == GAMESTATE.RUNNING) {
            this.gamestate = GAMESTATE.PAUSED;
        } else {
            this.gamestate = GAMESTATE.RUNNING;
        }
    }
}