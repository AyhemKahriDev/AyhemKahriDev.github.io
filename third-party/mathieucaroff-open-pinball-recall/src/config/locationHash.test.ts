import { describe, expect, test } from 'vitest'
import { startNewSession, updateConfigHash } from './locationHash'

let locationWithHash = (hash: string) => {
  let currentHash = hash
  return {
    get hash() {
      return currentHash
    },
    set hash(value: string) {
      currentHash = value.startsWith('#') ? value : `#${value}`
    },
  } as Location
}

describe('updateConfigHash', () => {
  test('combines difficulty updates and serializes enabled boolean options', () => {
    let location = locationWithHash('#difficulty=4:5#seed=old#pauseAfterFailure')

    updateConfigHash(location, {
      size: 6,
      bumperCount: 12,
      seed: 'new',
      pauseAfterSuccess: true,
      pauseAfterFailure: false,
    })

    expect(location.hash).toBe('#difficulty=6:12#seed=new#pauseAfterSuccess')
  })

  test('writes normal-game progress for a new session', () => {
    let location = locationWithHash('#difficulty=4:5#remaining=0#score=240')

    updateConfigHash(location, { remaining: 7, score: 0, seed: 'new' })

    expect(location.hash).toBe('#difficulty=4:5#remaining=7#score=0#seed=new')
  })

  test('writes the final round score before showing the score phase', () => {
    let location = locationWithHash('#difficulty=4:5#remaining=1#score=0')

    updateConfigHash(location, { remaining: 0, score: 240 })

    expect(location.hash).toBe('#difficulty=4:5#remaining=0#score=240')
  })
})

describe('startNewSession', () => {
  test('preserves settings while clearing prior progress and practice counters', () => {
    let location = locationWithHash(
      '#difficulty=4:5#roundCount=7#remaining=3#score=240#practiceMode#successCount=8#failureCount=2',
    )

    startNewSession(location, { ballSpeed: 200, practiceMode: false })

    expect(location.hash).toBe('#difficulty=4:5#roundCount=7#ballSpeed=200')
  })
})
