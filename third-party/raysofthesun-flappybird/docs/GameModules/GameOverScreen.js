
/**
 * Represents the game's game over screen
 * @class GameOverScreen
 */
class GameOverScreen {

    /**
     * Creates an instance of GameOverScreen.
     * @memberof GameOverScreen
     */
    constructor() {
        this.bronzeMedal = new Sprite("res/Images/bronze.png");
        this.goldMedal = new Sprite("res/Images/gold.png");
        this.platinumMedal = new Sprite("res/Images/platinum.png");
        
        this.title = new Sprite("res/Images/gameOver.png");
        this.board = new Sprite("res/Images/game_over_board.png");

        this.title_xCoordinate = (innerWidth / 4) + 50;
        this.title_yCoordinate = (innerHeight * 0.2179);

        this.board_xCoordinate = (innerWidth / 4) + 20;
        this.board_yCoordinate = (innerHeight / 4) + 120;

        this.score_xCoordinate = (innerWidth / 2) + 190;
        this.score_yCoordinate = (innerHeight / 4) + 235;

        this.medal_xCoordinate = (innerWidth / 4) + 80;
        this.medal_yCoordinate = (innerHeight / 4) + 218;
        this.medalWidth = 90;
        this.medalHeight = 89;

        this.prompt_xCoordinate = (innerWidth / 4) - 70;
        this.prompt_yCoordinate = (innerHeight / 4) + 500; 

        this.offset = 0;
        this.highScoreOffset = 0;
    }

    /**
     * Display the game over screen along with the player's final score.
     * @param {Number} finalScore The player's final score.
     * @memberof GameOverScreen
     */
    play(finalScore) {
        this.board.toCanvas(this.board_xCoordinate, this.board_yCoordinate);
        this.title.toCanvas(this.title_xCoordinate, this.title_yCoordinate);
        this.scoreTextToCanvas(finalScore);
        this.medalToCanvas(finalScore);
        this.promptTextToCanvas();
    }

    /**
     * Render the player's score onto the canvas.
     * @param {Number} finalScore The player's final score.
     * @memberof GameOverScreen
     */
    scoreTextToCanvas(finalScore) {

        this.calculateOffsets(finalScore);
        let highScore = this.getHighScore();

        textSize(50);

        fill(0);
        text(String(finalScore), this.score_xCoordinate - this.offset, 
        this.score_yCoordinate + 5);
        fill(255);
        text(String(finalScore), this.score_xCoordinate - this.offset, 
                this.score_yCoordinate);

        fill(0);
        text(String(highScore), this.score_xCoordinate - this.highScoreOffset, 
        this.score_yCoordinate + 95);
        fill(255);
        text(String(highScore), this.score_xCoordinate - this.highScoreOffset, 
                this.score_yCoordinate + 90);
    }

    /**
     * Draw the medal to be awarded to the player for earning a certain amount of points.
     * @param {Number} finalScore The player's final score.
     * @memberof GameOverScreen
     */
    medalToCanvas(finalScore) {
        if (finalScore >= 20 && finalScore <= 39) {
            this.bronzeMedal.toCanvas(this.medal_xCoordinate, this.medal_yCoordinate,
                this.medalWidth, this.medalHeight);
        }
        else if (finalScore >= 40 && finalScore <= 69) {
            this.goldMedal.toCanvas(this.medal_xCoordinate, this.medal_yCoordinate,
                this.medalWidth, this.medalHeight);
        }
        else if (finalScore >= 70) {
            this.platinumMedal.toCanvas(this.medal_xCoordinate, this.medal_yCoordinate,
                this.medalWidth, this.medalHeight);
        }
    }

    promptTextToCanvas() {
        textSize(50);

        if (frameCount % 60 <= 30) {
            fill(255);
            text("Tap anywhere to play again",this.prompt_xCoordinate, this.prompt_yCoordinate + 5);
            fill("#F09F46");
            text("Tap anywhere to play again", this.prompt_xCoordinate, this.prompt_yCoordinate);
        }
    }

    /**
     * Determines the space to be applied to the score text's x-coordinate.
     * @param {Number} finalScore The player's final score.
     * @returns A Number that represents the value of the offset
     * @memberof GameOverScreen
     */
    calculateTextOffset(finalScore) {
        
        let scoreStrLength = String(finalScore).length;

        let offset = 0;

        if (scoreStrLength == 2) {
            offset = 20;
        }
        else if (scoreStrLength == 3) {
            offset = 40;
        }
        else if (scoreStrLength == 4) {
            offset = 70;
        }

        return offset;
    }

    /**
     * Initializes the variables used by the object to determine the alignmnet of
     * score strings.
     * @param {Number} finalScore The player's final score.
     * @memberof GameOverScreen
     */
    calculateOffsets(finalScore) {
        if(this.offset == 0 && this.highScoreOffset == 0) {
            this.offset = this.calculateTextOffset(finalScore);
            this.highScoreOffset = this.calculateTextOffset(this.getHighScore());
        }
    }

    /**
     * Save the player's high score to a cookie
     * @param {Number} finalScore The player's final score.
     * @memberof GameOverScreen
     */
    recordScore(finalScore) {
        if (this.getHighScore() < finalScore) {
            docCookies.setItem("score", finalScore, this.maxAgeToGMT(150));
        }
    }

    /**
     * Retrieve the player's current high score.
     * @returns A number representing the player's high score if it is available.
     * A 0 (zero) is returned otherwise.
     * @memberof GameOverScreen
     */
    getHighScore() {
        if (docCookies.getItem("score") != null) {
            return docCookies.getItem("score"); 
        }

        return 0;
    }
    
    /**
     * Create a GMT string from a given age.
     * @param {Number} nMaxAge The desired maximum age.
     * @returns A GMT date in string representation relative to the given age.
     * @memberof GameOverScreen
     */
    maxAgeToGMT (nMaxAge) {
        return nMaxAge === Infinity ? "Fri, 31 Dec 9999 23:59:59 GMT" : 
            (new Date(nMaxAge * 1e3 + Date.now())).toUTCString();
    }

    /**
     * Reinitializes the variables that are used by the object to determine the alignment
     * of score strings.
     * @memberof GameOverScreen
     */
    reset() {
        this.offset = 0;
        this.highScoreOffset = 0;
    }
}