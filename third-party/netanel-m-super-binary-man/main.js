function init() {

  this.canvas = document.querySelector("#clickerCanvas");
  this.ctx = canvas.getContext("2d");

  //graphics
  this.defaultGradient = ctx.createLinearGradient(0, 10, 0, 50);
  defaultGradient.addColorStop(0, "darkgreen");
  defaultGradient.addColorStop(1, "black");

  this.playerGradient = ctx.createLinearGradient(0, 0, 50, 50);
  playerGradient.addColorStop(0, "blue");
  playerGradient.addColorStop(1, "black");

  this.enemyGradient = ctx.createLinearGradient(0, 0, 50, 50);
  enemyGradient.addColorStop(0, "red");
  enemyGradient.addColorStop(1, "black");

  this.blockGradient = ctx.createLinearGradient(0, 0, 50, 50);
  blockGradient.addColorStop(0, "yellow");
  blockGradient.addColorStop(1, "orange");

  this.blockGradientCorrect = ctx.createLinearGradient(0, 0, 50, 50);
  blockGradientCorrect.addColorStop(0, "lightgreen");
  blockGradientCorrect.addColorStop(1, "black");

  this.blockGradientIncorrect = ctx.createLinearGradient(0, 0, 50, 50);
  blockGradientIncorrect.addColorStop(0, "red");
  blockGradientIncorrect.addColorStop(1, "black");

  this.skyGradient = ctx.createLinearGradient(0, 1000, 0, canvas.height);
  skyGradient.addColorStop(0,  "#873600");
  skyGradient.addColorStop(1, "lightblue");

  //Sequence related section
  difficulty = 7
  this.sequence = "0".repeat(difficulty);
  generateRandomSequence();
  this.solution = parseInt(sequence, 2);
  this.accum = 0;
  this.score = 0;


  this.oldTime = 0; // for calculating delta time

  // control related section
  this.mousePos = new Vector(0,0);
  this.allKeys = [];

  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  this.w, this.h = canvas.width, canvas.height;

  this.platforms = [];
  this.blocks = [];
  this.walls = [];

  this.soundSystem = new SoundSystem();

  let floor = new Rect(0,
    canvas.height-50,
    canvas.width,
    50);
  let floor2 = new Rect(0,
      canvas.height/2-100,
      canvas.width-canvas.width/2-100,
      50);
  let floor3 = new Rect(canvas.width/2+100,
          canvas.height/2-100,
          canvas.width-canvas.width/2,
          50);
  this.lowerFloorY =canvas.height-50;
  this.upperFloorY = canvas.height/2-100;
  let leftTopWall = new Rect(0,0, 50, canvas.height - canvas.height * 0.8)
  let rightTopWall = new Rect(canvas.width-50,0, 50, canvas.height - canvas.height * 0.8)
  let leftWall = new Rect(0,canvas.height/2.5, 50, canvas.height * 0.35);
  let rightWall = new Rect(canvas.width-50,canvas.height/2.5, 50, canvas.height * 0.35);

    for(let i = sequence.length-1; i>-1; i--) {
      let b = new BinaryBlock(
        (canvas.width / 2 - (140/2) + (difficulty / 2 * 140)) - 35 - i * 140,
        canvas.height - 400,
        70, 70,
        2**i,
        blockGradient)
      this.blocks.push(b);
    }

  this.platforms.push(floor);
  this.platforms.push(floor2);
  this.platforms.push(floor3);
  this.walls.push(leftTopWall);
  this.walls.push(rightTopWall);
  this.walls.push(leftWall);
  this.walls.push(rightWall);

  this.player = new Player(canvas.width/2-25,canvas.height-150, 50, 75, playerGradient);

  this.testEnemy = new DumDum(50, 0, 50, 75, enemyGradient);
  this.testEnemy2 = new DumDum(canvas.width-100, 0, 50, 75, enemyGradient);
  this.enemies = [];
  this.enemies.push(testEnemy);
  this.enemies.push(testEnemy2);
  initEvents();

  requestAnimationFrame(mainLoop);
}

function mainLoop(TIMESTAMP) {
  newTime = TIMESTAMP / 1000
  dt = newTime - oldTime;
  oldTime = newTime;

  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle = skyGradient;
  ctx.fillRect(0,0, canvas.width, canvas.height);
  // draw texts
  ctx.font = "32pt monospace";
  ctx.fillStyle = "grey";
  let fontWidth = ctx.measureText("Goal: "+solution).width
  ctx.fillText("Goal: "+ solution, canvas.width-canvas.width/3-fontWidth/2, 100);
  let fontWidthAccum = ctx.measureText("Sum: " + accum).width;
  ctx.fillText("Sum: " + accum, canvas.width/3-fontWidth/2, 100);
  ctx.fillText("Score: "  + score, canvas.width/16, 100);
  let fontWidthLife = ctx.measureText("Life: " + player.life).width;;
  ctx.fillText("Life: "  + player.life, canvas.width-canvas.width/16-fontWidthLife, 100);

  // draw platforms
  for (let i=0; i<this.platforms.length; i++) {
    this.platforms[i].draw();
  }
  // draw walls
  for (let i=0; i<this.walls.length; i++) {
    this.walls[i].draw();
  }
  // draw blocks
  for (let i=0; i<this.blocks.length; i++) {
    this.blocks[i].draw();
  }

  // draw and update player
  this.player.draw();

  this.player.update(dt);

  for(let i = 0; i < enemies.length; i++) {
    enemies[i].draw();
    enemies[i].update(dt);

    player.collideWithEnemy(enemies[i]);
  }

  // update blocks
  for (let i=0; i<this.blocks.length; i++) {
    this.blocks[i].update(dt);
  }

  //player.previousPos = new Vector(player.pos.x, player.pos.y); // no longer necessary for now
  requestAnimationFrame(mainLoop);
}
