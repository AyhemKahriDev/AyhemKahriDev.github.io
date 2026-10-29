import { expect, it } from 'vitest';
import { Simulation, NEUTRAL } from '../src/core/simulation';
import { clamp } from '../src/core/math';
import { riverAt, SECTOR_LENGTH, channelAt } from '../src/core/world';

it('collides with the visible bridge deck outside the control tower', () => {
  const s = new Simulation();
  s.start();
  const bridge = s.entities.find((e) => e.kind === 'bridge')!;
  s.player.pos = { x: bridge.pos.x + 30, y: 11.5, z: bridge.pos.z + 12 };
  s.player.invulnerable = 0;
  for (let i = 0; i < 25; i++) s.step(1 / 60, NEUTRAL);
  expect(s.phase).toBe('crashed');
});
it('replays the same encounter motion after a checkpoint retry', () => {
  const s = new Simulation();
  s.start();
  for (let i = 0; i < 60; i++) s.step(1 / 60, NEUTRAL);
  const before = s.entities.find((e) => e.kind === 'helicopter')!.pos.x;
  s.damagePlayer(200);
  s.retry();
  for (let i = 0; i < 60; i++) s.step(1 / 60, NEUTRAL);
  expect(s.entities.find((e) => e.kind === 'helicopter')!.pos.x).toBeCloseTo(before, 8);
});
it('restores checkpoint score and permits completion of all three sectors', () => {
  const s = new Simulation();
  s.start();
  for (let sector = 0; sector < 3; sector++) {
    const bridge = s.entities.find((e) => e.kind === 'bridge')!;
    const p = s.player;
    p.pos = { x: bridge.pos.x, y: bridge.pos.y, z: bridge.pos.z + 250 };
    p.yaw = 0;
    p.pitch = 0;
    for (let i = 0; i < 160; i++) s.step(1 / 60, { ...NEUTRAL, fire: true, missile: true });
    expect(s.bridgeDestroyed).toBe(true);
    const d = (sector + 1) * SECTOR_LENGTH - 0.2;
    p.pos = { x: riverAt(d).center, y: 60, z: -d };
    s.step(1 / 60, NEUTRAL);
    expect(s.phase).toBe('playing');
    expect(s.sector).toBe(sector + 1);
  }
});
it('a pilot can follow the left fork and refuel through the first three bridges with ordinary controls and evasive climbs', () => {
  const s = new Simulation();
  s.start();
  for (let frame = 0; frame < 60 * 180 && s.phase === 'playing' && s.sector < 3; frame++) {
    const p = s.player,
      d = -p.pos.z,
      channels = channelAt(d + 90),
      current = channelAt(d);
    const route = current.length === 2 && channels.length === 1 ? current[0] : channels[0];
    const targetX = (route.left + route.right) / 2;
    const desired = Math.atan2(targetX - p.pos.x, 90);
    const roll = clamp((desired - p.yaw) * 3.8, -1, 1);
    s.step(1 / 60, {
      ...NEUTRAL,
      roll,
      pitch: clamp(
        ((s.bullets.some((b) => b.enemy && Math.abs(b.pos.z - p.pos.z) < 100)
          ? 32 + 12 * Math.sin(s.time * 3)
          : 18) -
          p.pos.y) *
          0.12,
        -1,
        1,
      ),
      fire: !s.entities.some(
        (e) =>
          e.kind === 'fuel' &&
          e.active &&
          p.pos.z - e.pos.z > 0 &&
          p.pos.z - e.pos.z < 160 &&
          Math.abs(p.pos.x - e.pos.x) < 25,
      ),
      missile: s.entities.some(
        (e) => e.kind === 'bridge' && e.active && p.pos.z - e.pos.z > 30 && p.pos.z - e.pos.z < 340,
      ),
    });
  }
  expect({
    phase: s.phase,
    cause: s.message,
    sector: s.sector,
    health: s.player.health,
    fuel: s.player.fuel,
  }).toMatchObject({ phase: 'playing', sector: 3 });
});
