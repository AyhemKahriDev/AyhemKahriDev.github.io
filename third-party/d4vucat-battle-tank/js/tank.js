/**
 * Tank base class
 * @returns
 */
var Tank = function(){
	this.x = 0;
	this.y = 0;
	this.size = 32;           // tank size
	this.dir = UP;            // direction: 0=up, 1=down, 2=left, 3=right
	this.speed = 1;           // tank speed
	this.frame = 0;           // timer controlling AI tank direction changes
	this.hit = false;         // whether tank has hit a wall or another tank
	this.isAI = false;        // whether tank is AI-controlled
	this.isShooting = false;  // whether a bullet is currently active
	this.bullet = null;       // bullet reference
	this.shootRate = 0.6;     // shooting probability
	this.isDestroyed = false;
	this.tempX = 0;
	this.tempY = 0;
	
	this.move = function(){
		// for AI tanks, switch direction after a set time or upon collision
		
		if(this.isAI && emenyStopTime > 0 ){
			return;
		}

		this.tempX = this.x;
		this.tempY = this.y;
		
		if(this.isAI){
			this.frame ++;
			if(this.frame % 100 == 0 || this.hit){
				this.dir = parseInt(Math.random()*4); // pick a random direction
				this.hit = false;
				this.frame = 0;
			}
		}
		if(this.dir == UP){
			this.tempY -= this.speed;
		}else if(this.dir == DOWN){
			this.tempY += this.speed;
		}else if(this.dir == RIGHT){
			this.tempX += this.speed;
		}else if(this.dir == LEFT){
			this.tempX -= this.speed;
		}
		this.isHit();
		if(!this.hit){
			this.x = this.tempX;
			this.y = this.tempY;
		}
	};
	
	/**
	 * Collision detection
	 */
	this.isHit = function(){
		// boundary check
		if(this.dir == LEFT){
			if(this.x <= map.offsetX){
				this.x = map.offsetX;
				this.hit = true;
			}
		}else if(this.dir == RIGHT){
			if(this.x >= map.offsetX + map.mapWidth - this.size){
				this.x = map.offsetX + map.mapWidth - this.size;
				this.hit = true;
			}
		}else if(this.dir == UP ){
			if(this.y <= map.offsetY){
				this.y = map.offsetY;
				this.hit = true;
			}
		}else if(this.dir == DOWN){
			if(this.y >= map.offsetY + map.mapHeight - this.size){
				this.y = map.offsetY + map.mapHeight - this.size;
				this.hit = true;
			}
		}
		if(!this.hit){
			// map tile collision check
			if(tankMapCollision(this,map)){
				this.hit = true;
			}
		}
		// tank vs tank collision (commented out)
		/*if(enemyArray != null && enemyArray.length >0){
			var enemySize = enemyArray.length;
			for(var i=0;i<enemySize;i++){
				if(enemyArray[i] != this && CheckIntersect(enemyArray[i],this,0)){
					this.hit = true;
					break;
				}
			}
		}*/
	};
	
	/**
	 * Check if shot
	 */
	this.isShot = function(){
		
	};
	/**
	 * Shoot
	 */ 
	this.shoot = function(type){
		if(this.isAI && emenyStopTime > 0 ){
			return;
		}
		if(this.isShooting){
			return ;
		}else{
			var tempX = this.x;
			var tempY = this.y;
			this.bullet = new Bullet(this.ctx,this,type,this.dir);
			if(this.dir == UP){
				tempX = this.x + parseInt(this.size/2) - parseInt(this.bullet.size/2);
				tempY = this.y - this.bullet.size;
			}else if(this.dir == DOWN){
				tempX = this.x + parseInt(this.size/2) - parseInt(this.bullet.size/2);
				tempY = this.y + this.size;
			}else if(this.dir == LEFT){
				tempX = this.x - this.bullet.size;
				tempY = this.y + parseInt(this.size/2) - parseInt(this.bullet.size/2);
			}else if(this.dir == RIGHT){
				tempX = this.x + this.size;
				tempY = this.y + parseInt(this.size/2) - parseInt(this.bullet.size/2);
			}
			this.bullet.x = tempX;
			this.bullet.y = tempY;
			if(!this.isAI){
				ATTACK_AUDIO.play();
			}
			this.bullet.draw();
			// add bullet to the bullet array
			bulletArray.push(this.bullet);
			this.isShooting = true;
		}
	};
	
	/**
	 * Tank destroyed
	 */
	this.distroy = function(){
		this.isDestroyed = true;
		crackArray.push(new CrackAnimation(CRACK_TYPE_TANK,this.ctx,this));
		TANK_DESTROY_AUDIO.play();
	};
	
	
	
};

/**
 * Menu selection tank (cursor)
 * @returns
 */
var SelectTank = function(){
	this.ys = [250, 281]; // Y positions for 1P and 2P
	this.x = 140;
	this.size = 27;
};

SelectTank.prototype = new Tank();

/**
 * Player tank
 * @param context canvas context for drawing the tank
 * @returns
 */
