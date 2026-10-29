import { describe, expect, test } from 'vitest'
import { createRoundState } from './roundState'

describe('createRoundState', () => {
  test('creates serializable state for a fresh round', () => {
    expect(createRoundState()).toEqual({ journey: 0 })
  })
})
