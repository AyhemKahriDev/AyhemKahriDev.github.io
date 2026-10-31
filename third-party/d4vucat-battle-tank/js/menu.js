/**
 * Game start menu
 **/ 

var Menu = function(context){
	this.ctx = context;
	this.x = 0;
	this.y = SCREEN_HEIGHT;
	this.selectTank = new SelectTank();
	this.playNum = 1;
	this.times = 0;
	
	/**
	 * Draw the menu
	 */
	this.draw = function(){
		this.times ++ ;
		var temp = 0;
		if( parseInt(this.times / 6) % 2 == 0){
			temp = 0;
		}else{
			temp = this.selectTank.size;
		}
		if(this.y <= 0){
			this.y = 0;
		}else{
			this.y -= 5;
		}
		this.ctx.clearRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);   
		this.ctx.save(); 
		// draw background
		this.ctx.drawImage(MENU_IMAGE, this.x, this.y);
		// draw selector tank cursor
		this.ctx.drawImage(RESOURCE_IMAGE,POS["selectTank"][0],POS["selectTank"][1] + temp,this.selectTank.size,this.selectTank.size,
				this.selectTank.x,this.y + this.selectTank.ys[this.playNum-1],this.selectTank.size,this.selectTank.size);
		this.ctx.restore();
	};
	
	/**
	 * Move selector up or down
	 */
	this.next = function(n){
		this.playNum += n;
		if(this.playNum > 2){
			this.playNum = 1;
		}else if(this.playNum < 1){
			this.playNum = 2;
		}
	};
};
