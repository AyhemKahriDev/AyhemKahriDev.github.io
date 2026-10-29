// Signal Meadow style: levels use an authored, stepped route with clear invitations before hazards.
import type { Checkpoint, Enemy, Platform, Rect, Shard } from "./types";

export type StageData = { id: number; name: string; width: number; spawn: { x: number; y: number }; solids: Rect[]; hazards: Rect[]; shards: Shard[]; enemies: Enemy[]; checkpoints: Checkpoint[]; platforms: Platform[]; portal: Rect };
const tile = 20;
const ground = (x: number, y: number, w: number, h = tile) => ({ x, y, w, h });
const platform = (x: number, y: number, w: number) => ({ x, y, w, h: tile, vx: 0.55, minX: x - 42, maxX: x + 42 });
const shard = (x: number, y: number): Shard => ({ x, y, w: 12, h: 16, collected: false, bob: (x * 0.13) % 6 });
const enemy = (x: number, y: number, range = 48): Enemy => ({ x, y, w: 18, h: 16, vx: 0.7, alive: true, phase: range });
const checkpoint = (x: number, y: number): Checkpoint => ({ x, y, w: 16, h: 40, active: false });

export const STAGES: StageData[] = [
  {
    id: 1, name: "Meadow Relay", width: 3000, spawn: { x: 80, y: 220 },
    solids: [ground(0, 300, 620, 60), ground(700, 300, 460, 60), ground(1250, 300, 580, 60), ground(1930, 300, 520, 60), ground(2550, 300, 450, 60), ground(340, 240, 120), ground(780, 220, 120), ground(1030, 220, 120), ground(1360, 230, 120), ground(1510, 220, 120), ground(2080, 230, 140), ground(2250, 220, 100), ground(2670, 220, 120)],
    hazards: [ground(620, 320, 80, 40), ground(1160, 320, 90, 40), ground(1830, 320, 100, 40), ground(2450, 320, 100, 40)],
    shards: [shard(370, 196), shard(510, 256), shard(825, 176), shard(1080, 176), shard(1400, 186), shard(1550, 176), shard(2140, 186), shard(2280, 176), shard(2720, 176)],
    enemies: [enemy(480, 284), enemy(900, 284), enemy(1410, 214), enemy(1640, 284), enemy(2180, 214), enemy(2760, 204)], checkpoints: [checkpoint(1260, 260), checkpoint(2050, 260)], platforms: [], portal: { x: 2860, y: 238, w: 28, h: 62 },
  },
  {
    id: 2, name: "Copper Canopy", width: 3300, spawn: { x: 80, y: 220 },
    solids: [ground(0, 300, 520, 60), ground(620, 300, 360, 60), ground(1070, 300, 480, 60), ground(1640, 300, 480, 60), ground(2210, 300, 1090, 60), ground(260, 230, 120), ground(720, 220, 100), ground(880, 220, 100), ground(1220, 220, 120), ground(1460, 220, 120), ground(1850, 220, 120), ground(2020, 220, 110), ground(2520, 220, 140), ground(2740, 220, 120)],
    hazards: [ground(520, 320, 100, 40), ground(980, 320, 90, 40), ground(1550, 320, 90, 40), ground(2120, 320, 90, 40)],
    shards: [shard(300, 186), shard(750, 176), shard(920, 176), shard(1270, 176), shard(1510, 176), shard(1890, 176), shard(2050, 176), shard(2570, 176), shard(2790, 176), shard(3160, 256)],
    enemies: [enemy(420, 284), enemy(780, 204), enemy(1300, 284), enemy(1510, 204), enemy(1910, 204), enemy(2640, 284), enemy(2880, 284)], checkpoints: [checkpoint(1080, 260), checkpoint(2220, 260)], platforms: [platform(530, 265, 74), platform(1000, 220, 84), platform(1610, 250, 88), platform(2128, 250, 96)], portal: { x: 3200, y: 238, w: 28, h: 62 },
  },
  {
    id: 3, name: "Dawn Switchyard", width: 3700, spawn: { x: 80, y: 220 },
    solids: [ground(0, 300, 700, 60), ground(790, 300, 500, 60), ground(1410, 300, 480, 60), ground(2030, 300, 580, 60), ground(2700, 300, 1000, 60), ground(380, 220, 130), ground(940, 220, 120), ground(1100, 220, 120), ground(1500, 220, 120), ground(1680, 220, 120), ground(2160, 220, 120), ground(2320, 220, 120), ground(2890, 220, 140), ground(3110, 220, 120), ground(3420, 220, 120)],
    hazards: [ground(700, 320, 90, 40), ground(1290, 320, 120, 40), ground(1890, 320, 140, 40), ground(2610, 320, 90, 40)],
    shards: [shard(420, 176), shard(960, 176), shard(1140, 176), shard(1530, 176), shard(1710, 176), shard(2190, 176), shard(2350, 176), shard(2920, 176), shard(3140, 176), shard(3460, 176), shard(3620, 256)],
    enemies: [enemy(560, 284), enemy(1020, 204), enemy(1570, 204), enemy(1760, 284), enemy(2220, 204), enemy(2440, 284), enemy(2980, 204), enemy(3290, 284), enemy(3500, 204)], checkpoints: [checkpoint(1470, 260), checkpoint(2760, 260)], platforms: [platform(720, 260, 82), platform(1340, 220, 90), platform(1940, 260, 86), platform(2620, 230, 88)], portal: { x: 3580, y: 238, w: 28, h: 62 },
  },
];

export function cloneStage(stage: StageData): StageData {
  return { ...stage, solids: stage.solids.map((item) => ({ ...item })), hazards: stage.hazards.map((item) => ({ ...item })), shards: stage.shards.map((item) => ({ ...item })), enemies: stage.enemies.map((item) => ({ ...item })), checkpoints: stage.checkpoints.map((item) => ({ ...item })), platforms: stage.platforms.map((item) => ({ ...item })), portal: { ...stage.portal } };
}
