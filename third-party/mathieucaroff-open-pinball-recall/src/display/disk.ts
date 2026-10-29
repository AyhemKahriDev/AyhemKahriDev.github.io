import * as pixi from 'pixi.js'

export let drawDisk = (color: number, radius: number, strokeWidth = 0) => {
  let disk = new pixi.Graphics()
  disk.circle(0, 0, radius).fill(color).stroke({ width: strokeWidth, color: 0xffffff })
  return disk
}
