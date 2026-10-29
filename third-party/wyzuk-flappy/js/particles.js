/**
 * FLAPPY WYZUK - PARTICLE & FX ENGINE
 * Author: Wyzuk (https://github.com/wyzuk)
 * Repository: https://github.com/wyzuk/flappy
 */

class ParticleEngine {
    constructor() {
        this.particles = [];
        this.weatherParticles = [];
        this.currentWeather = 'none';
        this.densityMultiplier = 1.0;
    }

    setDensity(density) {
        switch (density) {
            case 'ultra': this.densityMultiplier = 1.6; break;
            case 'high': this.densityMultiplier = 1.0; break;
            case 'medium': this.densityMultiplier = 0.6; break;
            case 'low': this.densityMultiplier = 0.3; break;
            default: this.densityMultiplier = 1.0;
        }
    }

    setWeather(type, width, height) {
        this.currentWeather = type;
        this.weatherParticles = [];
        const baseCount = Math.floor(60 * this.densityMultiplier);

        if (type === 'rain') {
            for (let i = 0; i < baseCount * 1.5; i++) {
                this.weatherParticles.push({
                    x: Math.random() * width,
                    y: Math.random() * height,
                    length: Math.random() * 18 + 12,
                    speedY: Math.random() * 12 + 14,
                    speedX: -2.5,
                    alpha: Math.random() * 0.4 + 0.3
                });
            }
        } else if (type === 'snow') {
            for (let i = 0; i < baseCount; i++) {
                this.weatherParticles.push({
                    x: Math.random() * width,
                    y: Math.random() * height,
                    radius: Math.random() * 2.5 + 1,
                    speedY: Math.random() * 1.5 + 0.8,
                    speedX: Math.random() * 0.8 - 0.4,
                    wobble: Math.random() * Math.PI * 2,
                    alpha: Math.random() * 0.6 + 0.3
                });
            }
        } else if (type === 'fireflies') {
            for (let i = 0; i < baseCount * 0.5; i++) {
                this.weatherParticles.push({
                    x: Math.random() * width,
                    y: Math.random() * height,
                    radius: Math.random() * 2 + 1.2,
                    speedX: (Math.random() - 0.5) * 0.8,
                    speedY: (Math.random() - 0.5) * 0.8,
                    pulse: Math.random() * Math.PI * 2,
                    color: '#a3ff00'
                });
            }
        } else if (type === 'bubbles') {
            for (let i = 0; i < baseCount * 0.6; i++) {
                this.weatherParticles.push({
                    x: Math.random() * width,
                    y: Math.random() * height,
                    radius: Math.random() * 3.5 + 1.5,
                    speedY: -(Math.random() * 1.8 + 0.8),
                    speedX: Math.sin(Math.random()) * 0.5,
                    alpha: Math.random() * 0.5 + 0.2
                });
            }
        }
    }

    emitBirdTrail(x, y, birdColor, trailType) {
        if (Math.random() > 0.45 * this.densityMultiplier) return;

        const count = Math.ceil(2 * this.densityMultiplier);
        for (let i = 0; i < count; i++) {
            this.particles.push({
                type: trailType || 'spark',
                x: x + (Math.random() * 6 - 3),
                y: y + (Math.random() * 6 - 3),
                vx: -Math.random() * 2.5 - 1.5,
                vy: (Math.random() - 0.5) * 1.5,
                radius: Math.random() * 3 + 1.5,
                color: birdColor,
                alpha: 0.9,
                decay: Math.random() * 0.03 + 0.02,
                rotation: Math.random() * Math.PI * 2,
                rotSpeed: (Math.random() - 0.5) * 0.1
            });
        }
    }

    emitScoreBurst(x, y, color = '#ffbe0b') {
        const count = Math.floor(24 * this.densityMultiplier);
        for (let i = 0; i < count; i++) {
            const angle = (Math.PI * 2 / count) * i + (Math.random() * 0.2);
            const speed = Math.random() * 5 + 2.5;
            this.particles.push({
                type: 'star',
                x: x,
                y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                radius: Math.random() * 3.5 + 2,
                color: color,
                alpha: 1.0,
                decay: Math.random() * 0.02 + 0.015,
                gravity: 0.08
            });
        }
    }

