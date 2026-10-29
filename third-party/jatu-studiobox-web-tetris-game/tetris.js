class Tetris {
    constructor(imageX, imageY, template) {
        this.imageX = imageX;
        this.imageY = imageY;
        this.template = template;
        this.x = squareCountX / 2;
        this.y = 0;
    }

    getTruncedPosition() {
        return { x: Math.trunc(this.x), y: Math.trunc(this.y) };
    }

    checkBottom() {
        for (let i = 0; i < this.template.length; i++) {
            for (let j = 0; j < this.template.length; j++) {
                if (this.template[i][j] == 0) continue;
                let realX = i + this.getTruncedPosition().x;
                let realY = j + this.getTruncedPosition().y;
                if (realY + 1 >= squareCountY) {
                    return false;
                }
                if (gameMap[realY + 1][realX].imageX != -1) {
                    return false;
                }
            }
        }
        return true;
    }

    checkLeft() {
        for (let i = 0; i < this.template.length; i++) {
            for (let j = 0; j < this.template.length; j++) {
                if (this.template[i][j] == 0) continue;
                let realX = i + this.getTruncedPosition().x;
                let realY = j + this.getTruncedPosition().y;
                if (realX - 1 < 0) return false;
                if (gameMap[realY][realX - 1].imageX != -1) return false;
            }
        }
        return true;
    }

    checkRight() {
        for (let i = 0; i < this.template.length; i++) {
            for (let j = 0; j < this.template.length; j++) {
                if (this.template[i][j] == 0) continue;
                let realX = i + this.getTruncedPosition().x;
                let realY = j + this.getTruncedPosition().y;
                if (realX + 1 >= squareCountX) return false;
                if (gameMap[realY][realX + 1].imageX != -1) return false;
            }
        }
        return true;
    }

    moveBottom() {
        if (this.checkBottom()) {
            this.y += 1;
            score += gameSpeed;
        }
    }

    moveRight() {
        if (this.checkRight()) {
            this.x += 1;
        }
    }

    moveLeft() {
        if (this.checkLeft()) {
            this.x -= 1;
        }
    }

    clockwiseRotation() {
        let tempTemplate = [];
        for (let i = 0; i < this.template.length; i++)
            tempTemplate[i] = this.template[i].slice();
        let n = this.template.length;
        for (let layer = 0; layer < n / 2; layer++) {
            let first = layer;
            let last = n - 1 - layer;
            for (let i = first; i < last; i++) {
                let offset = i - first;
                let top = this.template[first][i];
                this.template[first][i] = this.template[i][last];   // top = right
                this.template[i][last] = this.template[last][last - offset];    // right = bottom
                this.template[last][last - offset] = this.template[last - offset][first];   // bottom = left
                this.template[last - offset][first] = top;  // left = top
            }
        }

        for (let i = 0; i < this.template.length; i++) {
            for (let j = 0; j < this.template.length; j++) {
                if (this.template[i][j] == 0) continue;
                let realX = i + this.getTruncedPosition().x;
                let realY = j + this.getTruncedPosition().y;
                if (realX < 0 || realX >= squareCountX || realY < 0 || realY >= squareCountY) {
                    this.template = tempTemplate;
                    return false;
                }
            }
        }
    }

    counterClockwiseRotation() {
        let tempTemplate = [];
        for (let i = 0; i < this.template.length; i++)
            tempTemplate[i] = this.template[i].slice();
        let n = this.template.length;
        for (let layer = 0; layer < n / 2; layer++) {
            let first = layer;
            let last = n - 1 - layer;
            for (let i = first; i < last; i++) {
                let offset = i - first;
                let top = this.template[first][i];
                this.template[first][i] = this.template[last - offset][first];  // top = left
                this.template[last - offset][first] = this.template[last][last - offset];   // left = bottom
                this.template[last][last - offset] = this.template[i][last];    // bottom = right
                this.template[i][last] = top;   // right = top
            }
        }

        for (let i = 0; i < this.template.length; i++) {
            for (let j = 0; j < this.template.length; j++) {
                if (this.template[i][j] == 0) continue;
                let realX = i + this.getTruncedPosition().x;
                let realY = j + this.getTruncedPosition().y;
                if (realX < 0 || realX >= squareCountX || realY < 0 || realY >= squareCountY) {
                    this.template = tempTemplate;
                    return false;
                }
            }
        }
    }
}

