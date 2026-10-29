import { describe, expect, test } from 'vitest'
import seedrandom from 'seedrandom'
import { PinballConfig } from '../config/config'
import { createGame } from './game'

describe('createGame', () => {
  test('generates a deterministic path that crosses at least two bumpers', () => {
    let config = { size: 4, bumperCount: 5 } as PinballConfig
    let game = createGame(config, seedrandom('fixed-seed'), false)
    let bumperCount = game.trail.filter((mark) => mark.in !== mark.out).length

    expect(bumperCount).toBeGreaterThanOrEqual(2)
    expect(game.phase).toBe('initial')
  })
})
