class SpaceInvadersGame {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext("2d");
        this.setupCanvas();
        this.init();
    }

    setupCanvas() {
        // Ajustar canvas para alta DPI
        const dpr = window.devicePixelRatio || 1;
        const rect = this.canvas.getBoundingClientRect();
        
        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        this.canvas.style.width = rect.width + 'px';
        this.canvas.style.height = rect.height + 'px';
        
        this.ctx.scale(dpr, dpr);
        this.actualWidth = rect.width;
        this.actualHeight = rect.height;
    }

    init() {
        // Detectar dispositivo móvel
        this.isMobile = this.detectMobile();
        
        // Configurações globais
        this.gameState = 'start';
        this.animationID = null;
        this.frameCount = 0;
        this.fps = 60;
        this.interval = 1000 / this.fps;
        this.then = Date.now();

        // Sprites
        this.spriteBase64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAAEACAYAAAADRnAGAAACGUlEQVR42u3aSQ7CMBAEQIsn8P+/hiviAAK8zFOLtZQbELuRHGfGY0zI9WdG9AAAAKAVwBU8AAAA6DPZ5SgAAACYfrPV3wcAAIBFEAAAAOdqCqcXyfAFEwAAigF8O+DVnwcAAMDemmCGPgUAAAAO7WyiL7zSdY7Kt8MBAAAQ622wPAgAAM0A2pfAAQBIBDDGALMnlO58AAAAzQCcDwAAoPfe4PQimK4XCABAYAC9QQAAdIdPd2fTV4UBAAAQG0B7HAAAAK0BnA8AAKAXgPMBAADoAmmPAwAAwPkAAADqA8xAi/Z7AAAA2NupcUYIAIC8ACcGuAIYAAAAcRa9aPcLX0Ue2QMAAIC8AHqDAADoDusLAAAAAPa97aU/HwAAQDMA5wMAAOi9QtruRTJ91RcAgOQA0TdCAAAAyLUmpJswAAAAALwNsNv9AAAA0BhgxlZ194SX1wQBAACBSucAAADYCzBjQLt/DwAAAPsAnA8AAKD2CZHWx2EAAAAAqsIAAJQHiPYPHH8KAAAAoBeA8wEAAAAANg7wh/b4/fUCAAAAvUvE4RY9AACaVYGjtccBAABQF4DzAQAAxAOIvhECAADAUYDZBRcAAAAcXTP4d1MSvgIEAAAAACtzu+7X8zW6BQAAAL0AXif86QIAAAAAAAAA5Blw9AsAAAA9Jvs1CgAAAAAAAAAAAAAAAAAAAEDv/w8yJm1tbmRyb2lkVGFnZ2VkAQAAAGxtbmRuAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP7/AAIBCQEAAAAA+v8AAgEJAAAAAAL/AAIBCQEAAAADKwACARAABwADKwACARAACQA=";
        this.loadSprites();

        // Configurações do tanque
        this.spriteUnitHeight = 35;
        this.spriteUnitWidth = 64;
        this.scoreBarHeight = 50;
        this.tankBottomOffset = (this.spriteUnitHeight / 2) + this.scoreBarHeight;
        this.tankX = this.actualWidth / 2;
        this.tankdX = this.isMobile ? 6 : 4;
        this.tankY = this.actualHeight - this.tankBottomOffset;
        this.tankWidth = this.spriteUnitWidth / 2;
        this.tankHeight = this.spriteUnitHeight / 2;

        // Sistema de pontuação e vidas
        this.score = 0;
        this.allowedLives = 3;
        this.lives = this.allowedLives;
        this.hasLifeDecreased = false;
        this.level = 1;

        // Invasores
        this.invaderWidth = this.spriteUnitWidth / 2.5;
        this.invaderHeight = this.spriteUnitHeight / 2.5;
        this.armyRows = 5;
        this.armyColumns = 10;
        this.armyX = 60;
        this.armyY = 60;
        this.invaderLeftOffset = 15;
        this.invaderTopOffset = 20;
        this.armyDirection = "right";
        this.armyDx = 10;
        this.armyDy = 10;
        this.armySpeed = 40;
        this.armySpeedDecrement = 10;
        this.aliveInvaders = this.armyColumns * this.armyRows;
        this.armyInvaderBulletsSpeed = 4;
        this.armyArray = [];
        this.spriteSelector = 0;
        this.invaderSpriteHeightsArray = [[68, 102], [102, 134], [102, 134], [0, 34], [0, 34]];

        // Sistema de balas
        this.bulletHeight = 10;
        this.bulletWidth = 3;
        this.shouldMoveTankBullet = false;
        this.tankBulletDy = 10;
        this.invaderBulletsArray = [];
        this.invBulletDy = 5;
        this.invBulletPrevFrameCount = 0;

        // Sistema de explosões
        this.particlesPerExplosion = 50;
        this.particlesMinSpeed = 1;
        this.particlesMaxSpeed = 6;
        this.particlesMinSize = 1;
        this.particlesMaxSize = 8;
        this.explosions = [];
        this.explosionColor = "white";

        // Controles
        this.keys = {};
        this.touchControls = {
            left: false,
            right: false,
            fire: false
        };
        
        this.setupEventListeners();
        this.drawStartScreen();
    }

    detectMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
               window.innerWidth <= 768;
    }

    loadSprites() {
        this.tank = new Image();
        this.tank.src = this.spriteBase64;
        this.invader = new Image();
        this.invader.src = this.spriteBase64;
    }

    setupEventListeners() {
        // Teclado
        document.addEventListener("keydown", (e) => {
            if (['ArrowLeft', 'ArrowRight', ' ', 'a', 'A', 'd', 'D', 'x', 'X'].includes(e.key)) {
                e.preventDefault();
            }
            this.keys[e.key] = true;
            this.keys[e.code] = true;
        });

        document.addEventListener("keyup", (e) => {
            this.keys[e.key] = false;
            this.keys[e.code] = false;
        });

        document.addEventListener("keypress", (e) => {
            if (e.key === "Enter") {
                if (this.gameState === 'start' || this.gameState === 'gameover' || this.gameState === 'win') {
                    this.startGame();
                }
            } else if (e.key === "p" || e.key === "P") {
                this.togglePause();
            }
        });

        // Botões de controle
        document.getElementById('startBtn').addEventListener('click', () => this.startGame());
        document.getElementById('pauseBtn').addEventListener('click', () => this.togglePause());
        document.getElementById('restartBtn').addEventListener('click', () => this.startGame());
        document.getElementById('resumeBtn').addEventListener('click', () => this.togglePause());

        // Controles mobile
        this.setupMobileControls();

        // Redimensionamento da janela
        window.addEventListener('resize', () => {
            this.setupCanvas();
            if (this.gameState === 'playing') {
                this.drawGameElements();
            }
        });

        // Prevenir scroll em mobile
        document.addEventListener('touchmove', (e) => {
            if (this.gameState === 'playing') {
                e.preventDefault();
            }
        }, { passive: false });
    }

    setupMobileControls() {
        const leftBtn = document.getElementById('leftBtn');
        const rightBtn = document.getElementById('rightBtn');
        const fireBtn = document.getElementById('fireBtn');

        // Controles touch
        const setupButton = (button, control) => {
            button.addEventListener('touchstart', (e) => {
                e.preventDefault();
                this.touchControls[control] = true;
                button.classList.add('active');
            });

            button.addEventListener('touchend', (e) => {
                e.preventDefault();
                this.touchControls[control] = false;
                button.classList.remove('active');
            });

            button.addEventListener('touchcancel', (e) => {
                e.preventDefault();
                this.touchControls[control] = false;
                button.classList.remove('active');
            });

            // Suporte a mouse também
            button.addEventListener('mousedown', (e) => {
                e.preventDefault();
                this.touchControls[control] = true;
                button.classList.add('active');
            });

            button.addEventListener('mouseup', (e) => {
                e.preventDefault();
                this.touchControls[control] = false;
                button.classList.remove('active');
            });

            button.addEventListener('mouseleave', (e) => {
                e.preventDefault();
                this.touchControls[control] = false;
                button.classList.remove('active');
            });
        };

        setupButton(leftBtn, 'left');
        setupButton(rightBtn, 'right');
        setupButton(fireBtn, 'fire');
    }

    startGame() {
        this.gameState = 'playing';
        this.gameInit();
        this.constructArmy(this.armyX, this.armyY);
        this.gameLoop();
        this.updateUI();
    }

    gameInit() {
        this.invaderBulletsArray = [];
        this.armyArray = [];
        this.score = 0;
        this.lives = this.allowedLives;
        this.level = 1;
        this.armyDirection = "right";
        this.aliveInvaders = this.armyColumns * this.armyRows;
        this.frameCount = 0;
        this.armyPrevFrameCount = 0;
        this.invBulletPrevFrameCount = 0;
        this.hasLifeDecreased = false;
        this.armySpeed = 40;
        this.tankX = this.actualWidth / 2;
        this.updateUI();
    }

    togglePause() {
        if (this.gameState === 'playing') {
            this.gameState = 'paused';
            if (this.animationID) {
                cancelAnimationFrame(this.animationID);
            }
            document.getElementById('pauseScreen').classList.remove('hidden');
        } else if (this.gameState === 'paused') {
            this.gameState = 'playing';
            document.getElementById('pauseScreen').classList.add('hidden');
            this.gameLoop();
        }
        this.updateUI();
    }

    gameLoop() {
        if (this.gameState !== 'playing') return;

        // Verificar condições de fim de jogo
        if (this.lives <= 0) {
            this.endGame("Você Perdeu");
            return;
        }

        if (this.aliveInvaders === 0) {
            this.levelUp();
        }

        if (this.checkGameOverByCollision()) {
            this.endGame("Você Perdeu");
            return;
        }

        this.ctx.clearRect(0, 0, this.actualWidth, this.actualHeight);
        
        this.drawGameElements();
        this.handleInput();
        this.updateGameState();
        
        this.frameCount++;
        
        // Controlar FPS
        const now = Date.now();
        const delta = now - this.then;
        
        if (delta > this.interval) {
            this.then = now - (delta % this.interval);
            this.drawExplosion();
        }

        this.animationID = requestAnimationFrame(() => this.gameLoop());
    }

    drawGameElements() {
        this.drawScoreSeparateLine();
        this.drawScore();
        this.drawLives();
        this.drawLevel();
        this.moveArmy();
        this.drawArmyOfInvaders();
        this.drawTank(this.tankX, this.tankY);
        
        if (this.shouldMoveTankBullet) {
            this.drawBullet(this.tankBulletX, this.tankBulletY);
            this.moveTankBullet();
        }
        
        this.invadersBulletHandler();
        this.helperHandler();
    }

    updateGameState() {
        this.invadersBulletHandler();
    }

    handleInput() {
        // Controles de teclado
        if (this.keys['ArrowLeft'] || this.keys['a'] || this.keys['A']) {
            if (this.tankX - this.tankdX > 0) {
                this.tankX -= this.tankdX;
            }
        }
        
        if (this.keys['ArrowRight'] || this.keys['d'] || this.keys['D']) {
            if (this.actualWidth - (this.tankX + this.tankWidth) > this.tankdX) {
                this.tankX += this.tankdX;
            }
        }
        
        if ((this.keys[' '] || this.keys['x'] || this.keys['X']) && !this.shouldMoveTankBullet) {
            this.fireTankBullet();
        }

        // Controles touch/mobile
        if (this.touchControls.left) {
            if (this.tankX - this.tankdX > 0) {
                this.tankX -= this.tankdX;
            }
        }
        
        if (this.touchControls.right) {
            if (this.actualWidth - (this.tankX + this.tankWidth) > this.tankdX) {
                this.tankX += this.tankdX;
            }
        }
        
        if (this.touchControls.fire && !this.shouldMoveTankBullet) {
            this.fireTankBullet();
        }
    }

    drawInvader(x, y, sHeight) {
        this.ctx.drawImage(
            this.invader,
            0, sHeight,
            this.spriteUnitWidth, this.spriteUnitHeight,
            x, y,
            this.invaderWidth, this.invaderHeight
        );
    }

    drawTank(x, y) {
        this.ctx.drawImage(
            this.tank,
            0, this.tank.height - 50,
            this.tank.width, this.spriteUnitHeight,
            x, y,
            this.tankWidth, this.tankHeight
        );
    }

    drawBullet(bx, by) {
        this.ctx.beginPath();
        this.ctx.moveTo(bx, by);
        this.ctx.lineTo(bx, by - this.bulletHeight);
        this.ctx.lineWidth = this.bulletWidth + 2;
        this.ctx.strokeStyle = "#00ff00";
        this.ctx.stroke();
    }

    drawScoreSeparateLine() {
        this.ctx.beginPath();
        this.ctx.moveTo(0, this.actualHeight - (this.scoreBarHeight - 15));
        this.ctx.lineTo(this.actualWidth, this.actualHeight - (this.scoreBarHeight - 15));
        this.ctx.lineWidth = 2;
        this.ctx.strokeStyle = "#00ff00";
        this.ctx.stroke();
    }

    drawScore() {
        this.drawBottomMessage(`Pontos: ${this.score}`, this.actualWidth - 90);
        document.getElementById('score').textContent = this.score;
    }

    drawLives() {
        this.drawBottomMessage(`Vidas: ${this.lives}`, 10);
        document.getElementById('lives').textContent = this.lives;
    }

    drawLevel() {
        document.getElementById('level').textContent = this.level;
    }

    drawBottomMessage(message, sx) {
        this.ctx.font = "16px Play";
        this.ctx.fillStyle = "#ffffff";
        this.ctx.fillText(message, sx, this.actualHeight - 10);
    }

    drawStartScreen() {
        this.ctx.clearRect(0, 0, this.actualWidth, this.actualHeight);
        this.drawScreenLine1("Invasores Espaciais");
        this.drawScreenLine2(this.isMobile ? "Toque para jogar" : "Pressione Enter para Jogar");
        this.updateUI();
    }

    drawScreenLine1(message) {
        this.ctx.font = "bold 40px Play";
        this.ctx.fillStyle = "#ffffff";
        this.ctx.textAlign = "center";
        this.ctx.fillText(message, this.actualWidth / 2, this.actualHeight / 2 - 30);
    }

    drawScreenLine2(message) {
        this.ctx.font = "20px Play";
        this.ctx.fillStyle = "#00ff00";
        this.ctx.textAlign = "center";
        this.ctx.fillText(message, this.actualWidth / 2, this.actualHeight / 2 + 20);
    }

    endGame(message) {
        this.gameState = 'gameover';
        if (message === "Você Ganhou") {
            this.gameState = 'win';
        }
        
        this.ctx.clearRect(0, 0, this.actualWidth, this.actualHeight);
        this.drawScore();
        this.drawLives();
        this.drawGameOver(message);
        this.updateUI();
        
        if (this.animationID) {
            cancelAnimationFrame(this.animationID);
        }
    }

    drawGameOver(message) {
        this.drawScreenLine1("Fim de Jogo");
        this.drawScreenLine2(message);
        this.drawScreenLine3(`Pontuação Final: ${this.score}`);
        this.drawBottomMessage(this.isMobile ? "Toque para jogar novamente" : "Pressione Enter para jogar novamente", this.actualWidth / 2 - 150);
        
        document.getElementById('finalScore').textContent = this.score;
        document.getElementById('gameOver').classList.remove('hidden');
    }

    drawScreenLine3(message) {
        this.ctx.font = "18px Play";
        this.ctx.fillStyle = "#fbc531";
        this.ctx.textAlign = "center";
        this.ctx.fillText(message, this.actualWidth / 2, this.actualHeight / 2 + 60);
    }

    levelUp() {
        this.level++;
        this.armyY = 60;
        this.armySpeed = Math.max(10, this.armySpeed - 5);
        this.constructArmy(this.armyX, this.armyY);
        this.aliveInvaders = this.armyColumns * this.armyRows;
        
        // Efeito visual de level up
        this.ctx.fillStyle = "rgba(251, 197, 49, 0.3)";
        this.ctx.fillRect(0, 0, this.actualWidth, this.actualHeight);
        
        setTimeout(() => {
            this.drawScreenLine1(`Nível ${this.level}`);
        }, 500);
    }

    updateUI() {
        const gameOverElement = document.getElementById('gameOver');
        const pauseScreen = document.getElementById('pauseScreen');
        const pauseBtn = document.getElementById('pauseBtn');
        const mobileControls = document.getElementById('mobileControls');
        
        if (this.gameState === 'playing') {
            gameOverElement.classList.add('hidden');
            pauseScreen.classList.add('hidden');
            pauseBtn.textContent = 'Pausar';
            pauseBtn.disabled = false;
            if (mobileControls) mobileControls.style.display = 'flex';
        } else if (this.gameState === 'paused') {
            pauseBtn.textContent = 'Continuar';
            if (mobileControls) mobileControls.style.display = 'none';
        } else if (this.gameState === 'gameover' || this.gameState === 'win') {
            gameOverElement.classList.remove('hidden');
            pauseBtn.disabled = true;
            if (mobileControls) mobileControls.style.display = 'none';
        } else {
            gameOverElement.classList.add('hidden');
            pauseScreen.classList.add('hidden');
            pauseBtn.disabled = true;
            if (mobileControls) mobileControls.style.display = 'none';
        }
        
        document.getElementById('startBtn').disabled = this.gameState === 'playing';
    }

    constructArmy(aX, aY) {
        for (let i = 0; i < this.armyRows; i++) {
            this.armyArray[i] = [];
            for (let j = 0; j < this.armyColumns; j++) {
                this.armyArray[i][j] = {
                    x: aX + j * (this.invaderWidth + this.invaderLeftOffset),
                    y: aY + i * (this.invaderHeight + this.invaderTopOffset),
                    status: "alive"
                };
            }
        }
    }

    moveArmy() {
        if (this.frameCount - this.armyPrevFrameCount > this.armySpeed) {
            this.armyPrevFrameCount = this.frameCount;
            this.spriteSelector = 1 - this.spriteSelector;
        } else {
            return false;
        }

        let dx;
        let dy = 0;

        if (this.armyDirection === 'right') {
            if (this.actualWidth - (this.armyX + (this.invaderWidth + this.invaderLeftOffset) * (this.armyColumns - 1)) > this.invaderWidth) {
                dx = 1;
            } else {
                this.armyDirection = 'left';
                dx = -1;
                dy = this.armyDy;
            }
        } else if (this.armyDirection === 'left') {
            if (this.armyX - this.armyDx > 0) {
                dx = -1;
            } else {
                this.armyDirection = 'right';
                dx = 1;
                dy = this.armyDy;
            }
        }

        this.armyX += this.armyDx * dx;
        this.updateArmy(dx * this.armyDx, dy);
    }

    updateArmy(adx, ady) {
        for (let i = 0; i < this.armyRows; i++) {
            for (let j = 0; j < this.armyColumns; j++) {
                let soldier = this.armyArray[i][j];
                soldier.x = soldier.x + adx;
                soldier.y = soldier.y + ady;
            }
        }
    }

    drawArmyOfInvaders() {
        for (let i = 0; i < this.armyRows; i++) {
            for (let j = 0; j < this.armyColumns; j++) {
                let soldier = this.armyArray[i][j];
                if (soldier.status === 'alive') {
                    this.drawInvader(soldier.x, soldier.y, this.invaderSpriteHeightsArray[i][this.spriteSelector]);
                }
            }
        }
    }

    fireTankBullet() {
        this.tankBulletX = this.tankX + this.tankWidth / 2;
        this.tankBulletY = this.actualHeight - this.tankBottomOffset;
        this.drawBullet(this.tankBulletX, this.tankBulletY);
        this.shouldMoveTankBullet = true;
    }

    moveTankBullet() {
        if (this.tankBulletY < 0) {
            this.shouldMoveTankBullet = false;
            return;
        }

        // Verificar colisão com invasores
        for (let i = 0; i < this.armyRows; i++) {
            for (let j = 0; j < this.armyColumns; j++) {
                let soldier = this.armyArray[i][j];
                if (soldier.status === 'alive' &&
                    this.tankBulletX > soldier.x &&
                    this.tankBulletX < soldier.x + this.invaderWidth &&
                    this.tankBulletY > soldier.y &&
                    this.tankBulletY < soldier.y + this.invaderHeight) {
                    
                    soldier.status = 'dead';
                    this.shouldMoveTankBullet = false;
                    this.aliveInvaders--;
                    this.score += 10 * this.level;
                    
                    this.explosionColor = "white";
                    this.particlesPerExplosion = 50;
                    this.particlesMaxSize = 3;
                    this.triggerExplosion(soldier.x + this.invaderWidth / 2, soldier.y + this.invaderHeight / 2);

                    // Aumentar velocidade
                    if (this.aliveInvaders % this.armyColumns === 0 && this.armySpeed > 10) {
                        this.armySpeed -= this.armySpeedDecrement;
                    }
                }
            }
        }

        this.tankBulletY -= this.tankBulletDy;
    }

    invadersBulletHandler() {
        if (this.invaderBulletsArray.length < 3 && this.frameCount - this.invBulletPrevFrameCount > (this.armySpeed * this.armyInvaderBulletsSpeed)) {
            this.generateInvaderRandomBullet();
            this.invBulletPrevFrameCount = this.frameCount;
        }
        this.moveInvaderBullets();
    }

    generateInvaderRandomBullet() {
        let aliveArmy = [];
        for (let i = 0; i < this.armyRows; i++) {
            for (let j = 0; j < this.armyColumns; j++) {
                let soldier = this.armyArray[i][j];
                if (soldier.status === 'alive') {
                    aliveArmy.push(soldier);
                }
            }
        }

        if (aliveArmy.length > 0) {
            let rInvader = aliveArmy[this.genRandomNumber(aliveArmy.length)];
            let iBullet = {
                x: rInvader.x + this.invaderWidth / 2,
                y: rInvader.y + this.invaderHeight
            };
            this.invaderBulletsArray.push(iBullet);
        }
    }

    moveInvaderBullets() {
        for (let i = 0; i < this.invaderBulletsArray.length; i++) {
            let iB = this.invaderBulletsArray[i];
            iB.y += this.invBulletDy;

            // Verificar se a bala saiu da tela
            if (iB.y > this.actualHeight) {
                this.invaderBulletsArray.splice(i, 1);
                continue;
            }

            // Verificar colisão com o tanque
            if (iB.x > this.tankX &&
                iB.x < this.tankX + this.tankWidth &&
                iB.y > this.tankY &&
                iB.y < this.tankY + this.tankHeight) {
                
                this.explosionColor = "green";
                this.particlesPerExplosion = 150;
                this.particlesMaxSize = 4;
                this.triggerExplosion(this.tankX + this.tankWidth / 2, this.tankY + this.tankHeight / 2);
                this.invaderBulletsArray.splice(i, 1);
                this.lives--;
                this.hasLifeDecreased = true;
            }

            this.drawInvaderBullet(iB.x, iB.y);
        }
    }

    drawInvaderBullet(ix, iy) {
        this.ctx.beginPath();
        this.ctx.moveTo(ix, iy);
        this.ctx.lineTo(ix, iy + this.bulletHeight);
        this.ctx.lineWidth = this.bulletWidth;
        this.ctx.strokeStyle = "#FFF";
        this.ctx.stroke();
    }

    checkGameOverByCollision() {
        for (let i = 0; i < this.armyRows; i++) {
            for (let j = 0; j < this.armyColumns; j++) {
                let soldier = this.armyArray[i][j];
                if (soldier.status === 'alive' && soldier.y > this.tankY) {
                    return true;
                }
            }
        }
        return false;
    }

    helperHandler() {
        if (this.aliveInvaders === this.armyColumns * this.armyRows) {
            this.drawBottomMessage("Pressione ESPAÇO para atirar", 125);
        } else if (this.hasLifeDecreased) {
            this.drawBottomMessage(`BATEU. Vidas restantes: ${this.lives}`, 120);
            setTimeout(() => {
                this.hasLifeDecreased = false;
            }, 2000);
        }
    }

    genRandomNumber(rng) {
        return Math.floor(Math.random() * rng);
    }

    // Sistema de explosões
    drawExplosion() {
        if (this.explosions.length === 0) return;

        for (let i = 0; i < this.explosions.length; i++) {
            const explosion = this.explosions[i];
            const particles = explosion.particles;

            if (particles.length === 0) {
                this.explosions.splice(i, 1);
                continue;
            }

            const particlesAfterRemoval = particles.slice();
            for (let ii = 0; ii < particles.length; ii++) {
                const particle = particles[ii];

                if (particle.size <= 0) {
                    particlesAfterRemoval.splice(ii, 1);
                    continue;
                }

                this.ctx.beginPath();
                this.ctx.arc(particle.x, particle.y, particle.size, Math.PI * 2, 0, false);
                this.ctx.closePath();
                this.ctx.fillStyle = this.explosionColor;
                this.ctx.fill();

                particle.x += particle.xv;
                particle.y += particle.yv;
                particle.size -= 0.1;
            }

            explosion.particles = particlesAfterRemoval;
        }
    }

    triggerExplosion(x, y) {
        this.explosions.push(new Explosion(x, y));
    }
}

