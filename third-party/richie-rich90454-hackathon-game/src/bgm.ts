import type {PolySynth as PolySynthType, FMSynth as FMSynthType, Loop as LoopType} from "tone";
import type {Midi as MidiType} from "@tonejs/midi";

let isPlaying=false;
let starting=false;
let midiData: MidiType|null=null;
let synth: PolySynthType<FMSynthType>|null=null;
let midiLoop: LoopType|null=null;

function initAudio(tone: typeof import("tone")){
	synth=new tone.PolySynth(tone.FMSynth,{
		harmonicity: 3,
		modulationIndex: 10,
		oscillator:{
			type: "sine" as const
		},
		envelope:{
			attack: 0.002,
			decay: 1.2,
			sustain: 0.3,
			release: 1.5
		},
		modulation:{
			type: "triangle" as const
		},
		modulationEnvelope:{
			attack: 0.002,
			decay: 0.5,
			sustain: 0,
			release: 0.5
		}
	}).toDestination();
}
function decodeMidi(dataUri: string, MidiParser: typeof import("@tonejs/midi").Midi): MidiType{
	let base64=dataUri.slice(dataUri.indexOf(",")+1);
	let binary=atob(base64);
	let bytes=new Uint8Array(binary.length);
	for (let i=0;i<binary.length;i++){
		bytes[i]=binary.charCodeAt(i);
	}
	return new MidiParser(bytes);
}
// Called by the "Begin the Journey with Wonder!" button in script.ts. Nothing here touches Web
// Audio until then, so the game stays completely silent until the player starts it.
export async function startMusic(){
	if (isPlaying||starting) return;
	starting=true;
	try{
		if (!midiData){
			let [{MIDI_DATA_URI}, {Midi}]=await Promise.all([import("./midi"), import("@tonejs/midi")]);
			midiData=decodeMidi(MIDI_DATA_URI, Midi);
		}
		// Tone builds its AudioContext while the module is evaluated, so it is imported here, from
		// the start button click, instead of on load. Autoplay policies then allow it to start.
		let tone=await import("tone");
		if (!synth) initAudio(tone);
		await tone.start();
		// Tone boots with the Transport stopped, so its clock never ticks and anything scheduled
		// through it, such as the Loop below, would silently never fire. Start it first.
		let transport=tone.getTransport();
		if (transport.state!="started"){
			transport.start();
		}
		if (midiData.header.tempos.length){
			let bpm=midiData.header.tempos[0].bpm;
			synth!.context.transport.bpm.value=bpm;
		}
		midiLoop?.stop();
		midiLoop?.dispose();
		let startTime=tone.now()+.1;
		midiLoop=new tone.Loop((time)=>{
			midiData!.tracks.forEach(track=>{
				track.notes.forEach(n=>{
					synth!.triggerAttackRelease(n.name, n.duration, time+n.time, n.velocity*0.75);
				});
			});
		}, midiData.duration);
		midiLoop.start(startTime);
		isPlaying=true;
	}
	catch (e){
		console.error("Music failed to start:", e);
	}
	finally{
		starting=false;
	}
}
