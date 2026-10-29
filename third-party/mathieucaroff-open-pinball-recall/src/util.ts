import { PRNG } from 'seedrandom'

export let randomPick = <T>(random: PRNG, array: T[]) => {
  return array[Math.floor(random() * array.length)]
}

export let trigonometricRotationFromDirection = (d: Direction): number => {
  return {
    up: Math.PI,
    down: 0,
    left: Math.PI / 2,
    right: -Math.PI / 2,
  }[d]
}

let diagonalDownTurns: Record<Direction, Direction> = {
  up: 'right',
  down: 'left',
  left: 'down',
  right: 'up',
}

let diagonalUpTurns: Record<Direction, Direction> = {
  up: 'left',
  down: 'right',
  left: 'up',
  right: 'down',
}

let oppositeDirections: Record<Direction, Direction> = {
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left',
}

// Diagonal down bumper: `\`
export let diagonalDownTurn = (d: Direction): Direction => {
  return diagonalDownTurns[d]
}

// Diagonal up bumper: `/`
export let diagonalUpTurn = (d: Direction): Direction => {
  return diagonalUpTurns[d]
}

// Diagonal up bumper: `/`
export let opposite = (d: Direction): Direction => {
  return oppositeDirections[d]
}

export let bumperTurn = (b: GridDirection, d: Direction): Direction => {
  if (b === 'empty') {
    return opposite(d)
  } else if (b === 'diagonalDown') {
    return diagonalDownTurn(d)
  } else {
    return diagonalUpTurn(d)
  }
}

export let moveFromDirection = (d: Direction): Position => {
  return {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 },
  }[d]
}
