// Board configuration
export const BOARD_SIZE = 15;
export const CELL_SIZE = 40;
export const TOKEN_SIZE = 30;

// Player colors
export const COLORS = {
    RED: '#ff4d4d',
    GREEN: '#4dff4d',
    YELLOW: '#ffff4d',
    BLUE: '#4d4dff'
};

// Game constants
export const DICE_MIN = 1;
export const DICE_MAX = 6;
export const PLAYERS_MIN = 2;
export const PLAYERS_MAX = 4;

// Movement rules
export const SAFE_POSITIONS = [
    // Add coordinates for safe positions
    {x: 1, y: 6}, {x: 8, y: 1},
    {x: 13, y: 8}, {x: 6, y: 13}
];

// Home base positions
export const HOME_BASES = {
    RED: {x: 1, y: 1},
    GREEN: {x: 1, y: 13},
    YELLOW: {x: 13, y: 13},
    BLUE: {x: 13, y: 1}
};

// Start positions
export const START_POSITIONS = {
    RED: {x: 1, y: 6},
    GREEN: {x: 6, y: 13},
    YELLOW: {x: 13, y: 8},
    BLUE: {x: 8, y: 1}
}; 