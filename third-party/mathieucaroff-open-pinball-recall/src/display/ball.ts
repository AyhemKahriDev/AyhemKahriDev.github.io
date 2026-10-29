import * as pixi from 'pixi.js'
import { PinballConfig } from '../config/config'
import { LayoutInfo } from './layout'

export function drawBall(config: PinballConfig, layout: LayoutInfo, stand: Game) {
  let g = new pixi.Graphics()
  g.circle(0, 0, layout.ballRadius)
    .fill(config.ballColor)
    .stroke({ color: 0xffffff, width: layout.ballStrokeWidth })
  return g
}
