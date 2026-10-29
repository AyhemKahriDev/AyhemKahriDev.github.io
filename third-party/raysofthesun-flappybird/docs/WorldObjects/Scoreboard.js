/**
 * Represents the player's score in the game
 * @class Scoreboard
 */
class Scoreboard {
    /**
     * Creates an instance of Scoreboard.
     * @memberof Scoreboard
     */
    constructor() {
        this.xCoordinate = innerWidth / 2;
        this.yCoordinate = innerHeight * 0.125;
        this.offset = 15;        
        this.scoreLength = 0;
        
        this.sound = loadSound("res/sounds/sfx_point.wav");
    }

    /**
     * Renders the player's score onto the canvas.
     * @param {Number} score The player's running score in the game.
     * @memberof Scoreboard
     */
    toCanvas(score) {
        let newScoreLength = String(score).length;
        if (newScoreLength > this.scoreLength) {
            this.scoreLength = newScoreLength;
            this.xCoordinate -= 15;
        }
        
        textSize(100)
        fill(0);
        text(`${score}`, this.xCoordinate, this.yCoordinate + 5);
        fill(255);
        text(`${score}`, this.xCoordinate, this.yCoordinate);
    }

    /**
     * Play a sound.
     * @memberof Scoreboard
     */
    buzz() {
        this.sound.play();
    }
}