// GAME-RELATED FUNCTIONS

const backgroundOrder = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 0],
    tileContainer = document.querySelector(".tiles-container"),
    tiles = document.querySelectorAll(".tile");

let currentWindowSize,
    currentOrder,
    firstMove = true, 
    moves = 0, 
    timerId, 
    timer = 0;

    
// Define tile size for desktop/mobile
function measureScreen() {

    let newWindowSize = window.innerWidth;

    if ((newWindowSize <= 700 && currentWindowSize > 700)
        || (newWindowSize > 700 && currentWindowSize <= 700)) {
        rearrangeTiles(currentOrder);
    }
    currentWindowSize = newWindowSize;
}

// Put tiles in the right places if switching between desktop/mobile and during scrambling
function rearrangeTiles(order) {

    tiles.forEach(function(item) {
        backgroundTile = document.getElementById("b" + (order.indexOf(parseInt(item.id.slice(1,))) + 1));

        item.style.left = Math.round(backgroundTile.getBoundingClientRect().left - tileContainer.getBoundingClientRect().left) + "px";
        item.style.top = Math.round(backgroundTile.getBoundingClientRect().top - tileContainer.getBoundingClientRect().top) + "px";
    });
}

// Check for previous state of the game
function checkSavedState() {

    let previousOrder = localStorage.getItem("currentOrder");

    if (previousOrder && previousOrder.length > 0 && previousOrder !== ("undefined" || "null")) {

        currentOrder = previousOrder.split(",").map(item =>
            parseInt(item)
        );    

        buildLayout(currentOrder);
        
        moves = parseInt(localStorage.getItem("moves"));
        timer = parseInt(localStorage.getItem("timer"));

    } else {
        initiateLayout();
    }    
}    

// Generate a random layout
function randomize() {
    let order = [],
        rand = 0;

    do {
        rand = Math.round(Math.random() * 15);
        if (order.indexOf(rand) < 0) {
            order.push(rand);
        }
    } while (order.length < 16);

    // Check if the order equals the solved state
    if (order === backgroundOrder) {
        return false;
    
    } else {
    // Check if the puzzle is solvable - www.geeksforgeeks.org/check-instance-15-puzzle-solvable/

        // 1. Get the row number of empty tile from the bottom 
        let e = Math.floor((16 - (order.indexOf(0) + 1)) / 4) + 1;

        // 2. Calculate the number of inversions
        let N = 0; 
        order.forEach(function(item) {
            for (let i = order.indexOf(item); i < 16; i++) {
                if (item > order[i] && order[i] !== 0) {
                    N++;
                }
            }
        });

        // 3. Check if their sum is odd 
        let sum = N + e;
        if (sum % 2 === 0) {    // unsolvable
            return false;
        } else {                // solvable
            return order;
        }
    }
}

// Get solvable tile order
function initiateLayout() {

    let order;

    do {
        order = randomize();
    } while (order === false)

    currentOrder = order;
    localStorage.setItem("currentOrder", currentOrder);

    return buildLayout(order);
}

// Create layout from a tile order
function buildLayout(order) {

    let n = 0;

    order.forEach(function(item) {
        let tile = tiles[n];
        tile.id = "t" + item;

        if (item === 0) {
            tile.classList.add("empty-tile");
            tile.querySelector("p").innerHTML = "";
        } else {
            tile.querySelector("p").innerHTML = item;
            tile.classList.remove("empty-tile");
        }
        n++;
    });

    //Check which tiles already are in correct places
    return checkSolved(order);
}

// See if the clicked tile can move, define tile order after the move
function shouldTileMove(event) {

    if (!showingSolved) {

        let t0Ind = currentOrder.indexOf(0),
            clickedTile,
            clickedTileInd,
            newOrder = currentOrder;

        switch(event.type) {

            case "mousedown":

                clickedTile = parseInt(event.currentTarget.id.slice(1));
                clickedTileInd = currentOrder.indexOf(clickedTile);

            break;

            case "touchstart":

                event.preventDefault();     // prevent page scrolling while playing
                document.querySelector(".field").focus();

                clickedTile = parseInt(event.currentTarget.id.slice(1));
                clickedTileInd = currentOrder.indexOf(clickedTile);
                
            break;

            case "keydown":

                if (event.key === "ArrowUp" || event.key === "ArrowDown" || event.key === "ArrowRight" || event.key === "ArrowLeft") {

                    event.preventDefault();     // prevent page scrolling while playing

                    switch(event.key) {
                        case "ArrowUp":
                            clickedTileInd = t0Ind + 4;
                        break;
                        case "ArrowDown":
                            clickedTileInd = t0Ind - 4;
                        break;
                        case "ArrowRight":
                            clickedTileInd = t0Ind - 1;
                        break;
                        case "ArrowLeft":
                            clickedTileInd = t0Ind + 1;
                        break;                            
                    }
                    clickedTile = newOrder[clickedTileInd];
                }
            break;
        }

        if ((clickedTile)
            && ((clickedTileInd === t0Ind - 1 && t0Ind % 4 !== 0)
                || (clickedTileInd === t0Ind + 1 && (t0Ind + 1) % 4 !== 0)
                || clickedTileInd === t0Ind + 4 
                || clickedTileInd === t0Ind - 4)) {
            
            newOrder[clickedTileInd] = 0;
            newOrder[t0Ind] = clickedTile;

            updateZindex(newOrder);

            return moveTile(newOrder, clickedTile);
        }
    }
}

