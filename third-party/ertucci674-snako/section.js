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

let Section = {
    position: null,
    size: 0,
    dir: null,
    part: null,
    partTurning: 0,

    // Constructor
    newSection: function (x, y, size, dir) {
        let obj = Object.create(this);
        obj.position = Vector.newVector(x, y);
        obj.size = size;
        obj.dir = dir;
        return obj;
    },

    setPart: function (part) {
        this.part = part;
    },
}