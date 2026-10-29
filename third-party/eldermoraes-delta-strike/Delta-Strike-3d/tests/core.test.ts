import { describe, expect, it } from 'vitest';
import { segmentBox } from '../src/core/math';
import { FixedClock } from '../src/core/clock';
import { riverAt, sectorEntities } from '../src/core/world';
import { Simulation, NEUTRAL } from '../src/core/simulation';

describe('swept collision', () => {
  it('detects a projectile crossing a thin target between frames', () => {
    expect(
      segmentBox(
        { x: 0, y: 3, z: 10 },
        { x: 0, y: 3, z: -10 },
        { x: 0, y: 3, z: 0 },
        { x: 2, y: 2, z: 0.5 },
      ),
    ).toBeCloseTo(0.475);
  });
  it('rejects a parallel shot outside the target', () => {
    expect(
      segmentBox(
        { x: 5, y: 3, z: 10 },
        { x: 5, y: 3, z: -10 },
        { x: 0, y: 3, z: 0 },
        { x: 2, y: 2, z: 1 },
      ),
    ).toBeNull();
  });
});
describe('deterministic world', () => {
  it('reproduces encounters with the same seed and changes them with another seed', () => {
    expect(sectorEntities(1, 42)).toEqual(sectorEntities(1, 42));
    expect(sectorEntities(1, 42)).not.toEqual(sectorEntities(1, 43));
  });
  it('keeps every encounter inside a navigable river corridor', () => {
    for (const e of sectorEntities(2, 42).filter((e) => e.kind !== 'jet'))
      expect(Math.abs(e.pos.x - riverAt(-e.pos.z).center)).toBeLessThan(
        riverAt(-e.pos.z).width / 2,
      );
  });
});
describe('fixed simulation clock', () => {
  it('runs the same number of simulation steps at different frame rates', () => {
    const run = (fps: number) => {
      const c = new FixedClock();
      let n = 0;
      for (let i = 0; i < fps * 10; i++) c.advance(1 / fps, () => n++);
      return n;
    };
    expect(run(30)).toBe(600);
    expect(run(144)).toBe(600);
  });
  it('bounds work after a long stall', () => {
    let n = 0;
    new FixedClock().advance(8, () => n++);
    expect(n).toBeLessThanOrEqual(8);
  });
});
describe('mission lifecycle', () => {
  it('pauses without consuming fuel or moving', () => {
    const s = new Simulation();
    s.start();
    s.pause();
    const p = { ...s.player.pos };
    const f = s.player.fuel;
    s.step(1 / 60, { ...NEUTRAL, boost: true });
    expect(s.player.pos).toEqual(p);
    expect(s.player.fuel).toBe(f);
  });
  it('clears projectiles and restores a safe player on checkpoint retry', () => {
    const s = new Simulation();
    s.start();
    s.step(1 / 60, { ...NEUTRAL, fire: true });
    expect(s.bullets.length).toBeGreaterThan(0);
    s.damagePlayer(200);
    expect(s.phase).toBe('crashed');
    s.retry();
    expect(s.phase).toBe('playing');
    expect(s.bullets).toHaveLength(0);
    expect(s.player.health).toBe(100);
    expect(s.player.lives).toBe(2);
  });
  it('cannot consume several lives from one collision burst', () => {
    const s = new Simulation();
    s.start();
    s.damagePlayer(200);
    s.damagePlayer(200);
    expect(s.player.lives).toBe(2);
  });
  it('ends the sortie when the last aircraft is lost', () => {
    const s = new Simulation();
    s.start();
    for (let i = 0; i < 3; i++) {
      s.damagePlayer(200);
      if (i < 2) s.retry();
    }
    expect(s.phase).toBe('lost');
  });
  it('handles fuel exhaustion as a recoverable aircraft loss', () => {
    const s = new Simulation();
    s.start();
    s.player.fuel = 0.001;
    s.step(1 / 60, NEUTRAL);
    expect(s.phase).toBe('crashed');
  });
  it('keeps altitude and speed finite under sustained climb and boost', () => {
    const s = new Simulation();
    s.start();
    for (let i = 0; i < 180; i++) s.step(1 / 60, { ...NEUTRAL, pitch: 1, boost: true });
    expect(s.player.pos.y).toBeLessThanOrEqual(96);
    expect(s.player.speed).toBeLessThanOrEqual(110);
    expect(Number.isFinite(s.player.pos.z)).toBe(true);
  });
});
