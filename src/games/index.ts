import type { GameSpec } from '../engine/types';
import { wordSearch } from './wordsearch';
import { merge } from './merge';
import { snake } from './snake';
import { memory } from './memory';
import { sudoku } from './sudoku';
import { minesweeper } from './minesweeper';
import { breakout } from './breakout';
import { lightsout } from './lightsout';
import { simon } from './simon';
import { typing } from './typing';

export const gameSpecs: GameSpec[] = [
  wordSearch,
  merge,
  snake,
  memory,
  sudoku,
  minesweeper,
  breakout,
  lightsout,
  simon,
  typing,
];

const byId = new Map(gameSpecs.map((g) => [g.id, g]));

export function getGame(id: string): GameSpec | undefined {
  return byId.get(id);
}

export function listGames(): GameSpec[] {
  return gameSpecs;
}
