export interface ElementType{
	name: string;
	color: string;
}
export interface Reaction{
	elements: string[];
	name: string;
	multiplier?: number;
	bonus?: number;
	type: string;
}
export const elements: ElementType[]=[
	{name: "Pyra", color: "#DE0000"},
	{name: "Aqua", color: "#1C94E9"},
	{name: "Voltis", color: "#800089"},
	{name: "Flora", color: "#009C17"},
	{name: "Glacia", color: "#59CFDA"},
	{name: "Terra", color: "#FFAA44"},
	{name: "Aero", color: "#75C2AA"}
];
// Every reaction is listed in both orders, because the pair is read left to right and reversing it can
// change the outcome: Steamburst is worth 2x as Pyra then Aqua but only 1.5x as Aqua then Pyra.
export const reactions: Reaction[]=[
	{elements: ["Pyra", "Aqua"], name: "Steamburst", multiplier: 2, type: "amplifying"},
	{elements: ["Aqua", "Pyra"], name: "Steamburst", multiplier: 1.5, type: "amplifying"},
	{elements: ["Pyra", "Glacia"], name: "Frostburn", multiplier: 2, type: "amplifying"},
	{elements: ["Glacia", "Pyra"], name: "Frostburn", multiplier: 1.5, type: "amplifying"},
	{elements: ["Voltis", "Pyra"], name: "Sparkflare", bonus: 175, type: "transformative"},
	{elements: ["Pyra", "Voltis"], name: "Sparkflare", bonus: 175, type: "transformative"},
	{elements: ["Voltis", "Glacia"], name: "Chillshock", bonus: 60, type: "transformative"},
	{elements: ["Glacia", "Voltis"], name: "Chillshock", bonus: 60, type: "transformative"},
	{elements: ["Voltis", "Aqua"], name: "Voltflow", bonus: 90, type: "transformative"},
	{elements: ["Aqua", "Voltis"], name: "Voltflow", bonus: 90, type: "transformative"},
	{elements: ["Aero", "Pyra"], name: "Galeweave", bonus: 60, type: "transformative"},
	{elements: ["Aero", "Aqua"], name: "Galeweave", bonus: 60, type: "transformative"},
	{elements: ["Aero", "Voltis"], name: "Galeweave", bonus: 60, type: "transformative"},
	{elements: ["Aero", "Glacia"], name: "Galeweave", bonus: 60, type: "transformative"},
	{elements: ["Terra", "Pyra"], name: "Stoneguard", bonus: 40, type: "transformative"},
	{elements: ["Terra", "Aqua"], name: "Stoneguard", bonus: 40, type: "transformative"},
	{elements: ["Terra", "Voltis"], name: "Stoneguard", bonus: 40, type: "transformative"},
	{elements: ["Terra", "Glacia"], name: "Stoneguard", bonus: 40, type: "transformative"},
	{elements: ["Pyra", "Flora"], name: "Wildfire", bonus: 60, type: "transformative"},
	{elements: ["Flora", "Pyra"], name: "Wildfire", bonus: 60, type: "transformative"},
	{elements: ["Aqua", "Glacia"], name: "Icebind", bonus: 40, type: "status"},
	{elements: ["Glacia", "Aqua"], name: "Icebind", bonus: 40, type: "status"},
	{elements: ["Aqua", "Flora"], name: "Lifeburst", bonus: 70, type: "transformative"},
	{elements: ["Flora", "Aqua"], name: "Lifeburst", bonus: 70, type: "transformative"},
	{elements: ["Flora", "Voltis"], name: "Growthspark", bonus: 60, type: "catalyze"},
	{elements: ["Voltis", "Flora"], name: "Growthspark", bonus: 60, type: "catalyze"},
	{elements: ["Voltis", "Growthspark"], name: "Shockbloom", bonus: 200, type: "catalyze"},
	{elements: ["Flora", "Growthspark"], name: "Wildgrowth", bonus: 200, type: "catalyze"},
	{elements: ["Pyra", "Lifeburst"], name: "Flamebloom", bonus: 150, type: "transformative"},
	{elements: ["Voltis", "Lifeburst"], name: "Surgebloom", bonus: 150, type: "transformative"}
];
