"use strict";

/**
 * Generates a random number between the specified minimum and maximum values.
 *
 * @param {number} mini - The minimum value.
 * @param {number} maxi - The maximum value.
 * @returns {number} The generated random number.
 */
function generateRandomNumber(mini, maxi) {
    let min = Math.floor(mini);
    let max = Math.floor(maxi);
    return Math.floor(Math.random() * (max - min + 1) + min);
}

/**
 * Generates a random initial direction for the snake.
 * @returns {Direction} A random initial direction.
 */
function generateRandomInitialDirection() {
    const arrValidDirections = [
        Direction.UP,
        Direction.DOWN,
        Direction.RIGHT
    ];
    const randomIndex = generateRandomNumber(0, arrValidDirections.length - 1);
    return arrValidDirections[randomIndex];
}

/**
 * Represents the value of a snake cell in the game board.
 * @type {number}
 * @const
 */
const SNAKE_VAL = 1;

/**
 * Represents the value of a food cell in the game board.
 * @type {number}
 * @const
 */
const FOOD_VAL = 2;

/**
 * Represents the value of an empty cell in the game board.
 * @type {number}
 * @const
 */
const EMPTY_VAL = 0;

/**
 * Enum for the direction of movement.
 * @readonly
 * @enum {number}
 */
const Direction = {
    UP: -1,
    DOWN: 1,
    LEFT: -2,
    RIGHT: 2,
};

/**
 * Enum for the color of the game elements.
 * @readonly
 * @enum {string}
 */
const Color = {
    SNAKE_HEAD: "#3432a8",
    SNAKE_BODY: "#278EA5",
    FOOD: "#fd0000",
    BOARD: "#000",
};

/**
 * Represents the timer for the game.
 */
class Timer {
    #minutes;
    #seconds;

    /**
     * Constructs a new Timer instance.
     *
     * @constructor
     * @param {number} [minutes=0] - The initial minutes for the timer. Defaults to 0.
     * @param {number} [seconds=0] - The initial seconds for the timer. Defaults to 0.
     */
    constructor(minutes = 0, seconds = 0) {
        this.#minutes = minutes;
        this.#seconds = seconds;
    }

    /**
     * Sets the timer based on the provided milliseconds.
     *
     * This method converts the provided milliseconds into minutes and seconds,
     * and then sets the timer's minutes and seconds properties accordingly.
     *
     * @param {number} milliseconds - The time in milliseconds.
     */
    setTimer(milliseconds) {
        const totalSeconds = Math.floor(milliseconds / 1000);
        this.#minutes = Math.floor(totalSeconds / 60);
        this.#seconds = totalSeconds % 60;
    }

    /**
     * Gets the minutes from the timer.
     * @returns {number} The minutes from the timer.
     */
    getMinutes() {
        return this.#minutes;
    }

    /**
     * Gets the seconds from the timer.
     * @returns {number} The seconds from the timer.
     */
    getSeconds() {
        return this.#seconds;
    }
}

/**
 * Represents a point in a two-dimensional coordinate system.
 */
class Point {
    #x;
    #y;

    /**
     * Creates a new Point object.
     * @param {number} x - The x-coordinate of the point.
     * @param {number} y - The y-coordinate of the point.
     */
    constructor(x, y) {
        this.#x = x;
        this.#y = y;
    }

    /**
     * Gets the x-coordinate of the point.
     * @returns {number} The x-coordinate.
     */
    getX(){
        return this.#x;
    }

    /**
     * Sets the x-coordinate of the point.
     * @param {number} x - The new x-coordinate.
     */
    setX(x){
        this.#x = x;
    }

    /**
     * Gets the y-coordinate of the point.
     * @returns {number} The y-coordinate.
     */
    getY(){
        return this.#y;
    }

    /**
     * Sets the y-coordinate of the point.
     * @param {number} y - The new y-coordinate.
     */
    setY(y){
        this.#y = y;
    }

    /**
     * Creates a clone of the current Point object.
     * @returns {Point} A new Point object with the same x and y coordinates as the original.
     */
    clone(){
        return new Point(this.#x, this.#y);
    }
}

/**
 * Represents a food item in the game.
 * @extends Point
 */
class Food extends Point {
    /**
     * Creates a new instance of the Food class.
     * @param {number} x - The x-coordinate of the food item.
     * @param {number} y - The y-coordinate of the food item.
     */
    constructor(x, y) {
        super(x, y);
    }

