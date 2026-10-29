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

let Vector = {
    x: 0,
    y: 0,

    // Constructor
    newVector: function (x, y) {
        let obj = Object.create(this);
        obj.x = x;
        obj.y = y;
        return obj;
    },

    // Copy Values from an other vector
    changeTo: function (v2) {
        this.x = v2.x;
        this.y = v2.y;
    },

    // Add a vector's values
    addTo: function (v2) {
        this.x += v2.x;
        this.y += v2.y;
    }
}