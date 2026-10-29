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

let Gameover = {
    canvas: null,
    context: null,

    // Window Size
    width: 0,
    widthCenter: 0,
    height: 0,
    heightCenter: 0,

    // Test
    text: null,

    // Button
    button: null,

    // Constructor
    newGameover: function (canvas, context) {
        let obj = Object.create(this);

        obj.canvas = canvas;
        obj.context = context;

        obj.setup();

        return obj;
    },

    update: function () {
        this.button.update();
    },

    render: function () {
        this.context.clearRect(0, 0, this.width, this.height);
        this.renderScore();
        this.button.render(this.context);
    },

    renderScore: function () {
        this.context.fillStyle = "#000";
        this.context.fillText(this.text,
            this.widthCenter - this.context.measureText(this.text).width * 0.5,
            this.heightCenter - 50);
    },

    // Setters
    setup: function () {
        // Window Size
        this.width = this.canvas.width = window.innerWidth;
        this.widthCenter = this.width * 0.5;
        this.height = this.canvas.height = window.innerHeight;
        this.heightCenter = this.height * 0.5;

        // Button
        this.button = Button.newButton(this.widthCenter, this.heightCenter + 50, "Play Again");

        // Text
        this.text = "Your Score: ";
        this.context.font = FONT;
    },

    setScore: function (score) {
        this.text = "Your Score: " + score.toString();
    },

    eventListener: function (event) {
        this.button.eventListener(event);
    },

    changePage: function (event) {
        if (this.button.eventListener(event)) {
            this.context.clearRect(0, 0, this.width, this.height);
            return true;
        }
        return false;
    },
}