    /**
     * Generates a new food item at a random position within the specified width and height.
     * @param {number} width - The width of the game area.
     * @param {number} height - The height of the game area.
     * @returns {Food} - A new Food instance.
     */
    static generateRandomFood(width, height) {
        return new Food(
            generateRandomNumber(0, width - 1), 
            generateRandomNumber(0, height - 1)
        );
    }
}

/**
 * Represents a snake in the game.
 */
class Snake {
    #direction;
    #body;

    /**
     * Creates a new instance of the Snake class.
     * @param {Array<Point>} body - The initial body of the snake.
     */
    constructor(body){
        this.#direction = generateRandomInitialDirection();
        this.#body = body;
    }

    /**
     * Generates the initial body of the snake.
     * @returns {Array<Point>} - The initial body of the snake.
     */
    static generateInitialSnake(width, height) {
        const body = [];
        const initX = Math.floor(width / 2);
        const initY = Math.floor(height / 2);
        for (let i = 2; i >= 0; i--) {
            body.push(new Point(initX - i, initY));
        }
        return body;
    }

    /**
     * Gets the direction of the snake.
     * @returns {Direction} - The direction of the snake.
     */
    getDirection(){
        return this.#direction;
    }

    /**
     * Sets the direction of the snake.
     * @param {Direction} direction - The direction to set
     */
    setDirection(direction){
        this.#direction = direction;
    }

    /**
     * Gets the point at the specified index in the snake's body.
     * @param {number} index - The index of the point.
     * @returns {Point} - The point at the specified index.
     */
    getPoint(index){
        return this.#body[index];
    }

    /**
     * Gets the length of the snake's body.
     * @returns {number} - The length of the snake's body.
     */
    getLength(){
        return this.#body.length;
    }

    /**
     * Removes the tail of the snake.
     * @returns {Point} The removed tail of the snake.
     */
    removeTail(){
        return this.#body.shift();
    }

    /**
     * Adds a new point to the head of the snake.
     * @param {Point} point - The new point to be added to the head of the snake.
     */
    addHead(point){
        this.#body.push(point);
    }
}

/**
 * Represents a game board.
 */
class Board {
    #width;
    #height;
    #body;

    /**
     * Creates a new instance of the Board class.
     * @param {number} width - The width of the board.
     * @param {number} height - The height of the board.
     */
    constructor(width, height) {
        this.#width = width;
        this.#height = height;
        this.#body = this.#generateBoard();
    }
    
    /**
     * Generates the initial board with all cells set to 0.
     * @returns {Array<Array<number>>} The generated board.
     */
    #generateBoard() {
        const board = [];
        for (let i = 0; i < this.#height; i++) {
            board.push(Array(this.#width).fill(EMPTY_VAL));
        }
        return board;
    }

    /**
     * Sets a value at the specified point in the game board.
     *
     * @param {Point} point - The point at which to set the value.
     * @param {number} value - The value to set at the specified point.
     */
    putPoint(point, value){
        this.#body[point.getY()][point.getX()] = value;
    }

    /**
     * Puts the snake on the board by updating the corresponding cells to 1.
     * @param {Snake} snake - The snake object to put on the board.
     */
    putSnakeOnBoard(snake) {
        for (let i = 0; i < snake.getLength(); i++) {
            const point = snake.getPoint(i);
            this.putPoint(point, SNAKE_VAL);
        }
    }

    /**
     * Puts the food on the game board.
     * @param {Food} food - The food object to be placed on the board.
     */
    putFoodOnBoard(food){
        this.putPoint(food, FOOD_VAL);
    }

    /**
     * Checks if a given point is occupied in the game grid.
     * @param {Point} point - The point to check.
     * @param {any} value - The value to check against.
     * @returns {boolean} - True if the point is occupied, false otherwise.
     */
    isPointSet(point, value){
        return this.#body[point.getY()][point.getX()] === value;
    }

    /**
     * Get the width of the object.
     * @returns {number} The width of the object.
     */
    getWidth(){
        return this.#width;
    }

    /**
     * Get the height of the object.
     * @returns {number} The height of the object.
     */
    getHeight(){
        return this.#height;
    }
}

/**
 * Represents the game drawer.
 */
class GameDrawer {
    #ctx;
    #canvas;
    #snakeGame;
    #scale;

