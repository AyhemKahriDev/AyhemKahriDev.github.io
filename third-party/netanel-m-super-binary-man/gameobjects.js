class Rect {
  constructor(x,y,w,h, gradient=defaultGradient) {
    this.gradient = gradient;
    this.pos = new Vector(x,y);
    this.previousPos = new Vector(x,y);
    this.w = w;
    this.h = h;
    this.top = y;
    this.bottom = y+h;
    this.left = x;
    this.right = x+w;
  }

  draw() {
    ctx.save();
    ctx.translate(this.pos.x, this.pos.y);
    ctx.fillStyle = this.gradient;
    ctx.fillRect(0, 0, this.w, this.h);
    ctx.restore();
  }

  containsPoint(x,y) {
    if(x >= this.pos.x &&
       x <= this.pos.x + this.w &&
       y >= this.pos.y &&
       y <= this.pos.y + this.h) {
      return true;
    } else {
      return false;
    }
  }

  intersectsWith(rect) {
    if(rect.pos.x < this.pos.x + this.w &&
       this.pos.x < rect.pos.x + rect.w &&
       rect.pos.y < this.pos.y + this.h) {
      return this.pos.y < rect.pos.y + rect.h;
    } else {
      return false;
    }
  }

}

class Sprite extends Rect {
  constructor(x,y,w,h, gradient = defaultGradient) {
    super(x,y,w,h);
    this.originalPos = new Vector(this.pos.x, this.pos.y);
    this.velocity = new Vector(0,0);
    this.acceleration = new Vector(0,0);
    this.onTheGround = false;
  }

  draw() {
    ctx.save();
      ctx.translate(this.pos.x, this.pos.y);
      ctx.strokeStyle = 'black';
      ctx.lineWidth = 2
      ctx.strokeRect(0, 0, this.w, this.h);
      ctx.fillStyle = this.gradient;
      ctx.fillRect(0,0,this.w,this.h);
    ctx.restore();
  }

  update(dt) {
    this.top = this.pos.y;
    this.bottom = this.pos.y+this.h;
    this.left = this.pos.x;
    this.right = this.pos.x+this.w;
  }

  resetPosition() {
    this.pos = new Vector(this.originalPos.x, this.originalPos.y);;
  }

  warp() {
    if(this.pos.x >= canvas.width + this.w-1) {
      // if sprite is past the right edge of the screen
      this.pos.x = 0;
      if(this.pos.y > canvas.height/2) { // if sprite is at lower floor
        this.pos.y = upperFloorY - this.h
        this.onTheGround = true;
      } else if(this.pos.y < canvas.height/2) { // if sprite is at upper floor
        this.pos.y = lowerFloorY - this.h
        this.onTheGround = true;
      }
      //this.pos.y = canvas.height-this.h-75;
    } else if(this.pos.x <= 0 - this.w+1) {
      // if sprite is past the left edge of the screen
      this.pos.x = canvas.width;
      if(this.pos.y > canvas.height/2) { // if sprite is at lower floor
        this.pos.y = upperFloorY - this.h
        this.onTheGround = true;
      } else if(this.pos.y < canvas.height/2) { // if sprite is at upper floor
        this.pos.y = lowerFloorY - this.h
        this.onTheGround = true;
      }
      //this.pos.y = canvas.height-this.h-75;
    }
    if(this.pos.y >= canvas.height + this.h) {
      this.pos.y = 0 - this.h;
    }
  }

}

class Enemy extends Sprite {
  constructor(x,y,w,h, gradient=defaultGradient) {
    super(x,y,w,h);
    this.gradient = gradient
  }

  applyForce(f) {
    this.acceleration.add(f);
  }

  update(dt) {
    super.update(dt);

    if (this.onTheGround === false) {
      this.acceleration.add(new Vector(0,canvas.height * 0.03 *dt));
    } else {
      if(this.direction === "right") {
        this.applyForce(new Vector( (this.speed * dt), 0));
      } else if (this.direction === "left") {
        this.applyForce(new Vector( -(this.speed * dt), 0));
      }
    }

    this.velocity.add(this.acceleration);
    this.pos.add(this.velocity);
    this.acceleration.mult(0);
    this.velocity.limit(1000 * dt);

    this.updateCollisions();
    this.warp();

  }


  updateCollisions() {
    // update collisions

    let collisions = [];

    for(let i=0; i < platforms.length; i++) {
      collisions.push(collideSpriteWithPlatforms(this, platforms[i]))
    }

    for(let i=0; i < walls.length; i++) {
      collisions.push(collideSpriteWithWalls(this, walls[i]))
    }

    for(let i=0; i < blocks.length; i++) {
      collisions.push(collideSpriteWithBlocks(this, blocks[i]))
    }

    if(collisions.includes(true)) {} else {
      this.onTheGround = false;
    }
  }

}

class DumDum extends Enemy {
  constructor(x,y,w,h, gradient = defaultGradient) {
    super(x,y,w,h);
    this.gradient = gradient;
    this.chooseRandomSpeed();
    this.chooseRandomDirection();
  }

