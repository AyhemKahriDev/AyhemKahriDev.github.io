export interface Config{
	width: number;
	height: number;
	skyGradient: string[];
	planeColor: string;
	planeSize: number;
	terrainSegmentWidth: number;
	terrainMaxDelta: number;
	terrainMinHeight: number;
	terrainMaxHeight: number;
	ballSpawnInterval: number;
	ballMinRadius: number;
	ballMaxRadius: number;
	cursorSize: number;
	cursorGlowRadius: number;
	cursorGradient: string[];
	reactionWindow: number;
	maxParticles: number;
	maxBalls: number;
	soundCooldown: number;
}
export function defaultConfig(): Config{
	return {
		width: window.innerWidth,
		height: window.innerHeight,
		skyGradient: ["#000044", "#88CCDD"],
		planeColor: "#FFF",
		planeSize: 33.5,
		terrainSegmentWidth: 10,
		terrainMaxDelta: 40,
		terrainMinHeight: 40,
		terrainMaxHeight: 200,
		ballSpawnInterval: 40,
		ballMinRadius: 5,
		ballMaxRadius: 20,
		cursorSize: 30,
		cursorGlowRadius: 8,
		cursorGradient: ["#DE0000", "#28465C"],
		reactionWindow: 4000,
		maxParticles: 100,
		maxBalls: 100,
		soundCooldown: 100
	};
}
