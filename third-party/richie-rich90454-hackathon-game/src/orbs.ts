import type {Game} from "./state";
import {checkReactions} from "./reactions";
import {playCollectionSound} from "./sfx";
export function spawnBall(game: Game){
	let {config, state}=game;
	let r=(Math.random()*(config.ballMaxRadius-config.ballMinRadius)+config.ballMinRadius)*1.2;
	let element=state.elements[Math.floor(Math.random()*state.elements.length)];
	state.balls.push({
		x: config.width+r,
		y: Math.random()*(config.height-2*r)+r,
		r: r,
		color: element.color,
		element: element.name,
		collectTimestamp: 0
	});
}
export function updateBalls(game: Game, dx: number){
	let {config, state}=game;
	let player=state.player;
	// Orbs are moved, then tested and compacted in place. Squaring both sides of the collision test
	// gives the same answer as comparing a square root, and keeps the list from being reallocated
	// every frame.
	let kept=0;
	for (let b of state.balls){
		b.x-=dx;
		let px=player.x-b.x;
		let py=player.y-b.y;
		let reach=b.r+config.planeSize;
		if (px*px+py*py<reach*reach){
			playCollectionSound(game);
			let basePoints=Math.floor(b.r*10);
			state.score+=basePoints;
			b.collectTimestamp=Date.now();
			checkReactions(game, b.element, basePoints);
			continue;
		}
		if (b.x+b.r>0){
			state.balls[kept++]=b;
		}
	}
	state.balls.length=kept;
}
