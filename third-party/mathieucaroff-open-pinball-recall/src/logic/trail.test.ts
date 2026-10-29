import { describe, expect, test } from 'vitest'
import { createTrail } from './trail'

describe('createTrail', () => {
  test('follows a bumper reflection to the correct exit', () => {
    let grid: Grid = [
      ['diagonalUp', 'empty'],
      ['empty', 'empty'],
    ]
    let start: Start = { x: 0, y: 1, direction: 'right' }
    let bumperCounter = { count: 0 }

    let trail = createTrail({ size: 2 }, start, grid, bumperCounter)

    expect(trail).toEqual([
      { x: 1, y: 1, in: 'left', out: 'up', revealed: false },
      { x: 1, y: 0, in: 'down', out: 'up', revealed: false },
    ])
    expect(bumperCounter.count).toBe(1)
  })
})
