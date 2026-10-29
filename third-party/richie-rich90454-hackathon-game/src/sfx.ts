import type {PolySynth as PolySynthType} from "tone";
import type {Game} from "./state";

// Tone is pulled in on the start click (see initSfx) because it builds its AudioContext while the module
// is evaluated. Until then this stays inert and the sound effects are simply silent.
let now: ()=>number=()=>0;
let toneModule: typeof import("tone")|null=null;
export async function initSfx(game: Game){
	let tone=await import("tone");
	await tone.start();
	now=tone.now;
	toneModule=tone;
	// state.synth is the collection blip's own voice and is never reconfigured, so it always sounds the
	// same no matter what reacted before it.
	game.state.synth=new tone.PolySynth(tone.Synth).toDestination();
}
export function playCollectionSound(game: Game){
	if (Date.now()-game.state.lastSoundTime<game.config.soundCooldown){
		return;
	}
	if (game.state.synth){
		game.state.synth.triggerAttackRelease("E4", "8n", now(), 1.0);
		game.state.lastSoundTime=Date.now();
	}
}
type OscillatorType="sine"|"triangle"|"sawtooth"|"square"|"pulse";
interface Timbre{
	oscillator: { type: OscillatorType };
	envelope: { attack: number; decay: number; sustain: number; release: number };
}
// Seven distinct timbres, held as shared objects so that two reactions which sound alike share one voice.
const timbres: { [name: string]: Timbre }={
	sineShort: {oscillator: {type: "sine"}, envelope: {attack: .01, decay: .2, sustain: 0, release: .2}},
	triangleShort: {oscillator: {type: "triangle"}, envelope: {attack: .01, decay: .2, sustain: 0, release: .2}},
	pulseShort: {oscillator: {type: "pulse"}, envelope: {attack: .01, decay: .2, sustain: 0, release: .2}},
	sawShort: {oscillator: {type: "sawtooth"}, envelope: {attack: .01, decay: .2, sustain: 0, release: .2}},
	squareShort: {oscillator: {type: "square"}, envelope: {attack: .01, decay: .2, sustain: 0, release: .2}},
	sineLong: {oscillator: {type: "sine"}, envelope: {attack: .01, decay: .3, sustain: 0, release: .3}},
	sawLong: {oscillator: {type: "sawtooth"}, envelope: {attack: .01, decay: .3, sustain: 0, release: .3}}
};
interface ReactionSound{
	timbre: Timbre;
	note: string;
	duration: string;
}
const reactionSounds: { [name: string]: ReactionSound }={
	Steamburst: {timbre: timbres.sineShort, note: "G4", duration: "8n"},
	Frostburn: {timbre: timbres.triangleShort, note: "A4", duration: "8n"},
	Sparkflare: {timbre: timbres.sawLong, note: "E3", duration: "4n"},
	Chillshock: {timbre: timbres.squareShort, note: "F3", duration: "8n"},
	Voltflow: {timbre: timbres.pulseShort, note: "D4", duration: "8n"},
	Galeweave: {timbre: timbres.sineLong, note: "C5", duration: "4n"},
	Stoneguard: {timbre: timbres.triangleShort, note: "B3", duration: "8n"},
	Wildfire: {timbre: timbres.sawLong, note: "G3", duration: "4n"},
	Icebind: {timbre: timbres.sineShort, note: "A5", duration: "8n"},
	Lifeburst: {timbre: timbres.triangleShort, note: "E4", duration: "8n"},
	Growthspark: {timbre: timbres.pulseShort, note: "F4", duration: "8n"},
	Shockbloom: {timbre: timbres.sawShort, note: "G4", duration: "8n"},
	Wildgrowth: {timbre: timbres.triangleShort, note: "A4", duration: "8n"},
	Flamebloom: {timbre: timbres.sawLong, note: "E3", duration: "4n"},
	Surgebloom: {timbre: timbres.pulseShort, note: "D4", duration: "8n"}
};
// One voice per timbre. Previously every reaction reconfigured the single shared synth, which restrung
// notes that were still ringing: a Steamburst landing on top of a Wildfire used to turn the Wildfire's
// fading tail into a sine. Each timbre now lives on its own synth, created with its settings, so nothing
// has to be reconfigured at play time and overlapping reactions keep the voice they were given.
let channels=new Map<Timbre, PolySynthType>();
function channelFor(timbre: Timbre): PolySynthType|null{
	let existing=channels.get(timbre);
	if (existing){
		return existing;
	}
	if (!toneModule){
		return null;
	}
	let created=new toneModule.PolySynth(toneModule.Synth, timbre).toDestination();
	channels.set(timbre, created);
	return created;
}
export function playReactionSound(game: Game, reactionName: string){
	if (Date.now()-game.state.lastSoundTime<game.config.soundCooldown){
		return;
	}
	if (!game.state.synth){
		return;
	}
	let sound=reactionSounds[reactionName];
	if (sound){
		let channel=channelFor(sound.timbre);
		if (channel){
			channel.triggerAttackRelease(sound.note, sound.duration, now(), 0.5);
		}
	}
	game.state.lastSoundTime=Date.now();
}
