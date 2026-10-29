"use strict";
    /* -------------------- Global Variables and Constants -------------------- */
    const cols = 20;
    const rows = 20;
    const cellSize = 30; // each cell is 30x30 pixels
    let grid = [];
    let current;          // current cell for maze generation
    let stack = [];
    // This will store the player's traced solution as an array of {col, row} objects.
    let solutionPath = [];
    // Starting cell at (0,0) and finish cell at (cols-1, rows-1)
    const startCell = { col: 0, row: 0 };
    const finishCell = { col: cols - 1, row: rows - 1 };
    // Canvas and context
    const canvas = document.getElementById("mazeCanvas");
    const ctx = canvas.getContext("2d");
    const messageEl = document.getElementById("message");
    
    /* -------------------- Cell Class -------------------- */
    class Cell {
      constructor(col, row) {
        this.col = col;
        this.row = row;
        // Walls: top, right, bottom, left are initially all true.
        this.walls = { top: true, right: true, bottom: true, left: true };
        this.visited = false;
      }
      
      draw() {
        const x = this.col * cellSize;
        const y = this.row * cellSize;
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 2;
        if (this.walls.top) {
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + cellSize, y);
          ctx.stroke();
        }
        if (this.walls.right) {
          ctx.beginPath();
          ctx.moveTo(x + cellSize, y);
          ctx.lineTo(x + cellSize, y + cellSize);
          ctx.stroke();
        }
        if (this.walls.bottom) {
          ctx.beginPath();
          ctx.moveTo(x + cellSize, y + cellSize);
          ctx.lineTo(x, y + cellSize);
          ctx.stroke();
        }
        if (this.walls.left) {
          ctx.beginPath();
          ctx.moveTo(x, y + cellSize);
          ctx.lineTo(x, y);
          ctx.stroke();
        }
      }
      
      // Highlight this cell with the given color.
      highlight(color) {
        const x = this.col * cellSize;
        const y = this.row * cellSize;
        ctx.fillStyle = color;
        ctx.fillRect(x, y, cellSize, cellSize);
      }
    }
    
    /* -------------------- Create Maze Grid -------------------- */
    function createGrid() {
      grid = [];
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          grid.push(new Cell(c, r));
        }
      }
    }
    
    function index(col, row) {
      if (col < 0 || row < 0 || col >= cols || row >= rows) return -1;
      return col + row * cols;
    }
    
    /* -------------------- Maze Generation (Recursive Backtracking) -------------------- */
    function generateMaze() {
      createGrid();
      current = grid[0];
      current.visited = true;
      stack = [];
      
      function step() {
        let next = checkNeighbors(current);
        if (next) {
          next.visited = true;
          stack.push(current);
          removeWalls(current, next);
          current = next;
          drawMaze();
          setTimeout(step, 5);
        } else if (stack.length > 0) {
          current = stack.pop();
          drawMaze();
          setTimeout(step, 5);
        } else {
          drawMaze();
          // Maze generation complete. Reset the solution path to only contain the start cell.
          solutionPath = [{ col: startCell.col, row: startCell.row }];
          messageEl.innerText = "Use W, A, S, D to trace your path.";
          drawPlayerPath();
        }
      }
      
      step();
    }
    
    function checkNeighbors(cell) {
      let neighbors = [];
      const top = grid[index(cell.col, cell.row - 1)];
      const right = grid[index(cell.col + 1, cell.row)];
      const bottom = grid[index(cell.col, cell.row + 1)];
      const left = grid[index(cell.col - 1, cell.row)];
      
      if (top && !top.visited) neighbors.push(top);
      if (right && !right.visited) neighbors.push(right);
      if (bottom && !bottom.visited) neighbors.push(bottom);
      if (left && !left.visited) neighbors.push(left);
      
      if (neighbors.length > 0) {
        const r = Math.floor(Math.random() * neighbors.length);
        return neighbors[r];
      } else {
        return undefined;
      }
    }
    
    function removeWalls(a, b) {
      const x = a.col - b.col;
      const y = a.row - b.row;
      if (x === 1) {
        a.walls.left = false;
        b.walls.right = false;
      } else if (x === -1) {
        a.walls.right = false;
        b.walls.left = false;
      }
      if (y === 1) {
        a.walls.top = false;
        b.walls.bottom = false;
      } else if (y === -1) {
        a.walls.bottom = false;
        b.walls.top = false;
      }
    }
    
    /* -------------------- Draw Maze and Special Cells -------------------- */
    function drawMaze() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      grid.forEach(cell => cell.draw());
      // Highlight the start cell (green) and finish cell (red).
      grid[index(startCell.col, startCell.row)].highlight("lightgreen");
      grid[index(finishCell.col, finishCell.row)].highlight("lightcoral");
      // Redraw walls to ensure clarity.
      grid[index(startCell.col, startCell.row)].draw();
      grid[index(finishCell.col, finishCell.row)].draw();
      // Draw the player's solution path.
      drawPlayerPath();
    }
    
    /* -------------------- Draw Player's Path -------------------- */
    function drawPlayerPath() {
      if (solutionPath.length > 1) {
        ctx.strokeStyle = "blue";
        ctx.lineWidth = 4;
        ctx.beginPath();
        for (let i = 0; i < solutionPath.length; i++) {
          const { col, row } = solutionPath[i];
          const x = col * cellSize + cellSize / 2;
          const y = row * cellSize + cellSize / 2;
          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.stroke();
      }
    }
    
    /* -------------------- Keyboard Movement using WASD -------------------- */
    document.addEventListener("keydown", function(e) {
      const key = e.key.toLowerCase();
      if (!["w", "a", "s", "d"].includes(key)) return;
      e.preventDefault();
      
      if (grid.length === 0) return;
      const last = solutionPath[solutionPath.length - 1];
      const curr = grid[index(last.col, last.row)];
      let newPos = { col: last.col, row: last.row };
      
      if (key === "w") {
        if (!curr.walls.top) newPos.row--;
      } else if (key === "s") {
        if (!curr.walls.bottom) newPos.row++;
      } else if (key === "a") {
        if (!curr.walls.left) newPos.col--;
      } else if (key === "d") {
        if (!curr.walls.right) newPos.col++;
      }
      
      if (newPos.col < 0 || newPos.row < 0 || newPos.col >= cols || newPos.row >= rows) return;
      
      // If pressing back (moving to the previous cell), remove last step.
      if (solutionPath.length > 1) {
        const penultimate = solutionPath[solutionPath.length - 2];
        if (penultimate.col === newPos.col && penultimate.row === newPos.row) {
          solutionPath.pop();
          drawMaze();
          checkWin();
          return;
        }
      }
      
      // Avoid loops: if new position already exists in the path, skip.
      for (let cell of solutionPath) {
        if (cell.col === newPos.col && cell.row === newPos.row) return;
      }
      
      // Add new position
      solutionPath.push(newPos);
      drawMaze();
      checkWin();
    });
    
    function resetPath() {
      solutionPath = [{ col: startCell.col, row: startCell.row }];
      drawMaze();
      messageEl.innerText = "";
    }
    
    /* -------------------- Check Win Condition -------------------- */
    function checkWin() {
      const last = solutionPath[solutionPath.length - 1];
      if (last.col === finishCell.col && last.row === finishCell.row) {
        // When the finish cell is reached, prompt the user.
        const playAgain = confirm("Congratulations, you have completed the maze!\nDo you want to generate a new maze? Click OK for a new maze or Cancel to close the window.");
        if (playAgain) {
          newMaze();
        } else {
          window.close();
        }
      }
    }
    
    /* -------------------- New Maze Generation -------------------- */
    function newMaze() {
      messageEl.innerText = "Generating maze...";
      // Clear any previous solution path.
      solutionPath = [];
      generateMaze();
      // Reattach the WASD key listener to prevent default scrolling.
      document.addEventListener("keydown", function(e) {
        const key = e.key.toLowerCase();
        if (!["w", "a", "s", "d"].includes(key)) return;
        e.preventDefault();
      });
    }
    
    /* -------------------- Export Functions -------------------- */
    function downloadImage(format) {
      const dataURL = canvas.toDataURL("image/" + format);
      const link = document.createElement("a");
      link.download = "maze." + (format === "jpeg" ? "jpg" : format);
      link.href = dataURL;
      link.click();
    }
    
    async function downloadPDF() {
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF("p", "pt", [canvas.width, canvas.height]);
      const imgData = canvas.toDataURL("image/png");
      pdf.addImage(imgData, "PNG", 0, 0, canvas.width, canvas.height);
      pdf.save("maze.pdf");
    }
    
    /* -------------------- Start Maze on Page Load -------------------- */
    newMaze();
