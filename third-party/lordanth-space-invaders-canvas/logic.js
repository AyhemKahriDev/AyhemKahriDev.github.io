// ============================================================
// DOM References & Audio Setup
// ============================================================
const canvas = document.getElementById('gameCanvas')
const ctx = canvas.getContext('2d')
const leftBtn = document.getElementById('leftBtn')
const rightBtn = document.getElementById('rightBtn')
const scoreBoard = document.getElementById('scoreBoard')

// Audio
const explosionSound = new Audio('assets/audio/explosion.mp3')
const healSound = new Audio('assets/audio/heal.mp3')
const hitSound = new Audio('assets/audio/hit.mp3')
const CombatMusic = new Audio('assets/audio/combat-music.m4a')
const hoverSound = new Audio('assets/audio/hover.wav')
const clickSound = new Audio('assets/audio/click.wav')
const gameOverSound = new Audio('assets/audio/game-over.mp3')
const victorySound = new Audio('assets/audio/victory.mp3')

// UI Elements
const livesBoard = document.getElementById('livesBoard')
const damageOverlay = document.getElementById('damageOverlay')
const gameContainer = document.getElementById('gameContainer')
const mainMenu = document.getElementById('mainMenu')
const btnPlay = document.getElementById('btnPlay')
const btnOptions = document.getElementById('btnOptions')
const btnCredits = document.getElementById('btnCredits')
const btnLanguage = document.getElementById('btnLanguage')
const btnBack = document.getElementById('btnBack')
const btnBackCredits = document.getElementById('btnBackCredits')
const btnRetry = document.getElementById('btnRetry')
const btnQuit = document.getElementById('btnQuit')
const btnRetryWin = document.getElementById('btnRetryWin')
const btnQuitWin = document.getElementById('btnQuitWin')
const allButtons = document.querySelectorAll('button')
const sound = document.getElementById('sound')
const color = document.getElementById('color')
const additional = document.getElementById('additional')
const dev = document.getElementById('dev')
const testing = document.getElementById('testing')
const finalScore = document.getElementById('finalScore')
const finalScoreWin = document.getElementById('finalScoreWin')
const optionsTitle = document.getElementById('optionsTitle')
const gameOverTitle = document.getElementById('gameOverTitle')
const victoryTitle = document.getElementById('victoryTitle')
const creditsTitle = document.getElementById('creditsTitle')
const mobileControls = document.getElementById('mobileControls')
const optionsMenu = document.getElementById('optionsMenu')
const gameOverMenu = document.getElementById('gameOverMenu')
const victoryMenu = document.getElementById('victoryMenu')
const creditsMenu = document.getElementById('creditsMenu')
const volumeSlider = document.getElementById('volumeSlider')
const shipColorPicker = document.getElementById('shipColorPicker')

// Audio config
CombatMusic.loop = true
CombatMusic.volume = 0.6
hoverSound.volume = 0.5
clickSound.volume = 0.5

// ============================================================
// Game State
// ============================================================
const Languages = ['EN', 'ES', 'FR']
let LangIndex = 0
let currentLang = Languages[LangIndex]
let score = 0
let lives = 3
let healTimer = 0
let damageTimer = 0
let isGameActive = false
let enemyInterval
let bulletInterval
let livesInterval
let animationId
let playerColor = '#0055ff'

// Start game: hide menu, show HUD, begin timers and game loop
function startGame() {
  if (isGameActive) return
  isGameActive = true

  mainMenu.classList.add('hidden')
  mobileControls.classList.remove('hidden')
  scoreBoard.classList.remove('hidden')
  livesBoard.classList.remove('hidden')

  CombatMusic.play()

  enemyInterval = setInterval(spawnEnemy, 1000)   // Spawn enemy every 1s
  bulletInterval = setInterval(fireBullet, 500)    // Auto-fire every 500ms
  livesInterval = setInterval(spawnLivesObj, 15000) // Life pickup every 15s
  updateLivesBoard(0)
  requestAnimationFrame(gameLoop)
}

// Reset game state to initial values
function resetGame() {
  enemies.length = 0
  bullets.length = 0
  livesObj.length = 0
  explosions.length = 0
  healing.length = 0
  bossBullets.length = 0

  score = 0
  lives = 3
  healTimer = 0
  damageTimer = 0

  boss.active = false
  boss.health = boss.maxHealth
  boss.y = -150

  player.x = canvas.width / 2 - 15
  player.y = canvas.height - 30

  canvas.style.filter = 'none'
  damageOverlay.classList.remove('animate-flash')
  scoreBoard.textContent = translations[currentLang].hudScore + score
  updateLivesBoard(0)
}

