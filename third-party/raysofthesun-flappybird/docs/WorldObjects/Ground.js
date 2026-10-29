/**
 * The game world's in-game lower boundary.s
 * @class Ground
 */
class Ground {
    // Initializes a new instance of the Ground class
    constructor() {
        this.offset = 100;

        this.xCoordinate = 0;
        this.yCoordinate = innerHeight - this.offset;
        this.width = innerWidth;
        this.height = this.offset;

        this.sprite = new Sprite("res/Images/ground.png");
    }

    // Draws the ground onto the specified canvas or surface
    toCanvas() {
        this.sprite.toCanvas(this.xCoordinate, this.yCoordinate, 
            this.height, this.width);
    }
}