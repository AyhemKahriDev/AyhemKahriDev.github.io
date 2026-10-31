/**
 * FLAPPY WYZUK - CORE GAME ENGINE & STATE MACHINE
 * Author: Wyzuk (https://github.com/wyzuk)
 * Repository: https://github.com/wyzuk/flappy
 */

class GameEngine {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.shakeLayer = document.getElementById('screen-shake-layer');

        this.renderer = new GameRenderer(this.canvas, this.shakeLayer);
        this.physics = new PhysicsEngine();
        this.particles = new ParticleEngine();

        this.gameState = 'MENU'; // 'MENU', 'READY', 'PLAYING', 'PAUSED', 'GAMEOVER'
        this.currentBird = null;
        this.currentTheme = null;

        this.lastTime = 0;
        this.isCrashAnimation = false;

        this.init();
    }

    init() {
        StorageManager.loadData();
        const data = StorageManager.get();

        this.currentBird = BirdsManager.getBird(data.selectedBirdId);
        this.currentTheme = BackgroundsManager.getTheme(data.selectedThemeId);

        this.particles.setDensity(data.settings.particleDensity);
        this.particles.setWeather(this.currentTheme.weather, this.renderer.width, this.renderer.height);

        UIManager.init({
            onStartGame: () => this.prepareGame(),
            onFlapAction: () => this.handleFlapAction(),
            onPauseGame: () => this.pauseGame(),
            onResumeGame: () => this.resumeGame(),
            onRestartGame: () => this.restartGame(),
            onReturnMenu: () => this.returnToMenu(),
            onBirdChanged: (bird) => {
                this.currentBird = bird;
            },
            onThemeChanged: (theme) => {
                this.currentTheme = theme;
                this.particles.setWeather(theme.weather, this.renderer.width, this.renderer.height);
            }
        });

        this.bindInputEvents();
        window.addEventListener('resize', () => this.handleResize());

        requestAnimationFrame((time) => this.gameLoop(time));
    }

    handleResize() {
        this.renderer.resize();
        this.particles.setWeather(this.currentTheme.weather, this.renderer.width, this.renderer.height);
    }

    bindInputEvents() {
        window.addEventListener('keydown', (e) => {
            if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
                e.preventDefault();
                this.handleFlapAction();
            } else if (e.code === 'Escape' || e.code === 'KeyP') {
                e.preventDefault();
                if (this.gameState === 'PLAYING') this.pauseGame();
                else if (this.gameState === 'PAUSED') this.resumeGame();
            } else if (e.code === 'KeyM') {
                e.preventDefault();
                const currentMute = StorageManager.get().settings.masterSound;
                StorageManager.updateSettings({ masterSound: !currentMute });
                AudioManager.applySettings();
                UIManager.showToast(!currentMute ? 'Audio Unmuted' : 'Audio Muted');
            }
        });

        this.canvas.addEventListener('mousedown', (e) => {
            if (e.button === 0) { // Left click
                this.handleFlapAction();
            }
        });

        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.handleFlapAction();
        }, { passive: false });
    }

    prepareGame() {
        AudioManager.ensureContext();
        AudioManager.applySettings();
        StorageManager.incrementGames();

        this.physics.reset(this.renderer.width, this.renderer.height);
        this.gameState = 'READY';
        this.isCrashAnimation = false;

        UIManager.showGameHud();
    }

    handleFlapAction() {
        if (this.gameState === 'READY') {
            this.gameState = 'PLAYING';
            UIManager.hideReadyHint();
            this.physics.flap();
            AudioManager.playJump();
            this.particles.emitBirdTrail(this.physics.bird.x, this.physics.bird.y, this.currentBird.primaryColor, this.currentBird.trailType);
        } else if (this.gameState === 'PLAYING') {
            this.physics.flap();
            AudioManager.playJump();
            this.particles.emitBirdTrail(this.physics.bird.x, this.physics.bird.y, this.currentBird.primaryColor, this.currentBird.trailType);
        }
    }

    pauseGame() {
        if (this.gameState !== 'PLAYING') return;
        this.gameState = 'PAUSED';
        UIManager.showPauseScreen(this.physics.score);
    }

    resumeGame() {
        if (this.gameState !== 'PAUSED') return;
        UIManager.hidePauseScreen();
        this.gameState = 'PLAYING';
    }

    restartGame() {
        this.prepareGame();
    }

    returnToMenu() {
        this.gameState = 'MENU';
        this.physics.reset(this.renderer.width, this.renderer.height);
        UIManager.showMainMenu();
    }

    handleCrash() {
        this.gameState = 'GAMEOVER';
        this.isCrashAnimation = true;
        AudioManager.playHit();

        const state = StorageManager.get();
        if (state.settings.screenShake) {
            this.renderer.triggerScreenShake();
        }

        this.particles.emitCrashImpact(this.physics.bird.x, this.physics.bird.y);

        const isNewBest = StorageManager.updateHighScore(this.physics.score);
        if (isNewBest && this.physics.score > 0) {
            AudioManager.playNewBest();
            this.particles.emitConfetti(this.renderer.width, this.renderer.height);
        }

        setTimeout(() => {
            UIManager.showGameOver(this.physics.score, isNewBest);
        }, 700);
    }

    gameLoop(time) {
        const dt = (time - this.lastTime) / 1000;
        this.lastTime = time;

        const isPlaying = (this.gameState === 'PLAYING');

        if (this.gameState === 'PLAYING' || this.gameState === 'READY' || this.gameState === 'MENU') {
            const result = this.physics.update(this.renderer.width, this.renderer.height, isPlaying);

            if (result.event === 'crash') {
                this.handleCrash();
            } else if (result.event === 'score') {
                AudioManager.playScore();
                this.particles.emitScoreBurst(this.physics.bird.x, this.physics.bird.y - 20, this.currentBird.primaryColor);

                const { progress } = this.physics.getDifficultyParams(this.physics.score);
                const best = StorageManager.get().highScore;
                UIManager.updateHudScores(this.physics.score, Math.max(best, this.physics.score), progress);
            }
        }

        if (this.gameState === 'PLAYING') {
            this.particles.emitBirdTrail(this.physics.bird.x - 12, this.physics.bird.y, this.currentBird.primaryColor, this.currentBird.trailType);
        }

        this.particles.update(this.renderer.width, this.renderer.height);

        this.renderer.render(
            this.physics,
            this.particles,
            this.currentBird,
            this.currentTheme,
            (this.gameState === 'GAMEOVER')
        );

        requestAnimationFrame((t) => this.gameLoop(t));
    }
}

window.addEventListener('DOMContentLoaded', () => {
    window.FlappyApp = new GameEngine();
});
