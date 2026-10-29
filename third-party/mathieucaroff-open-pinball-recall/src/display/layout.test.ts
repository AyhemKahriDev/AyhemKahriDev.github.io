import { describe, expect, test } from 'vitest'
import { PinballConfig } from '../config/config'
import { getLayout } from './layout'

let config = { size: 4 } as PinballConfig

function layoutFor(width: number, height: number, devicePixelRatio = 1) {
  let window = { devicePixelRatio } as Window
  let canvas = { clientWidth: width, clientHeight: height } as HTMLCanvasElement
  return getLayout(window, canvas, config)
}

describe('getLayout', () => {
  test('caps the board at 720 CSS pixels on large screens', () => {
    expect(layoutFor(2000, 1200, 2).boardSize).toBe(720)
  })

  test('uses 82 percent of the narrowest viewport edge on small screens', () => {
    expect(layoutFor(320, 640).boardSize).toBe(258)
  })
})
