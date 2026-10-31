const GAME_WIDTH=64;
const GAME_HEIGHT=64;
const FPS=30;
let DEBUG=0;
let b_anim;
let player;
let mouse;

function INIT(){
mouse={x:-1,y:-1,HOVERING:false}
player={x:11,y:12,velocity:0,side:null,fall:true,jumpingforce:0,colLeft:false,colRight:false,colTop:false,playing:0,}	
b_anim=0;

}


MAP=[
[4,18,18,18,18,18,18,18,18,18,18,18,18,18,4,4],
[20,0,0,0,0,0,0,0,0,0,0,0,0,0,21,4],
[20,0,0,0,0,0,0,0,0,0,0,0,0,0,21,4],
[20,0,0,0,0,0,0,0,0,0,0,0,0,0,21,4],
[20,0,0,0,0,0,0,8,0,0,0,0,0,0,21,4],
[20,0,0,0,0,0,0,5,0,0,0,0,0,0,21,4],
[20,0,0,0,16,0,0,5,0,0,0,0,0,0,21,4],
[20,0,1,2,3,0,0,5,0,0,0,8,0,0,8,4],
[20,0,4,4,4,0,0,5,0,0,0,5,0,0,0,21,4],
[20,0,0,0,0,0,0,9,0,0,0,5,0,0,0,21],
[20,0,0,10,0,0,0,0,0,0,0,5,0,0,0,21],
[20,0,0,0,0,0,0,0,0,0,0,5,0,0,0,21],
[20,0,0,0,0,0,0,0,0,0,0,5,0,0,15,21],
[20,0,0,10,0,0,16,0,0,0,0,5,0,13,2,4],
[20,0,0,13,2,2,2,14,0,0,0,5,0,11,4,4],
[20,0,0,11,4,4,4,12,0,0,0,5,0,11,4,4],
];


function resize() {
	if(document.body.clientHeight>document.body.clientWidth){canvas.style.height="auto";canvas.style.width="100%";}
	else{canvas.style.width="auto";canvas.style.height="100%";}
	return true;
}

function drawPixelText(text,posx,posy){
	let x=-1;
	for (var i=0; i<text.length ; i++) {
		let off=0;c=text[i].charCodeAt()-48;
		if(c>=10){off=1}
		x+=off+1;
		ctx.drawImage(font,5*c+off,0,5,5,posx+x,posy-1,5,5);
		x+=4;
	}
}

function drawtile(){
	ctx.drawImage(bg,0,0);


	for (var y=0; y < 16; y++) {
		for (var x=0; x < 16; x++) {
			cell=MAP[y][x];

			if(cell!==0){
				if(cell<15){ctx.drawImage(tileset,(cell-1)*5,0,4,4,x*4+2,y*4,4,4)}
				if(cell>=15){ctx.drawImage(tileset,(cell-1)*5,0,4,8,x*4+2,y*4-4,4,8)}
			}

			if(cell==5 || cell==7){
				MAP[y][x]=6;		
			}
			else if(cell==6 && frame%4==0){
				MAP[y][x]=5;
			}

			if(cell==8 && frame%30<15){
				MAP[y][x]=9;		
			}
			else if(cell==9 && frame%30>15){
				MAP[y][x]=8;
}}}}

function managecollisions(){

	let currx=Math.floor(player.x);
	let curry=Math.floor(player.y);

	player.fall=1.75;
	player.colBottom=false;
	player.colLeft=false;
	player.colRight=false;
	player.colTop=false;
	for (var y=0; y < 16; y++) {
		for (var x=0; x < 16; x++) {
			cell=MAP[y][x];

			let bbox=[x*4+2,y*4,x*4+6,y*4+4];
			let boundingheight=4;

			if(cell!=16 && cell!=0 && cell!=15){
				

				if( currx<bbox[0]+4 && currx+4>bbox[0]
					 && curry+6>=bbox[1] && curry<bbox[1]-4){
					player.fall=false;
					if(cell==16){player.y=bbox[1]-5}
					else{player.y=bbox[1]-6}

				if(!player.colLeft && !player.colRight && !player.colTop )
					{player.colBottom=true;}

					player.y=bbox[1]-6;
				}

				else if( curry-4<=bbox[1] && curry>=bbox[1]+1 && currx+4>bbox[0]
					&& currx<bbox[0]+4
					){
					player.colTop=true;
						player.y=bbox[1]+4


				}

				else if(curry>bbox[1]-6 && curry<=bbox[1]+boundingheight-1 && currx<=bbox[0] && currx+4>=bbox[0]){
	
					if(!player.colBottom && !player.colTop){}
						player.x=bbox[0]-4
						player.colRight=true;


				}

				else if( curry>bbox[1]-6 && curry<bbox[1]+4 && currx>=bbox[0] 
					&& currx<=bbox[0]+4
					){
					if(!player.colBottom && !player.colTop){}
					player.colLeft=true;player.x=bbox[0]+4

				}

			}//IF CELL
			else if(cell==16){


				if( curry-bbox[1]<2 && curry-bbox[1]>=-4 && currx<bbox[0]+4 && currx+4>bbox[0] ){
				ctx.fillStyle="#ffff2d";
				ctx.fillRect(bbox[0]-1,bbox[1]+2,6,1);
				ctx.fillStyle="black";
				ctx.fillRect(bbox[0],bbox[1]+1,4,1);
				player.jumpingforce=10;
				player.y=bbox[1]-4;
			}

			}

			else if(cell==15){
				if( curry-bbox[1]<=4 && curry-bbox[1]>=-4 && currx<bbox[0]+4 && currx+4>bbox[0] ){
					player.fall=false;player.y=88;
					clearInterval(LOOP);
					INIT();
					main();
					return
				}
			}
	}
}


}//END COLS


