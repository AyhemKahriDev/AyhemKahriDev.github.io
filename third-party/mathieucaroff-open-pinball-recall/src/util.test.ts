import { describe, expect, test } from 'vitest'
import { bumperTurn, moveFromDirection, opposite } from './util'

describe('direction helpers', () => {
  test('reflects directions for both bumper orientations', () => {
    expect(bumperTurn('diagonalDown', 'up')).toBe('right')
    expect(bumperTurn('diagonalDown', 'down')).toBe('left')
    expect(bumperTurn('diagonalDown', 'left')).toBe('down')
    expect(bumperTurn('diagonalDown', 'right')).toBe('up')
    expect(bumperTurn('diagonalUp', 'up')).toBe('left')
    expect(bumperTurn('diagonalUp', 'down')).toBe('right')
    expect(bumperTurn('diagonalUp', 'left')).toBe('up')
    expect(bumperTurn('diagonalUp', 'right')).toBe('down')
  })

  test('returns opposite directions and movement vectors', () => {
    expect(opposite('up')).toBe('down')
    expect(opposite('left')).toBe('right')
    expect(moveFromDirection('up')).toEqual({ x: 0, y: -1 })
    expect(moveFromDirection('right')).toEqual({ x: 1, y: 0 })
  })
})