// Gathering html element
const canvas = document.getElementById("canvas");
const nextShapeCanvas = document.getElementById("nextShapeCanvas");
const scoreText = document.getElementById("scoreText");
const speedText = document.getElementById("speedText");
const image = document.getElementById("image");
const btnRefresh = document.getElementById("btnRefresh");
const modalSettings = document.getElementById("modalSettings");
const btnOpenSetttings = document.getElementById("btnOpenSetttings");
const btnCloseSettings = document.getElementById("btnCloseSettings");
const modalController = document.getElementById("modalController");
const btnOpenController = document.getElementById("btnOpenController");
const btnCloseController = document.getElementById("btnCloseController");
const settingItems = document.querySelectorAll(".setting-item");
const gameSpeedItems = document.querySelectorAll(".game-speed-item");
const btnSaveSettings = document.getElementById("btnSaveSettings");
const btnOpenAbout = document.getElementById("btnOpenAbout");
const btnCloseAbout = document.getElementById("btnCloseAbout");
const modalAbout = document.getElementById("modalAbout");
const linkGitHub = document.getElementById("linkGitHub");

// Game Config
const imageSquareSize = 25;
const size = 30;
const framePerSecond = 25;
let gameSpeed = 1;
const displayLineheight = 40;
const ctx = canvas.getContext("2d");
const nctx = nextShapeCanvas.getContext("2d");
const squareCountX = canvas.width / size;
const squareCountY = canvas.height / size;
let drawIntervalId;
let updateIntervalId;

// Temporary for control display
let activeSettingItem;
let gameSpeedTemp;

// Constant section
const textGameOver = "Game Over!!";
const textPressNewGame = ["Press 'R'", "to new game"];
const textPause = "Pause";
const textPressContinue = ["Press Space Bar", "to continue"];

// Score section
const scorePositionTetris = 50;
const scoreDeletedRow = 500;

// Initial tetris shapes
const shapes = [
    new Tetris(0, 0, [
        [0, 0, 1, 0],
        [0, 0, 1, 0],
        [0, 0, 1, 0],
        [0, 0, 1, 0],
    ]),
    new Tetris(0, 25, [
        [1, 1],
        [1, 1]
    ]),
    new Tetris(0, 50, [
        [0, 0, 0],
        [0, 1, 1],
        [1, 1, 0]
    ]),
    new Tetris(0, 75, [
        [0, 0, 0],
        [1, 1, 1],
        [0, 1, 0]
    ]),
    new Tetris(0, 100, [
        [0, 1, 0],
        [0, 1, 0],
        [1, 1, 0]
    ]),
    new Tetris(0, 125, [
        [0, 1, 0],
        [0, 1, 0],
        [0, 1, 1]
    ]),
    new Tetris(0, 150, [
        [0, 0, 0],
        [1, 1, 0],
        [0, 1, 1]
    ])
];

let gameMap;
let gameOver;
let currentShape;
let nextShape;
let score;
let initialTwoDArr;
let whiteLineThickness = 3;
let gamePause;
let firstLoop;
let openedDialogController;
let openedDialogSettings;
let openedDialogAbout;
let deletedRows = 0;

const gameLoop = () => {
    if (updateIntervalId) clearInterval(updateIntervalId);
    if (drawIntervalId) clearInterval(drawIntervalId);
    updateIntervalId = setInterval(update, 1000 / gameSpeed);
    drawIntervalId = setInterval(draw, 1000 / framePerSecond);
};

const deleteCompleteRows = () => {
    for (let i = 0; i < gameMap.length; i++) {
        let t = gameMap[i];
        let isComplete = true;
        for (let j = 0; j < t.length; j++) {
            if (t[j].imageX == -1) isComplete = false;
        }
        if (isComplete) {
            console.log("complete row");

            // Sum deleted rows, when complete row
            deletedRows += 1;
            // score += scoreDeletedRow;

            for (let k = i; k > 0; k--) {
                gameMap[k] = gameMap[k - 1];
            }
            let temp = [];
            for (let j = 0; j < squareCountX; j++) {
                temp.push({ imageX: -1, imageY: -1 });
            }
            gameMap[0] = temp;
        }
    }
    // check there are deleted rows, then sum score
    if (deletedRows > 0) {
        console.log("deletedRows: ", deletedRows);
        score += scoreDeletedRow * deletedRows * gameSpeed;
        deletedRows = 0;
    }
};