// ============================================================
// Menu Event Listeners
// ============================================================
btnPlay.addEventListener('click', startGame)
btnPlay.addEventListener('touchstart', startGame)

btnOptions.addEventListener('click', () => {
  mainMenu.classList.add('hidden')
  optionsMenu.classList.remove('hidden')
})

btnCredits.addEventListener('click', () => {
  console.log("Credits Button Clicked")
  mainMenu.classList.add('hidden')
  creditsMenu.classList.remove('hidden')
})

btnBack.addEventListener('click', () => {
  optionsMenu.classList.add('hidden')
  mainMenu.classList.remove('hidden')
})

btnBackCredits.addEventListener('click', () => {
  creditsMenu.classList.add('hidden')
  mainMenu.classList.remove('hidden')
})

volumeSlider.addEventListener('input', (e) => {
  const volume = e.target.value
  CombatMusic.volume = volume
})

shipColorPicker.addEventListener('input', (e) => {
  playerColor = e.target.value
})

btnLanguage.addEventListener('click', () => {
  LangIndex++
  if (LangIndex >= Languages.length) LangIndex = 0
  currentLang = Languages[LangIndex]
  updateLanguage()
})

const btnRetryHandler = () => {
  gameOverMenu.classList.add('hidden')
  victoryMenu.classList.add('hidden')
  resetGame()
  startGame()
}

btnRetryWin.addEventListener('click', btnRetryHandler)
btnRetry.addEventListener('click', btnRetryHandler)

const btnQuitHandler = () => {
  gameOverMenu.classList.add('hidden')
  victoryMenu.classList.add('hidden')
  mainMenu.classList.remove('hidden')
  scoreBoard.classList.add('hidden')
  livesBoard.classList.add('hidden')
  mobileControls.classList.add('hidden')
  resetGame()
}

btnQuitWin.addEventListener('click', btnQuitHandler)
btnQuit.addEventListener('click', btnQuitHandler)

// Hover and click sounds for all buttons
allButtons.forEach(button => {
  button.addEventListener('mouseenter', () => {
    hoverSound.currentTime = 0
    hoverSound.play()
  })

  button.addEventListener('click', () => {
    clickSound.currentTime = 0
    clickSound.play()
  })
})

// ============================================================
// Internationalization
// ============================================================

// Update all UI text to current language
function updateLanguage() {
  const language = translations[currentLang]

  btnPlay.textContent = language.play
  btnOptions.textContent = language.options
  btnCredits.textContent = language.credits
  btnBack.textContent = language.back
  btnCredits.textContent = language.credits
  btnBackCredits.textContent = language.back

  sound.textContent = language.sound
  color.textContent = language.color
  additional.textContent = language.additional
  dev.textContent = language.dev
  testing.textContent = language.testing
  optionsTitle.textContent = language.optionsTitle
  gameOverTitle.textContent = language.gameOver
  victoryTitle.textContent = language.winner
  creditsTitle.textContent = language.credits
  btnRetry.textContent = language.retry
  btnRetryWin.textContent = language.retry
  btnQuit.textContent = language.quit
  btnQuitWin.textContent = language.quit
  finalScore.textContent = language.finalScore + score
  finalScoreWin.textContent = language.finalScore + score
  scoreBoard.textContent = language.hudScore + score

  btnLanguage.textContent = `${language.language}: ${currentLang}`
}

