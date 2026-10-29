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

window.onload = function () {
    let canvas = document.getElementById("canvas"),
        context = canvas.getContext("2d");

    // Text
    context.font = FONT;

    const game = Game.newGame(canvas, context);
    const gameover = Gameover.newGameover(canvas, context);
    let currentPage = game;

    // Time Control
    let timeLast = performance.now();

    render();
    main();

    // Change Snake direction when arrow keys are pressed
    window.addEventListener("keydown", function (event) {
        if (currentPage == game) {
            game.eventListener(event);
        }
    });

    window.addEventListener("mousemove", function (event) {
        if (currentPage == gameover) {
            gameover.eventListener(event);
        }
    });

    window.addEventListener("mousedown", function (event) {
        if (currentPage == gameover) {
            if (gameover.changePage(event)) {
                currentPage = game;
            }
        }
    })

    function main() {
        // Control Frame Rate
        const timeNow = performance.now();
        const timePassed = timeNow - timeLast;

        if (timePassed >= rr) {
            render();
            update();
            timeLast = timeNow - (timePassed % rr);
        }

        requestAnimationFrame(main);
    }

    function update() {
        switch (currentPage) {
            case game:
                if (game.pageChange()) {
                    gameover.setScore(game.score);
                    currentPage = gameover;
                }
                game.update();
                break;
            case gameover:
                gameover.update();
                break
            default:
                break;
        }
    }

    function render() {
        switch (currentPage) {
            case game:
                game.render();
                break;
            case gameover:
                gameover.render();
                break
            default:
                break;
        }
    }
};