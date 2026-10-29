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

let Button = {
    x: 0,
    y: 0,
    color: "#083002",
    text: null,

    newButton: function (x, y, text) {
        let obj = Object.create(this);
        obj.x = x;
        obj.y = y;
        obj.text = text;

        return obj;
    },

    update: function () {

    },

    render: function (context) {
        context.fillStyle = this.color;
        context.fillRect(this.x - buttonWidth * 0.5, this.y - buttonHeight * 0.5, buttonWidth, buttonHeight);
        context.fillStyle = "white";
        context.fillText(this.text, this.x - context.measureText(this.text).width * 0.5, this.y);
    },

    eventListener: function (event) {
        const mouseX = event.clientX;
        const mouseY = event.clientY;

        if (mouseX >= this.x - buttonWidth * 0.5 && mouseX <= this.x + buttonWidth * 0.5
            && mouseY >= this.y - buttonHeight * 0.5 && mouseY <= this.y + buttonHeight * 0.5) {
            this.color = "#106b06";
            return true;
        }
        else this.color = "#083002";
        return false;
    },
}