// Update tiles stacking order during the move
function updateZindex(newOrder) {

    for (let z = 0; z < 16; z++) {
        elem = document.getElementById("t" + newOrder[z]);
        elem.style.zIndex = z + 1;
    }
}

// Move the tile
function moveTile(newOrder, clickedTile) {

    if (firstMove) {
        timerId = setInterval(function() {
            timer++;
            localStorage.setItem("timer", timer);
        }, 1000);
        firstMove = false;
    }

    moves++;
    localStorage.setItem("moves", moves);

    let movingTile = document.getElementById("t" + clickedTile),
        t0 = document.getElementById("t0"),
        backgroundMovingTile = document.getElementById("b" + parseInt(newOrder.indexOf(clickedTile) + 1)),
        backgroundT0 = document.getElementById("b" + parseInt(newOrder.indexOf(0) + 1));

    movingTile.style.left = Math.round(backgroundMovingTile.getBoundingClientRect().left - tileContainer.getBoundingClientRect().left) + "px";
    movingTile.style.top = Math.round(backgroundMovingTile.getBoundingClientRect().top - tileContainer.getBoundingClientRect().top) + "px";

    t0.style.left = Math.round(backgroundT0.getBoundingClientRect().left - tileContainer.getBoundingClientRect().left) + "px";
    t0.style.top = Math.round(backgroundT0.getBoundingClientRect().top - tileContainer.getBoundingClientRect().top) + "px";

    currentOrder = newOrder;
    localStorage.setItem("currentOrder", currentOrder);

    return checkSolved(currentOrder);
}

// Check which tiles are in correct spots
function checkSolved(order) {

    let correctTiles = 0;

    order.forEach(function(item) {
        if (item === backgroundOrder[order.indexOf(item)]) {
            document.getElementById("t" + item).classList.add("correct-tile");
            correctTiles++;
        } else {
            document.getElementById("t" + item).classList.remove("correct-tile");
        }
    });

    //Check if the puzzle is solved
    setTimeout(function() {
        if (correctTiles === 16 && showingSolved === false && timer > 0) {
            clearInterval(timerId);
            
            let timeSolved = [Math.floor(timer / 3600), 
                            Math.floor((timer % 3600) / 60),
                            (timer % 3600) % 60];
            
            timeSolved = timeSolved.map(function(item) {
                item = item.toString();

                if (item.length < 2) {
                    item = "0" + item;
                }
                return item;
            });
            
            document.getElementById("alert-text").innerHTML = `You solved it in ${timeSolved[0]}:${timeSolved[1]}:${timeSolved[2]} and ${moves} moves!`;
            openWinAlert();

            localStorage.setItem("currentOrder", "");
            localStorage.setItem("moves", 0);
            localStorage.setItem("timer", 0);
        }
    }, 400);
}



// UI-RELATED FUNCTIONS

const menuButton = document.querySelector(".menu-button"),
    navOverlay = document.querySelector(".nav-overlay"),
    menuLis = document.querySelectorAll(".nav-overlay li"),
    themeToggle = document.querySelector(".theme-button"),
    seeSolvedButton = document.querySelector(".btn-solved"),
    scrambleButton = document.querySelector(".btn-scramble"),
    body = document.querySelector("body"),
    winAlert = document.querySelector(".win-alert");

let menuOpen = false,
    colorTheme,
    showingSolved = false;


// Hamburger menu
function toggleMenu() {

    let hamburger = menuButton.querySelector(".hamburger");

    if (!menuOpen) {
        hamburger.classList.add("hamburger-active");
        navOverlay.classList.add("nav-overlay-active");
        
        menuLis.forEach(item => 
            item.classList.add("menu-li-active")
        );
        
        setTimeout(function() {
            hamburger.classList.add("cross");            
        }, 300);

        body.classList.add("no-scroll");
        body.addEventListener("click", clickOutsideMenu, false);

        setTimeout(function() {
            menuOpen = true;
        }, 300);

    } else {
        hamburger.classList.remove("cross");
        navOverlay.classList.remove("nav-overlay-active");
       
        menuLis.forEach(item => 
            item.classList.remove("menu-li-active")
        );
       
        setTimeout(function() {
            hamburger.classList.remove("hamburger-active");
        }, 300);
       
        body.classList.remove("no-scroll");
        body.removeEventListener("click", clickOutsideMenu, false);

        menuOpen = false;
    }
}