const update = () => {
    if (!gamePause) {
        if (gameOver) return;
        if (currentShape.checkBottom()) {
            currentShape.y += 1;
        } else {
            for (let k = 0; k < currentShape.template.length; k++) {
                for (let l = 0; l < currentShape.template.length; l++) {
                    if (currentShape.template[k][l] == 0) continue;
                    const currentTruncePositionXY = currentShape.getTruncedPosition();
                    gameMap[currentTruncePositionXY.y + l][currentTruncePositionXY.x + k] = { imageX: currentShape.imageX, imageY: currentShape.imageY };
                }
            }
            deleteCompleteRows();
            currentShape = nextShape;
            nextShape = getRandomShape();
            if (!currentShape.checkBottom()) {
                gameOver = true;
            }
            score += scorePositionTetris * gameSpeed;
            drawNextShape();
        }
    }
};

const drawRect = (x, y, width, height, color) => {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, width, height);
};

const drawBackground = () => {
    drawRect(0, 0, canvas.width, canvas.height, "#cccccc");
    for (let i = 0; i < squareCountX + 1; i++) {
        drawRect(
            size * i - whiteLineThickness,
            0,
            whiteLineThickness,
            canvas.height,
            "white"
        );
    }

    for (let i = 0; i < squareCountY + 1; i++) {
        drawRect(
            0,
            size * i - whiteLineThickness,
            canvas.width,
            whiteLineThickness,
            "white"
        );
    }
};

const drawCurrentTetris = () => {
    for (let i = 0; i < currentShape.template.length; i++) {
        for (let j = 0; j < currentShape.template.length; j++) {
            if (currentShape.template[i][j] == 0) continue;
            ctx.drawImage(
                image,
                currentShape.imageX,
                currentShape.imageY,
                imageSquareSize,
                imageSquareSize,
                Math.trunc(currentShape.x) * size + size * i,
                Math.trunc(currentShape.y) * size + size * j,
                size,
                size
            );
        }
    }
};

const drawSquares = () => {
    for (let i = 0; i < gameMap.length; i++) {
        let t = gameMap[i];
        for (let j = 0; j < t.length; j++) {
            if (t[j].imageX == -1) continue;
            ctx.drawImage(
                image,
                t[j].imageX,
                t[j].imageY,
                imageSquareSize,
                imageSquareSize,
                j * size,
                i * size,
                size,
                size
            );
        }
    }
};

const drawNextShape = () => {
    nctx.fillStyle = "#000061";
    // nctx.fillStyle = "black";
    nctx.fillRect(0, 0, nextShapeCanvas.width, nextShapeCanvas.height);
    for (let i = 0; i < nextShape.template.length; i++) {
        for (let j = 0; j < nextShape.template.length; j++) {
            if (nextShape.template[i][j] == 0) continue;
            nctx.drawImage(
                image,
                nextShape.imageX,
                nextShape.imageY,
                imageSquareSize,
                imageSquareSize,
                ((nextShapeCanvas.width / 2) - ((nextShape.template.length * size) / 2) + (size * i)),
                ((nextShapeCanvas.width / 2) - ((nextShape.template.length * size) / 2) + (size * j)),
                size,
                size
            );
        }
    }
};

const drawScore = () => {
    scoreText.innerHTML = score;
};

const drawSpeed = () => {
    speedText.innerHTML = gameSpeed;
}

const drawGameOver = () => {
    // Draw background alpha black
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw text "Game Over"
    ctx.globalAlpha = 1.0;
    ctx.font = "36px Silkscreen";
    ctx.fillStyle = "white";
    ctx.textAlign = "center";
    ctx.fillText(textGameOver, canvas.width / 2, (canvas.height / 2) - displayLineheight);

    // Draw text press button
    ctx.font = "26px Silkscreen";
    for (var j = 0; j < textPressNewGame.length; j++) {
        ctx.fillText(textPressNewGame[j], canvas.width / 2, (canvas.height / 2) + (j * displayLineheight));
    }
};

const drawPause = () => {
    // Draw Background Alpha Black
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw Text "Pause"
    ctx.font = "36px Silkscreen";
    ctx.fillStyle = "white";
    ctx.textAlign = "center";
    ctx.fillText(textPause, canvas.width / 2, (canvas.height / 2) - displayLineheight);

    // Draw text press button
    ctx.font = "26px Silkscreen";
    for (var j = 0; j < textPressContinue.length; j++) {
        ctx.fillText(textPressContinue[j], canvas.width / 2, (canvas.height / 2) + (j * displayLineheight));
    }
}

const draw = () => {
    if (!gamePause) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawBackground();
        drawSquares();
        drawCurrentTetris();
        // Check first loop
        if (firstLoop) {
            drawNextShape();
            drawSpeed();
            firstLoop = false;
        }
        drawScore();
        if (gameOver) {
            drawGameOver();
        }
    }
};

