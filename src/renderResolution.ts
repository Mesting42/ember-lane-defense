export type RenderQuality = 'standard' | 'high'

// Keep game coordinates at 1000 x 600 while matching the physical display pixels.
export function getBattleResolution(cssWidth: number, devicePixelRatio: number, quality: RenderQuality) {
  const width = Number.isFinite(cssWidth) && cssWidth > 0 ? cssWidth : 1000
  const dpr = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1
  const density = quality === 'high' ? Math.max(1.5, Math.min(3, dpr)) : Math.min(1, dpr)
  const limit = quality === 'high' ? 4096 : 1600
  const pixels = Math.max(1, Math.round(Math.min(limit, width * density)))
  return { width: pixels, height: Math.max(1, Math.round(pixels * 0.6)) }
}
