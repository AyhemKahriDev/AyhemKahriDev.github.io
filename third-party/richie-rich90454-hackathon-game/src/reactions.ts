import type {Game} from "./state";
import type {Reaction} from "./data";
import {reactions} from "./data";
import {playReactionSound} from "./sfx";
// The table never changes at runtime, so both lookups the reaction engine does per collected orb are
// resolved once here: every reaction name, for the product check, and every element pair, keyed in the
// order it is written. A pair is read in order first and reversed second, which is why both the exact
// and the flipped key are consulted, and why the reversed read can pay less.
let reactionNames=new Set<string>();
let reactionByPair=new Map<string, Reaction>();
for (let r of reactions){
	reactionNames.add(r.name);
	let key=r.elements[0]+"|"+r.elements[1];
	if (!reactionByPair.has(key)){
		reactionByPair.set(key, r);
	}
}
function findReaction(first: string, second: string): Reaction|null{
	return reactionByPair.get(first+"|"+second)||reactionByPair.get(second+"|"+first)||null;
}
function rememberReactionProduct(state: Game["state"], name: string, timestamp: number){
	if (!state.collectedElements.some(e=>e.name==name)){
		state.collectedElements.push({name: name, timestamp: timestamp});
	}
}
export function checkReactions(game: Game, newElement: string, basePoints: number){
	let {state, config}=game;
	let now=Date.now();
	let reactionTriggered=false;
	let auraConsumed=false;
	let aura=state.player.aura;
	if (aura){
		let reaction=findReaction(aura, newElement);
		if (reaction){
			let bonusPoints=0;
			if (reaction.type=="amplifying"){
				bonusPoints=Math.floor(basePoints*(reaction.multiplier!-1));
			}
			else if (reaction.type=="transformative"||reaction.type=="catalyze"){
				bonusPoints=reaction.bonus!;
			}
			else if (reaction.type=="status"){
				bonusPoints=reaction.bonus!;
				state.player.aura="Frozen";
				state.player.auraTimestamp=now;
				auraConsumed=false;
			}
			state.score+=bonusPoints;
			state.lastReactionMessage.text=`${reaction.name}!+${bonusPoints}`;
			state.lastReactionMessage.opacity=1;
			state.reactionCounts[reaction.name]=(state.reactionCounts[reaction.name]||0)+1;
			playReactionSound(game, reaction.name);
			reactionTriggered=true;
			if (reaction.type!=="status"){
				auraConsumed=true;
			}
			if (reaction.type=="transformative"||reaction.type=="catalyze"){
				rememberReactionProduct(state, reaction.name, now);
			}
		}
	}
	if (!reactionTriggered){
		let activeElements=state.collectedElements.filter(e=>now-e.timestamp<config.reactionWindow);
		let validElements: typeof activeElements = activeElements.concat({name: newElement, timestamp: now });
		for (let reaction of state.reactions){
			let [elem1, elem2]=reaction.elements;
			if (reactionNames.has(elem2)&&validElements.some(e=>e.name==elem2)&&newElement==elem1){
				let bonusPoints=reaction.bonus!;
				state.score+=bonusPoints;
				state.lastReactionMessage.text=`${reaction.name}!+${bonusPoints}`;
				state.lastReactionMessage.opacity=1;
				state.reactionCounts[reaction.name]=(state.reactionCounts[reaction.name]||0)+1;
				playReactionSound(game, reaction.name);
				let idx=validElements.findIndex(e=>e.name==elem2);
				if (idx>=0) validElements.splice(idx, 1);
				reactionTriggered=true;
				break;
			}
		}
		state.collectedElements=validElements;
	}
	if (!reactionTriggered&&(!state.player.aura||auraConsumed)){
		state.player.aura=newElement;
		state.player.auraTimestamp=now;
	}
	else if (auraConsumed){
		state.player.aura=null;
	}
}