    #scoreControl;
    #elapsedTimeControl;

    #modalGameOver;
    #btnModalRestartGame;
    #btnModalClose;
    #finalScoreControl;

    #modalStartGame;
    #btnModalStartGame;

    #intervalIdTimer;

    /**
     * Constructs a new instance of the GameDrawer class.
     *
     * @constructor
     * @param {HTMLCanvasElement} canvas - The canvas element to draw the game on.
     * @param {number} scale - The scale factor for the game grid.
     * @param {SnakeGame} snakeGame - The instance of the SnakeGame class.
     */
    constructor(canvas, scale, snakeGame){
        this.#canvas = canvas;
        this.#ctx = this.#canvas.getContext("2d");
        this.#snakeGame = snakeGame;
        this.#scale = scale;

        this.#scoreControl = document.getElementById("score");
        this.#elapsedTimeControl = document.getElementById("elapsedTime");
        this.#modalGameOver = document.getElementById("modelGameOVer");
        this.#btnModalRestartGame = document.getElementById("btnRestartModalGameOver");
        this.#btnModalClose = document.getElementById("btnCloseModalGameOver");
        this.#finalScoreControl = document.getElementById("finalScore");
        this.#modalStartGame = document.getElementById("modalStartGame");
        this.#btnModalStartGame = document.getElementById("btnStartGameModal");

        this.#initListeners();
    }

    /**
     * Initializes event listeners for the game.
     */
    #initListeners(){
        this.#btnModalClose.addEventListener("click", () => this.#modalGameOver.close());
        this.#btnModalStartGame.addEventListener("click", () => this.#snakeGame.start());
        this.#btnModalRestartGame.addEventListener("click", () => this.#snakeGame.reset());
        window.addEventListener("keydown", (event) => {
            if(this.#snakeGame.directionLock) return;

            const snake = this.#snakeGame.snakeBody;
            switch(event.key){
                case "ArrowUp":
                    if(snake.getDirection() === Direction.DOWN) break;
                    snake.setDirection(Direction.UP);
                    this.#snakeGame.directionLock = true;
                    break;
                case "ArrowDown":
                    if(snake.getDirection() === Direction.UP) break;
                    snake.setDirection(Direction.DOWN);
                    this.#snakeGame.directionLock = true;
                    break;
                case "ArrowLeft":
                    if(snake.getDirection() === Direction.RIGHT) break;
                    snake.setDirection(Direction.LEFT);
                    this.#snakeGame.directionLock = true;
                    break;
                case "ArrowRight":
                    if(snake.getDirection() === Direction.LEFT) break;
                    snake.setDirection(Direction.RIGHT);
                    this.#snakeGame.directionLock = true;
                    break;
            }
        });
    }

    /**
     * Draws a cell on the canvas at the specified position with the given color.
     * @param {Point} position - The position of the cell on the canvas.
     * @param {Color} [color=Color.BOARD] - The color to fill the cell with. Defaults to Color.BOARD.
     */
    drawCell(position, color = Color.BOARD) {
        this.#ctx.fillStyle = color;
        this.#ctx.fillRect(
            position.getX() * this.#scale,
            position.getY() * this.#scale,
            this.#scale * 1,
            this.#scale * 1
        );
    }

    /**
     * Draws the snake on the canvas.
     * @param {Snake} snake - The snake object to draw.
     */
    drawSnake(snake) {
        for (let i = 0; i < snake.getLength(); i++) {
            let color = (i === snake.getLength() - 1) ? Color.SNAKE_HEAD : Color.SNAKE_BODY;
            this.drawCell(snake.getPoint(i), color);
        }
    }

