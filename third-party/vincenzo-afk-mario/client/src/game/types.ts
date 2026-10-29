// Signal Meadow style: semantic gameplay data stays crisp and compact; no React or renderer coupling belongs here.

export type InputAction = "left" | "right" | "jump" | "pause" | "restart";
export type InputState = { left: boolean; right: boolean; jump: boolean };
export type Rect = { x: number; y: number; w: number; h: number };
export type Shard = Rect & { collected: boolean; bob: number };
export type Enemy = Rect & { vx: number; alive: boolean; phase: number };
export type Checkpoint = Rect & { active: boolean };
export type Platform = Rect & { vx: number; minX: number; maxX: number };
export type GameStatus = "menu" | "playing" | "paused" | "dead" | "complete";
export type AudioCue = "jump" | "collect" | "stomp" | "checkpoint" | "hurt" | "finish";
export type HudSnapshot = { stage: number; stageName: string; score: number; shards: number; totalShards: number; lives: number; status: GameStatus; message: string };
export type GameCallbacks = { onHud: (snapshot: HudSnapshot) => void; onAudioCue?: (cue: AudioCue) => void };
