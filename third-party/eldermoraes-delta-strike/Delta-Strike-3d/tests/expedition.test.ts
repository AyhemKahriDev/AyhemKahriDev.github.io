import { describe, expect, it } from 'vitest';
import { Simulation, NEUTRAL } from '../src/core/simulation';
import {
  channelAt,
  islandAt,
  groundHeight,
  sectorEntities,
  SECTOR_LENGTH,
  MAX_SCORE,
  difficultyAt,
} from '../src/core/world';
describe('long river expedition', () => {
  it('has real raised islands with two navigable channels', () => {
    const d = 850,
      island = islandAt(d)!;
    expect(island).not.toBeNull();
    const channels = channelAt(d);
    expect(channels).toHaveLength(2);
    expect(groundHeight(island.center, d)).toBeGreaterThan(30);
    for (const channel of channels) {
      expect(channel.right - channel.left).toBeGreaterThan(30);
      expect(groundHeight((channel.left + channel.right) / 2, d)).toBe(0);
    }
  });
  it('does not spawn boats or fuel on the new islands', () => {
    for (const sector of [0, 1, 2, 10, 50, 300])
      for (const e of sectorEntities(sector, 42))
        if (e.kind === 'boat' || e.kind === 'fuel') expect(groundHeight(e.pos.x, -e.pos.z)).toBe(0);
  });
  it('keeps generation and difficulty bounded far beyond the old ending', () => {
    for (const sector of [0, 3, 20, 100, 500]) {
      const entities = sectorEntities(sector, 42);
      expect(entities.length).toBeLessThan(40);
      expect(entities.every((e) => Number.isFinite(e.pos.x) && Number.isFinite(e.pos.z))).toBe(
        true,
      );
      expect(difficultyAt(sector)).toBeLessThanOrEqual(1);
    }
  });
  it('continues into bridge four instead of finishing after bridge three', () => {
    const s = new Simulation();
    s.start();
    s.sector = 2;
    s.bridgeDestroyed = true;
    s.entities = [];
    s.player.pos = { x: 0, y: 90, z: -SECTOR_LENGTH * 3 + 0.1 };
    s.step(1 / 60, NEUTRAL);
    expect(s.phase).toBe('playing');
    expect(s.sector).toBe(3);
  });
  it('finishes at one million points and caps the scoreboard', () => {
    const s = new Simulation();
    s.start();
    s.score = MAX_SCORE - 50;
    s.awardScore(100);
    expect(s.score).toBe(MAX_SCORE);
    expect(s.phase).toBe('won');
  });
  it('awards an extra aircraft at each 10,000 without retry farming', () => {
    const s = new Simulation();
    s.start();
    s.awardScore(10000);
    expect(s.player.lives).toBe(4);
    s.damagePlayer(200);
    s.retry();
    s.awardScore(10000);
    expect(s.player.lives).toBe(3);
  });
  it('moves crossing jets rapidly across the river without forward drift', () => {
    const s = new Simulation();
    s.start();
    const jet = s.entities.find((e) => e.kind === 'jet')!;
    s.player.pos = { x: 0, y: 85, z: jet.pos.z + 140 };
    for (let i = 0; i < 120 && !jet.crossing; i++) s.step(1 / 60, NEUTRAL);
    expect(jet.crossing).toBe(true);
    const before = { ...jet.pos };
    for (let i = 0; i < 60; i++) s.step(1 / 60, NEUTRAL);
    expect(Math.abs(jet.pos.x - before.x)).toBeGreaterThan(100);
    expect(jet.pos.z).toBe(before.z);
  });
  it('round-trips a valid checkpoint and rejects corrupt saves', () => {
    const a = new Simulation();
    a.start();
    const saved = a.checkpoint()!;
    const b = new Simulation();
    expect(b.restore(saved)).toBe(true);
    expect(b.player.fuel).toBe(saved.fuel);
    expect(b.score).toBe(saved.score);
    expect(b.restore({ ...saved, sector: -1 })).toBe(false);
    expect(b.restore({ ...saved, fuel: Infinity })).toBe(false);
    expect(b.restore({ ...saved, lives: 0 })).toBe(false);
  });
  it('carries fuel and hull damage into the next checkpoint', () => {
    const s = new Simulation();
    s.start();
    s.player.fuel = 52;
    s.player.health = 67;
    s.bridgeDestroyed = true;
    s.entities = [];
    s.player.pos = { x: 0, y: 80, z: -SECTOR_LENGTH + 0.1 };
    s.step(1 / 60, NEUTRAL);
    expect(s.player.fuel).toBeLessThan(52);
    expect(s.player.health).toBe(67);
    expect(s.checkpoint()?.fuel).toBe(s.player.fuel);
  });
  it('reload after a crash gives the same replacement aircraft as retry', () => {
    const s = new Simulation();
    s.start();
    const save = s.checkpoint()!;
    s.restore({ ...save, sector: 3, fuel: 5, health: 10, missiles: 0 });
    s.damagePlayer(200);
    const crashedSave = s.checkpoint();
    s.retry();
    const reloaded = new Simulation();
    expect(reloaded.restore(crashedSave)).toBe(true);
    expect({
      fuel: reloaded.player.fuel,
      health: reloaded.player.health,
      missiles: reloaded.player.missiles,
      lives: reloaded.player.lives,
    }).toEqual({
      fuel: s.player.fuel,
      health: s.player.health,
      missiles: s.player.missiles,
      lives: s.player.lives,
    });
  });
});
