// 游戏常量
const GAME_WIDTH = 800;
const GAME_HEIGHT = 520; // 画布高度 (不包括头部和底部信息栏)
const ROAD_WIDTH = 400;
const ROAD_MARGIN = (GAME_WIDTH - ROAD_WIDTH) / 2;
const PLAYER_WIDTH = 40;
const PLAYER_HEIGHT = 70;
const OBSTACLE_WIDTH = 40;
const OBSTACLE_HEIGHT = 70;
const LANE_COUNT = 3;
const LANE_WIDTH = ROAD_WIDTH / LANE_COUNT;

// 粒子系统
let particles = [];
let skidMarks = [];
let speedLines = [];

// 游戏变量
let canvas, ctx;
let player;
let obstacles = [];
let score = 0;
let lives = 3;
let gameRunning = false;
let animationId;
let lastObstacleTime = 0;
let roadOffset = 0;
let roadSpeed = 5;

// 按键状态
const keys = {
    ArrowUp: false,
    ArrowDown: false,
    ArrowLeft: false,
    ArrowRight: false
};

// 初始化游戏
function initGame() {
    canvas = document.getElementById('gameCanvas');
    canvas.width = GAME_WIDTH;
    canvas.height = GAME_HEIGHT;
    ctx = canvas.getContext('2d');
    
    // 初始化玩家
    player = {
        x: GAME_WIDTH / 2 - PLAYER_WIDTH / 2,
        y: GAME_HEIGHT - PLAYER_HEIGHT - 20,
        width: PLAYER_WIDTH,
        height: PLAYER_HEIGHT,
        speed: 0,
        maxSpeed: 10,
        acceleration: 0.2,
        deceleration: 0.1,
        handling: 5,
        lane: 1 // 0: 左, 1: 中, 2: 右
    };
    
    // 重置游戏状态
    obstacles = [];
    score = 0;
    lives = 3;
    roadOffset = 0;
    roadSpeed = 5;
    
    // 更新UI
    updateUI();
    
    // 显示开始屏幕
    document.getElementById('startScreen').style.display = 'flex';
    document.getElementById('gameOver').style.display = 'none';
}

// 开始游戏
function startGame() {
    gameRunning = true;
    document.getElementById('startScreen').style.display = 'none';
    gameLoop();
}

// 游戏主循环
function gameLoop() {
    if (!gameRunning) return;
    
    update();
    render();
    
    animationId = requestAnimationFrame(gameLoop);
}

// 更新游戏状态
function update() {
    // 更新玩家速度
    if (keys.ArrowUp) {
        player.speed = Math.min(player.speed + player.acceleration, player.maxSpeed);
    } else if (keys.ArrowDown) {
        player.speed = Math.max(player.speed - player.deceleration * 2, 0);
    } else {
        player.speed = Math.max(player.speed - player.deceleration, 0);
    }
    
    // 创建尾气效果
    createExhaust();
    
    // 创建道路火花效果
    createRoadSparks();
    
    // 更新道路速度
    roadSpeed = 5 + (player.speed / 2);
    
    // 更新玩家位置
    if (keys.ArrowLeft) {
        player.x = Math.max(player.x - player.handling, ROAD_MARGIN);
    }
    if (keys.ArrowRight) {
        player.x = Math.min(player.x + player.handling, GAME_WIDTH - ROAD_MARGIN - player.width);
    }
    
    // 更新道路偏移
    roadOffset += roadSpeed;
    if (roadOffset >= 40) {
        roadOffset = 0;
    }
    
    // 生成障碍物
    const currentTime = Date.now();
    if (currentTime - lastObstacleTime > 1500 - player.speed * 50) {
        createObstacle();
        lastObstacleTime = currentTime;
    }
    
    // 更新障碍物
    for (let i = obstacles.length - 1; i >= 0; i--) {
        const obstacle = obstacles[i];
        obstacle.y += roadSpeed;
        
        // 移除超出屏幕的障碍物
        if (obstacle.y > GAME_HEIGHT) {
            obstacles.splice(i, 1);
            score += 10;
            
            // 创建得分动画
            createScoreAnimation(10, GAME_WIDTH / 2, GAME_HEIGHT / 2);
            
            updateUI();
        }
        
        // 检测碰撞
        if (checkCollision(player, obstacle)) {
            // 创建爆炸效果
            createExplosion(
                obstacle.x + obstacle.width / 2, 
                obstacle.y + obstacle.height / 2
            );
            
            // 屏幕震动
            shakeScreen(15);
            
            obstacles.splice(i, 1);
            lives--;
            updateUI();
            
            if (lives <= 0) {
                gameOver();
            }
        }
    }
}