  update(dt) {
    super.update(dt);
    let dice = Math.floor(Math.random() * 200);
    if(dice === 0) {
      this.chooseRandomSpeed();
      this.chooseRandomDirection();
    }
  }

  chooseRandomDirection() {
    let direction = Math.floor(Math.random() * 2);
    if(direction === 0) {
      this.direction = "left";
      return "left";
    } else {
      this.direction = "right";
      return "right";
    }
  }

  chooseRandomSpeed() {
    this.speed = Math.random() * (400 - 150) + 150;
  }

  flipDirection() {
    if(this.direction === "left") {
      this.direction = "right";
    } else {
      this.direction = "left";
    }
  }

}

class Player extends Sprite {
  constructor(x,y,w,h, gradient=defaultGradient) {
    super(x,y,w,h);
    this.gradient = gradient;
    this.goRight = false;
    this.goLeft = false;
    this.jump = false;
    this.onTheGround = true;
    this.life = 3;
  }

  applyForce(f) {
    this.acceleration.add(f);
  }

  update(dt) {
    super.update(dt);

    if (this.onTheGround === false) {
      this.acceleration.add(new Vector(0,canvas.height * 0.01 *dt));
    }

    if(this.jumpDown === true) {
      this.pos.y += player.h+50;
      this.jumpDown = false;
    }

    if (this.jump === true && this.onTheGround === true) {
      this.acceleration.sub(new Vector(0,canvas.height*5 * dt))
      this.onTheGround = false;
      soundSystem.jumpSound.play();
    }

    if(this.goRight === true) {
      this.pos.add(new Vector(500 * dt,0));
    }

    else if (this.goLeft === true) {
      this.pos.sub(new Vector(500 * dt,0));
    }

    this.velocity.add(this.acceleration);
    this.pos.add(this.velocity);
    this.acceleration.mult(0);
    this.velocity.limit(1000 * dt);

    this.warp();
    this.updateCollisions();
  }

  updateCollisions() {
    // update collisions

    let collisions = [];

    for(let i=0; i < platforms.length; i++) {
      collisions.push(collideSpriteWithPlatforms(this, platforms[i]))
    }

    for(let i=0; i < walls.length; i++) {
      collisions.push(collideSpriteWithWalls(this, walls[i]))
    }

    for(let i=0; i < blocks.length; i++) {
      collisions.push(collideSpriteWithBlocks(this, blocks[i]))
    }

    if(collisions.includes(true)) {} else {
      this.onTheGround = false;
    }

  }

  collideWithEnemy(enemy) {
    if((collideSpriteWithSprite(player, enemy) === true)) {
      resetLevel(true);
    }
  }

}

class BinaryBlock extends Sprite {
  constructor(x,y,w,h, number, gradient = defaultGradient) {
    super(x,y,w,h);
    this.originalY = this.pos.y;
    this.gradient = gradient;
    this.status = "inactive";
    this.sinAccum = 0;
    this.number = number;
    this.toggled = false;
  }

  draw() {
    super.draw();
    ctx.save();
    ctx.translate(this.pos.x, this.pos.y);
    ctx.font = "25pt monospace";
    let width = ctx.measureText(this.number).width
    ctx.fillText(this.number, this.w/2-width/2, this.h/2+25/2);
    ctx.restore();
  }

  update(dt) {
    if (this.toggled === true) {
      this.sinAccum += 10 * dt; // had to move this up here to solve the annoying bug where the blocks only moved when bumped against 2x
      this.pos.y = this.pos.y + ( Math.sin(this.sinAccum) * 150 ) * -1 * dt;

      if(this.pos.y >= this.originalY) {
        this.toggled = false;
      }
    }

  }

  toggle() {
    if(this.status === "inactive") { // a bit of a hack but this prevents bumping into a block multiple times
      this.toggled = true;
      for(let i = 0; i < blocks.length; i++) {
        if(blocks[i] === this) {
          if(sequence[i] === "1") {
            this.status = "correct";
            this.gradient = blockGradientCorrect;
            soundSystem.rightBlockSound.play();
            accum += this.number;
          } else {
            // add dumdum related code here ->
            for(let i = 0; i < enemies.length; i++) {
              if(Math.random() > 0.5) {
                enemies[i].flipDirection();
              }
            }
            this.status = "incorrect";
            this.gradient = blockGradientIncorrect;
            soundSystem.wrongBlockSound.play();
            score-= this.number;
          }
          // check if sequence is complete and if so reset the score blocks and accum
          if(parseInt(sequence, 2) === accum) {
            score += accum;
            soundSystem.successSound.play();
            resetLevel(false);
          }
          break;
        }
      }
    }
  }

}

class SoundSystem {
  constructor() {
    this.jumpSound = new Howl({
      src: ['newJump.ogg']
    });
    this.rightBlockSound = new Howl({
      src: ['rightBlock.ogg']
    });
    this.wrongBlockSound = new Howl({
      src: ['wrongBlock.ogg']
    });
    this.successSound = new Howl({
      src: ['success.ogg']
    });
  }

}