var PlayTank = function(context){
	this.ctx = context;
	this.lives = 3;           // number of lives
	this.isProtected = true;  // spawn protection active
	this.protectedTime = 500; // protection timer
	this.offsetX = 0;         // sprite offset (player 2 differs from player 1)
	this.speed = 2;           // tank speed
	
	this.draw = function(){
		this.hit = false;
		this.ctx.drawImage(RESOURCE_IMAGE,POS["player"][0]+this.offsetX+this.dir*this.size,POS["player"][1],this.size,this.size,this.x,this.y,this.size,this.size);
		if(this.isProtected){
			var temp = parseInt((500-this.protectedTime)/5)%2;
			this.ctx.drawImage(RESOURCE_IMAGE,POS["protected"][0],POS["protected"][1]+32*temp,32, 32,this.x,this.y,32, 32);
			this.protectedTime--;
			if(this.protectedTime == 0){
				this.isProtected = false;
			}
		}
		
	};
	
	this.distroy = function(){
		this.isDestroyed = true;
		crackArray.push(new CrackAnimation(CRACK_TYPE_TANK,this.ctx,this));
		PLAYER_DESTROY_AUDIO.play();
	};
	
	this.renascenc = function(player){
		this.lives -- ;
		this.dir = UP;
		this.isProtected = true;
		this.protectedTime = 500;
		this.isDestroyed = false;
		var temp= 0 ;
		if(player == 1){
			temp = 129;
		}else{
			temp = 256;
		}
		this.x = temp + map.offsetX;
		this.y = 385 + map.offsetY;
	};
	
};
PlayTank.prototype = new Tank();

/**
 * Enemy tank type 1
 * @param context canvas context for drawing the tank
 * @returns
 */
var EnemyOne = function(context){
	this.ctx = context;
	this.isAppear = false;
	this.times = 0;
	this.lives = 1;
	this.isAI = true;
	this.speed = 1.5;
	
	this.draw = function(){
		this.times ++;
		if(!this.isAppear){
			var temp = parseInt(this.times/5)%7;
			this.ctx.drawImage(RESOURCE_IMAGE,POS["enemyBefore"][0]+temp*32,POS["enemyBefore"][1],32,32,this.x,this.y,32,32);
			if(this.times == 34){
				this.isAppear = true;
				this.times = 0;
				this.shoot(2);
			}
		}else{
			this.ctx.drawImage(RESOURCE_IMAGE,POS["enemy1"][0]+this.dir*this.size,POS["enemy1"][1],32,32,this.x,this.y,32,32);
			
			// shoot with a certain probability
			if(this.times %50 ==0){
				var ra = Math.random();
				if(ra < this.shootRate){
					this.shoot(2);
				}
				this.times = 0;
			}
			this.move();
			
			
		}
		
	};
	
};
EnemyOne.prototype = new Tank();


/**
 * Enemy tank type 2
 * @param context canvas context for drawing the tank
 * @returns
 */
var EnemyTwo = function(context){
	this.ctx = context;
	this.isAppear = false;
	this.times = 0;
	this.lives = 2;
	this.isAI = true;
	this.speed = 1;
	
	this.draw = function(){
		this.times ++;
		if(!this.isAppear){
			var temp = parseInt(this.times/5)%7;
			this.ctx.drawImage(RESOURCE_IMAGE,POS["enemyBefore"][0]+temp*32,POS["enemyBefore"][1],32,32,this.x,this.y,32,32);
			if(this.times == 35){
				this.isAppear = true;
				this.times = 0;
				this.shoot(2);
			}
		}else{
			this.ctx.drawImage(RESOURCE_IMAGE,POS["enemy2"][0]+this.dir*this.size,POS["enemy2"][1],32,32,this.x,this.y,32,32);
			// shoot with a certain probability
			if(this.times %50 ==0){
				var ra = Math.random();
				if(ra < this.shootRate){
					this.shoot(2);
				}
				this.times = 0;
			}
			this.move();
		}
	};
	
};
EnemyTwo.prototype = new Tank();



/**
 * Enemy tank type 3
 * @param context canvas context for drawing the tank
 * @returns
 */
var EnemyThree = function(context){
	this.ctx = context;
	this.isAppear = false;
	this.times = 0;
	this.lives = 3;
	this.isAI = true;
	this.speed = 0.5;
	
	this.draw = function(){
		this.times ++;
		if(!this.isAppear){
			var temp = parseInt(this.times/5)%7;
			this.ctx.drawImage(RESOURCE_IMAGE,POS["enemyBefore"][0]+temp*32,POS["enemyBefore"][1],32,32,this.x,this.y,32,32);
			if(this.times == 35){
				this.isAppear = true;
				this.times = 0;
				this.shoot(2);
			}
		}else{
			this.ctx.drawImage(RESOURCE_IMAGE,POS["enemy3"][0]+this.dir*this.size+(3-this.lives)*this.size*4,POS["enemy3"][1],32,32,this.x,this.y,32,32);
			// shoot with a certain probability
			if(this.times %50 ==0){
				var ra = Math.random();
				if(ra < this.shootRate){
					this.shoot(2);
				}
				this.times = 0;
			}
			this.move();
		}
		
	};
	
};
EnemyThree.prototype = new Tank();
