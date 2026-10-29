import { expect, it } from 'vitest';
import { Simulation, NEUTRAL } from '../src/core/simulation';

it('enemy fire hits an aircraft that maintains its course', () => {
  const s = new Simulation();
  s.start();
  const boat = s.entities.find((e) => e.kind === 'boat')!;
  boat.pos = { x: 0, y: 3, z: -200 };
  boat.previous = { ...boat.pos };
  boat.originX = 0;
  boat.cooldown = 0;
  s.entities = [boat];
  s.player.invulnerable = 0;
  for (let i = 0; i < 120; i++) s.step(1 / 60, NEUTRAL);
  expect(s.phase).toBe('playing');
  expect(s.player.health).toBeLessThan(100);
});

it('allows a course change to dodge a shot already fired', () => {
  const s = new Simulation();
  s.start();
  const boat = s.entities.find((e) => e.kind === 'boat')!;
  boat.pos = { x: 0, y: 3, z: -200 };
  boat.previous = { ...boat.pos };
  boat.originX = 0;
  boat.cooldown = 0;
  s.entities = [boat];
  s.player.invulnerable = 0;
  s.step(1 / 60, NEUTRAL);
  expect(s.bullets.some((b) => b.enemy)).toBe(true);
  for (let i = 0; i < 100; i++) s.step(1 / 60, { ...NEUTRAL, pitch: 1 });
  expect(s.player.health).toBe(100);
});