    emitCrashImpact(x, y) {
        const count = Math.floor(36 * this.densityMultiplier);
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 7 + 1.5;
            this.particles.push({
                type: Math.random() > 0.4 ? 'debris' : 'smoke',
                x: x,
                y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                radius: Math.random() * 4 + 2,
                color: Math.random() > 0.5 ? '#00f2fe' : '#ff2a7a',
                alpha: 1.0,
                decay: Math.random() * 0.025 + 0.015,
                gravity: 0.15
            });
        }
    }

    emitConfetti(width, height) {
        const count = Math.floor(80 * this.densityMultiplier);
        const palette = ['#00f2fe', '#ff2a7a', '#ffbe0b', '#00f090', '#892cdc', '#ffffff'];
        for (let i = 0; i < count; i++) {
            this.particles.push({
                type: 'confetti',
                x: Math.random() * width,
                y: -10 - Math.random() * 50,
                vx: (Math.random() - 0.5) * 4,
                vy: Math.random() * 3 + 3,
                w: Math.random() * 8 + 4,
                h: Math.random() * 6 + 3,
                color: palette[Math.floor(Math.random() * palette.length)],
                alpha: 1.0,
                decay: Math.random() * 0.006 + 0.003,
                rotation: Math.random() * Math.PI * 2,
                rotSpeed: (Math.random() - 0.5) * 0.2
            });
        }
    }

    update(width, height) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx;
            p.y += p.vy;
            if (p.gravity) p.vy += p.gravity;
            if (p.rotSpeed) p.rotation += p.rotSpeed;
            p.alpha -= p.decay;

            if (p.alpha <= 0 || p.y > height + 20) {
                this.particles.splice(i, 1);
            }
        }

        if (this.currentWeather === 'rain') {
            this.weatherParticles.forEach(p => {
                p.x += p.speedX;
                p.y += p.speedY;
                if (p.y > height) {
                    p.y = -p.length;
                    p.x = Math.random() * width;
                }
            });
        } else if (this.currentWeather === 'snow') {
            this.weatherParticles.forEach(p => {
                p.wobble += 0.03;
                p.x += p.speedX + Math.sin(p.wobble) * 0.5;
                p.y += p.speedY;
                if (p.y > height) {
                    p.y = -5;
                    p.x = Math.random() * width;
                }
            });
        } else if (this.currentWeather === 'fireflies') {
            this.weatherParticles.forEach(p => {
                p.pulse += 0.05;
                p.x += p.speedX;
                p.y += p.speedY;
                if (p.x < 0) p.x = width;
                if (p.x > width) p.x = 0;
                if (p.y < 0) p.y = height;
                if (p.y > height) p.y = 0;
            });
        } else if (this.currentWeather === 'bubbles') {
            this.weatherParticles.forEach(p => {
                p.y += p.speedY;
                p.x += p.speedX;
                if (p.y < -10) {
                    p.y = height + 10;
                    p.x = Math.random() * width;
                }
            });
        }
    }

    render(ctx) {
        if (this.currentWeather === 'rain') {
            ctx.save();
            ctx.strokeStyle = 'rgba(160, 210, 255, 0.45)';
            ctx.lineWidth = 1.2;
            this.weatherParticles.forEach(p => {
                ctx.beginPath();
                ctx.moveTo(p.x, p.y);
                ctx.lineTo(p.x + p.speedX * 2, p.y + p.length);
                ctx.stroke();
            });
            ctx.restore();
        } else if (this.currentWeather === 'snow') {
            ctx.save();
            this.weatherParticles.forEach(p => {
                ctx.fillStyle = `rgba(255, 255, 255, ${p.alpha})`;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
                ctx.fill();
            });
            ctx.restore();
        } else if (this.currentWeather === 'fireflies') {
            ctx.save();
            this.weatherParticles.forEach(p => {
                const alpha = (Math.sin(p.pulse) + 1) * 0.4 + 0.2;
                ctx.fillStyle = p.color;
                ctx.globalAlpha = alpha;
                ctx.shadowColor = p.color;
                ctx.shadowBlur = 8;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
                ctx.fill();
            });
            ctx.restore();
        } else if (this.currentWeather === 'bubbles') {
            ctx.save();
            this.weatherParticles.forEach(p => {
                ctx.strokeStyle = `rgba(180, 230, 255, ${p.alpha})`;
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
                ctx.stroke();
            });
            ctx.restore();
        }

        ctx.save();
        for (let i = 0; i < this.particles.length; i++) {
            const p = this.particles[i];
            ctx.globalAlpha = Math.max(0, p.alpha);

            if (p.type === 'confetti') {
                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.rotate(p.rotation);
                ctx.fillStyle = p.color;
                ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
                ctx.restore();
            } else if (p.type === 'star') {
                ctx.fillStyle = p.color;
                ctx.shadowColor = p.color;
                ctx.shadowBlur = 10;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
                ctx.fill();
            } else {
                ctx.fillStyle = p.color;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        ctx.restore();
    }
}
