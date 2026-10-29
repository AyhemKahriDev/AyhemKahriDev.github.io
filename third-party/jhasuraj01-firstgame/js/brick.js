class Brick {
    constructor(game, position) {
        this.gameWidth = game.gameWidth;
        this.gameHeight = game.gameHeight;
        this.game = game;

        this.svg_brick = document.getElementById('svg-brick');
        
        this.position = position;
        this.width = 80;
        this.height = 30;

        this.deletion_mark = false;
    }
    update(deltaTime) {
        if(detectCollosion(this.game.ball, this)) {
            this.game.ball.speed.y = - this.game.ball.speed.y;
            this.deletion_mark = true;
        }
    }
    draw(deltaTime) {
        ctx.drawImage(this.svg_brick, this.position.x, this.position.y, this.width, this.height);
    }
}