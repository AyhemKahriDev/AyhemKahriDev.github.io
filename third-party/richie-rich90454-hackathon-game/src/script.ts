import $ from "jquery";
import {startMusic} from "./bgm";
import {defaultConfig} from "./config";
import {createInitialState} from "./state";
import type {Game} from "./state";
import {resizeCanvas, startGame} from "./game";
import {registerInput} from "./input";
import {initSfx} from "./sfx";
$(document).ready(function(){
	$("#startModal").show();
	$("#controls-toggle").hide();
	let config=defaultConfig();
	let canvas=document.getElementById("gameCanvas") as HTMLCanvasElement;
	let ctx=canvas.getContext("2d");
	if (!ctx){
		console.error("Canvas error, refresh to try again.");
		return;
	}
	let game: Game={config, state: createInitialState(config), ctx};
	$("#startButton").click(async function(){
		$("#startModal").hide();
		$("#controls-toggle").show();
		startMusic();
		await initSfx(game);
		startGame(game);
	});
	$("#restartButton").click(function(){
		window.location.reload();
	});
	window.addEventListener("resize", ()=>resizeCanvas(game));
	resizeCanvas(game);
	registerInput(game);
});