// Translation strings for EN, ES, FR
const translations = {
  EN: {
    play: "Play",
    options: "Options",
    score: "Score",
    credits: "Credits",
    back: "Back",
    language: "Language",
    color: "Color",
    sound: "Sound",
    optionsTitle: "Options",
    additional: "Create with Canvas Api",
    hudScore: "Score: ",
    hudLives: "Lives: ",
    gameOver: "Game Over",
    retry: "Try Again",
    quit: "Main Menu",
    finalScore: "Final Score: ",
    dev: "Development",
    testing: "Testing",
    winner: "Congratulations!"
  },
  ES: {
    play: "Jugar",
    options: "Opciones",
    score: "Puntuación",
    credits: "Créditos",
    back: "Volver",
    language: "Idioma",
    color: "Color",
    sound: "Sonido",
    optionsTitle: "Opciones",
    additional: "Creado con Canvas Api",
    hudScore: "Puntuación: ",
    hudLives: "Vidas: ",
    gameOver: "Fin del Juego",
    retry: "Reintentar",
    quit: "Menú Principal",
    finalScore: "Puntaje Final: ",
    dev: "Desarrollo",
    testing: "Pruebas",
    winner: "¡Felicidades!"
  },
  FR: {
    play: "Jouer",
    options: "Options",
    score: "Score",
    credits: "Crédits",
    back: "Retour",
    language: "Langue",
    color: "Couleur",
    sound: "Son",
    optionsTitle: "Options",
    additional: "Créé avec Canvas Api",
    hudScore: "Score: ",
    hudLives: "Vies: ",
    gameOver: "Jeu Terminé",
    retry: "Réessayer",
    quit: "Menu Principal",
    finalScore: "Score Final: ",
    dev: "Développement",
    testing: "Test",
    winner: "Félicitations!"
  }
}

// ============================================================
// Game Objects
// ============================================================

const player = {
  x: canvas.width / 2 - 15,
  y: canvas.height - 30,
  width: 30,
  height: 15,
  speed: 5
}

const shootingStar = {
  x: 0,
  y: 0,
  speed: 0,
  active: false
}

const boss = {
  active: false,
  x: canvas.width / 2 - 50,
  y: -150,
  width: 100,
  height: 60,
  speedX: 3,
  positionY: 50,
  health: 500,
  maxHealth: 500
}

const enemies = []
const bullets = []
const bossBullets = []
const livesObj = []
const explosions = []
const healing = []
const stars = []
const numStars = 100

// ============================================================
// Input Handling
// ============================================================
let leftPressed = false
let rightPressed = false

document.addEventListener('keydown', e => {
  if (e.key === 'ArrowLeft') leftPressed = true
  if (e.key === 'ArrowRight') rightPressed = true
})
document.addEventListener('keyup', e => {
  if (e.key === 'ArrowLeft') leftPressed = false
  if (e.key === 'ArrowRight') rightPressed = false
})

leftBtn.addEventListener('touchstart', () => leftPressed = true)
leftBtn.addEventListener('touchend', () => leftPressed = false)
rightBtn.addEventListener('touchstart', () => rightPressed = true)
rightBtn.addEventListener('touchend', () => rightPressed = false)

leftBtn.addEventListener('mousedown', () => leftPressed = true)
leftBtn.addEventListener('mouseup', () => leftPressed = false)
rightBtn.addEventListener('mousedown', () => rightPressed = true)
rightBtn.addEventListener('mouseup', () => rightPressed = false)

// Initialize background star positions
for (let i = 0; i < numStars; i++) {
  stars.push({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    size: Math.random() * 1.5,
    speed: Math.random() * 2 + 0.5
  })
}

// ============================================================
// Spawn Functions
// ============================================================

// Create a bullet at the player's position
function fireBullet() {
  bullets.push({
    x: player.x + player.width / 2 - 2,
    y: player.y - 10,
    width: 4,
    height: 10,
    speed: 7
  })
}

// Create an enemy at a random X position at the top
function spawnEnemy() {
  if (boss.active) return
  const enemyWidth = 30
  enemies.push({
    x: Math.random() * (canvas.width - enemyWidth),
    y: 0,
    width: enemyWidth,
    height: 20,
    speed: 2
  })
}

// Create a life pickup at a random X position at the top
function spawnLivesObj() {
  const lifeWidth = 15
  livesObj.push({
    x: Math.random() * (canvas.width - lifeWidth),
    y: 0,
    width: lifeWidth,
    height: lifeWidth,
    speed: 1.5
  })
}

// ============================================================
// Particle Effects
// ============================================================

// Spawn explosion particles at a given position
function createExplosion(x, y) {
  const particles = 15
  for (let i = 0; i < particles; i++) {
    explosions.push({
      x: x,
      y: y,
      vx: (Math.random() - 0.5) * 6,
      vy: (Math.random() - 0.5) * 6,
      size: Math.random() * 4 + 1,
      time: 30,
    })
  }
}

