import atlas from './generated/tower-atlas.json'
import type { TowerKind } from './engine'

export const TOWER_ATLAS = atlas
const DRAW_SCALE = atlas.worldSize / atlas.cell
const TAU = Math.PI * 2

export function towerAngleToFrame(angle: number): number {
  return Math.round(((angle % TAU + TAU) % TAU) / TAU * atlas.frames) % atlas.frames
}

export function towerGround(pad: { x: number; y: number; high: boolean }) {
  return { x: pad.x, y: pad.y - (pad.high ? 9 : 5) }
}

function atlasToWorld(point: number[], pad: { x: number; y: number; high: boolean }) {
  const ground = towerGround(pad)
  return {
    x: ground.x + (point[0] - atlas.anchor[0]) * DRAW_SCALE,
    y: ground.y + (point[1] - atlas.anchor[1]) * DRAW_SCALE,
  }
}

export function towerAimOrigin(type: TowerKind, pad: { x: number; y: number; high: boolean }) {
  return atlasToWorld(atlas.towers[type].aimOrigin, pad)
}

export function towerMuzzle(type: TowerKind, pad: { x: number; y: number; high: boolean }, frame: number, shotIndex = 0) {
  const points = atlas.towers[type].muzzles[frame]
  return atlasToWorld(points[shotIndex % points.length], pad)
}
