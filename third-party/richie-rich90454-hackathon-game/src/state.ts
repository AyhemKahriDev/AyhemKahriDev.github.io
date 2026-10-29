import type {PolySynth as PolySynthType} from "tone";
import type {Config} from "./config";
import type {ElementType, Reaction} from "./data";
import {elements, reactions} from "./data";
export interface Player{
	x: number;
	y: number;
	forwardSpeed: number;
	acceleration: number;
	maxSpeed: number;
	verticalVelocity: number;
	verticalAcceleration: number;
	maxVerticalSpeed: number;
	friction: number;
	aura: string|null;
	auraTimestamp: number;
}
export interface TerrainPoint{
	x: number;
	y: number;
}
export interface Ball{
	x: number;
	y: number;
	r: number;
	color: string;
	element: string;
	collectTimestamp: number;
}
export interface Particle{
	x: number;
	y: number;
	size: number;
	opacity: number;
	decay: number;
}
export interface CollectedElement{
	name: string;
	timestamp: number;
}
export interface State{
	player: Player;
	terrain: TerrainPoint[];
	balls: Ball[];
	frame: number;
	keys: { [key: string]: boolean };
	trailParticles: Particle[];
	score: number;
	collectedElements: CollectedElement[];
	elements: ElementType[];
	reactions: Reaction[];
	lastReactionMessage: { text: string; opacity: number; decay: number };
	synth: PolySynthType|null;
	lastSoundTime: number;
	startTime: number|null;
	maxSpeedUsed: number;
	reactionCounts: { [key: string]: number };
	gameEnded: boolean;
}
// Everything the systems need to do their work, passed as one object so no module reaches for a
// global. The systems never write to Game itself, only to state and config inside it.
export interface Game{
	config: Config;
	state: State;
	ctx: CanvasRenderingContext2D;
}
export function createInitialState(config: Config): State{
	return {
		player:{
			x: config.width/4,
			y: config.height/2,
			forwardSpeed: 2.1,
			acceleration: .01,
			maxSpeed: 12,
			verticalVelocity: 0,
			verticalAcceleration: .25,
			maxVerticalSpeed: 5,
			friction: .85,
			aura: null,
			auraTimestamp: 0
		},
		terrain: [],
		balls: [],
		frame: 0,
		keys:{},
		trailParticles:[],
		score: 0,
		collectedElements: [],
		elements: elements,
		reactions: reactions,
		lastReactionMessage:{text: "", opacity: 1, decay: .01},
		synth: null,
		lastSoundTime: 0,
		startTime: null,
		maxSpeedUsed: 8,
		reactionCounts:{},
		gameEnded: false
	};
}
