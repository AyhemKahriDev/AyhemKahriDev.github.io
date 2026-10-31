// Copyright(C) 2024 Alessandro Amatucci Girlanda

// This file is part of Snako.

// Snako is free software: you can redistribute it and / or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
//     (at your option) any later version.

// Snako is distributed in the hope that it will be useful,
//     but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with Snako.If not, see < https://www.gnu.org/licenses/>.

let Game = {
    canvas: null,
    context: null,
    scale: 1,

    // Window Size
    width: 0,
    widthCenter: 0,
    height: 0,
    heightCenter: 0,

    // Map Area
    grid: {},
    rectStartX: 0,
    rectStartY: 0,
    map: new Image(),
    wall: new Image(),

    // Snake
    snake: null,
    snakeDir: 0,
    snakeTurn: 0,
    score: 0,
    scoreScale: 1,

    // Food
    food: new Image(),
    foodQuads: [],
    currentFood: 0,

    // Constructor
    newGame: function (canvas, context) {
        let obj = Object.create(this);

        // Graphics
        obj.canvas = canvas;
        obj.context = context;

        obj.setup();
        obj.currentFood = Food.randomFood();
        Food.spawnFood(obj.grid, obj.snake);

        return obj;
    },

    update: function () {
        this.snake.update();
        this.snakeTurn = true;
        this.snake.setDir(this.snakeDir);
        if (this.snake.checkFood(this.grid)) {
            this.currentFood = Food.randomFood();
            Food.spawnFood(this.grid, this.snake);
        }
    },

    // Rendering
    render: function () {
        this.context.clearRect(0, 0, this.width, this.height);

        this.context.save()
        this.context.scale(this.scale, this.scale);
        this.renderGrid();
        this.renderScore();
        this.snake.render(this.context, this.rectStartX, this.rectStartY);
        this.context.restore();
    },

    renderGrid: function () {
        this.context.fillStyle = "#FFF";
        //Draw Background
        this.context.drawImage(this.map, this.widthCenter - rectHalfSide, this.heightCenter - rectHalfSide, rectSide, rectSide);
        // Draw items
        for (let c = 0; c < gridCols; c++) {
            for (let r = 0; r < gridRows; r++) {
                if (this.grid[r][c] == FOOD) {
                    let quad = this.foodQuads[this.currentFood];
                    this.context.drawImage(this.food, quad.x, quad.y, quad.width, quad.height,
                        this.widthCenter - rectHalfSide + cellWidth * c,
                        this.heightCenter - rectHalfSide + cellHeight * r,
                        quad.width, quad.height);
                }
                else if (this.grid[r][c] == WALL) {
                    this.context.drawImage(this.wall, this.widthCenter - rectHalfSide + cellWidth * c, this.heightCenter - rectHalfSide + cellWidth * r);
                }
            }
        }
        this.context.stroke();
    },

    renderScore: function () {
        this.context.fillStyle = "black";
        this.context.fillText("Score: " + (this.snake.sectionsNum - snakeSectionsStart).toString(), 50, 50);
    },


    // Setters
    setup: function () {
        // Window Size
        this.width = this.canvas.width = window.innerWidth;
        this.widthCenter = this.width * 0.5;
        this.height = this.canvas.height = window.innerHeight;
        this.heightCenter = this.height * 0.5;

        // Adjust scaling if game is larger than screen
        if (rectSide > this.height) {
            this.scale = (this.height / rectSide) * 0.9;

            this.widthCenter /= this.scale;
            this.heightCenter /= this.scale;
        }

        // Map
        this.setGrid();
        this.rectStartX = this.widthCenter - rectHalfSide;
        this.rectStartY = this.heightCenter - rectHalfSide;
        this.map.src = "pictures/map.png";
        this.wall.src = "pictures/wall.png";

        // Snake
        this.setupSnake();

        // Food
        this.setupFood();

        // Text
        this.context.font = FONT;
    },

    setupSnake: function () {
        this.snake = Snake.newSnake(snakeStartX, snakeStartY, 0, -snakeSpeed, cellWidth);
        this.snakeDir = UP;
        this.snakeTurn = true;
    },

    setupFood: function () {
        this.food.src = "pictures/food.png";
        for (let i = 0; i < 3; i++) {
            const quad = Quad.newQuad(cellWidth * i, 0, cellWidth, cellHeight);
            this.foodQuads.push(quad);
        }
    },

    setGrid: function () {
        this.grid = Array.from({ length: gridRows }, () => Array(gridCols).fill(0));

        this.grid = [
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 2, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 2, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 2, 2, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 2, 2, 0, 0, 0, 0],
            [0, 0, 0, 0, 2, 2, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 2, 2, 0, 0, 0, 0],
            [0, 0, 0, 0, 2, 2, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 2, 2, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 2, 2, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 2, 2, 0, 0, 0, 0],
            [0, 0, 0, 0, 2, 2, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 2, 2, 0, 0, 0, 0],
            [0, 0, 0, 0, 2, 2, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 2, 2, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 2, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 2, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        ]
    },

    eventListener: function (event) {
        if (this.snakeTurn) {
            const speed = this.snake.velocity;
            switch (event.key) {
                case "ArrowUp":
                    if (speed.y != 1) {
                        speed.x = 0;
                        speed.y = -snakeSpeed;
                        this.snakeDir = UP;
                        this.snakeTurn = false;
                    }
                    break;
                case "ArrowDown":
                    if (speed.y != -1) {
                        speed.x = 0;
                        speed.y = snakeSpeed;
                        this.snakeDir = DOWN;
                        this.snakeTurn = false;
                    }
                    break;
                case "ArrowLeft":
                    if (speed.x != 1) {
                        speed.x = -snakeSpeed;
                        speed.y = 0;
                        this.snakeDir = LEFT;
                        this.snakeTurn = false;
                    }
                    break;
                case "ArrowRight":
                    if (speed.x != -1) {
                        speed.x = snakeSpeed;
                        speed.y = 0;
                        this.snakeDir = RIGHT;
                        this.snakeTurn = false;
                    }
                    break;
                default:
                    break;
            }
        }
    },

    pageChange: function () {
        if (this.snake.collision(this.grid)) {
            this.context.clearRect(0, 0, this.width, this.height);
            this.score = this.snake.sectionsNum - snakeSectionsStart;
            this.reset();
            return true;
        }
        return false;
    },

    reset: function () {
        this.snake.reset()
        this.snakeDir = UP;
        this.setGrid();
        this.currentFood = Food.randomFood();
        Food.spawnFood(this.grid, this.snake);
    },
}