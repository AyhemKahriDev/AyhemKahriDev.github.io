// 视觉效果增强模块

// 屏幕震动变量
let screenShake = 0;

// 绘制速度线效果
function drawSpeedLines() {
    // 添加新的速度线
    if (Math.random() < 0.3) {
        speedLines.push({
            x: Math.random() * GAME_WIDTH,
            y: 0,
            length: Math.random() * 30 + 20,
            speed: player.speed * 2,
            opacity: 0.5
        });
    }
    
    // 更新和绘制速度线
    for (let i = speedLines.length - 1; i >= 0; i--) {
        const line = speedLines[i];
        line.y += line.speed;
        line.opacity -= 0.02;
        
        if (line.y > GAME_HEIGHT || line.opacity <= 0) {
            speedLines.splice(i, 1);
            continue;
        }
        
        ctx.strokeStyle = `rgba(255, 255, 255, ${line.opacity})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(line.x, line.y);
        ctx.lineTo(line.x, line.y + line.length);
        ctx.stroke();
    }
}

// 绘制轮胎痕迹
function drawSkidMarks() {
    // 添加轮胎痕迹（转弯时）
    if ((keys.ArrowLeft || keys.ArrowRight) && player.speed > 3) {
        skidMarks.push({
            x: player.x + 2,
            y: player.y + player.height - 15,
            width: 3,
            height: 10,
            opacity: 0.4
        });
        skidMarks.push({
            x: player.x + player.width - 5,
            y: player.y + player.height - 15,
            width: 3,
            height: 10,
            opacity: 0.4
        });
    }
    
    // 更新和绘制轮胎痕迹
    for (let i = skidMarks.length - 1; i >= 0; i--) {
        const mark = skidMarks[i];
        mark.y += roadSpeed;
        mark.opacity -= 0.005;
        
        if (mark.y > GAME_HEIGHT || mark.opacity <= 0) {
            skidMarks.splice(i, 1);
            continue;
        }
        
        ctx.fillStyle = `rgba(0, 0, 0, ${mark.opacity})`;
        ctx.fillRect(mark.x, mark.y, mark.width, mark.height);
    }
}

// 创建爆炸粒子效果
function createExplosion(x, y) {
    // 创建火花粒子
    for (let i = 0; i < 20; i++) {
        particles.push({
            x: x,
            y: y,
            vx: (Math.random() - 0.5) * 8,
            vy: (Math.random() - 0.5) * 8,
            size: Math.random() * 4 + 2,
            color: `hsl(${Math.random() * 60}, 100%, 50%)`,
            life: 1,
            type: 'spark'
        });
    }
    
    // 创建烟雾粒子
    for (let i = 0; i < 10; i++) {
        particles.push({
            x: x + (Math.random() - 0.5) * 20,
            y: y + (Math.random() - 0.5) * 20,
            vx: (Math.random() - 0.5) * 2,
            vy: -Math.random() * 2,
            size: Math.random() * 15 + 10,
            color: `rgba(100, 100, 100, 0.5)`,
            life: 1,
            type: 'smoke'
        });
    }
}

// 更新和绘制粒子
function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        const particle = particles[i];
        
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.life -= 0.02;
        
        if (particle.type === 'spark') {
            particle.size *= 0.98;
            particle.vy += 0.2; // 重力效果
        } else if (particle.type === 'smoke') {
            particle.size *= 1.02; // 烟雾扩散
            particle.vy -= 0.1; // 烟雾上升
        }
        
        if (particle.life <= 0 || particle.size < 0.5) {
            particles.splice(i, 1);
            continue;
        }
        
        ctx.globalAlpha = particle.life;
        
        if (particle.type === 'spark') {
            // 绘制火花
            ctx.fillStyle = particle.color;
            ctx.shadowBlur = 10;
            ctx.shadowColor = particle.color;
            ctx.beginPath();
            ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
        } else if (particle.type === 'smoke') {
            // 绘制烟雾
            const gradient = ctx.createRadialGradient(
                particle.x, particle.y, 0,
                particle.x, particle.y, particle.size
            );
            gradient.addColorStop(0, `rgba(100, 100, 100, ${particle.life * 0.3})`);
            gradient.addColorStop(1, 'rgba(100, 100, 100, 0)');
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    ctx.globalAlpha = 1;
}

// 屏幕震动效果
function shakeScreen(intensity = 10) {
    screenShake = intensity;
}

// 应用屏幕震动
function applyScreenShake() {
    if (screenShake > 0) {
        const shakeX = (Math.random() - 0.5) * screenShake;
        const shakeY = (Math.random() - 0.5) * screenShake;
        ctx.save();
        ctx.translate(shakeX, shakeY);
        screenShake *= 0.9;
        
        if (screenShake < 0.1) {
            screenShake = 0;
        }
        
        return true;
    }
    return false;
}

// 恢复屏幕震动状态
function restoreScreenShake() {
    if (screenShake > 0) {
        ctx.restore();
    }
}

// 创建道路火花效果（高速行驶时）
function createRoadSparks() {
    if (player.speed > 8 && Math.random() < 0.1) {
        particles.push({
            x: player.x + player.width / 2 + (Math.random() - 0.5) * 20,
            y: player.y + player.height,
            vx: (Math.random() - 0.5) * 2,
            vy: -Math.random() * 3 - 2,
            size: Math.random() * 2 + 1,
            color: `hsl(${30 + Math.random() * 30}, 100%, 70%)`,
            life: 0.5,
            type: 'spark'
        });
    }
}

// 创建尾气效果
function createExhaust() {
    if (player.speed > 0 && Math.random() < 0.3) {
        particles.push({
            x: player.x + 5 + Math.random() * 5,
            y: player.y + player.height,
            vx: (Math.random() - 0.5) * 0.5,
            vy: Math.random() * 0.5 + 0.5,
            size: Math.random() * 3 + 2,
            color: `rgba(150, 150, 150, 0.3)`,
            life: 0.5,
            type: 'smoke'
        });
        
        particles.push({
            x: player.x + player.width - 10 + Math.random() * 5,
            y: player.y + player.height,
            vx: (Math.random() - 0.5) * 0.5,
            vy: Math.random() * 0.5 + 0.5,
            size: Math.random() * 3 + 2,
            color: `rgba(150, 150, 150, 0.3)`,
            life: 0.5,
            type: 'smoke'
        });
    }
}

// 绘制得分动画
let scoreAnimations = [];

function createScoreAnimation(points, x, y) {
    scoreAnimations.push({
        text: `+${points}`,
        x: x,
        y: y,
        vy: -2,
        life: 1,
        scale: 1
    });
}

function updateScoreAnimations() {
    for (let i = scoreAnimations.length - 1; i >= 0; i--) {
        const anim = scoreAnimations[i];
        
        anim.y += anim.vy;
        anim.life -= 0.02;
        anim.scale += 0.01;
        
        if (anim.life <= 0) {
            scoreAnimations.splice(i, 1);
            continue;
        }
        
        ctx.save();
        ctx.globalAlpha = anim.life;
        ctx.font = `bold ${20 * anim.scale}px Orbitron`;
        ctx.fillStyle = '#FFD700';
        ctx.strokeStyle = '#FF6B35';
        ctx.lineWidth = 2;
        ctx.textAlign = 'center';
        ctx.strokeText(anim.text, anim.x, anim.y);
        ctx.fillText(anim.text, anim.x, anim.y);
        ctx.restore();
    }
}

// 绘制道路光效
function drawRoadGlow() {
    if (player.speed > 7) {
        const glowGradient = ctx.createLinearGradient(
            player.x, player.y + player.height,
            player.x, player.y + player.height + 50
        );
        glowGradient.addColorStop(0, `rgba(255, 200, 100, ${0.3 * (player.speed / 10)})`);
        glowGradient.addColorStop(1, 'rgba(255, 200, 100, 0)');
        
        ctx.fillStyle = glowGradient;
        ctx.fillRect(
            player.x - 10,
            player.y + player.height,
            player.width + 20,
            50
        );
    }
}

// 导出所有效果函数（如果需要模块化）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        drawSpeedLines,
        drawSkidMarks,
        createExplosion,
        updateParticles,
        shakeScreen,
        applyScreenShake,
        restoreScreenShake,
        createRoadSparks,
        createExhaust,
        createScoreAnimation,
        updateScoreAnimations,
        drawRoadGlow
    };
}
