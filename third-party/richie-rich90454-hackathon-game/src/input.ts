import $ from "jquery";
import type {Game} from "./state";
const controlMap: { [key: string]: string }={
	w: "up",
	s: "down",
	"-": "slower",
	"=": "faster",
	"+": "faster",
	a: "slower",
	d: "faster"
};
const touchButtonMap: [string, string][]=[["upBtn","up"], ["downBtn","down"], ["slowerBtn","slower"], ["fasterBtn","faster"]];
function registerKeyboard(game: Game){
	let {state}=game;
	window.addEventListener("keydown", e=>{
		let c=controlMap[e.key.toLowerCase()];
		if (c){
			state.keys[c]=true;
			e.preventDefault();
		}
	});
	window.addEventListener("keyup", e=>{
		let c=controlMap[e.key.toLowerCase()];
		if (c){
			state.keys[c]=false;
			e.preventDefault();
		}
	});
}
function registerTouchButtons(game: Game){
	let {state}=game;
	touchButtonMap.forEach(([btnId, ctrl])=>{
		let btn=document.getElementById(btnId);
		if (!btn){
			return;
		}
		btn.addEventListener("pointerdown", e=>{
			e.preventDefault();
			state.keys[ctrl]=true;
		},{passive:false});
		btn.addEventListener("pointerup", e=>{
			e.preventDefault();
			state.keys[ctrl]=false;
		},{passive:false});
		btn.addEventListener("pointerleave", e=>{
			e.preventDefault();
			state.keys[ctrl]=false;
		},{passive:false});
	});
}
function registerSwipe(game: Game){
	let {config, state}=game;
	let canvas=document.getElementById("gameCanvas") as HTMLCanvasElement;
	canvas.addEventListener("touchmove", e=>{
		let t=e.touches[0];
		let headerH=(document.querySelector("header") as HTMLElement).offsetHeight;
		let y=t.clientY-headerH;
		state.keys.up=y<config.height/2;
		state.keys.down=y>config.height/2;
		e.preventDefault();
	},{passive:false});
	canvas.addEventListener("touchend", ()=>{
		state.keys.up=state.keys.down=false;
	});
}
function registerControlsToggle(){
	let touchControls=$("#touch-controls");
	let touchControlsToggleBtn=$("#toggleControlsBtn");
	touchControls.hide();
	let istouchControlsVisible=false;
	touchControlsToggleBtn.text("Show Controls");
	touchControlsToggleBtn.on("click", function(){
		istouchControlsVisible=!istouchControlsVisible;
		touchControls.slideToggle(200);
		touchControlsToggleBtn.text(istouchControlsVisible?"Hide Controls":"Show Controls");
		touchControlsToggleBtn.attr("aria-expanded", istouchControlsVisible?"true":"false");
	});
}
export function registerInput(game: Game){
	registerKeyboard(game);
	registerTouchButtons(game);
	registerSwipe(game);
	registerControlsToggle();
}
