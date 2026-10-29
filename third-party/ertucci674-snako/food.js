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

let Food = {
    randomFood: function () {
        return Math.floor(Math.random() * 3);
    },

    // Randomly spawn food around the map
    spawnFood: function (grid, snake) {
        let x = 0, y = 0;
        do {
            x = Math.floor(Math.random() * gridCols);
            y = Math.floor(Math.random() * gridRows);
        } while (this.objectOnFood(x, y, grid, snake));
        grid[y][x] = FOOD;
    },

    // Make sure food spawns in an empty slot
    objectOnFood: function (x, y, grid, snake) {
        // Check that no wall is present
        if (grid[y][x] != EMPTY) {
            return true;
        }

        // Check if any snake section is present
        for (let i = 0; i < snake.sectionsNum; i++) {
            if (snake.sections[i].position.x == x && snake.sections[i].position.y == y) {
                return true;
            }
        }

        return false;
    },
}