// Classes auxiliares para explosões
class Explosion {
    constructor(x, y) {
        this.particles = [];
        for (let i = 0; i < window.game.particlesPerExplosion; i++) {
            this.particles.push(new Particle(x, y));
        }
    }
}

class Particle {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.xv = this.randInt(window.game.particlesMinSpeed, window.game.particlesMaxSpeed, false);
        this.yv = this.randInt(window.game.particlesMinSpeed, window.game.particlesMaxSpeed, false);
        this.size = this.randInt(window.game.particlesMinSize, window.game.particlesMaxSize, true);
    }

    randInt(min, max, positive) {
        let num;
        if (positive === false) {
            num = Math.floor(Math.random() * max) - min;
            num *= Math.floor(Math.random() * 2) === 1 ? 1 : -1;
        } else {
            num = Math.floor(Math.random() * max) + min;
        }
        return num;
    }
}

// Inicializar o jogo
window.addEventListener('load', () => {
    window.game = new SpaceInvadersGame();
});

// Polyfill para requestAnimationFrame
(function() {
    var requestAnimationFrame = window.requestAnimationFrame || 
                               window.mozRequestAnimationFrame || 
                               window.webkitRequestAnimationFrame || 
                               window.msRequestAnimationFrame;
    window.requestAnimationFrame = requestAnimationFrame;
    
    var cancelAnimationFrame = window.cancelAnimationFrame || 
                              window.mozCancelAnimationFrame;
})();