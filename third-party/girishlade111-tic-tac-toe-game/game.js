// game.js

class Game {
  constructor() {
    this.board = Array(9).fill(null);
    this.currentPlayer = 'X';
    this.scores = { X: 0, O: 0 };
    this.history = [];
    this.currentIndex = -1;
    this.mysteryMode = false;
    this.soundsEnabled = true;
    this.timer = null;
    this.timeLeft = 10;
    this.symbols = { X: 'X', O: 'O' };
    this.soundClick = new Audio('click.mp3');
    this.soundWin = new Audio('win.mp3');
    this.soundDraw = new Audio('draw.mp3');
    this.init();
  }

  init() {
    this.createBoard();
    this.initEventListeners();
    this.startTimer();
    this.createBgParticles();
    this.animateBg();
  }

  createBoard() {
    const board = document.getElementById('board');
    board.innerHTML = '';
    for (let i = 0; i < 9; i++) {
      const cell = document.createElement('div');
      cell.classList.add('cell');
      cell.dataset.index = i;
      board.appendChild(cell);
    }
    this.cells = Array.from(document.querySelectorAll('.cell'));
  }

  initEventListeners() {
    document.getElementById('reset-button').addEventListener('click', () => this.resetGame());
    document.getElementById('undo-button').addEventListener('click', () => this.undo());
    document.getElementById('mystery-toggle').addEventListener('change', e => {
      this.mysteryMode = e.target.checked;
      this.activateMysteryMode();
    });
    document.getElementById('sound-toggle').addEventListener('change', e => {
      this.soundsEnabled = e.target.checked;
    });
    document.getElementById('play-again').addEventListener('click', () => this.hideVictoryScreen());
    this.cells.forEach(cell => cell.addEventListener('click', () => this.handleMove(cell.dataset.index)));
  }

  activateMysteryMode() {
    const symbols = ['🔥', '🌟', '💀', '🍕', '⚽', '🎉', '🎈', '💎'];
    this.symbols.X = symbols[Math.floor(Math.random() * symbols.length)];
    this.symbols.O = symbols[Math.floor(Math.random() * symbols.length)];
    this.render();
  }

  handleMove(index) {
    if (this.board[index] || this.checkWin()) return;
    this.board[index] = this.currentPlayer;
    this.saveHistory();
    this.render();
    this.playSound('click');

    if (this.checkWin()) {
      this.scores[this.currentPlayer]++;
      this.updateScoreboard();
      this.showVictoryScreen(`${this.symbols[this.currentPlayer]} Wins!`);
      this.playSound('win');
      this.createVictoryParticles();
    } else if (this.isDraw()) {
      this.showVictoryScreen("It's a Draw!");
      this.playSound('draw');
      this.createVictoryParticles(true);
    } else {
      this.switchPlayer();
      this.startTimer();
    }
  }

  saveHistory() {
    this.history = this.history.slice(0, this.currentIndex + 1);
    this.history.push([...this.board]);
    this.currentIndex++;
  }

  undo() {
    if (this.currentIndex <= 0) return;
    this.currentIndex--;
    this.board = [...this.history[this.currentIndex]];
    this.render();
    clearInterval(this.timer);
    this.startTimer();
  }

  switchPlayer() {
    this.currentPlayer = this.currentPlayer === 'X' ? 'O' : 'X';
  }

  startTimer() {
    this.timeLeft = 10;
    this.updateProgress();
    clearInterval(this.timer);
    this.timer = setInterval(() => {
      this.timeLeft--;
      this.updateProgress();
      if (this.timeLeft <= 0) {
        this.switchPlayer();
        this.startTimer();
      }
    }, 1000);
  }

  updateProgress() {
    const percent = ((10 - this.timeLeft) / 10) * 100;
    document.querySelector('.progress-fill').style.width = `${percent}%`;
  }

  resetGame() {
    this.board = Array(9).fill(null);
    this.currentPlayer = 'X';
    this.history = [];
    this.currentIndex = -1;
    this.render();
    clearInterval(this.timer);
    this.startTimer();
    this.hideVictoryScreen();
  }

  showVictoryScreen(message) {
    document.getElementById('victory-message').textContent = message;
    document.getElementById('victory-screen').style.display = 'block';
  }

  hideVictoryScreen() {
    document.getElementById('victory-screen').style.display = 'none';
    this.resetGame();
  }

  playSound(type) {
    if (!this.soundsEnabled) return;
    switch(type) {
      case 'click': this.soundClick.play(); break;
      case 'win': this.soundWin.play(); break;
      case 'draw': this.soundDraw.play(); break;
    }
  }

  updateScoreboard() {
    document.getElementById('score-X').textContent = this.scores.X;
    document.getElementById('score-O').textContent = this.scores.O;
  }

