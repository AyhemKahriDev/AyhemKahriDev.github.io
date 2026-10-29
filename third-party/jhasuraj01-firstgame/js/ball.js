class Ball {
    constructor(game) {
        this.gameWidth = game.gameWidth;
        this.gameHeight = game.gameHeight;
        this.game = game;
        this.svg_ball = document.getElementById('svg-ball');
        this.speed = { x: 4, y: 2 };
        this.reset();
        this.size = 16;
    }
    reset() {
        this.position = {x: this.gameWidth/2, y: this.gameHeight/2};
    }
    draw(ctx) {
        ctx.drawImage(this.svg_ball, this.position.x, this.position.y, this.size, this.size);
    }
    update(deltaTime) {
        this.position.x += this.speed.x;
        this.position.y += this.speed.y;

        // check collision with left and right wall
        if(this.position.x < 0 || this.position.x > this.gameWidth - this.size) this.speed.x = - this.speed.x;
        // check collision with top wall
        if(this.position.y < 0) this.speed.y = - this.speed.y;

        // check collision with bottom wall
        if(this.position.y > this.gameHeight - this.size) {
            this.game.lives--;
            this.reset();
        }

        if(detectCollosion(this, this.game.paddle)) {
            this.speed.y = - this.speed.y;
            this.position.y = this.game.paddle.position.y - this.size;
        }
    }
}