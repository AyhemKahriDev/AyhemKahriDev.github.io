/**
 * The game world's background.
 * @class Backdrop
 */
class Backdrop {
    /**
     * Creates an instance of Backdrop.
     * @param {Number} ground_offset The height of the game world's ground
     * @memberof Backdrop
     */
    constructor(ground_offset) {
        this.offset = ground_offset;
        this.sprite = new Sprite("res/Images/background.png");
        
        this.xCoordinate = 0;
        this.yCoordinate = innerHeight - (this.offset*4);
    }

    /**
     * Draws the object's sprite onto the canvas.
     * @memberof Backdrop
     */
    toCanvas() {
        this.sprite.toCanvas(this.xCoordinate, this.yCoordinate);
    }
}