const setPause = (pauseValue) => {
    // set pause or continue
    gamePause = pauseValue;
    if (gamePause) {
        drawPause();
    }
};

// Random Tetris Shape
const getRandomShape = () => {
    return Object.create(shapes[Math.floor(Math.random() * shapes.length)]);
};

const resetVars = () => {
    initialTwoDArr = [];
    for (let i = 0; i < squareCountY; i++) {
        let temp = [];
        for (let j = 0; j < squareCountX; j++) {
            temp.push({ imageX: -1, imageY: -1 });
        }
        initialTwoDArr.push(temp);
    }
    score = 0;
    gameOver = false;
    currentShape = getRandomShape();
    nextShape = getRandomShape();
    gameMap = initialTwoDArr;

    // set pause to false
    gamePause = false;

    // set dialog open to false
    openedDialogController = false;
    openedDialogSettings = false;

    // set first loop
    firstLoop = true;
};

const saveSettings = () => {
    console.log("Save settings...");
    gameSpeed = gameSpeedTemp;
    drawSpeed();
};

const blurButton = (button) => {
    button.blur();
};

// function for 'Settings' modal display & status
const setModalSettings = (setValue) => {
    openedDialogSettings = setValue;
    modalSettings.style.display = setValue ? "block" : "none";
};

// function for 'Controller' modal display & status
const setModalController = (setValue) => {
    openedDialogController = setValue;
    modalController.style.display = setValue ? "block" : "none";
};

// function for 'Controller' modal display & status
const setModalAbout = (setValue) => {
    openedDialogAbout = setValue;
    modalAbout.style.display = setValue ? "block" : "none";
};

// function for open 'Settings' modal
const openModalSettings = () => {
    if (!openedDialogSettings) {
        setModalSettings(true);

        // when open 'Settings' modal, then set highlight to item 0
        activeSettingItem = 0;
        setActiveSettingItem();

        // highlight game speed setting
        gameSpeedTemp = gameSpeed;
        setActiveGameSpeedHighLight();

        // case game not over, then set
        if (!gameOver) {
            setPause(true); // pause game
        }
    }
};

// function for close 'Settings' modal
const closeModalSettings = () => {
    if (openedDialogSettings) setModalSettings(false);
};

// function for open 'Controller' modal
const openModalController = () => {
    if (!openedDialogController) {
        setModalController(true);
        // case game not over, then set
        if (!gameOver) {
            setPause(true); // pause game
        }
    }
};

// function for close 'Controller' modal
const closeModalController = () => {
    if (openedDialogController) setModalController(false);
};

// function for open 'Controller' modal
const openModalAbout = () => {
    if (!openedDialogAbout) {
        setModalAbout(true);
        // case game not over, then set
        if (!gameOver) {
            setPause(true); // pause game
        }
    }
};

// function for close 'Controller' modal
const closeModalAbout = () => {
    if (openedDialogAbout) setModalAbout(false);
};

const setActiveGameSpeedHighLight = () => {
    for (let i = 0; i < gameSpeedItems.length; i++) {
        gameSpeedItems[i].classList.remove("game-speed-item-highlight-active");
        gameSpeedItems[i].classList.remove("game-speed-item-highlight-not-active");
        if (gameSpeedItems[i].innerText === gameSpeedTemp.toString()) {
            const classHighLight = activeSettingItem === 0 ? "game-speed-item-highlight-active" : "game-speed-item-highlight-not-active";
            gameSpeedItems[i].classList.add(classHighLight);
        }
    }
};

const prepareGameSpeedSetting = () => {
    // loop for add event mouseover
    for (let i = 0; i < gameSpeedItems.length; i++) {
        gameSpeedItems[i].addEventListener("click", (event) => {
            if (activeSettingItem === 0) {
                gameSpeedTemp = parseInt(gameSpeedItems[i].innerText);
                setActiveGameSpeedHighLight();
            }
        });
    }
};

// function set 'active' or 'highlight' setting item
const setActiveSettingItem = () => {
    for (let i = 0; i < settingItems.length; i++) {
        // Gathering tag 'i' cursor element
        let cursor = settingItems[i].querySelector("i");
        if (i === activeSettingItem) {
            settingItems[i].classList.add("setting-item-highlight");
            cursor.style.display = "inline-block";
        } else {
            settingItems[i].classList.remove("setting-item-highlight");
            cursor.style.display = "none";
        }
    }
};