  checkWin() {
    const lines = [
      [0,1,2],[3,4,5],[6,7,8],
      [0,3,6],[1,4,7],[2,5,8],
      [0,4,8],[2,4,6]
    ];
    return lines.some(([a,b,c]) =>
      this.board[a] &&
      this.board[a] === this.board[b] &&
      this.board[a] === this.board[c]
    );
  }

  isDraw() {
    return this.board.every(cell => cell !== null) && !this.checkWin();
  }

  createVictoryParticles(isDraw = false) {
    const winLines = this.getWinningLines();
    const cells = isDraw
      ? this.cells
      : winLines.flatMap(line => line.map(i => this.cells[i]));

    createVictoryParticles(cells);
  }

  getWinningLines() {
    const lines = [
      [0,1,2],[3,4,5],[6,7,8],
      [0,3,6],[1,4,7],[2,5,8],
      [0,4,8],[2,4,6]
    ];
    return lines.filter(([a,b,c]) =>
      this.board[a] &&
      this.board[a] === this.board[b] &&
      this.board[a] === this.board[c]
    );
  }

  render() {
    this.cells.forEach((cell, i) => {
      const mark = this.board[i];
      cell.innerHTML = '';
      if (mark) {
        if (this.mysteryMode) {
          cell.textContent = this.symbols[mark];
        } else {
          const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
          svg.setAttribute('viewBox', '0 0 100 100');
          svg.setAttribute('width', '80%');
          svg.setAttribute('height', '80%');
          if (mark === 'X') {
            const line1 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line1.setAttribute('x1', '10');
            line1.setAttribute('y1', '10');
            line1.setAttribute('x2', '90');
            line1.setAttribute('y2', '90');
            line1.setAttribute('stroke', '#0ff');
            line1.setAttribute('stroke-width', '10');
            svg.appendChild(line1);
            const line2 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line2.setAttribute('x1', '90');
            line2.setAttribute('y1', '10');
            line2.setAttribute('x2', '10');
            line2.setAttribute('y2', '90');
            line2.setAttribute('stroke', '#0ff');
            line2.setAttribute('stroke-width', '10');
            svg.appendChild(line2);
          } else {
            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('cx', '50');
            circle.setAttribute('cy', '50');
            circle.setAttribute('r', '40');
            circle.setAttribute('stroke', '#0ff');
            circle.setAttribute('stroke-width', '10');
            circle.setAttribute('fill', 'none');
            svg.appendChild(circle);
          }
          cell.appendChild(svg);
        }
      }
    });
  }

  // Background particles
  createBgParticles() {
    this.bgCanvas = document.getElementById('bg-particles');
    this.bgCtx = this.bgCanvas.getContext('2d');
    this.bgParticles = Array.from({ length: 100 }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      r: Math.random() * 2 + 1,
      dx: (Math.random() - 0.5) * 0.5,
      dy: (Math.random() - 0.5) * 0.5,
    }));
  }

  animateBg() {
    this.bgCtx.clearRect(0, 0, this.bgCanvas.width, this.bgCanvas.height);
    this.bgParticles.forEach(p => {
      p.x += p.dx;
      p.y += p.dy;
      if (p.x < 0 || p.x > this.bgCanvas.width) p.dx *= -1;
      if (p.y < 0 || p.y > this.bgCanvas.height) p.dy *= -1;
      this.bgCtx.beginPath();
      this.bgCtx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      this.bgCtx.fillStyle = 'rgba(0,255,255,0.5)';
      this.bgCtx.fill();
    });
    requestAnimationFrame(() => this.animateBg());
  }

  // Victory Particles
  createVictoryParticles(cells) {
    const particlesToCreate = [];
    cells.forEach(cell => {
      const rect = cell.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      for (let i = 0; i < 30; i++) {
        particlesToCreate.push({
          x, y,
          vx: (Math.random() - 0.5) * 6,
          vy: (Math.random() - 0.5) * 6,
          alpha: 1,
          size: Math.random() * 5 + 2,
          hue: Math.random() * 360
        });
      }
    });
    animateVictoryParticles(particlesToCreate);
  }
}

function animateVictoryParticles(particles) {
  const canvas = document.getElementById('win-particles');
  const ctx = canvas.getContext('2d');
  let duration = 1000;
  let start = performance.now();
  function frame(now) {
    let t = (now - start) / duration;
    if (t > 1) t = 1;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => {
      if (p.alpha <= 0) return;
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.1;
      p.alpha -= 0.02;
      ctx.beginPath();
      ctx.fillStyle = `hsla(${p.hue}, 100%, 50%, ${p.alpha})`;
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    });
    if (t < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

window.addEventListener('DOMContentLoaded', () => new Game());