// 渲染游戏
function render() {
    // 清空画布
    ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    
    // 应用屏幕震动效果
    const hasShake = applyScreenShake();
    
    // 绘制背景
    drawBackground();
    
    // 绘制道路
    drawRoad();
    
    // 绘制玩家
    drawPlayer();
    
    // 绘制障碍物
    drawObstacles();
    
    // 绘制道路光效
    drawRoadGlow();
    
    // 更新粒子效果
    updateParticles();
    
    // 更新得分动画
    updateScoreAnimations();
    
    // 恢复屏幕震动状态
    if (hasShake) {
        restoreScreenShake();
    }
}

// 绘制背景
function drawBackground() {
    // 创建渐变背景
    const gradient = ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT);
    gradient.addColorStop(0, '#87CEEB'); // 天空蓝
    gradient.addColorStop(0.5, '#98D8C8'); // 浅绿
    gradient.addColorStop(1, '#7ec850'); // 草地绿
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    
    // 添加云朵效果
    drawClouds();
    
    // 绘制路边树木
    drawTrees();
}

// 绘制云朵
function drawClouds() {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    const cloudY = 50 + Math.sin(Date.now() * 0.0001) * 10;
    
    // 云朵1
    drawCloud(100, cloudY, 40);
    // 云朵2
    drawCloud(600, cloudY + 30, 35);
    // 云朵3
    drawCloud(350, cloudY - 20, 45);
}

function drawCloud(x, y, size) {
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.arc(x + size, y, size * 0.8, 0, Math.PI * 2);
    ctx.arc(x - size * 0.5, y, size * 0.7, 0, Math.PI * 2);
    ctx.fill();
}

// 绘制树木
function drawTrees() {
    const treePositions = [
        { x: 50, y: 200 },
        { x: 100, y: 350 },
        { x: 750, y: 250 },
        { x: 700, y: 400 }
    ];
    
    treePositions.forEach(pos => {
        const offset = (roadOffset * 0.5) % 100;
        drawTree(pos.x, pos.y + offset);
    });
}

function drawTree(x, y) {
    // 树干
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(x - 5, y, 10, 20);
    
    // 树叶
    ctx.fillStyle = '#228B22';
    ctx.beginPath();
    ctx.moveTo(x, y - 20);
    ctx.lineTo(x - 15, y);
    ctx.lineTo(x + 15, y);
    ctx.closePath();
    ctx.fill();
}

// 绘制道路
function drawRoad() {
    // 道路渐变
    const roadGradient = ctx.createLinearGradient(ROAD_MARGIN, 0, ROAD_MARGIN + ROAD_WIDTH, 0);
    roadGradient.addColorStop(0, '#3a3a3a');
    roadGradient.addColorStop(0.5, '#555555');
    roadGradient.addColorStop(1, '#3a3a3a');
    ctx.fillStyle = roadGradient;
    ctx.fillRect(ROAD_MARGIN, 0, ROAD_WIDTH, GAME_HEIGHT);
    
    // 道路纹理
    ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
    for (let i = 0; i < 10; i++) {
        const y = (roadOffset * 2 + i * 50) % GAME_HEIGHT;
        ctx.fillRect(ROAD_MARGIN, y, ROAD_WIDTH, 2);
    }
    
    // 道路边缘（黄色边线）
    const edgeGradient = ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT);
    edgeGradient.addColorStop(0, '#FFD700');
    edgeGradient.addColorStop(0.5, '#FFA500');
    edgeGradient.addColorStop(1, '#FFD700');
    ctx.fillStyle = edgeGradient;
    ctx.fillRect(ROAD_MARGIN - 5, 0, 5, GAME_HEIGHT);
    ctx.fillRect(ROAD_MARGIN + ROAD_WIDTH, 0, 5, GAME_HEIGHT);
    
    // 道路边缘阴影
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 10;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.fillRect(ROAD_MARGIN - 10, 0, 5, GAME_HEIGHT);
    ctx.fillRect(ROAD_MARGIN + ROAD_WIDTH + 5, 0, 5, GAME_HEIGHT);
    ctx.shadowBlur = 0;
    
    // 道路中间虚线（白色）
    const laneWidth = ROAD_WIDTH / LANE_COUNT;
    
    for (let lane = 1; lane < LANE_COUNT; lane++) {
        const x = ROAD_MARGIN + lane * laneWidth;
        
        for (let y = -40 + roadOffset; y < GAME_HEIGHT; y += 60) {
            // 虚线渐变效果
            const lineGradient = ctx.createLinearGradient(x, y, x, y + 30);
            lineGradient.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
            lineGradient.addColorStop(0.5, 'rgba(255, 255, 255, 1)');
            lineGradient.addColorStop(1, 'rgba(255, 255, 255, 0.9)');
            ctx.fillStyle = lineGradient;
            ctx.fillRect(x - 3, y, 6, 30);
        }
    }
    
    // 绘制轮胎痕迹
    drawSkidMarks();
}

