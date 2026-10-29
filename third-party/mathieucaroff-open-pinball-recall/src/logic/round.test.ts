import { describe, expect, test } from 'vitest'
import { resolveRound } from './round'

describe('resolveRound', () => {
  test('increases score and bumpers after a victory', () => {
    expect(
      resolveRound({ size: 4, bumperCount: 5, remaining: 1, score: 0, practiceMode: false }, true),
    ).toEqual({ size: 4, bumperCount: 6, remaining: 0, score: 240, isGameOver: true })
  })

  test('reduces difficulty after a failure and preserves the minimum bumper count', () => {
    expect(
      resolveRound(
        { size: 4, bumperCount: 2, remaining: 0, score: 100, practiceMode: false },
        false,
      ),
    ).toEqual({ size: 3, bumperCount: 2, remaining: -1, score: 100, isGameOver: true })
  })

  test('keeps the selected difficulty fixed in practice mode', () => {
    expect(
      resolveRound({ size: 5, bumperCount: 6, remaining: 4, score: 100, practiceMode: true }, true),
    ).toEqual({ size: 5, bumperCount: 6, remaining: 3, score: 400, isGameOver: false })

    expect(
      resolveRound(
        { size: 5, bumperCount: 6, remaining: 4, score: 100, practiceMode: true },
        false,
      ),
    ).toEqual({ size: 5, bumperCount: 6, remaining: 3, score: 100, isGameOver: false })
  })
})
