function GetDistance(x1,y1,x2,y2) {
		const disX = x1 - x2;
		const disY = y1 - y2;
		return Math.sqrt((disX * disX) + (disY*disY));
}

// get the angle between previous position and new position
function getAngle(last_x,last_y,new_x,new_y) {
	let x = last_x - new_x;
	let y = last_y - new_y;
	return Math.atan2(y,x);
}

// check the whole trail for collision
function Checktrail(me,oth,block) {
	let colstate = 0;
	for(var i=0,n = oth.length;i!=n;++i) {
		const dist = GetDistance(me.x,me.y,oth[i].x,oth[i].y) - block;
		if(dist <= 0) {	// colided
			colstate = 1;
			break; 
		} else if(dist <= 50) { //may collide
			colstate = 2;
		}
	}
	return colstate;
}
	
	
function setfood(x = 0,y = 0) {
	if(x+y != 0) {			
		edible.push(new food(x,y));
	} else {
		x = Math.floor((Math.random() * mapWidth));
		y = Math.floor((Math.random() * mapHeight));
		edible.push(new food(x,y));
	}
}	
	
function gameover() {
	ctx.fillStyle = "#000000";
	ctx.font = "60px Arial";
	ctx.fillText('GameOver',(WindowWidth/2) - 120,(WindowHeight/2));
}

function displayScore() {
	ctx.fillStyle = "#000000";
	ctx.font = "20px Arial";
	ctx.fillText('Score : ' + score,20,50);
	ctx.fillText('fps : ' + fps,WindowWidth - 100,50);
}

let startX; // first tile X position
let endX; // last tile to be drawn
let startY;
let endY;
let offsetX; // amout of tile to be clipped
let offsetY; 
let scy; // screen y position
let scx; // screen x position

function draw() {
	//display background pattren
	if(resloaded) {
		startX = Math.floor(cam.X/bgwidth);
		endX = startX + (WindowWidth/bgwidth)+1;
		startY = Math.floor(cam.Y/bgwidth);
		endY = startY + (WindowHeight/bgheight)+1;
		offsetX = (cam.X % bgwidth);
		offsetY = (cam.Y % bgheight);
		
		for(var i=startY;i< endY;++i) {
			scy = (i - startY)* bgheight - offsetY;
			for(var j=startX;j< endX;++j) {
				scx = (j - startX) * bgwidth - offsetX;
				ctx.drawImage(bgcanv,scx,scy,bgwidth,bgheight);
			}
		}
	} 
	
	for(var foods = 0,foode = edible.length;foods < foode;++foods) {
		if( (edible[foods].x < (cam.X + WindowWidth) && (edible[foods].x > cam.X))&& 
			(edible[foods].y < (cam.Y + WindowHeight) && (edible[foods].y > cam.Y)) ) {
			ctx.fillStyle = ctx.strokeStyle = edible[foods].color;
			ctx.lineWidth = 2;
			ctx.beginPath();
			ctx.arc(edible[foods].x - cam.X,edible[foods].y - cam.Y,edible[foods].mass,0,circ);
			ctx.stroke();
			ctx.globalAlpha = 0.5;
			ctx.fill();
			ctx.globalAlpha = 1;
			ctx.closePath();
			
		}
	}
	
	// display controls
	if(controlmode === 3 && moveable) {
		ctx.beginPath();
		ctx.arc(Xctr,Yctr,50,0,circ);
		ctx.closePath();
		ctx.strokeStyle = "rgba(255,255,255,0.5)";
		ctx.lineWidth = 3;
		ctx.stroke();
		ctx.beginPath();
		ctx.arc(Xctr + (mvx * 40),Yctr + (mvy * 40),10,0,circ);
		ctx.closePath();
		ctx.fillStyle = "rgba(255,255,255,0.5)";
		ctx.fill();
	}
}

window.addEventListener('resize',screenChange);
	
function screenChange() {
	WindowWidth = window.innerWidth;
	WindowHeight = window.innerHeight;
	Screen.width = WindowWidth;
	Screen.height = WindowHeight;
	Xcenter = window.innerWidth/2;
	Ycenter = window.innerHeight/2;
}

let frames = 0;
let fps = 0;
function Resetfps() {
	fps = frames;
	frames = 0;
}
setInterval(Resetfps,1000);