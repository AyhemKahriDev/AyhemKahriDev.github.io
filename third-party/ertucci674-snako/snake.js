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

let Snake = {
    sections: [],
    sectionsNum: snakeSectionsStart,
    incCheck: false,
    head: null,
    size: null,
    velocity: null,
    image: new Image(),
    quads: [],
    biteAudio: new Audio(),

    // Constructor
    newSnake: function (x, y, speedX, speedY, size) {
        let obj = Object.create(this);
        obj.size = size;
        obj.velocity = Vector.newVector(speedX, speedY);

        // Snake Picture
        obj.setImage();
        for (let i = 0; i < obj.sectionsNum; i++) {
            let section = Section.newSection(x, y + i, size, snakeStartDir);
            let part = i * 2;
            section.setPart(part);
            obj.sections.push(section);
        }

        obj.head = obj.sections[0]

        // Bite Sound
        this.biteAudio.src = "sounds/bite.mp3";
        this.biteAudio.volume = 0.8;

        return obj;
    },

    // Move Snake
    update: function () {
        // Add new body section
        // Must happen prior the movement
        if (this.incCheck) {
            this.increase();
            this.incCheck = false;
        }

        // Move Snake
        this.move();
    },

    render: function (context, rectStartX, rectStartY) {
        this.setBodyDirection();

        // Sections are drawn in reverse order so the one ahead is always on top
        // Avoids graphics issues when inserting a new section
        for (let i = this.sectionsNum - 1; i >= 0; i--) {
            const section = this.sections[i];
            const half = section.size * 0.5;
            const quad = this.quads[section.part];
            let scaleX = 1, scaleY = 1;

            // Flip the picture so it turns towards the opposite direction
            if (section.part == TAILT && section.partTurning == Math.PI * 0.5) {
                scaleX = -1;
            }

            // Shifting the canvas to the center point of the section
            // Rotating the canvas (hence the section)
            // Render the picture
            // Restore the original canvas settings (position and rotation)
            context.save();
            context.translate(rectStartX + section.position.x * section.size + half, rectStartY + section.position.y * section.size + half);
            context.scale(scaleX, scaleY);
            context.rotate((section.dir + section.partTurning) * scaleX * scaleY);
            context.drawImage(this.image, quad.x, quad.y, quad.width, quad.height, -half * scaleX, -half * scaleY, section.size * scaleX, section.size * scaleY);
            context.restore();
        }
    },

    // Setters
    setDir: function (dir) {
        this.head.dir = dir;
    },

    setImage: function () {
        this.image.src = "pictures/snake.png";
        for (let r = 0; r < 3; r++) {
            for (let c = 0; c < 2; c++) {
                let quad = Quad.newQuad(this.size * c, this.size * r, this.size, this.size);
                this.quads.push(quad);
            }
        }
    },

    // Changing Body 'quad' depending on snake turning angle
    setBodyDirection: function () {
        for (let i = this.sectionsNum - 1; i > 0; i--) {
            const current = this.sections[i];
            const next = this.sections[i - 1];

            // Reset Body direction
            if (current.part == BODYT) {
                current.part = BODY;
                current.partTurning = 0;
            }
            else if (current.part == TAILT) {
                current.part = TAIL;
                current.partTurning = 0;
            }

            // Turn Body
            if (current.part == BODY) {
                // Check difference in angle
                const diff = next.dir - current.dir;

                // Right Turn
                if (diff == Math.PI * 0.5 || diff == -Math.PI * 1.5) {
                    current.part = BODYT;
                    current.partTurning = Math.PI;
                }

                // Left Turn
                else if (diff == -Math.PI * 0.5 || diff == Math.PI * 1.5) {
                    current.part = BODYT;
                    current.partTurning = -Math.PI * 0.5;
                }

                else current.partTurning = 0;
            }
            // Turn Tail
            else if (current.part == TAIL) {
                // Check difference in angle
                const diff = next.dir - current.dir;

                // Right Turn
                if (diff == Math.PI * 0.5 || diff == -Math.PI * 1.5) {
                    current.part = TAILT;
                    current.partTurning = Math.PI * 0.5;
                }

                // Left Turn
                else if (diff == -Math.PI * 0.5 || diff == Math.PI * 1.5) {
                    current.part = TAILT;
                    current.partTurning = -Math.PI * 0.5;
                }

                else current.partTurning = 0;
            }
        }
    },

    // Movement and Space
    move: function () {
        for (let i = this.sectionsNum - 1; i > 0; i--) {
            const current = this.sections[i];
            const next = this.sections[i - 1];

            // Change the position values to the one of the following section
            current.position.changeTo(next.position);

            // Change the direction value to the one of the following section
            current.dir = next.dir;
        }
        this.head.position.addTo(this.velocity);
        this.contain();
    },

    // Keep the snake inside the map
    contain: function () {
        const pos = this.head.position,
            x = this.head.position.x,
            y = this.head.position.y;

        // X-axis
        if (x >= gridCols)
            pos.x -= gridCols;
        else if (x < 0)
            pos.x += gridCols;

        // Y-axis
        if (y >= gridRows)
            pos.y -= gridRows;
        else if (y < 0)
            pos.y += gridRows;
    },

    // Check if snake collides with itself or a wall
    collision: function (grid) {
        let x = this.head.position.x,
            y = this.head.position.y;

        // Wall Collision
        if (grid[y][x] == WALL) {
            return true;
        }

        // Body Collision
        for (let i = 1; i < this.sectionsNum; i++) {
            if (x == this.sections[i].position.x && y == this.sections[i].position.y) {
                return true;
            }
        }

        return false;
    },

    // Increase the snake length if food is eaten
    checkFood: function (grid) {
        const x = this.head.position.x;
        const y = this.head.position.y;
        if (grid[y][x] == FOOD) {
            this.incCheck = true;
            grid[y][x] = EMPTY;
            this.biteAudio.play();
            return true;
        }
    },

    // Increase Snake's Sections
    increase: function () {
        const last = this.sections[this.sectionsNum - 1];
        const section = Section.newSection(last.position.x, last.position.y, this.size, last.dir);
        section.part = last.part;
        this.sections.push(section);
        this.sectionsNum += 1;
        this.sections[this.sectionsNum - 2].part = BODY;
    },

    reset: function () {
        this.sections.splice(0);
        this.incCheck = false;
        this.velocity.x = 0;
        this.velocity.y = -snakeSpeed;

        // Re-populate sections array
        this.sectionsNum = snakeSectionsStart;
        for (let i = 0; i < this.sectionsNum; i++) {
            let section = Section.newSection(snakeStartX, snakeStartY + i, this.size, snakeStartDir);
            let part = i * 2;
            section.setPart(part);
            this.sections.push(section);
        }
        this.head = this.sections[0];
    },
}