// Spawn healing particles on life pickup
function HealEffect(x, y) {
  const particle = 10
  for (let i = 0; i < particle; i++) {
    healing.push({
      x: x + (Math.random() - 0.5) * 20,
      y: y,
      vx: (Math.random() - 0.5) * 2,
      vy: - (Math.random() * 3 - 1),
      size: Math.random() * 5 + 4,
      life: 40,
    })
  }
}

// AABB collision detection between two rectangles
function isColliding(rect1, rect2) {
  return rect1.x < rect2.x + rect2.width &&
    rect1.x + rect1.width > rect2.x &&
    rect1.y < rect2.y + rect2.height &&
    rect1.y + rect1.height > rect2.y
}

// ============================================================
// Lives System
// ============================================================

// Update remaining lives: positive value = gain, negative = lose
function updateLivesBoard(value) {
  if (value < 0) {
    damageOverlay.classList.add('animate-flash')
    setTimeout(() => damageOverlay.classList.remove('animate-flash'), 400)
    gameContainer.classList.add('shake-effect')
    setTimeout(() => gameContainer.classList.remove('shake-effect'), 200)
  }

  lives += value
  if (lives > 5) lives = 5

  livesBoard.innerHTML = ""
  const label = document.createElement('span')
  label.textContent = translations[currentLang].hudLives
  livesBoard.appendChild(label)

  for (let i = 0; i < lives; i++) {
    const heartImg = document.createElement('img')
    heartImg.src = "assets/images/heart.png"
    heartImg.classList.add("heart-icon")
    livesBoard.appendChild(heartImg)
  }

  // Game Over
  if (lives <= 0) {
    isGameActive = false
    cancelAnimationFrame(animationId)

    clearInterval(enemyInterval)
    clearInterval(bulletInterval)
    clearInterval(livesInterval)

    setTimeout(() => damageOverlay.classList.add('animate-flash'), 1000)
    canvas.style.filter = 'grayscale(100%) blur(2px) brightness(0.5)'

    CombatMusic.currentTime = 0
    CombatMusic.pause()
    gameOverSound.play()

    setTimeout(() => {

      mobileControls.classList.add('hidden')
      scoreBoard.classList.add('hidden')
      livesBoard.classList.add('hidden')
      gameOverMenu.classList.remove('hidden')

      finalScore.textContent = translations[currentLang].finalScore + score
    }, 1000)
  }
}

