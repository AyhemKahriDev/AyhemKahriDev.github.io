import { describe, expect, test } from 'vitest'
import { getConfig } from './config'

let locationWithHash = (hash: string) => ({ hash }) as Location

describe('getConfig', () => {
  test('uses defaults when no hash values are provided', () => {
    let config = getConfig(locationWithHash(''))

    expect(config.practiceMode).toBe(false)
    expect(config.successCount).toBe(0)
    expect(config.failureCount).toBe(0)
    expect(config.pauseAfterSuccess).toBe(false)
    expect(config.pauseAfterFailure).toBe(true)
  })

  test('parses typed hash values and ignores unknown or invalid entries', () => {
    let config = getConfig(
      locationWithHash(
        '#ballSpeed=200#practiceMode#successCount=9#failureCount=2#pauseAfterSuccess=true#pauseAfterFailure=false#unknown=42#remaining=oops',
      ),
    )

    expect(config.ballSpeed).toBe(200)
    expect(config.practiceMode).toBe(true)
    expect(config.successCount).toBe(9)
    expect(config.failureCount).toBe(2)
    expect(config.pauseAfterSuccess).toBe(true)
    expect(config.pauseAfterFailure).toBe(false)
    expect(config.remaining).toBe(7)
    expect('unknown' in config).toBe(false)
  })
})