function clickOutsideMenu(event) {
    if (menuOpen
        && event.clientY > navOverlay.getBoundingClientRect().bottom) {
        toggleMenu();
    }
}

// Check for previous color theme
function checkSavedTheme() {

    let previousTheme = localStorage.getItem("colorTheme");

    if (previousTheme && previousTheme !== ("undefined" || "null")) {
        colorTheme = previousTheme;
    } else {
        colorTheme = "light"
    }

    body.classList.add(colorTheme);
    localStorage.setItem("colorTheme", colorTheme);
}

// Color theme toggle
function toggleTheme() {    

    if (colorTheme === "light") {
        body.classList.add("dark");
        body.classList.remove("light");
        colorTheme = "dark";

    } else if (colorTheme === "dark") {
        body.classList.add("light");
        body.classList.remove("dark");
        colorTheme = "light";
    }

    localStorage.setItem("colorTheme", colorTheme);
}

// See Solved button clicked
function showSolved() {

    tiles.forEach(item => {
        item.classList.add("tile-load");
        item.style.left = "8.2em";
        item.style.top = "8.2em";
    });

    if (!showingSolved) {

        showingSolved = true;

        seeSolvedButton.classList.add("btn-solved-active");
        seeSolvedButton.innerHTML = "Back to playing";

        setTimeout(function() {

            buildLayout(backgroundOrder);
            rearrangeTiles(backgroundOrder);
            updateZindex(backgroundOrder);
        
            tiles.forEach(item => {
            item.classList.remove("tile-load");
            });
        }, 600);

    } else {

        showingSolved = false;

        seeSolvedButton.classList.remove("btn-solved-active");
        seeSolvedButton.innerHTML = "See solved";

        setTimeout(function() {
            
            buildLayout(currentOrder);
            rearrangeTiles(currentOrder);
            updateZindex(currentOrder);
            
            tiles.forEach(item => {
            item.classList.remove("tile-load");
            });
        }, 600);
    }
}

//Scramble button clicked
function scramble() {

    tiles.forEach(item => {
        item.classList.add("tile-load");
        item.style.left = "8.2em";
        item.style.top = "8.2em";
    });

    moves = 0;
    localStorage.setItem("moves", moves);

    firstMove = true;
    timer = 0;
    localStorage.setItem("timer", timer);

    if (showingSolved) {
        showSolved();
    }

    setTimeout(function() {
        initiateLayout();
        rearrangeTiles(currentOrder);
        updateZindex(currentOrder);    

        tiles.forEach(item => {
        item.classList.remove("tile-load");
        });
    }, 600);
}

//Win alert functions
function openWinAlert() {

    winAlert.classList.add("win-alert-active");
    winAlert.querySelector(".alert-cross").addEventListener("click", closeWinAlert, false);
    winAlert.querySelector(".btn-play-again").addEventListener("click", playAgain, false);
}

function closeWinAlert() {

    winAlert.querySelector(".alert-cross").removeEventListener("click", closeWinAlert, false);
    winAlert.querySelector(".btn-play-again").removeEventListener("click", playAgain, false);
    document.getElementById("alert-text").innerHTML = '';
    winAlert.classList.remove("win-alert-active");
}

function playAgain() {

    closeWinAlert();
    scramble();
}



// EXECUTE UPON LOAD

document.addEventListener('DOMContentLoaded', function() {

    // Check for saved parameters    
    checkSavedTheme();
    measureScreen();
    checkSavedState();

    // Add event listeners on tiles, start animation
    tiles.forEach(item => {
        item.addEventListener("mousedown", shouldTileMove, false);
        item.addEventListener("touchstart", shouldTileMove, false);
        item.classList.remove("tile-load");
    });
    document.querySelector(".field").addEventListener("keydown", shouldTileMove, false);

    //Buttons event listeners
    scrambleButton.addEventListener("click", scramble, false);
    seeSolvedButton.addEventListener("click", showSolved, false);
    
    //Menu event listeners
    menuButton.addEventListener("click", toggleMenu, false);
    navOverlay.addEventListener("click", toggleMenu, false);
    themeToggle.addEventListener("click", toggleTheme, false);

    // Window event listeners
    window.addEventListener("resize", measureScreen, false);
}, false);
