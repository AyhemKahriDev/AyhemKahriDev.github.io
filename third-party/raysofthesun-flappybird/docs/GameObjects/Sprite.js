/**
 * Represents a 2D image in the game world
 * @class Sprite
 */
class Sprite {

    /**
     * Creates an instance of Sprite.
     * @param {String} pathToImage the relative path to the image used in
     *                             generating the sprite.
     * @memberof Sprite
     */
    constructor(pathToImage) {
        this.image = loadImage(pathToImage);
    }
    
    /**
     * Draws the sprite onto the canvas
     *
     * @param {Number} x_coordinate The position of the represented object 
     *                              relative to the x-axis.
     * @param {Number} y_coordinate The position of the represented object 
     *                              relative to the y-axis.
     * @param {Number} [transform_height=0] The height the image is to be 
     *                                      scaled to.
     * @param {Number} [transform_width=0] The width the image is to be 
     *                                     scaled to.
     * @memberof Sprite
     */
    toCanvas(x_coordinate, y_coordinate, transform_height=null, 
        transform_width=null) {
        if (transform_height != 0 && transform_width != 0) {
            image(this.image, x_coordinate, y_coordinate, 
                transform_width, transform_height);
        }
        else {
            image(this.image, x_coordinate, y_coordinate);
        }
    }
}