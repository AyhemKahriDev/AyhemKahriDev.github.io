import $ from "jquery";
import type {Game} from "./state";
import {generateInitialTerrain, updateTerrain} from "./terrain";
import {spawnBall, updateBalls} from "./orbs";
import {draw} from "./render";
let animationFrameId: number;
let running=false;
export function clampPlayerY(game: Game){
	let {config, state}=game;
	let buffer=20;
	state.player.y=Math.max(buffer, Math.min(config.height-buffer, state.player.y));
}
export function resizeCanvas(game: Game){
	let {config, state, ctx}=game;
	let canvas=ctx.canvas;
	let headerH=(document.querySelector("header") as HTMLElement).offsetHeight;
	let footerH=(document.querySelector("footer") as HTMLElement).offsetHeight;
	config.width=window.innerWidth;
	config.height=window.innerHeight-headerH-footerH;
	canvas.width=config.width;
	canvas.height=config.height;
	state.player.x=config.width/4;
	clampPlayerY(game);
	generateInitialTerrain(game);
	state.balls.forEach(b=>{
		b.y=Math.max(b.r, Math.min(config.height-b.r, b.y));
	});
}
function handleControls(game: Game){
	let {state}=game;
	if (state.keys.faster){
		state.player.maxSpeed=Math.min(state.player.maxSpeed+.05, 15);
		state.maxSpeedUsed=Math.max(state.maxSpeedUsed, state.player.maxSpeed);
	}
	if (state.keys.slower){
		state.player.maxSpeed=Math.max(state.player.maxSpeed-.05, 1);
		state.maxSpeedUsed=Math.max(state.maxSpeedUsed, state.player.maxSpeed);
	}
	if (state.keys.up){
		state.player.verticalVelocity-=state.player.verticalAcceleration;
	}
	else if (state.keys.down){
		state.player.verticalVelocity+=state.player.verticalAcceleration;
	}
	else{
		state.player.verticalVelocity*=state.player.friction;
	}
	state.player.verticalVelocity=Math.max(-state.player.maxVerticalSpeed, Math.min(state.player.maxVerticalSpeed, state.player.verticalVelocity));
	state.player.y+=state.player.verticalVelocity;
	clampPlayerY(game);
}
function update(game: Game){
	let {config, state}=game;
	if (state.gameEnded) return;
	handleControls(game);
	state.player.forwardSpeed=Math.min(
		state.player.forwardSpeed+state.player.acceleration,
		state.player.maxSpeed
	);
	updateTerrain(game, state.player.forwardSpeed);
	updateBalls(game, state.player.forwardSpeed);
	if (state.trailParticles.length<config.maxParticles){
		state.trailParticles.push({
			x: state.player.x,
			y: state.player.y,
			size: config.cursorSize*.8,
			opacity: 1,
			decay: .05
		});
	}
	// Both of these used to be rebuilt with filter() every frame. They are compacted in place instead,
	// which keeps the same contents without handing the collector a fresh array sixty times a second.
	let kept=0;
	for (let p of state.trailParticles){
		if (p.opacity>0){
			state.trailParticles[kept++]=p;
		}
	}
	state.trailParticles.length=kept;
	if (state.frame % config.ballSpawnInterval==0&&state.balls.length<config.maxBalls){
		spawnBall(game);
	}
	let now=Date.now();
	let keptElements=0;
	for (let e of state.collectedElements){
		if (now-e.timestamp<config.reactionWindow){
			state.collectedElements[keptElements++]=e;
		}
	}
	state.collectedElements.length=keptElements;
	if (state.player.aura&&now-state.player.auraTimestamp>config.reactionWindow){
		state.player.aura=null;
	}
	if (state.score>=10000&&!state.gameEnded){
		endGame(game);
	}
	state.frame++;
}
function endGame(game: Game){
	let {state}=game;
	state.gameEnded=true;
	cancelAnimationFrame(animationFrameId);
	let timeTaken=((Date.now()-state.startTime!)/1000).toFixed(1);
	$("#total-score").text(`Total Score: ${state.score}`);
	$("#time-taken").text(`Time Taken: ${timeTaken} seconds`);
	let reactionList=$("#reaction-list");
	reactionList.empty();
	if (Object.keys(state.reactionCounts).length==0){
		reactionList.append("<li>No reactions performed</li>");
	}
	else{
		for (let reaction in state.reactionCounts){
			reactionList.append(`<li>${reaction}: ${state.reactionCounts[reaction]}</li>`);
		}
	}
	$("#endModal").show();
	$("#controls-toggle").hide();
	$("#touch-controls").hide();
}
function loop(game: Game){
	update(game);
	if (game.state.gameEnded){
		return;
	}
	draw(game);
	animationFrameId=requestAnimationFrame(()=>loop(game));
}
export function startGame(game: Game){
	// The start button stays clickable while its handler is still awaiting the audio import, and a
	// second click would otherwise start a second frame loop on the same state.
	if (running) return;
	running=true;
	game.state.startTime=Date.now();
	loop(game);
}
