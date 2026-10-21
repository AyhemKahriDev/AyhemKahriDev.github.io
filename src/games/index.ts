import type { GameSpec } from '../engine/types';
import { wordSearch } from './wordsearch';
import { merge } from './merge';
import { snake } from './snake';
import { memory } from './memory';

export const gameSpecs: GameSpec[] = [wordSearch, merge, snake, memory];

const byId = new Map(gameSpecs.map((g) => [g.id, g]));

export function getGame(id: string): GameSpec | undefined {
  return byId.get(id);
}

export function listGames(): GameSpec[] {
  return gameSpecs;
}
