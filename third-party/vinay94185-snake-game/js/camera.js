//camera object
let cam = {
	X:0,
	Y:0,
	setNearX: function(x) {
		if((x+WindowWidth) >= mapWidth)  this.X = mapWidth - WindowWidth;
		else this.X = 0;
	},
	setNearY: function(y) {
		if((y+WindowHeight) >= mapHeight) this.Y = mapHeight - WindowHeight;
		else this.Y = 0
	},
	follow: function (x,y) { 
		const ix = x - (WindowWidth/2);
		const iy = y - (WindowHeight/2);
		if(((ix+WindowWidth) < mapWidth) && (ix > 0)) this.X = ix;
		else this.setNearX(ix);
		if(((iy+WindowHeight) < mapHeight) && (iy > 0)) this.Y = iy;
		else this.setNearY(iy);
	}
}