// 绘制玩家
function drawPlayer() {
    // 车身阴影
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;
    
    // 车身渐变
    const carGradient = ctx.createLinearGradient(player.x, player.y, player.x, player.y + player.height);
    carGradient.addColorStop(0, '#ff6b6b');
    carGradient.addColorStop(0.5, '#e74c3c');
    carGradient.addColorStop(1, '#c0392b');
    ctx.fillStyle = carGradient;
    ctx.fillRect(player.x, player.y, player.width, player.height);
    
    // 重置阴影
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    
    // 车顶
    ctx.fillStyle = '#a93226';
    ctx.fillRect(player.x + 3, player.y + 10, player.width - 6, player.height - 30);
    
    // 车窗（带反光效果）
    const windowGradient = ctx.createLinearGradient(player.x, player.y + 5, player.x, player.y + 20);
    windowGradient.addColorStop(0, '#87CEEB');
    windowGradient.addColorStop(0.5, '#5DADE2');
    windowGradient.addColorStop(1, '#3498db');
    ctx.fillStyle = windowGradient;
    ctx.fillRect(player.x + 5, player.y + 5, player.width - 10, 15);
    
    // 前车灯（发光效果）
    if (player.speed > 0) {
        // 光晕效果
        ctx.shadowColor = '#ffeb3b';
        ctx.shadowBlur = 15;
        ctx.fillStyle = '#ffeb3b';
        ctx.fillRect(player.x + 5, player.y - 2, 5, 5);
        ctx.fillRect(player.x + player.width - 10, player.y - 2, 5, 5);
        
        // 光束效果
        const lightGradient = ctx.createLinearGradient(player.x, player.y - 20, player.x, player.y);
        lightGradient.addColorStop(0, 'rgba(255, 235, 59, 0)');
        lightGradient.addColorStop(1, 'rgba(255, 235, 59, 0.3)');
        ctx.fillStyle = lightGradient;
        ctx.fillRect(player.x + 5, player.y - 20, 5, 20);
        ctx.fillRect(player.x + player.width - 10, player.y - 20, 5, 20);
        ctx.shadowBlur = 0;
    }
    
    // 尾灯
    ctx.fillStyle = '#e74c3c';
    ctx.fillRect(player.x + 5, player.y + player.height - 5, 5, 5);
    ctx.fillRect(player.x + player.width - 10, player.y + player.height - 5, 5, 5);
    
    // 车轮
    ctx.fillStyle = '#2c3e50';
    ctx.fillRect(player.x - 2, player.y + 10, 4, 10);
    ctx.fillRect(player.x + player.width - 2, player.y + 10, 4, 10);
    ctx.fillRect(player.x - 2, player.y + player.height - 20, 4, 10);
    ctx.fillRect(player.x + player.width - 2, player.y + player.height - 20, 4, 10);
    
    // 速度线效果
    if (player.speed > 5) {
        drawSpeedLines();
    }
}

