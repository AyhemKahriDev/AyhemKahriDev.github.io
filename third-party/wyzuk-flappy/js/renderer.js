/**
 * FLAPPY WYZUK - CANVAS 2D HIGH-DPI RENDERING PIPELINE
 * Author: Wyzuk (https://github.com/wyzuk)
 * Repository: https://github.com/wyzuk/flappy
 */

class GameRenderer {
    constructor(canvas, shakeLayer) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.shakeLayer = shakeLayer;
        this.dpr = window.devicePixelRatio || 1;
        this.width = 0;
        this.height = 0;
        this.resize();
    }

    resize() {
        const rect = this.canvas.parentElement.getBoundingClientRect();
        this.width = rect.width;
        this.height = rect.height;

        this.canvas.width = this.width * this.dpr;
        this.canvas.height = this.height * this.dpr;
        this.ctx.scale(this.dpr, this.dpr);
    }

    triggerScreenShake() {
        if (!this.shakeLayer) return;
        this.shakeLayer.classList.remove('shake-impact');
        void this.shakeLayer.offsetWidth; // Force reflow
        this.shakeLayer.classList.add('shake-impact');
    }

    render(physics, particleEngine, currentBird, currentTheme, isDead = false) {
        const ctx = this.ctx;
        const width = this.width;
        const height = this.height;

        ctx.clearRect(0, 0, width, height);

        BackgroundsManager.renderParallax(
            ctx,
            currentTheme,
            width,
            height,
            physics.scrollDistance,
            physics.groundHeight
        );

        this.renderPipes(ctx, physics.pipes, currentTheme, height, physics.groundHeight);

        const highScore = StorageManager.get().highScore;
        if (highScore > 0 && physics.score < highScore + 5) {
        }

        particleEngine.render(ctx);

        BirdsManager.drawBird(
            ctx,
            currentBird,
            physics.bird.x,
            physics.bird.y,
            physics.bird.angle,
            physics.bird.flapPhase,
            isDead
        );
    }

    renderPipes(ctx, pipes, theme, height, groundHeight) {
        ctx.save();
        const pipeWidth = 64;
        const capHeight = 24;
        const capOverhang = 5;
        const playableHeight = height - groundHeight;

        pipes.forEach(pipe => {
            const x = pipe.x;
            const topH = pipe.topHeight;
            const bottomY = pipe.topHeight + pipe.gap;
            const bottomH = playableHeight - bottomY;

            const grad = ctx.createLinearGradient(x, 0, x + pipeWidth, 0);
            grad.addColorStop(0, theme.pipeGrad[0]);
            grad.addColorStop(0.5, '#ffffff33');
            grad.addColorStop(1, theme.pipeGrad[1]);

            ctx.fillStyle = grad;
            ctx.fillRect(x, 0, pipeWidth, topH - capHeight);

            ctx.fillStyle = theme.pipeCap;
            ctx.strokeStyle = theme.pipeBorder;
            ctx.lineWidth = 2;
            ctx.fillRect(x - capOverhang, topH - capHeight, pipeWidth + capOverhang * 2, capHeight);
            ctx.strokeRect(x - capOverhang, topH - capHeight, pipeWidth + capOverhang * 2, capHeight);

            ctx.fillRect(x - capOverhang, bottomY, pipeWidth + capOverhang * 2, capHeight);
            ctx.strokeRect(x - capOverhang, bottomY, pipeWidth + capOverhang * 2, capHeight);

            ctx.fillStyle = grad;
            ctx.fillRect(x, bottomY + capHeight, pipeWidth, bottomH - capHeight);

            ctx.strokeStyle = theme.pipeBorder;
            ctx.lineWidth = 1.5;
            ctx.strokeRect(x, 0, pipeWidth, topH - capHeight);
            ctx.strokeRect(x, bottomY + capHeight, pipeWidth, bottomH - capHeight);
        });

        ctx.restore();
    }
}
