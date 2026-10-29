let buildLevel = (game, level) => {
    let bricks = [];
    level.forEach((row, rowIndex) => {
        row.forEach((brick, brickIndex) => {
            if (brick) {
                let position = {
                    x: 80 * brickIndex,
                    y: 20 + 30 * rowIndex
                };
                bricks.push(new Brick(game, position));
            }
        });
    });
    return bricks;
}
const level1 = [
    // [1, 0, 1, 0, 1, 0, 1, 0, 1, 0],
    // [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    // [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    // [1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
    [0, 0, 0, 0, 0, 0, 0, 0, 1, 0]
];
const level2 = [
    [1, 0, 1, 0, 1, 0, 1, 0, 1, 0],
    [0, 1, 0, 1, 0, 1, 0, 1, 0, 1],
    [1, 0, 1, 0, 1, 0, 1, 0, 1, 0],
    [0, 1, 0, 1, 0, 1, 0, 1, 0, 1],
];