// ============================================================
// Game Update Loop (called every frame)
// ============================================================
function update() {
  // Player Movement
  if (leftPressed) player.x = Math.max(0, player.x - player.speed)
  if (rightPressed) player.x = Math.min(canvas.width - player.width, player.x + player.speed)

  // Bullets
  for (let i = 0; i < bullets.length; i++) {
    bullets[i].y -= bullets[i].speed
    if (bullets[i].y < 0) {
      bullets.splice(i, 1)
      i--
    }
  }

  // Enemy Movement & Collision
  for (let i = 0; i < enemies.length; i++) {
    enemies[i].y += enemies[i].speed
    if (isColliding(player, enemies[i])) {
      damageTimer = 15
      enemies.splice(i, 1)
      i--
      hitSound.currentTime = 0
      hitSound.play()
      updateLivesBoard(-1)
      continue
    }
    if (enemies[i].y > canvas.height) {
      enemies.splice(i, 1)
      i--
      updateLivesBoard(-1)
      console.log("Enemy passed! Lives left: " + lives)
    }
  }

  // Damage Timer
  if (damageTimer > 0) {
    damageTimer--
  }

  // Life Pickups
  for (let i = 0; i < livesObj.length; i++) {
    livesObj[i].y += livesObj[i].speed
    if (isColliding(player, livesObj[i])) {
      HealEffect(player.x + player.width / 2, player.y)
      healTimer = 20
      livesObj.splice(i, 1)
      i--
      healSound.currentTime = 0
      healSound.play()
      updateLivesBoard(1)
      continue
    }
    if (livesObj[i].y > canvas.height) {
      livesObj.splice(i, 1)
      i--
    }
  }

  // Heal Timer
  if (healTimer > 0) {
    healTimer--
  }

  // Bullet-Enemy Collision
  for (let i = 0; i < bullets.length; i++) {
    for (let j = 0; j < enemies.length; j++) {
      if (isColliding(bullets[i], enemies[j])) {
        createExplosion(enemies[j].x + enemies[j].width / 2, enemies[j].y)
        bullets.splice(i, 1)
        enemies.splice(j, 1)
        score += 10
        scoreBoard.textContent = translations[currentLang].hudScore + score
        explosionSound.currentTime = 0
        explosionSound.play()
        i--
        break
      }
    }
  }

  // Explosion Particles
  for (let i = 0; i < explosions.length; i++) {
    const particle = explosions[i]
    particle.x += particle.vx
    particle.y += particle.vy
    particle.time--

    if (particle.time <= 0) {
      explosions.splice(i, 1)
      i--
    }
  }

  // Healing Particles
  for (let i = 0; i < healing.length; i++) {
    const particle = healing[i]
    particle.x += particle.vx
    particle.y += particle.vy
    particle.life--

    if (particle.life <= 0) {
      healing.splice(i, 1)
      i--
    }
  }

  // Starfield
  stars.forEach(star => {
    star.y += star.speed
    if (star.y > canvas.height) {
      star.y = 0
      star.x = Math.random() * canvas.width
    }
  })

  // Shooting Star
  if (!shootingStar.active && Math.random() < 0.01) {
    shootingStar.active = true
    shootingStar.x += Math.random() * canvas.width
    shootingStar.y = -10
    shootingStar.speed = Math.random() * 10 + 10
  }

  if (shootingStar.active) {
    shootingStar.y += shootingStar.speed
    shootingStar.x -= shootingStar.speed / 2

    if (shootingStar.y > canvas.height || shootingStar.x < 0) {
      shootingStar.active = false
    }
  }

  // Boss Activation
  if (score >= 250 && !boss.active && boss.health > 0) {
    boss.active = true
  }

  if (boss.active) {
    // Boss Movement
    if (boss.y < boss.positionY) {
      boss.y += 1
    } else {
      boss.x += boss.speedX
      if (boss.x <= 0 || boss.x + boss.width >= canvas.width) {
        boss.speedX *= -1
      }
    }

    // Boss Hit by Bullets
    for (let i = 0; i < bullets.length; i++) {
      if (isColliding(bullets[i], boss)) {
        boss.health -= 5
        createExplosion(bullets[i].x, bullets[i].y)
        bullets.splice(i, 1)
        i--
        explosionSound.currentTime = 0
        explosionSound.play()

        // Boss Defeated
        if (boss.health <= 0) {
          boss.active = false
          createExplosion(boss.x + boss.width / 2, boss.y + boss.height / 2)
          explosionSound.play()
          score += 1000

          setTimeout(() => {

            isGameActive = false
            cancelAnimationFrame(animationId)

            clearInterval(enemyInterval)
            clearInterval(bulletInterval)
            clearInterval(livesInterval)

            CombatMusic.currentTime = 0
            CombatMusic.pause()
            victorySound.play()

            victoryMenu.classList.remove('hidden')
            scoreBoard.classList.add('hidden')
            livesBoard.classList.add('hidden')
            mobileControls.classList.add('hidden')

            finalScoreWin.textContent = translations[currentLang].finalScore + score

          }, 1000)
        }
      }
    }

    // Boss Shoots (3 bullet types: left, right, center)
    if (Math.random() < 0.03) {
      bossBullets.push({
        x: boss.x,
        y: boss.y + boss.height,
        width: 15,
        height: 15,
        speed: 6,
        vx: -2
      })
    }
    if (Math.random() < 0.03) {
      bossBullets.push({
        x: boss.x + boss.width - 10,
        y: boss.y + boss.height,
        width: 15,
        height: 15,
        speed: 6,
        vx: 2
      })
    }
    if (Math.random() < 0.03) {
      bossBullets.push({
        x: boss.x + boss.width / 2,
        y: boss.y + boss.height,
        width: 15,
        height: 15,
        speed: 6,
        vx: 0
      })
    }

    // Move Boss Bullets
    for (let i = 0; i < bossBullets.length; i++) {
      const bullet = bossBullets[i]
      bullet.y += bullet.speed
      bullet.x += bullet.vx
      if (isColliding(player, bullet)) {
        updateLivesBoard(-1)
        hitSound.currentTime = 0
        hitSound.play()
        bossBullets.splice(i, 1)
        i--
        continue
      }

      if (bullet.y > canvas.height) {
        bossBullets.splice(i, 1)
        i--
      }
    }
  }
}

// ============================================================
// Rendering
// ============================================================