    /**
     * Draws the food on the canvas.
     * @param {Food} food - The food object to draw.
     */
    drawFood(food) {
        this.drawCell(food, Color.FOOD);
    }

    
    /**
     * Draws the game board on the canvas.
     * @param {Board} board - The game board object.
     */
    drawBoard(board) {
        //Draw horizontal lines
        for (let i = 0; i < board.getHeight(); i++) {
            this.#ctx.beginPath();
            this.#ctx.moveTo(0, i * this.#scale);
            this.#ctx.lineTo(this.#canvas.width, i * this.#scale);
            this.#ctx.stroke();
        }

        //Draw vertical lines
        for (let i = 0; i < board.getWidth(); i++) {
            this.#ctx.beginPath();
            this.#ctx.moveTo(i * this.#scale, 0);
            this.#ctx.lineTo(i * this.#scale, this.#canvas.height);
            this.#ctx.stroke();
        }
    }

    /**
     * Clears the game board by clearing the canvas.
     */
    clearBoard() {
        this.#ctx.clearRect(0, 0, this.#canvas.width, this.#canvas.height);
    }

    /**
     * Updates the score on the screen.
     * @param {number} score - The score to be displayed.
     */
    drawScore(score = 0) {
        this.#scoreControl.innerText = score;
    }

    /**
     * Updates the elapsed time display on the screen.
     * The elapsed time is displayed in the format MM:SS.
     * @param {Timer} timer - The timer object representing the elapsed time.
     */
    drawTime(timer){
        const minutes = timer.getMinutes().toString().padStart(2, "0");
        const seconds = timer.getSeconds().toString().padStart(2, "0");
        this.#elapsedTimeControl.innerText = `${minutes}:${seconds}`;
    }

    /**
     * Displays the start game modal.
     * @param {boolean} [show=true] - Whether to show or hide the modal. Defaults to true.
     */
    showStartGameModal(show = true){
        if(show) this.#modalStartGame.showModal();
        else this.#modalStartGame.close();
    }

    /**
     * Displays the game over modal and updates the final score.
     * @param {boolean} [show=true] - Whether to show or hide the modal. Defaults to true.
     */
    showGameOverModal(show = true){
        if(show) {
            this.#finalScoreControl.innerText = this.#snakeGame.points;
            this.#modalGameOver.showModal();
        } else {
            this.#modalGameOver.close();
        }
    }

    /**
     * Starts a timer that updates the elapsed time every second.
     * The elapsed time is displayed in the format MM:SS.
     */
    startTimer() {
        const startTime = Date.now();
        this.#intervalIdTimer = setInterval(() => {
            this.#snakeGame.timer.setTimer(Date.now() - startTime);
        }, 1000);
    }

    /**
     * Stops the timer that was started by the startTimer method.
     */
    stopTimer(){
        clearInterval(this.#intervalIdTimer);
    }

    /**
     * Resets the game timer to zero.
     */
    resetTimer(){
        this.#snakeGame.timer = new Timer(0, 0);
    }
}

/**
 * Represents a Snake Game.
 */
class SnakeGame {
    canvas;
    gameDrawer;

    scale = 50;
    tickSpeed = 100; //100ms
    lastTick = 0;
    isGameOver = false;

    widthCells;
    heightCells;

    points;
    board;
    snakeBody;
    food;
    timer = new Timer();

    directionLock = false;

    /**
     * Represents the main class of the snake game.
     * @constructor
     */
    constructor(){
        this.canvas = document.getElementById("board");
        this.widthCells = Math.floor(this.canvas.width / this.scale);
        this.heightCells = Math.floor(this.canvas.height / this.scale);
        this.gameDrawer = new GameDrawer(this.canvas, this.scale, this);

        this.initGame();
        this.drawGame();
        this.gameDrawer.showStartGameModal();
    }

