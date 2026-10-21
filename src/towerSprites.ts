import type { TowerKind } from './engine'
import type { RenderQuality } from './renderResolution'
import { TOWER_ATLAS, towerGround } from './towerGeometry'

type SpritePair = { base: HTMLImageElement; head: HTMLImageElement; ready: boolean; cell: number }
const sprites = new Map<string, SpritePair>()
const loading = new Map<RenderQuality, Promise<void>>()

export function preloadTowerSprites(quality: RenderQuality = 'high'): Promise<void> {
  const pending = loading.get(quality)
  if (pending) return pending
  const suffix = quality === 'high' ? '-hd' : ''
  const promise = Promise.all((Object.keys(TOWER_ATLAS.towers) as TowerKind[]).map(async type => {
    const base = new Image()
    const head = new Image()
    const pair = { base, head, ready: false, cell: quality === 'high' ? 384 : 192 }
    sprites.set(`${type}:${quality}`, pair)
    const load = (image: HTMLImageElement, url: string) => new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error(`Unable to load tower sprite: ${url}`))
      image.src = url
    })
    try {
      await Promise.all([load(base, `/assets/towers/${type}-base${suffix}.png`), load(head, `/assets/towers/${type}-head${suffix}.webp`)])
      pair.ready = true
    } catch {
      // The procedural silhouette remains available if an image cannot load.
      pair.ready = false
    }
  })).then(() => undefined)
  loading.set(quality, promise)
  return promise
}

export function drawTowerSprite(
  ctx: CanvasRenderingContext2D,
  type: TowerKind,
  pad: { x: number; y: number; high: boolean },
  frame: number,
  active: boolean,
  damaged: boolean,
  recoil: number,
  quality: RenderQuality = 'high',
): boolean {
  const desired = sprites.get(`${type}:${quality}`)
  const pair = desired?.ready ? desired : sprites.get(`${type}:${quality === 'high' ? 'standard' : 'high'}`)
  if (!pair?.ready) return false
  const { cell, worldSize, columns, anchor } = TOWER_ATLAS
  const scale = worldSize / cell
  const ground = towerGround(pad)
  const x = ground.x - anchor[0] * scale
  const y = ground.y - anchor[1] * scale
  ctx.save()
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  if (!active) ctx.filter = damaged ? 'grayscale(1) brightness(0.45)' : 'saturate(0.25) brightness(0.65)'
  ctx.drawImage(pair.base, x, y, worldSize, worldSize)
  const angle = frame / TOWER_ATLAS.frames * Math.PI * 2
  ctx.drawImage(pair.head, frame % columns * pair.cell, Math.floor(frame / columns) * pair.cell, pair.cell, pair.cell, x - Math.cos(angle) * recoil, y - Math.sin(angle) * recoil, worldSize, worldSize)
  ctx.restore()
  return true
}
