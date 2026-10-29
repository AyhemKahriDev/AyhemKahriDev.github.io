/**
 * Represents an in-game obstacle
 * @class PipeSet
 */
class PipeSet {

    /**
     * Creates an instance of PipeSet.
     * @memberof PipeSet
     */
    constructor() {
        this.x_coordinate =  innerWidth;
        this.pipeWidth = 80;
        this.passableSpaceHeight = this.pipeWidth;
        this.offSet = this.pipeWidth / 2;

        this.pipeHead = new Sprite("res/Images/pipe_head.png");
        this.pipeBody = new Sprite("res/Images/pipe_body.png");

        this.topPipeHeight = 0;
        this.bottomPipeHeight = 0;
        this.cleared = false;

        this.calculateDimensions();
    }

    /**
     * Calculates the height and gap between the two pipes in the pipe set
     * @memberof PipeSet
     */
    calculateDimensions() {
        let maxHeight = Math.abs((innerHeight / 2) - this.passableSpaceHeight * 4);
        // max defines how small the bottom pipe would be since this one grows from top to bottom
        this.bottomPipeHeight = this.getRandom(maxHeight, innerHeight - maxHeight);
        this.topPipeHeight = this.getRandom(this.passableSpaceHeight, maxHeight);        
    }


    /**
     * Gradually move the pipe set towards the bird and off the screen
     * @param {number} [scrollSpeed=2] How fast the pipe set will go towards the bird
     * @memberof PipeSet
     */
    scroll(scrollSpeed=2) {
        this.x_coordinate -= scrollSpeed;
    }

    /**
     * Draws the object's sprite onto the canvas
     * @memberof PipeSet
     */
    toCanvas() {

        // Pipe head parameters
        let pipeHeadWidth = this.pipeWidth;
        let pipeHeadHeight = this.offSet;

        // Top pipe body parameters
        let topPipeBody_xCoordinate = (this.x_coordinate - this.offSet);
        let topPipeBody_yCoordinate = -this.offSet;
        // Top pipe head paramters
        let topPipeHead_xCoordinate = (this.x_coordinate - this.offSet);
        let topPipeHead_yCoordinate = (this.topPipeHeight - this.offSet);
        // Top pipe dimensions
        let d_topPipeWidth = this.pipeWidth;
        let d_topPipeHeight = this.topPipeHeight;

        // Bottom pipe body parameters
        let bottomPipeBody_xCoordinate = (this.x_coordinate - this.offSet);
        let bottomPipeBody_yCoordinate = this.bottomPipeHeight + this.offSet;
        // Bottom pipe head paramters
        let bottomPipeHead_xCoordinate = (this.x_coordinate - this.offSet);
        let bottomPipeHead_yCoordinate = (this.bottomPipeHeight + this.offSet);
        // Bottom pipe dimensions
        let d_bottomPipeWidth = this.pipeWidth;
        let d_bottomPipeHeight = this.bottomPipeHeight * 4;
        
        // Draw the top pipe
        this.pipeBody.toCanvas(topPipeBody_xCoordinate, topPipeBody_yCoordinate, 
            d_topPipeHeight, d_topPipeWidth);
        this.pipeHead.toCanvas(topPipeHead_xCoordinate, topPipeHead_yCoordinate, 
            pipeHeadHeight, pipeHeadWidth);
        
        // Draw the bottom pipe
        this.pipeBody.toCanvas(bottomPipeBody_xCoordinate, bottomPipeBody_yCoordinate, 
            d_bottomPipeHeight, d_bottomPipeWidth);
        this.pipeHead.toCanvas(bottomPipeHead_xCoordinate, bottomPipeHead_yCoordinate, 
            pipeHeadHeight, pipeHeadWidth);
    }

    /**
     * Determine whether the bird has hit any of the pipes in the pipe set.
     * @param {Bird} bird the instance of the bird class in the game world.
     * @returns A boolean value based on whether the bird had hit (true) any of the pipes
     *          or not (false).
     * @memberof PipeSet
     */
    collide(bird) {
        let bird_in_contact = ((this.x_coordinate - this.pipeWidth) - 
            bird.x_coordinate) <= 0; 
        let midPoint_y = ((this.topPipeHeight + this.bottomPipeHeight) / 2) - 
            this.pipeWidth;
        let isOverPipes = 
            (
                ((bird.y_coordinate <= this.topPipeHeight) 
                && (bird.y_coordinate < midPoint_y)) ||
                ((bird.y_coordinate >= this.bottomPipeHeight)
                && (bird.y_coordinate > midPoint_y))
            );
        
        if (bird_in_contact && isOverPipes) {
                return true;
            }
            else {
                return false;
            }
    }

    /**
     * Determine whether the bird has successfully passed through the open space
     * in-between the two pipes in the pipe set.
     * 
     * @param {Bird} bird the instance of the bird class in the game world.
     * @returns A boolean value based on whether the bird had successfully passed through
     *          the two pipes (true) or not (false).
     * @memberof PipeSet
     */
    isCleared(bird) {        
        let isPastPipes = bird.x_coordinate > this.x_coordinate;
        let isInBetweenPipes = 
            (
                (bird.y_coordinate > this.topPipeHeight) ||
                (bird.y_coordinate < this.bottomPipeHeight)
            );

        if (!this.cleared && (isPastPipes && isInBetweenPipes)) {
            this.cleared = true;
            return this.cleared;
        }
        else {
            return false;
        }
    }


    /**
     * Reconstruct the pipes in the pipe set.
     * @memberof PipeSet
     */
    reconstruct() {
        this.x_coordinate = innerWidth;
        this.calculateDimensions();
        this.cleared = false;
    }

    /**
     * Returns a random number between the given intervals min and max.
     *
     * @param {Number} min the lower bound of the selection (exclusive).
     * @param {Number} max the upper bound of the selection (inclusive).
     * @returns a random Number in-between the given boundaries.
     * @memberof PipeSet
     */
    getRandom(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }
}