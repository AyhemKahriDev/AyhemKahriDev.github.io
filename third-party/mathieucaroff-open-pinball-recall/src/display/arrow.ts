import * as pixi from 'pixi.js'
import { trigonometricRotationFromDirection } from '../util'

export function drawStartArrow(color: number, strokeWidth: number, side: number, start: Start) {
  // draw an arrow at the start
  let arrow = new pixi.Graphics()
  drawTriangle(arrow, side * 0.7, side * 0.45)
  arrow.fill(color).stroke({
    color: 0xffffff,
    width: strokeWidth,
  })
  arrow.x = (start.x + 0.5) * side
  arrow.y = (start.y + 0.5) * side
  arrow.rotation = trigonometricRotationFromDirection(start.direction)

  return arrow
}

export function drawTriangle(triangle: pixi.Graphics, width: number, height: number) {
  // draw triangle
  triangle.poly([0, 0, width / 2, 0, 0, height, -width / 2, 0])
}
