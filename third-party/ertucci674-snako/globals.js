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

// Grid - Map
const rectSide = 800,
    rectHalfSide = rectSide / 2,

    FONT = "30px Arial",

    // Entities
    EMPTY = 0,
    FOOD = 1,
    WALL = 2,

    // Grid
    gridCols = 25,
    gridRows = 25,

    // Cells
    cellWidth = rectSide / gridCols,
    cellHeight = rectSide / gridRows,

    // Time
    rr = 1000 / 4,

    // Buttons
    buttonWidth = 200,
    buttonHeight = 50,

    // Directions
    UP = 0,
    RIGHT = Math.PI * 0.5,
    DOWN = Math.PI,
    LEFT = Math.PI * 1.5,

    // Snake
    HEAD = 0,
    NONE = 1,
    BODY = 2,
    BODYT = 3,
    TAIL = 4,
    TAILT = 5,

    snakeSectionsStart = 3,
    snakeStartX = Math.floor(gridCols / 2),
    snakeStartY = Math.floor(gridRows / 2),
    snakeStartDir = UP,
    snakeSpeed = 1;