    /**
     * Initializes the game by creating a new snake, board, and food.
     */
    initGame() {
        this.points = 0;
        this.isGameOver = false;
        this.directionLock = false;
        this.snakeBody = new Snake(
            Snake.generateInitialSnake(
                this.widthCells, 
                this.heightCells
            )
        );
        this.board = new Board(this.widthCells, this.heightCells);
        this.board.putSnakeOnBoard(this.snakeBody);
        this.food = this.#generateRandomFoodWithCollisionChecker(
            this.board,
            this.snakeBody.getPoint(this.snakeBody.getLength() - 1)
        );
        this.board.putFoodOnBoard(this.food);
    }

    /**
     * Draws the game on the canvas.
     */
    drawGame(){
        this.gameDrawer.clearBoard();
        this.gameDrawer.drawSnake(this.snakeBody);
        this.gameDrawer.drawFood(this.food);
        this.gameDrawer.drawBoard(this.board);
        this.gameDrawer.drawScore(this.points);
        this.gameDrawer.drawTime(this.timer);
    }

    /**
     * Starts the game by running the main game loop and showing the game board.
     */
    start(){
        requestAnimationFrame(this.mainLoop.bind(this));
        this.gameDrawer.resetTimer();
        this.gameDrawer.startTimer();
        this.gameDrawer.showStartGameModal(false);
    }

    /**
     * Resets the game to its initial state.
     */
    reset(){
        this.gameDrawer.showGameOverModal(false);
        this.gameDrawer.resetTimer();
        this.initGame();
        this.drawGame();
        this.gameDrawer.showStartGameModal();
    }

    /**
     * Ends the game by showing the game over modal and stopping the timer.
     */
    gameOver(){
        this.gameDrawer.showGameOverModal();
        this.gameDrawer.stopTimer();
    }

    /**
     * Generates a random food position on the board without any conflicts.
     * @param {Board} board - The game board.
     * @param {Point} newHead - The new head position of the snake.
     * @returns {Food} - The random food position.
     */
    #generateRandomFoodWithCollisionChecker(board, newHead) {
        let randomFood;
        do {
            randomFood = Food.generateRandomFood(
                board.getWidth(), 
                board.getHeight()
            );
        } while (
            board.isPointSet(randomFood, SNAKE_VAL) ||
            (randomFood.getX() === newHead.getX() && randomFood.getY() === newHead.getY())
        );
        return randomFood;
    }

    /**
     * Updates the game state by moving the snake and checking for collisions.
     */
    update(){
        const newHead = this.snakeBody.getPoint(this.snakeBody.getLength() - 1).clone();
        const direction = this.snakeBody.getDirection();
        this.directionLock = false;
        switch (direction) {
            case Direction.UP:
                newHead.setY(newHead.getY() - 1);
                break;
            case Direction.DOWN:
                newHead.setY(newHead.getY() + 1);
                break;
            case Direction.LEFT:
                newHead.setX(newHead.getX() - 1);
                break;
            case Direction.RIGHT:
                newHead.setX(newHead.getX() + 1);
                break;
        }

        //Validates if snake is going out of board and end the game
        if (
            newHead.getX() < 0 ||
            newHead.getX() >= this.widthCells ||
            newHead.getY() < 0 ||
            newHead.getY() >= this.heightCells
        ) {
            this.isGameOver = true;
            return;
        }

        this.board = new Board(this.widthCells, this.heightCells);
        this.board.putSnakeOnBoard(this.snakeBody);

        let isFoodFound = false;
        if (newHead.getX() === this.food.getX()
            && newHead.getY() === this.food.getY()) {
            this.food = this.#generateRandomFoodWithCollisionChecker(this.board, newHead);
            this.points++;
            isFoodFound = true;
        }
        this.board.putFoodOnBoard(this.food); //Save the new food position

        //Valid if the snake collides with itself.
        if (this.board.isPointSet(newHead, SNAKE_VAL)) {
            this.isGameOver = true;
            return;
        }

        //If the snake eats the food, it does not remove the tail.
        if(!isFoodFound) this.snakeBody.removeTail();
        this.snakeBody.addHead(newHead);
    }

    /**
     * The main game loop that updates and draws the game.
     * This method is called repeatedly using requestAnimationFrame to create a game loop.
     * The game state is updated and drawn only if the elapsed time since the last update is greater than the game speed.
     * After updating the game state and drawing, the method schedules the next call to itself.
     *
     * @param {number} timeStamp - The timestamp provided by requestAnimationFrame indicating the current time.
     */
    mainLoop(timeStamp) {
        if(timeStamp - this.lastTick > this.tickSpeed){
            this.update();
            this.drawGame();
            this.lastTick = timeStamp;

            if(this.isGameOver){
                this.gameOver();
                return;
            }
        }
        requestAnimationFrame(this.mainLoop.bind(this));
    }
}

new SnakeGame();