// 绘制障碍物
function drawObstacles() {
    obstacles.forEach(obstacle => {
        // 车身阴影
        ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
        ctx.shadowBlur = 8;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;
        
        // 车身渐变
        const obstacleGradient = ctx.createLinearGradient(obstacle.x, obstacle.y, obstacle.x, obstacle.y + obstacle.height);
        const baseColor = obstacle.color;
        obstacleGradient.addColorStop(0, lightenColor(baseColor, 20));
        obstacleGradient.addColorStop(0.5, baseColor);
        obstacleGradient.addColorStop(1, darkenColor(baseColor, 20));
        ctx.fillStyle = obstacleGradient;
        ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
        
        // 重置阴影
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        
        // 车顶
        ctx.fillStyle = darkenColor(baseColor, 30);
        ctx.fillRect(obstacle.x + 3, obstacle.y + obstacle.height - 60, obstacle.width - 6, 40);
        
        // 车窗
        const windowGradient = ctx.createLinearGradient(obstacle.x, obstacle.y + obstacle.height - 20, obstacle.x, obstacle.y + obstacle.height - 5);
        windowGradient.addColorStop(0, '#87CEEB');
        windowGradient.addColorStop(1, '#3498db');
        ctx.fillStyle = windowGradient;
        ctx.fillRect(obstacle.x + 5, obstacle.y + obstacle.height - 20, obstacle.width - 10, 15);
        
        // 尾灯
        ctx.fillStyle = '#dc143c';
        ctx.fillRect(obstacle.x + 5, obstacle.y + obstacle.height - 5, 5, 5);
        ctx.fillRect(obstacle.x + obstacle.width - 10, obstacle.y + obstacle.height - 5, 5, 5);
        
        // 车轮
        ctx.fillStyle = '#2c3e50';
        ctx.fillRect(obstacle.x - 2, obstacle.y + 10, 4, 10);
        ctx.fillRect(obstacle.x + obstacle.width - 2, obstacle.y + 10, 4, 10);
        ctx.fillRect(obstacle.x - 2, obstacle.y + obstacle.height - 20, 4, 10);
        ctx.fillRect(obstacle.x + obstacle.width - 2, obstacle.y + obstacle.height - 20, 4, 10);
    });
}

// 颜色辅助函数
function lightenColor(color, percent) {
    const num = parseInt(color.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) + amt;
    const G = (num >> 8 & 0x00FF) + amt;
    const B = (num & 0x0000FF) + amt;
    return '#' + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
        (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
        (B < 255 ? B < 1 ? 0 : B : 255)).toString(16).slice(1);
}

function darkenColor(color, percent) {
    return lightenColor(color, -percent);
}

// 创建障碍物
function createObstacle() {
    const lane = Math.floor(Math.random() * LANE_COUNT);
    const x = ROAD_MARGIN + (lane * LANE_WIDTH) + (LANE_WIDTH - OBSTACLE_WIDTH) / 2;
    
    const colors = ['#2ecc71', '#3498db', '#9b59b6', '#f1c40f', '#1abc9c'];
    const color = colors[Math.floor(Math.random() * colors.length)];
    
    obstacles.push({
        x: x,
        y: -OBSTACLE_HEIGHT,
        width: OBSTACLE_WIDTH,
        height: OBSTACLE_HEIGHT,
        color: color
    });
}

// 检测碰撞
function checkCollision(a, b) {
    return a.x < b.x + b.width &&
           a.x + a.width > b.x &&
           a.y < b.y + b.height &&
           a.y + a.height > b.y;
}

// 更新UI
function updateUI() {
    document.getElementById('score').textContent = score;
    document.getElementById('lives').textContent = lives;
    document.getElementById('speed').textContent = Math.floor(player.speed * 10);
}

// 游戏结束
function gameOver() {
    gameRunning = false;
    cancelAnimationFrame(animationId);
    
    document.getElementById('finalScore').textContent = score;
    document.getElementById('gameOver').style.display = 'flex';
}

// 重新开始游戏
function restartGame() {
    initGame();
    startGame();
}

// 键盘事件监听
document.addEventListener('keydown', (e) => {
    if (keys.hasOwnProperty(e.key)) {
        keys[e.key] = true;
    }
});

document.addEventListener('keyup', (e) => {
    if (keys.hasOwnProperty(e.key)) {
        keys[e.key] = false;
    }
});

// 按钮事件监听
document.getElementById('startButton').addEventListener('click', startGame);
document.getElementById('restartButton').addEventListener('click', restartGame);

// 初始化游戏
window.addEventListener('load', initGame);