// function repare 'Setting Items' actions
const prepareSettingItems = () => {
    // Set default active item at index 0
    activeSettingItem = 0;

    // loop for add event mouseover
    for (let i = 0; i < settingItems.length; i++) {
        settingItems[i].addEventListener("mouseover", (event) => {
            activeSettingItem = i;
            setActiveSettingItem();
            setActiveGameSpeedHighLight();
        });
    }
};

// Add Event 'Keydown' for play game
window.addEventListener("keydown", (event) => {
    if (!openedDialogController && !openedDialogSettings && !openedDialogAbout) {
        if (!gameOver) {
            if (!gamePause) {
                if (event.keyCode == 37) currentShape.moveLeft();   // key 'left' for move to left
                else if (event.keyCode == 38) currentShape.clockwiseRotation();    // key 'up' for Tetris rotation
                else if (event.keyCode == 39) currentShape.moveRight(); // key 'right' for move to bottom
                else if (event.keyCode == 40) currentShape.moveBottom();    // key 'down' for move to bottom
                else if (event.keyCode == 68) currentShape.clockwiseRotation();    // key 'd' for Tetris rotation
                else if (event.keyCode == 83) currentShape.counterClockwiseRotation();    // key 's' for Tetris rotation
            }
            if (event.keyCode == 32 && !openedDialogController && !openedDialogSettings) {  // key 'spacebar' for pause/continue game
                setPause(!gamePause);;
            }
        }
        if (event.keyCode == 82) resetVars();  // key 'r' for refresh game
        if (event.keyCode == 67) openModalController(); // key 'c' for open controller dialog
        if (event.keyCode == 69) openModalSettings();  // key 'e' for open settings dialog
        if (event.keyCode == 65) openModalAbout();  // key 'a' for open settings dialog
    }

    if (openedDialogController) {
        if (event.keyCode == 88) closeModalController();    // key 'x' for exit controller dialog
    }

    if (openedDialogAbout) {
        if (event.keyCode == 88) closeModalAbout();    // key 'x' for exit controller dialog
        if (event.keyCode == 13) {  // key 'Enter' for open GitHub Link
            linkGitHub.click();
        }
    }

    if (openedDialogSettings) {
        if (event.keyCode == 38) {  // key 'up' for move to above item
            // move to previous active index
            activeSettingItem -= 1;

            // activeSettingItem lower min index
            if (activeSettingItem < 0) activeSettingItem += 1;

            setActiveSettingItem();
            setActiveGameSpeedHighLight();
        };
        if (event.keyCode == 40) {  // key 'down' for move to below item
            // move to next active index
            activeSettingItem += 1;

            // activeSettingItem more than max index
            if (activeSettingItem > (settingItems.length - 1)) activeSettingItem -= 1;

            setActiveSettingItem();
            setActiveGameSpeedHighLight();
        }

        if (activeSettingItem === 0) {  // if setting item is at 'Game speed'
            if (event.keyCode == 37 && gameSpeedTemp > 1) {
                gameSpeedTemp -= 1;
                setActiveGameSpeedHighLight();
            }

            if (event.keyCode == 39 && gameSpeedTemp < gameSpeedItems.length) {
                gameSpeedTemp += 1;
                setActiveGameSpeedHighLight();
            }
        }

        if (event.keyCode == 83) {  // key 's' for save settings
            saveSettings();
            closeModalSettings();
            resetVars();
            gameLoop();
        }

        if (event.keyCode == 88) closeModalSettings();  // key 'x' for exit settings dialog
    }
});

// Add Event 'refresh' button click
btnRefresh.addEventListener("click", () => {
    btnRefresh.blur();
    resetVars();
});

btnOpenSetttings.addEventListener("click", () => {
    blurButton(btnOpenSetttings);
    openModalSettings();
});

btnCloseSettings.addEventListener("click", () => {
    blurButton(btnCloseSettings);
    closeModalSettings();
});

btnOpenController.addEventListener("click", () => {
    blurButton(btnOpenController);
    openModalController();
});

btnCloseController.addEventListener("click", () => {
    blurButton(btnCloseController);
    closeModalController();
});

btnOpenAbout.addEventListener("click", () => {
    blurButton(btnOpenAbout);
    openModalAbout();
});

btnCloseAbout.addEventListener("click", () => {
    blurButton(btnCloseAbout);
    closeModalAbout();
});

// Add Event 'refresh' button click
btnSaveSettings.addEventListener("click", () => {
    saveSettings();
    blurButton(btnSaveSettings);
    closeModalSettings();
    resetVars();
    gameLoop();
});

prepareSettingItems();
prepareGameSpeedSetting();

resetVars();
gameLoop();