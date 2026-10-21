
var Stage = function(context,l){
	this.ctx = context;
	this.ctx.fillStyle = "#7f7f7f";
	this.drawHeigth = 15;
	this.level = l;
	this.temp = 0;
	this.dir = 1;         // curtain direction: 1=closing, -1=opening
	this.isReady = false; // flag indicating map is ready to play
	this.levelNum = new Num(context);
	
	this.init = function(level){
		this.dir = 1;
		this.isReady = false;
		this.level = level;
		this.temp = 0;
	};
	
	this.draw = function(){
		if(this.dir == 1){
			
			// temp == 15*15 means gray curtain is fully drawn
			if(this.temp == 225){
				// STAGE text: width=78, height=14 in spritesheet; canvas position 194,208
				this.ctx.drawImage(RESOURCE_IMAGE, POS["stageLevel"][0], POS["stageLevel"][1], 78, 14, 194, 208, 78, 14);
				// level number: width=14, height=14; canvas position 308,208
				this.levelNum.draw(this.level,308, 208);
				//this.ctx.drawImage(RESOURCE_IMAGE,POS["num"][0]+this.level*14,POS["num"][1],14, 14,308, 208,14, 14);
				// draw the map by calling initMap from main.js
				initMap();
				
			}else if(this.temp == 225 + 600){
				// 600 frames = 600/15 calls, used as a pause delay
				this.temp = 225;
				this.dir = -1;
				START_AUDIO.play(); 
			}else{
				this.ctx.fillRect(0, this.temp, 512, this.drawHeigth);
				this.ctx.fillRect(0, 448 - this.temp - this.drawHeigth , 512, this.drawHeigth);
			}
		}else{
			if(this.temp >= 0){
				this.ctx.clearRect(0, this.temp , 512, this.drawHeigth);
				this.ctx.clearRect(0, 448 - this.temp - this.drawHeigth, 512, this.drawHeigth);
			}else{
				this.isReady = true;
			}
		}
		this.temp += this.drawHeigth * this.dir;
	};
};