function managekeys(e){
	let key=e.key;

	if(!player.playing){
		player.playing=true;
		player.x=19;player.y=50;
		return
	}
	
	if(key=="ArrowLeft"){
		player.velocity=25;
		player.side="neg";
	}
	else if(key=="ArrowRight"){
		player.velocity=25;
		player.side="pos";
	}

	}



let canvas=document.getElementById('app');
let ctx=canvas.getContext("2d");


let bg=new Image();
bg.src="bg.png";
let font=new Image();
font.src="font.png";
let tileset=new Image();
tileset.src="tileset.png";
let bg2=new Image();
bg2.src="bg2.png";
let mousepict=new Image();
mousepict.src="mouse.png";
let playerpict=new Image();
playerpict.src="player.png";
let button=new Image();
button.src="button.png";

canvas.onmousemove=function(e){
	mouse.x=Math.floor((e.offsetX/canvas.clientWidth)*64);
	mouse.y=Math.floor((e.offsetY/canvas.clientHeight)*64);
	if(mouse.x>-1 && mouse.y>-1 && mouse.x<64 && mouse.y<64){mouse.HOVERING=true;}
	else{
		mouse.HOVERING=false;
	}
}

canvas.onmouseleave=function(){mouse.HOVERING=false;}

	window.onload=resize;
	window.onresize=resize;

	onkeydown=managekeys;

let frame=0;

function main(){

	LOOP=setInterval(function(){

	drawtile();	
		let px=Math.floor(player.x);
		let py=Math.floor(player.y)
				
		if(player.side=="pos"){
			ctx.drawImage(playerpict,0,0,4,6,px,py,4,6)
		}
		else if(player.side=="neg"){
			ctx.drawImage(playerpict,8,0,4,6,px,py,4,6)
		}
		else if(player.side=="posnone"){
			ctx.drawImage(playerpict,4,0,4,6,px,py,4,6)
		}
		else if(player.side=="eyes"){
			ctx.drawImage(playerpict,16,0,4,6,px,py,4,6)
		}
		else{
			ctx.drawImage(playerpict,12,0,4,6,px,py,4,6)					
		}


		if(Math.abs(player.velocity>0.01)){
			player.velocity*=.1;

			if(player.side=="pos" && !player.colRight){player.x=(player.x+(player.velocity));}
			if(player.side=="neg" && !player.colLeft){player.x=(player.x-(player.velocity));}
			player.x=Math.floor(player.x);
			player.y=Math.floor(player.y)

		}
		else{
			if(player.side=="neg"){player.side="negnone";}
			if(player.side=="pos"){player.side="posnone";}
			player.velocity=null;
		}

		if(!DEBUG){

		if(player.jumpingforce>.1 && !player.colTop){
			player.jumpingforce*=.8;player.y-=3;
		}
		else{player.jumpingforce=0;}

		if(player.fall && player.y<64){
			player.y+=player.fall;
			player.fall*1.05;
		}
		else if(player.fall){
			clearInterval(LOOP);
			INIT();
			main();
		}
	}//IFPLAY

	managecollisions();managecollisions();

	ctx.drawImage(bg2,0,0);
	drawPixelText("0:0;",0,3);

	if(!player.playing){

		if(frame%55<50)player.side="posnone";
		else if(Math.random()>.7){player.side="eyes"}


		ctx.drawImage(button,14,64-b_anim);
		if(b_anim<18){b_anim++}
		else if(frame%20>10){
			b_anim=19;
		}
		else if(frame%20<10){
			b_anim=20;
		}
	}

	if(mouse.HOVERING){ctx.drawImage(mousepict,mouse.x-3,mouse.y-2);}
	frame++;



	},1000/FPS);

}

INIT();
canvas.onclick=function(e){
	if(player.playing){
		let x=(e.layerX/canvas.clientWidth);

		if(x<.5){managekeys({"key":"ArrowLeft"})}
		else{managekeys({"key":"ArrowRight"})}


		return


	}
	if(b_anim>18){player.playing=true;
	player.x=19;player.y=50;}
}

button.onload=main;