/**
 * FLAPPY WYZUK - PHYSICS & PROGRESSIVE DIFFICULTY ENGINE
 * Author: Wyzuk (https://github.com/wyzuk)
 * Repository: https://github.com/wyzuk/flappy
 */

class PhysicsEngine {
    constructor() {
        this.gravity = 0.36;
        this.jumpImpulse = -7.2;
        this.pipeWidth = 64;
        this.basePipeGap = 150;
        this.minPipeGap = 110;
        this.baseSpeed = 2.4;
        this.maxSpeed = 3.9;
        this.pipeDistance = 250;

        this.pipes = [];
        this.passedPipes = new Set();
        this.bird = {
            x: 90,
            y: 200,
            radius: 12,
            vy: 0,
            angle: 0,
            flapPhase: 0
        };

        this.score = 0;
        this.scrollDistance = 0;
        this.groundHeight = 90;
    }

    reset(stageWidth, stageHeight) {
        this.score = 0;
        this.scrollDistance = 0;
        this.bird.x = Math.max(80, stageWidth * 0.22);
        this.bird.y = stageHeight * 0.42;
        this.bird.vy = 0;
        this.bird.angle = 0;
        this.bird.flapPhase = 0;
        this.pipes = [];
        this.passedPipes.clear();

        const initialX = stageWidth + 120;
        this.spawnPipe(initialX, stageHeight);
        this.spawnPipe(initialX + this.pipeDistance, stageHeight);
        this.spawnPipe(initialX + this.pipeDistance * 2, stageHeight);
    }

    getDifficultyParams(score) {
        const progress = Math.min(1, score / 45);
        const currentSpeed = this.baseSpeed + (this.maxSpeed - this.baseSpeed) * progress;
        const currentGap = this.basePipeGap - (this.basePipeGap - this.minPipeGap) * progress;
        return { speed: currentSpeed, gap: currentGap, progress };
    }

    spawnPipe(x, stageHeight) {
        const { gap } = this.getDifficultyParams(this.score);
        const playableHeight = stageHeight - this.groundHeight;
        const margin = 70;
        const minTop = margin;
        const maxTop = playableHeight - gap - margin;
        const topHeight = Math.random() * (maxTop - minTop) + minTop;

        this.pipes.push({
            id: Math.random().toString(36).substr(2, 9),
            x: x,
            topHeight: topHeight,
            gap: gap,
            passed: false,
            initialY: topHeight,
            oscillationOffset: Math.random() * Math.PI * 2
        });
    }

    flap() {
        this.bird.vy = this.jumpImpulse;
        this.bird.flapPhase = 0;
        StorageManager.incrementFlaps();
    }

    update(stageWidth, stageHeight, isPlaying = true) {
        if (!isPlaying) {
            this.bird.flapPhase += 0.12;
            this.bird.y += Math.sin(this.bird.flapPhase) * 0.7;
            this.bird.angle = Math.sin(this.bird.flapPhase) * 0.08;
            return { event: 'none' };
        }

        const { speed } = this.getDifficultyParams(this.score);
        this.scrollDistance += speed;

        this.bird.vy += this.gravity;
        this.bird.vy = Math.min(10, this.bird.vy); // Terminal velocity
        this.bird.y += this.bird.vy;
        this.bird.flapPhase += 0.25;

        if (this.bird.vy < 0) {
            this.bird.angle = Math.max(-0.45, this.bird.vy * 0.07);
        } else {
            this.bird.angle = Math.min(1.2, this.bird.vy * 0.1);
        }

        let gameEvent = 'none';

        const floorY = stageHeight - this.groundHeight - this.bird.radius;
        if (this.bird.y >= floorY) {
            this.bird.y = floorY;
            return { event: 'crash' };
        }
        if (this.bird.y <= this.bird.radius) {
            this.bird.y = this.bird.radius;
            this.bird.vy = 0;
        }

        const playableHeight = stageHeight - this.groundHeight;

        for (let i = this.pipes.length - 1; i >= 0; i--) {
            const pipe = this.pipes[i];
            pipe.x -= speed;

            if (this.score >= 15) {
                const osc = Math.sin(this.scrollDistance * 0.02 + pipe.oscillationOffset) * 15;
                pipe.topHeight = Math.max(50, Math.min(playableHeight - pipe.gap - 50, pipe.initialY + osc));
            }

            if (!pipe.passed && (pipe.x + this.pipeWidth) < this.bird.x) {
                pipe.passed = true;
                this.score++;
                StorageManager.addPipes(1);
                gameEvent = 'score';
            }

            const hitboxMargin = 3.5;
            const bx = this.bird.x;
            const by = this.bird.y;
            const br = this.bird.radius - hitboxMargin;

            const pipeLeft = pipe.x + hitboxMargin;
            const pipeRight = pipe.x + this.pipeWidth - hitboxMargin;
            const topPipeBottom = pipe.topHeight;
            const bottomPipeTop = pipe.topHeight + pipe.gap;

            if (bx + br > pipeLeft && bx - br < pipeRight) {
                if (by - br < topPipeBottom || by + br > bottomPipeTop) {
                    return { event: 'crash' };
                }
            }

            if (pipe.x + this.pipeWidth < -60) {
                this.pipes.splice(i, 1);
            }
        }

        const lastPipe = this.pipes[this.pipes.length - 1];
        if (lastPipe && lastPipe.x < stageWidth) {
            this.spawnPipe(lastPipe.x + this.pipeDistance, stageHeight);
        }

        return { event: gameEvent };
    }
}
