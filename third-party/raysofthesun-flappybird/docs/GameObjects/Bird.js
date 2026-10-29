/**
 * Represents FlappyBird in the game world
 *
 * @class Bird
 */
class Bird {
    /**
     * Creates an instance of Bird.
     * @param {Number} ground_offset The height of the ground in the game world.
     * @param {Number} y_coordinate The position of the bird relative to the y-axis.
     * @param {number} [x_coordinate=60] The position of the bird relative to the 
     *                                   x-axis.
     * @memberof Bird
     */
    constructor(ground_offset, y_coordinate, x_coordinate = 60) {
        this.ground_offset = ground_offset;
        this.x_coordinate = x_coordinate;
        this.y_coordinate = y_coordinate;

        this.birdWidth = 55; // Determines the height and width of the bird
        this.pull = -12; // application will result into negative velocity
        this.gravity = 0.6; // the force the pulls the bird downward
        this.velocity = -2; // dictates the speed and direction of the bird

        // The bird should not go over the upper and lower bounds of the canvas
        this.upperLimit = innerHeight / this.birdWidth;
        this.lowerLimit = (innerHeight - this.birdWidth) - this.ground_offset;

        this.sprites = [new Sprite("res/Images/bird_wing_down.png"),
            new Sprite("res/Images/bird_wing_up.png")];
        this.flapSound = loadSound("res/sounds/sfx_wing_flap.wav");
        this.deathSound = loadSound("res/sounds/sfx_hit.wav");
        this.deathPlungeSound = loadSound("res/sounds/sfx_die.wav");
        this.sprite = [0];

        this.jumped = false;
        this.isDead = false;
    }

    /**
     * Draws the object's sprite onto the canvas.
     * @memberof Bird
     */
    toCanvas() {

        if (this.jumped) {
            this.fly();
        }
        else {
            this.fall();
        }

        this.updatePosition();

        this.sprite.toCanvas(this.x_coordinate, this.y_coordinate);
    }

    /**
     * Push the bird towards the ground or the lower boundary of the canvas.
     * @memberof Bird
     */
    fall() {
        if (this.y_coordinate != this.lowerLimit) {
            this.velocity += this.gravity;
            this.pull = -10;
        }
    }


    /**
     * Push the bird towards the upper boundary of the canvas.
     * @memberof Bird
     */
    fly() {
        if (this.y_coordinate > this.upperLimit) { 
            this.pull += 2;
            this.velocity += this.pull;
            this.flapSound.play();
        }

        this.jumped = false;
    }


    /**
     * Apply a push or pull force to the bird.
     * @memberof Bird
     */
    updatePosition() {
        this.sprite = frameCount % 60 <= 30 ? this.sprites[1] : 
            this.sprites[0];

        if ((this.y_coordinate <= 1) && (!this.jumped)) {
            this.y_coordinate = this.upperLimit;
            this.velocity = 0;
        }
        else if ((this.y_coordinate >= (innerHeight - this.ground_offset))) {
            this.y_coordinate = this.lowerLimit;
            this.velocity = 0;
        }
        else {
            this.y_coordinate += this.velocity;
        }
    }

    /**
     * Activate the bird object's flight mechanism.
     * @memberof Bird
     */
    jump() {
        this.jumped = isPlayerDead ? false : true;
    }

    /**
     * Let the bird fall to the ground.
     * @memberof Bird
     */
    plunge() {
        this.sprite = this.sprites[0]; 
        bird.toCanvas();
    }

    /**
     * Reinitializes the bird's x and y coordinates.
     * @memberof Bird
     */
    reset() {
        this.x_coordinate = 60;
        this.y_coordinate = innerHeight / 2;
    }
}