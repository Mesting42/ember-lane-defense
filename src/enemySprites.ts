import type { EnemyKind } from './engine'
import type { RenderQuality } from './renderResolution'
import atlas from './generated/enemy-atlas.json'

const sprites = new Map<string, { image: HTMLImageElement; ready: boolean; cell: number }>()
const loading = new Map<RenderQuality, Promise<void>>()

export function preloadEnemySprites(quality: RenderQuality = 'high'): Promise<void> {
  const pending = loading.get(quality)
  if (pending) return pending
  const suffix = quality === 'high' ? '-hd' : ''
  const promise = Promise.all((Object.keys(atlas.enemies) as EnemyKind[]).map(type => new Promise<void>(resolve => {
    const image = new Image(), entry = { image, ready: false, cell: quality === 'high' ? 384 : atlas.cell }
    sprites.set(`${type}:${quality}`, entry)
    image.onload = () => { entry.ready = true; resolve() }
    image.onerror = () => resolve()
    image.src = `/assets/enemies/${type}${suffix}.webp`
  }))).then(() => undefined)
  loading.set(quality, promise)
  return promise
}

export function drawEnemySprite(ctx: CanvasRenderingContext2D, type: EnemyKind, x: number, y: number, angle: number, time: number, detailed: boolean, quality: RenderQuality = 'high'): boolean {
  const desired = sprites.get(`${type}:${quality}`)
  const entry = desired?.ready ? desired : sprites.get(`${type}:${quality === 'high' ? 'standard' : 'high'}`)
  if (!entry?.ready) return false
  const { columns, frames } = atlas
  const cell = entry.cell
  const size = atlas.enemies[type].size
  const frame = Math.round(((angle % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2)) / (Math.PI * 2) * frames) % frames
  const color = type === 'jammer' ? '#d18fe2' : type === 'jumper' ? '#ae92ee' : '#ef9c66'
  ctx.save()
  ctx.translate(x, y); ctx.rotate(angle)
  ctx.fillStyle = color; ctx.globalAlpha = 0.7
  ctx.shadowColor = color; ctx.shadowBlur = detailed ? 12 : 0
  const engine = size * 0.19, flicker = detailed ? Math.sin(time * 18 + x) * 3 : 0
  ctx.beginPath(); ctx.moveTo(-engine, -size * 0.045); ctx.lineTo(-engine - 12 - flicker, 0); ctx.lineTo(-engine, size * 0.045); ctx.closePath(); ctx.fill()
  ctx.restore()
  ctx.save()
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(entry.image, frame % columns * cell, Math.floor(frame / columns) * cell, cell, cell, x - size / 2, y - size / 2, size, size)
  ctx.restore()
  return true
}