// 8x7 pixel heart pattern used for life pickup drawing
const heartPattern = [
  [0, 1, 1, 0, 0, 1, 1, 0],
  [1, 1, 1, 1, 1, 1, 1, 1],
  [1, 1, 1, 1, 1, 1, 1, 1],
  [0, 1, 1, 1, 1, 1, 1, 0],
  [0, 0, 1, 1, 1, 1, 0, 0],
  [0, 0, 0, 1, 1, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0]
];

// Main draw function — renders everything each frame
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Stars
  stars.forEach(star => {
    const flicker = 0.5 + Math.random() * 0.5
    ctx.fillStyle = `rgba(255, 255, 255, ${flicker})`
    ctx.beginPath()
    ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2)
    ctx.fill()
  })

  // Shooting Star
  if (shootingStar.active) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(shootingStar.x, shootingStar.y)
    ctx.lineTo(shootingStar.x + 15, shootingStar.y - 25)
    ctx.stroke()
  }

  // Player Ship
  let gradient = ctx.createLinearGradient(0, player.y, 0, player.y + player.height)
  gradient.addColorStop(0, '#00d4ff')
  gradient.addColorStop(1, playerColor)

  ctx.fillStyle = gradient

  if (damageTimer > 0) {
    ctx.fillStyle = '#FF0000'    // Red when damaged
  } else if (healTimer > 0) {
    ctx.fillStyle = 'white'      // White when healed
  } else {
    ctx.fillStyle = gradient     // Default gradient
  }

  ctx.beginPath()
  ctx.moveTo(player.x + player.width / 2, player.y)
  ctx.lineTo(player.x + player.width, player.y + player.height)
  ctx.lineTo(player.x + player.width / 2, player.y + player.height - 5)
  ctx.lineTo(player.x, player.y + player.height)
  ctx.closePath()
  ctx.fill()

  // Bullets
  ctx.fillStyle = '#FF0000'
  bullets.forEach(bullet => {
    ctx.fillRect(bullet.x, bullet.y, bullet.width, bullet.height)
  })

  // Enemies
  enemies.forEach(enemy => {
    let gradientEnemy = ctx.createLinearGradient(enemy.x, enemy.y, enemy.x, enemy.y + enemy.height)
    gradientEnemy.addColorStop(0, '#2ecc71')
    gradientEnemy.addColorStop(1, '#145a32')

    ctx.fillStyle = gradientEnemy

    // Draw body
    ctx.beginPath()
    ctx.arc(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2, enemy.width / 2, Math.PI, 0)
    ctx.lineTo(enemy.x + enemy.width, enemy.y + enemy.height - 5)
    ctx.lineTo(enemy.x, enemy.y + enemy.height - 5)
    ctx.fill()

    ctx.strokeStyle = '#145a32'
    ctx.lineWidth = 2
    ctx.stroke()

    // Draw eyes
    ctx.fillStyle = 'white'
    ctx.fillRect(enemy.x + enemy.width * 0.25, enemy.y + enemy.height * 0.3, 3, 3)
    ctx.fillRect(enemy.x + enemy.width * 0.65, enemy.y + enemy.height * 0.3, 3, 3)

    // Draw tentacles
    ctx.fillStyle = enemy.color || '#1e924e'
    let legOffset = Math.sin(Date.now() / 100) * 3

    ctx.fillRect(enemy.x + 2, enemy.y + enemy.height - 3, 6, 5 + legOffset)
    ctx.fillRect(enemy.x + enemy.width / 2 - 3, enemy.y + enemy.height - 3, 6, 5 - legOffset)
    ctx.fillRect(enemy.x + enemy.width - 8, enemy.y + enemy.height - 3, 6, 5 + legOffset)

    // visual collision box (for testing)
    //ctx.fillStyle = '#ff545463'
    //ctx.fillRect(enemy.x, enemy.y, enemy.width, enemy.height)
  })

  // Life Pickups (pixel heart)
  ctx.fillStyle = '#e63946'
  livesObj.forEach(live => {
    const size = 2
    for (let row = 0; row < heartPattern.length; row++) {
      for (let col = 0; col < heartPattern[row].length; col++) {
        if (heartPattern[row][col] === 1) {
          ctx.fillRect(live.x + col * size, live.y + row * size, size, size)
        }
      }
    }
  })

  // Boss
  if (boss.active) {

    ctx.fillStyle = '#8e44ad'
    ctx.shadowBlur = 10
    ctx.shadowColor = '#e056fd'

    // Body
    ctx.beginPath()
    ctx.moveTo(boss.x, boss.y)
    ctx.lineTo(boss.x + boss.width, boss.y)
    ctx.lineTo(boss.x + boss.width - 10, boss.y + boss.height)
    ctx.lineTo(boss.x + 10, boss.y + boss.height)
    ctx.closePath()
    ctx.fill()
    ctx.shadowBlur = 0

    // hands
    ctx.fillStyle = '#8e44ad'
    ctx.fillRect(boss.x - 15, boss.y + 10, 20, 10)
    ctx.fillRect(boss.x + boss.width - 5, boss.y + 10, 20, 10)
    ctx.fillRect(boss.x - 50, boss.y + boss.height / 2 - 4, 200, 15)

    // Mouth
    ctx.fillStyle = '#404240'
    ctx.strokeStyle = '#000000'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.arc(boss.x + boss.width / 2, boss.y + boss.height, boss.width / 6, Math.PI, 0)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()

    // Eyes
    ctx.fillStyle = '#fff018'
    ctx.shadowBlur = 5
    ctx.shadowColor = '#fff018'
    ctx.fillRect(boss.x + 20, boss.y + 20, 15, 10)
    ctx.fillRect(boss.x + boss.width - 35, boss.y + 20, 15, 10)
    ctx.shadowBlur = 0

    // Collision box (for testing)
    //ctx.fillStyle = "#be5f5fb9"
    //ctx.fillRect(boss.x, boss.y, boss.width, boss.height)

    // bullets
    ctx.fillStyle = '#00fbff'
    ctx.shadowBlur = 15
    ctx.shadowColor = '#05dffc'
    bossBullets.forEach(bullet => {
      ctx.beginPath()
      ctx.arc(bullet.x + bullet.width / 2, bullet.y + bullet.height / 2, bullet.width / 2, 0, Math.PI * 2)
      ctx.closePath()
      ctx.fill()
      //ctx.fillStyle = '#ff13eb4d'
      //ctx.fillRect(bullet.x, bullet.y, bullet.width, bullet.height)
    })
    ctx.shadowBlur = 0

    // Boss health bar UI
    const barWidth = 200
    const barHeight = 10
    const barX = (canvas.width - barWidth) / 2
    const barY = 20
    const healthPercent = boss.health / boss.maxHealth

    ctx.fillStyle = '#555'
    ctx.fillRect(barX, barY, barWidth, barHeight)
    ctx.fillStyle = '#e74c3c'
    ctx.fillRect(barX, barY, barWidth * healthPercent, barHeight)

    ctx.strokeStyle = 'white'
    ctx.lineWidth = 1
    ctx.strokeRect(barX, barY, barWidth, barHeight)

    ctx.fillStyle = 'white'
    ctx.font = '10px Arial'
    ctx.fillText(`Mondongo espacial: ${boss.health} / ${boss.maxHealth}`, barX + 50, barY + 8)
  }

  // Explosion Particles (yellow squares)
  ctx.fillStyle = '#fcff34ff'
  explosions.forEach(particle => {
    ctx.globalAlpha = particle.time / 30
    ctx.fillRect(particle.x, particle.y, particle.size, particle.size)
  })
  ctx.globalAlpha = 1

  // Healing Particles (green crosses)
  ctx.fillStyle = '#00ff88'
  healing.forEach(particle => {
    ctx.globalAlpha = particle.life / 40
    ctx.fillRect(particle.x, particle.y - particle.size / 2, 2, particle.size)
    ctx.fillRect(particle.x - particle.size / 2, particle.y, particle.size, 2)
  })
  ctx.globalAlpha = 1

}

// ============================================================
// Game Loop (runs at ~60fps via requestAnimationFrame)
// ============================================================
function gameLoop() {
  if (!isGameActive) return
  update()
  draw()

  animationId = requestAnimationFrame(gameLoop)
}

/* 
# requestAnimationFrame(function);
 
Función de JavaScript que le dice al navegador que quieres
hacer una animación, solicitando que ejecute una función específica
(callback) antes del siguiente repintado de la pantalla,
sincronizándose con la tasa de refresco del monitor

# function isColliding(rect1, rect2) { ... }

Esta función utiliza un algoritmo llamado AABB (Axis-Aligned Bounding Box).
Su objetivo es verificar si dos rectángulos se están tocando o solapando
en un espacio de 2D.

*/