import { useEffect, useRef, useState } from 'react'
import type { PointerEvent } from 'react'
import type { Battle, Enemy, Projectile, RunState, Structure, TowerKind } from './engine'
import { getEnemyPosition, getTowerStats, getTowerTargets, getTowerStatus, TOWER_SPECS } from './engine'
import { towerAimOrigin, towerAngleToFrame, towerGround, towerMuzzle } from './towerGeometry'
import { drawTowerSprite, preloadTowerSprites } from './towerSprites'
import { drawEnemySprite, preloadEnemySprites } from './enemySprites'
import { getBattleResolution } from './renderResolution'

interface Props {
  run: RunState
  revision: number
  buildType: TowerKind | null
  selectedId: string | null
  targetSkill: boolean
  effects: boolean
  quality: 'standard' | 'high'
  onPad: (slot: number) => void
  onSelect: (id: string) => void
  onMiss: () => void
  onTarget: (x: number, y: number) => void
  training?: { slot?: number; label: string }
}

const W = 1000
const H = 600

export default function Battlefield(props: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const latest = useRef(props)
  const [hover, setHover] = useState<{ x: number; y: number; slot: number | null } | null>(null)
  const hoverRef = useRef(hover)
  hoverRef.current = hover
  latest.current = props

  useEffect(() => {
    void preloadTowerSprites(props.quality)
    void preloadEnemySprites(props.quality)
  }, [props.quality])

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    let frame = 0
    let raf = 0
    let lastQuality = latest.current.quality
    let lastDpr = window.devicePixelRatio || 1
    let labelScale = 1
    const resize = () => {
      lastQuality = latest.current.quality
      lastDpr = window.devicePixelRatio || 1
      const cssWidth = canvas.getBoundingClientRect().width
      labelScale = Math.min(4, Math.max(1, W / Math.max(1, cssWidth)))
      const size = getBattleResolution(cssWidth, lastDpr, lastQuality)
      if (canvas.width !== size.width || canvas.height !== size.height) { canvas.width = size.width; canvas.height = size.height }
      ctx.setTransform(size.width / W, 0, 0, size.height / H, 0, 0)
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = lastQuality === 'high' ? 'high' : 'low'
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(canvas)
    window.addEventListener('resize', resize)
    const draw = (time: number) => {
      frame = time
      const p = latest.current
      if (p.quality !== lastQuality || (window.devicePixelRatio || 1) !== lastDpr) resize()
      if (p.run.battle) renderBattle(ctx, p, p.effects ? time : 0, hoverRef.current, labelScale)
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => { cancelAnimationFrame(raf); observer.disconnect(); window.removeEventListener('resize', resize); void frame }
  }, [])

  const toWorld = (event: PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    return { x: ((event.clientX - rect.left) / rect.width) * W, y: ((event.clientY - rect.top) / rect.height) * H }
  }

  const nearestSlot = (x: number, y: number, b: Battle, radius = 35) => {
    let best = -1
    let distance = radius
    b.pads.forEach((pad, i) => {
      const d = Math.hypot(x - pad.x, y - pad.y)
      if (d < distance) { distance = d; best = i }
    })
    return best >= 0 ? best : null
  }

  const handleMove = (event: PointerEvent<HTMLCanvasElement>) => {
    const p = latest.current
    if (!p.run.battle) return
    const pos = toWorld(event)
    setHover({ ...pos, slot: nearestSlot(pos.x, pos.y, p.run.battle) })
  }

  const handleLeave = () => setHover(null)

  const handleDown = (event: PointerEvent<HTMLCanvasElement>) => {
    const p = latest.current
    const b = p.run.battle
    if (!b) return
    const pos = toWorld(event)
    if (p.targetSkill) { p.onTarget(pos.x, pos.y); return }
    const touchRadius = event.pointerType === 'touch' ? Math.max(35, 22 * W / event.currentTarget.getBoundingClientRect().width) : 35
    const slot = nearestSlot(pos.x, pos.y, b, touchRadius)
    if (p.buildType && slot !== null) { p.onPad(slot); return }
    if (slot !== null) {
      const tower = b.structures.find(s => s.slot === slot)
      if (tower) { p.onSelect(tower.id); return }
    }
    p.onMiss()
  }

  return (
    <canvas
      ref={canvasRef}
      className={`battle-canvas${props.targetSkill ? ' targeting' : props.buildType ? ' placing' : ''}`}
      aria-label="战场沙盘，可点击空置平台部署设施，点击已部署设施查看详情"
      onPointerMove={handleMove}
      onPointerLeave={handleLeave}
      onPointerDown={handleDown}
    />
  )
}

function renderBattle(ctx: CanvasRenderingContext2D, props: Props, time: number, hover: { x: number; y: number; slot: number | null } | null, labelScale = 1) {
  const run = props.run
  const b = run.battle!
  const pulse = time * 0.001
  ctx.clearRect(0, 0, W, H)
  const base = ctx.createLinearGradient(0, 0, W, H)
  base.addColorStop(0, '#16262e')
  base.addColorStop(0.56, '#0d1b23')
  base.addColorStop(1, '#10171e')
  ctx.fillStyle = base
  ctx.fillRect(0, 0, W, H)
  drawBackdrop(ctx, b.zone, pulse, props.quality)
  drawTerrain(ctx, b.zone, pulse)
  drawPath(ctx, b, pulse)
  drawDocks(ctx, b, pulse)
  drawCore(ctx, b, run, pulse)
  drawPads(ctx, b, pulse, props, hover)

  if (props.selectedId) {
    const selected = b.structures.find(s => s.id === props.selectedId)
    if (selected) drawRange(ctx, b.pads[selected.slot], getTowerStats(selected, run).range, TOWER_SPECS[selected.type].color, false)
  } else if (props.buildType && hover?.slot !== null && hover?.slot !== undefined) {
    drawRange(ctx, b.pads[hover.slot], TOWER_SPECS[props.buildType].range, TOWER_SPECS[props.buildType].color, true)
  }

  for (const tower of [...b.structures].sort((a, z) => b.pads[a.slot].y - b.pads[z.slot].y)) drawStructure(ctx, run, b, tower, pulse, props.selectedId === tower.id, props.quality, labelScale)
  for (const enemy of b.enemies.filter(e => e.hp > 0)) drawEnemy(ctx, b, enemy, pulse, props.effects, props.quality)
  for (const projectile of b.projectiles) drawProjectile(ctx, projectile, props.effects)
  for (const effect of b.effects) drawEffect(ctx, effect, pulse, props.effects)
  if (b.bossWarning) {
    ctx.save()
    ctx.strokeStyle = 'rgba(239,112,101,.78)'
    ctx.lineWidth = 2
    ctx.setLineDash([8, 7])
    ctx.beginPath(); ctx.arc(b.bossWarning.x, b.bossWarning.y, b.bossWarning.kind === 'sweep' ? 155 : 105, 0, Math.PI * 2); ctx.stroke()
    ctx.setLineDash([])
    ctx.restore()
  }
  drawBoardLabels(ctx, b, run)
  if (props.training?.slot !== undefined) {
    const pad = b.pads[props.training.slot]
    if (pad) {
      ctx.save(); ctx.strokeStyle = '#f6cf87'; ctx.fillStyle = '#ebbb6522'; ctx.lineWidth = 2.5; ctx.setLineDash([5, 4])
      ctx.beginPath(); ctx.ellipse(pad.x, pad.y, 38, 28, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.setLineDash([])
      ctx.fillStyle = '#efca8e'; ctx.font = 'bold 13px "Microsoft YaHei", sans-serif'; ctx.textAlign = 'center'; ctx.fillText(props.training.label, pad.x, pad.y - 48)
      ctx.beginPath(); ctx.moveTo(pad.x, pad.y - 40); ctx.lineTo(pad.x - 5, pad.y - 33); ctx.lineTo(pad.x + 5, pad.y - 33); ctx.closePath(); ctx.fill(); ctx.restore()
    }
  }
}

function drawBackdrop(ctx: CanvasRenderingContext2D, zone: number, time: number, quality: 'standard' | 'high') {
  const seed = [0x18ac, 0x9d13, 0x4f21][zone]
  for (let i = 0; i < (quality === 'high' ? 82 : 38); i += 1) {
    const n = (i * 374761393 + seed) >>> 0
    const x = (n % 1000)
    const y = ((Math.imul(n ^ (n >>> 13), 1274126177) >>> 0) % 600)
    const alpha = 0.18 + ((i % 9) / 32)
    ctx.fillStyle = `rgba(193,213,211,${alpha})`
    const s = i % 13 === 0 ? 1.7 : 1
    ctx.fillRect(x, y, s, s)
  }
  const planets = [
    { x: 784, y: 75, r: 178, color: '#718b8c' },
    { x: 675, y: 140, r: 205, color: '#b1715d' },
    { x: 810, y: 112, r: 155, color: '#647f86' },
  ]
  const planet = planets[zone]
  const gradient = ctx.createRadialGradient(planet.x - planet.r * 0.42, planet.y - planet.r * 0.5, 5, planet.x, planet.y, planet.r)
  gradient.addColorStop(0, `${planet.color}78`)
  gradient.addColorStop(0.62, `${planet.color}35`)
  gradient.addColorStop(1, `${planet.color}00`)
  ctx.fillStyle = gradient
  ctx.beginPath(); ctx.arc(planet.x, planet.y, planet.r, 0, Math.PI * 2); ctx.fill()
  ctx.save()
  ctx.beginPath(); ctx.arc(planet.x, planet.y, planet.r * 0.7, Math.PI * 1.02, Math.PI * 1.82); ctx.strokeStyle = `rgba(192,208,193,${0.11 + Math.sin(time) * 0.025})`; ctx.lineWidth = 2; ctx.stroke()
  ctx.restore()
  const haze = ctx.createLinearGradient(0, 0, 0, H)
  haze.addColorStop(0, 'rgba(105,150,151,.05)')
  haze.addColorStop(0.5, 'rgba(105,150,151,0)')
  haze.addColorStop(1, 'rgba(239,172,113,.025)')
  ctx.fillStyle = haze; ctx.fillRect(0, 0, W, H)
}

function drawTerrain(ctx: CanvasRenderingContext2D, zone: number, time: number) {
  if (zone === 0) {
    for (let i = 0; i < 6; i += 1) {
      ctx.save()
      ctx.translate(120 + i * 147, 90 + (i % 2) * 340)
      ctx.rotate(-0.4 + i * 0.13)
      ctx.fillStyle = 'rgba(126,163,168,.055)'
      ctx.strokeStyle = 'rgba(174,201,194,.12)'
      ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(-48, -18); ctx.lineTo(15, -30); ctx.lineTo(64, -5); ctx.lineTo(39, 24); ctx.lineTo(-26, 30); ctx.closePath(); ctx.fill(); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(-24, -8); ctx.lineTo(21, 8); ctx.lineTo(43, 3); ctx.stroke()
      ctx.restore()
    }
  } else if (zone === 1) {
    for (let x = 360; x < 780; x += 105) {
      const y = 278 + Math.sin(x * 0.017) * 34
      ctx.fillStyle = 'rgba(108,130,128,.12)'
      ctx.strokeStyle = 'rgba(179,177,146,.16)'
      ctx.beginPath(); ctx.moveTo(x, y - 28); ctx.lineTo(x + 57, y - 18); ctx.lineTo(x + 48, y + 24); ctx.lineTo(x - 10, y + 20); ctx.closePath(); ctx.fill(); ctx.stroke()
      ctx.fillStyle = '#df9b63'
      ctx.fillRect(x + 18, y - 2, 5, 14)
    }
  } else {
    for (let i = 0; i < 8; i += 1) {
      const x = 115 + i * 128
      const y = 280 + Math.sin(time * 0.22 + i) * 4
      ctx.strokeStyle = 'rgba(118,158,163,.17)'
      ctx.lineWidth = 1
      ctx.beginPath(); ctx.ellipse(x, y, 54, 12, -0.14, 0, Math.PI * 2); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(x - 32, y - 38); ctx.lineTo(x + 20, y + 35); ctx.stroke()
    }
  }
  ctx.strokeStyle = 'rgba(165,193,188,.045)'
  ctx.lineWidth = 1
  for (let y = 24; y < H; y += 58) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y - 4); ctx.stroke() }
}

function drawPath(ctx: CanvasRenderingContext2D, b: Battle, time: number) {
  ctx.save()
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'
  ctx.beginPath(); b.path.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))
  ctx.strokeStyle = 'rgba(4,10,15,.78)'; ctx.lineWidth = 57; ctx.stroke()
  ctx.strokeStyle = 'rgba(116,133,133,.14)'; ctx.lineWidth = 44; ctx.stroke()
  ctx.strokeStyle = 'rgba(125,159,156,.2)'; ctx.lineWidth = 30; ctx.stroke()
  ctx.setLineDash([5, 16]); ctx.lineDashOffset = -time * 25; ctx.strokeStyle = 'rgba(201,172,126,.42)'; ctx.lineWidth = 2; ctx.stroke(); ctx.setLineDash([])
  ctx.lineDashOffset = 0
  ctx.beginPath(); b.path.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))
  ctx.strokeStyle = 'rgba(120,196,190,.12)'; ctx.lineWidth = 1; ctx.stroke()
  for (let i = 1; i < b.path.length - 1; i += 1) {
    const p = b.path[i]
    ctx.fillStyle = 'rgba(210,177,130,.65)'
    ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, Math.PI * 2); ctx.fill()
  }
  ctx.restore()
}


function drawDocks(ctx: CanvasRenderingContext2D, b: Battle, time: number) {
  const start = b.path[0]
  ctx.save(); ctx.translate(44, start.y)
  ctx.fillStyle = 'rgba(209,132,88,.72)'; ctx.font = '10px Consolas, monospace'; ctx.fillText('INBOUND', -23, -47)
  ctx.strokeStyle = 'rgba(223,145,96,.55)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-15, -33); ctx.lineTo(15, -33); ctx.stroke()
  ctx.restore()
  const core = b.path[b.path.length - 1]
  ctx.save(); ctx.translate(core.x - 12, core.y)
  ctx.rotate(Math.sin(time * 0.12) * 0.02)
  ctx.fillStyle = 'rgba(3,8,12,.7)'; ctx.beginPath(); ctx.ellipse(0, 28, 69, 23, 0, 0, Math.PI * 2); ctx.fill()
  polygon(ctx, [[-49, 4], [-32, -24], [-4, -34], [27, -22], [53, 0], [36, 20], [-25, 25]], '#273c42', '#9bb9ae', 1.4)
  polygon(ctx, [[-24, -13], [-8, -27], [17, -19], [27, -4], [-3, 0]], '#496267', '#c3ccbb', 1)
  polygon(ctx, [[-4, 2], [28, -3], [43, 4], [23, 15], [-8, 13]], '#34484b', '#8db4ac', 1)
  ctx.fillStyle = '#e7a16a'; ctx.shadowColor = '#e78d5f'; ctx.shadowBlur = 15
  for (const dx of [-31, 30]) { ctx.beginPath(); ctx.ellipse(dx, 21, 4, 11 + Math.sin(time * 4 + dx) * 2, 0, 0, Math.PI * 2); ctx.fill() }
  ctx.shadowBlur = 0
  for (let i = -2; i <= 2; i += 1) { ctx.fillStyle = i === 0 ? '#d5b879' : '#819997'; ctx.fillRect(i * 10 - 2, -7, 4, 3) }
  ctx.strokeStyle = 'rgba(230,119,99,.75)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, 57 + Math.sin(time * 3) * 2, -0.7, 0.7); ctx.stroke()
  ctx.restore()
}

function drawCore(ctx: CanvasRenderingContext2D, b: Battle, run: RunState, time: number) {
  const p = b.path[b.path.length - 1]
  const coreX = p.x - 12
  const healthRatio = Math.max(0, run.core / run.maxCore)
  ctx.save()
  ctx.strokeStyle = healthRatio > 0.35 ? 'rgba(118,196,176,.42)' : 'rgba(225,119,103,.62)'
  ctx.lineWidth = 1
  ctx.setLineDash([3, 5])
  ctx.beginPath(); ctx.ellipse(coreX, p.y, 76, 46, -0.1, time * 0.16, time * 0.16 + Math.PI * 1.65); ctx.stroke()
  ctx.setLineDash([])
  if (run.coreShield > 0) {
    ctx.strokeStyle = `rgba(119,203,217,${0.42 + Math.sin(time * 3) * 0.08})`
    ctx.lineWidth = 2
    ctx.beginPath(); ctx.ellipse(coreX, p.y, 67 + Math.sin(time * 2) * 2, 38, -0.1, 0, Math.PI * 2); ctx.stroke()
  }
  ctx.fillStyle = '#aebfb2'; ctx.font = '8px Consolas, monospace'; ctx.textAlign = 'center'
  ctx.fillText('ESCORT FLEET', coreX, p.y + 51)
  ctx.fillStyle = healthRatio > 0.35 ? '#9ac8aa' : '#e68471'
  ctx.beginPath(); ctx.arc(coreX + 51, p.y - 35, 3 + Math.sin(time * 4) * 0.5, 0, Math.PI * 2); ctx.fill()
  ctx.restore()
}

function drawPads(ctx: CanvasRenderingContext2D, b: Battle, time: number, props: Props, hover: { x: number; y: number; slot: number | null } | null) {
  b.pads.forEach((pad, i) => {
    const occupied = b.structures.some(t => t.slot === i)
    const hovered = hover?.slot === i
    ctx.save(); ctx.translate(pad.x, pad.y)
    ctx.fillStyle = 'rgba(0,0,0,.32)'; ctx.beginPath(); ctx.ellipse(0, 11, 31, 15, 0, 0, Math.PI * 2); ctx.fill()
    const side = pad.high ? 3 : 0
    polygon(ctx, [[-26, -4 - side], [-14, -18 - side], [14, -18 - side], [27, -4 - side], [19, 13 - side], [-18, 13 - side]], hovered ? '#3b5555' : '#26383e', hovered ? '#d7b777' : pad.high ? '#87b4ac' : '#607572', 1.4)
    polygon(ctx, [[-17, -3 - side], [-9, -12 - side], [10, -12 - side], [18, -2 - side], [12, 7 - side], [-12, 7 - side]], occupied ? '#213136' : '#304248', hovered ? '#e5c380' : 'rgba(136,166,157,.56)', 1)
    ctx.strokeStyle = 'rgba(160,183,173,.45)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-19, 4 - side); ctx.lineTo(-12, 10 - side); ctx.lineTo(16, 10 - side); ctx.stroke()
    ctx.fillStyle = pad.high ? 'rgba(239,194,119,.75)' : 'rgba(129,174,165,.7)'
    ctx.fillRect(-3, -7 - side, 6, 2)
    if (pad.high) { ctx.strokeStyle = 'rgba(226,183,111,.35)'; ctx.beginPath(); ctx.moveTo(-19, -13); ctx.lineTo(-19, -19); ctx.moveTo(18, -13); ctx.lineTo(18, -19); ctx.stroke() }
    if (!occupied && (props.buildType || hovered)) {
      const alpha = 0.35 + Math.sin(time * 4 + i) * 0.15
      ctx.strokeStyle = `rgba(231,187,114,${alpha})`; ctx.setLineDash([3, 5]); ctx.beginPath(); ctx.arc(0, -3, 26, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([])
    }
    if (occupied) {
      ctx.fillStyle = 'rgba(202,224,215,.5)'; ctx.font = '8px Consolas, monospace'; ctx.textAlign = 'center'; ctx.fillText(`${String(i + 1).padStart(2, '0')}`, 0, 23)
    }
    ctx.restore()
  })
}

function drawRange(ctx: CanvasRenderingContext2D, p: { x: number; y: number }, range: number, color: string, preview: boolean) {
  ctx.save()
  ctx.beginPath(); ctx.arc(p.x, p.y - 8, range, 0, Math.PI * 2)
  ctx.fillStyle = `${color}0c`; ctx.fill()
  ctx.strokeStyle = `${color}8f`; ctx.lineWidth = 1.3; ctx.setLineDash(preview ? [6, 7] : [4, 5]); ctx.stroke(); ctx.setLineDash([])
  ctx.restore()
}

function drawStructure(ctx: CanvasRenderingContext2D, run: RunState, b: Battle, t: Structure, time: number, selected: boolean, quality: 'standard' | 'high' = 'high', labelScale = 1) {
  const p = b.pads[t.slot]
  const candidates = getTowerTargets(run, t)
  const target = candidates.sort((a, z) => t.targetMode === 'strong' ? (z.maxHp + z.maxShield) - (a.maxHp + a.maxShield) || z.dist - a.dist : t.targetMode === 'support' ? Number(['carrier', 'jammer', 'boss'].includes(z.kind)) - Number(['carrier', 'jammer', 'boss'].includes(a.kind)) || z.dist - a.dist : z.dist - a.dist)[0]
  const firing = b.effects.find(effect => effect.kind === 'muzzle' && effect.source === t.id)
  const pivot = towerAimOrigin(t.type, p)
  const aim = target ? Math.atan2(target.y - pivot.y, target.x - pivot.x) : -Math.PI / 4 + Math.sin(time * 0.35 + t.slot) * 0.18
  const direction = firing?.frame ?? towerAngleToFrame(aim)
  const spec = TOWER_SPECS[t.type]
  const ground = towerGround(p)
  const active = t.powered && t.jammed <= 0 && t.health > 0
  ctx.save()
  ctx.fillStyle = 'rgba(2,7,10,.55)'; ctx.beginPath(); ctx.ellipse(ground.x, ground.y + 9, 28, 17, 0, 0, Math.PI * 2); ctx.fill()
  if (selected) {
    ctx.strokeStyle = '#f1c383'; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.ellipse(ground.x, ground.y + 2, 31, 23, 0, 0, Math.PI * 2); ctx.stroke()
  }
  if (t.level > 1) {
    for (let level = 0; level < t.level; level += 1) {
      ctx.fillStyle = t.branch === 'B' ? '#b5d6dc' : '#e1b773'
      ctx.fillRect(ground.x - 7 + level * 6, ground.y + 23, 4, 2)
    }
  }
  ctx.restore()
  const recoil = firing && ['needle', 'rail', 'comet', 'cold'].includes(t.type) ? 1.6 * firing.life / firing.maxLife : 0
  const rendered = drawTowerSprite(ctx, t.type, p, direction, active, t.health <= 0, recoil, quality)
  if (!rendered) {
  ctx.save(); ctx.translate(p.x, p.y - (b.pads[t.slot].high ? 17 : 12))
  ctx.fillStyle = 'rgba(2,7,10,.55)'; ctx.beginPath(); ctx.ellipse(0, 22, 26, 10, 0, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = t.powered ? `${spec.color}26` : 'rgba(170,83,72,.14)'; ctx.beginPath(); ctx.arc(0, 0, selected ? 25 : 21, 0, Math.PI * 2); ctx.fill()
  ctx.rotate(aim)
  if (firing) ctx.translate(-4 * firing.life / firing.maxLife, 0)
  const shell = t.powered ? '#526361' : '#3e4443'
  const trim = t.powered ? spec.color : '#b67b72'
  const breathe = Math.sin(time * 2.2 + t.slot) * 0.5
  polygon(ctx, [[-20, -10], [-12, -19], [10, -18], [22, -8], [18, 12], [2, 19], [-17, 12]], shell, selected ? '#f0c47d' : '#859996', 1.5)
  polygon(ctx, [[-12, -8], [-6, -14], [8, -13], [14, -6], [10, 9], [-4, 12], [-13, 6]], '#202b2d', trim, 1)
  if (t.type === 'needle') {
    ctx.fillStyle = '#899994'; ctx.fillRect(2, -7, 25, 4); ctx.fillRect(2, 3, 22, 4)
    ctx.fillStyle = trim; ctx.fillRect(23, -8, 4, 6); ctx.fillRect(20, 2, 4, 6)
    ctx.strokeStyle = '#b6c8bc'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-5, -12); ctx.lineTo(0, -24); ctx.lineTo(8, -12); ctx.stroke()
  } else if (t.type === 'rail') {
    ctx.fillStyle = '#cad4c6'; ctx.fillRect(4, -5, 42, 9); ctx.fillStyle = '#3b5557'; ctx.fillRect(4, -2, 43, 3)
    ctx.fillStyle = '#d0b572'; ctx.fillRect(13, -9, 5, 2); ctx.fillRect(29, 5, 5, 2)
    ctx.fillStyle = '#87d6cf'; ctx.globalAlpha = 0.55 + breathe * 0.3; ctx.fillRect(38, -2, 9, 3)
  } else if (t.type === 'arc') {
    ctx.strokeStyle = trim; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(3, -1, 16, -1.2, 1.25); ctx.stroke()
    ctx.beginPath(); ctx.arc(3, -1, 10, -1.4, 1.45); ctx.stroke()
    ctx.fillStyle = '#c4e5d7'; ctx.shadowColor = trim; ctx.shadowBlur = 8 + breathe * 4; ctx.beginPath(); ctx.arc(6, -1, 4, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0
  } else if (t.type === 'comet') {
    polygon(ctx, [[1, -9], [27, -11], [38, -4], [36, 5], [13, 8], [0, 4]], '#5c6260', trim, 1)
    for (let i = 0; i < 3; i += 1) { ctx.fillStyle = i === 0 ? '#d88567' : '#b5a178'; ctx.fillRect(12 + i * 8, -6 + i % 2 * 5, 8, 4) }
    ctx.fillStyle = '#e8a36a'; ctx.shadowColor = '#e7a36a'; ctx.shadowBlur = 12; ctx.beginPath(); ctx.ellipse(-3, 0, 5, 3 + breathe * 1.2, 0, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0
  } else if (t.type === 'cold') {
    ctx.strokeStyle = trim; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(8, 0, 15, 10, 0, 0.3, 5.8); ctx.stroke()
    ctx.fillStyle = '#bdddea'; ctx.beginPath(); ctx.moveTo(2, -6); ctx.lineTo(28, -3); ctx.lineTo(31, 0); ctx.lineTo(23, 5); ctx.lineTo(2, 6); ctx.closePath(); ctx.fill()
    ctx.strokeStyle = '#f1f4e5'; ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(28, 0); ctx.stroke()
  } else if (t.type === 'drone') {
    ctx.fillStyle = '#aebd9b'; ctx.beginPath(); ctx.ellipse(7, 0, 15, 10, 0, 0, Math.PI * 2); ctx.fill()
    ctx.strokeStyle = trim; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(7, -9); ctx.lineTo(16, -19); ctx.lineTo(25, -14); ctx.moveTo(8, 9); ctx.lineTo(18, 17); ctx.lineTo(26, 11); ctx.stroke()
    for (const [x, y] of [[17, -19], [18, 17], [26, -14], [26, 11]]) { ctx.fillStyle = '#c7d1b1'; ctx.beginPath(); ctx.ellipse(x, y, 4, 2.5, 0, 0, Math.PI * 2); ctx.fill() }
  } else if (t.type === 'relay') {
    ctx.strokeStyle = trim; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, 9); ctx.lineTo(0, -26); ctx.moveTo(-10, -12); ctx.lineTo(0, -22); ctx.lineTo(10, -12); ctx.stroke()
    ctx.beginPath(); ctx.arc(0, -15, 15 + breathe * 2, 3.6, 5.8); ctx.stroke()
    ctx.fillStyle = '#efd087'; ctx.shadowColor = trim; ctx.shadowBlur = 12; ctx.beginPath(); ctx.arc(0, -4, 4, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0
  } else if (t.type === 'shield') {
    ctx.strokeStyle = trim; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 19 + breathe, 0, Math.PI * 2); ctx.stroke()
    polygon(ctx, [[0, -13], [12, -6], [9, 9], [0, 16], [-9, 9], [-12, -6]], '#467078', '#99d2db', 1.2)
    ctx.fillStyle = '#b8e5e6'; ctx.fillRect(-2, -7, 4, 14)
  } else {
    ctx.strokeStyle = trim; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.arc(0, 0, 23 + breathe * 2, 0.1, Math.PI * 1.65); ctx.stroke()
    ctx.fillStyle = '#e4a18d'; ctx.beginPath(); ctx.arc(0, -3, 6, 0, Math.PI * 2); ctx.fill()
    ctx.strokeStyle = '#d8c092'; ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(0, -26); ctx.stroke()
  }
  ctx.globalAlpha = 1
  ctx.restore()
  }
  if (active && ['relay', 'shield', 'lure', 'arc'].includes(t.type)) {
    const emitter = towerMuzzle(t.type, p, direction)
    ctx.save(); ctx.strokeStyle = t.type === 'lure' ? '#d9a16e' : '#81d1d6'; ctx.globalAlpha = 0.35 + Math.sin(time * 2.2 + t.slot) * 0.13; ctx.lineWidth = 1
    const radius = t.type === 'relay' ? 7 + (time * 7 % 14) : t.type === 'shield' ? 18 + Math.sin(time * 2) * 2 : t.type === 'lure' ? 22 + (time * 5 % 12) : 7
    ctx.beginPath(); ctx.ellipse(emitter.x, emitter.y, radius, radius * (t.type === 'lure' ? 0.5 : 0.72), 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore()
  }
  ctx.save(); ctx.translate(p.x, p.y + 14)
  ctx.fillStyle = active ? '#92c9ad' : t.jammed > 0 ? '#d88dd4' : t.connected ? '#e5b66e' : '#dc8179'
  ctx.beginPath(); ctx.arc(-23, 1, 2.7, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#d8e1d8'; ctx.font = `${9 * labelScale}px "Microsoft YaHei", sans-serif`; ctx.textAlign = 'center'; ctx.fillText(`${spec.name}  ·  ${t.level}`, 0, 17 + (labelScale - 1) * 3)
  if (!active && t.jammed <= 0) { const status = getTowerStatus(run, t); ctx.fillStyle = status.tone === 'bad' ? '#df8b7c' : '#dbbd7e'; ctx.fillText(status.label, 0, 28) }
  if (t.jammed > 0) { ctx.fillStyle = '#db8bd3'; ctx.fillText('干扰', 0, -23) }
  if (t.health < t.maxHealth) {
    ctx.fillStyle = 'rgba(4,9,11,.8)'; ctx.fillRect(-15, -6, 30, 3)
    ctx.fillStyle = t.health / t.maxHealth > 0.5 ? '#a7c784' : '#e18475'; ctx.fillRect(-15, -6, 30 * t.health / t.maxHealth, 3)
  }
  ctx.restore()
}

function drawEnemy(ctx: CanvasRenderingContext2D, b: Battle, e: Enemy, time: number, effects: boolean, quality: 'standard' | 'high' = 'high') {
  const p = getEnemyPosition(b, e)
  const rendered = drawEnemySprite(ctx, e.kind, p.x, p.y, p.angle, time, effects, quality)
  if (!rendered) {
  const size = e.kind === 'boss' ? 1.5 : e.kind === 'siege' || e.kind === 'carrier' ? 1.12 : e.kind === 'mite' ? 0.75 : 0.9
  ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.angle); ctx.scale(size, size)
  const flicker = effects ? Math.sin(time * 11 + e.dist) * 1.8 : 0
  ctx.fillStyle = 'rgba(231,111,76,.35)'; ctx.shadowColor = '#dc7a52'; ctx.shadowBlur = 13
  ctx.beginPath(); ctx.moveTo(-12, -3); ctx.lineTo(-24 - flicker, -9); ctx.lineTo(-17, 0); ctx.lineTo(-25 - flicker, 9); ctx.lineTo(-9, 4); ctx.closePath(); ctx.fill(); ctx.shadowBlur = 0
  const main = e.kind === 'boss' ? '#7c4d4b' : e.kind === 'jammer' ? '#875d91' : e.kind === 'carrier' ? '#9b8062' : e.kind === 'jumper' ? '#76638f' : e.kind === 'siege' ? '#786e61' : e.kind === 'splitter' ? '#8e675e' : '#708384'
  const trim = e.kind === 'boss' ? '#ed9a6a' : e.kind === 'jammer' ? '#d6a2e2' : e.kind === 'carrier' ? '#f0cb8a' : e.kind === 'jumper' ? '#c1a6f2' : '#c2c5aa'
  if (e.kind === 'scout' || e.kind === 'mite') {
    polygon(ctx, [[18, 0], [6, -7], [-8, -8], [-17, 0], [-8, 8], [6, 7]], main, trim, 1.4)
    polygon(ctx, [[3, -5], [-3, -14], [-12, -12], [-9, -4]], '#495a5c', '#94aaa2', 1)
    polygon(ctx, [[3, 5], [-3, 14], [-12, 12], [-9, 4]], '#495a5c', '#94aaa2', 1)
    ctx.fillStyle = '#ef9770'; ctx.beginPath(); ctx.arc(10, 0, 2.5, 0, Math.PI * 2); ctx.fill()
  } else if (e.kind === 'siege') {
    polygon(ctx, [[21, 0], [11, -14], [-8, -17], [-20, -10], [-22, 9], [-6, 17], [11, 12]], main, trim, 1.5)
    polygon(ctx, [[0, -11], [23, -5], [26, 1], [4, 5], [-1, 1]], '#9a8e77', '#ddd0a4', 1)
    for (let i = 0; i < 3; i += 1) { ctx.fillStyle = '#474e4b'; ctx.fillRect(-12 + i * 8, -13, 4, 4); ctx.fillRect(-12 + i * 8, 9, 4, 4) }
  } else if (e.kind === 'splitter') {
    polygon(ctx, [[19, 0], [7, -12], [-7, -11], [-18, 0], [-6, 11], [7, 12]], main, trim, 1.5)
    polygon(ctx, [[-1, -7], [3, -16], [-7, -18], [-11, -7]], '#b17b68', '#e2a883', 1)
    polygon(ctx, [[-1, 7], [3, 16], [-7, 18], [-11, 7]], '#b17b68', '#e2a883', 1)
    ctx.fillStyle = '#f1c080'; ctx.beginPath(); ctx.arc(7, 0, 3, 0, Math.PI * 2); ctx.fill()
  } else if (e.kind === 'jammer') {
    polygon(ctx, [[18, 0], [7, -8], [-10, -8], [-18, -2], [-16, 8], [2, 11]], main, trim, 1.5)
    ctx.strokeStyle = trim; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 18 + Math.sin(time * 4) * 2, -1.1, 1.1); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(-7, -8); ctx.lineTo(-17, -20); ctx.moveTo(-7, 8); ctx.lineTo(-17, 20); ctx.stroke()
    ctx.fillStyle = '#dfabeb'; ctx.fillRect(2, -3, 8, 6)
  } else if (e.kind === 'jumper') {
    polygon(ctx, [[19, 0], [2, -11], [-4, -5], [-17, -17], [-15, -2], [-21, 0], [-15, 2], [-17, 17], [-4, 5], [2, 11]], main, trim, 1.4)
    ctx.strokeStyle = '#cbb2ef'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-9, -5); ctx.lineTo(9, 0); ctx.lineTo(-9, 5); ctx.stroke()
  } else if (e.kind === 'carrier') {
    polygon(ctx, [[21, 0], [10, -15], [-12, -13], [-23, 0], [-12, 13], [10, 15]], main, trim, 1.5)
    ctx.fillStyle = 'rgba(141,205,210,.25)'; ctx.strokeStyle = '#99d7d1'; ctx.lineWidth = 1
    for (let i = 0; i < 3; i += 1) { ctx.beginPath(); ctx.ellipse(-2 + i * 4, -7 + i * 7, 23, 13, 0, -1.1, 1.1); ctx.stroke() }
    ctx.fillStyle = '#f1cb8b'; ctx.fillRect(5, -3, 9, 6)
  } else {
    polygon(ctx, [[46, 0], [28, -29], [8, -33], [-8, -24], [-29, -35], [-26, -13], [-43, -7], [-39, 8], [-25, 14], [-31, 34], [-6, 25], [12, 31], [30, 23]], main, trim, 2)
    polygon(ctx, [[-2, -18], [18, -14], [31, -2], [24, 11], [0, 16], [-14, 7], [-11, -8]], '#63494a', '#efbd87', 1.4)
    polygon(ctx, [[3, -6], [27, -2], [22, 5], [0, 2]], '#a98268', '#e4be87', 1)
    ctx.strokeStyle = '#e9a06e'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-18, -22); ctx.lineTo(-28, -35); ctx.moveTo(-18, 22); ctx.lineTo(-31, 34); ctx.stroke()
    ctx.fillStyle = '#f0d18c'; ctx.shadowColor = '#f18c69'; ctx.shadowBlur = 15; ctx.beginPath(); ctx.arc(14, 0, 5, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0
  }
  ctx.restore()
  }
  if (e.maxShield > 0) {
    ctx.strokeStyle = `rgba(105,199,218,${0.38 + Math.sin(time * 4) * 0.08})`; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(e.x, e.y, (e.kind === 'boss' ? 64 : 25) + Math.sin(time * 2) * 2, 0, Math.PI * 2); ctx.stroke()
  }
  const barWidth = e.kind === 'boss' ? 105 : e.kind === 'siege' || e.kind === 'carrier' ? 42 : 30
  const barY = e.y - (e.kind === 'boss' ? 53 : 28)
  ctx.fillStyle = 'rgba(4,9,12,.82)'; ctx.fillRect(e.x - barWidth / 2, barY, barWidth, 4)
  ctx.fillStyle = e.kind === 'boss' ? '#ed8667' : e.hp / e.maxHp > 0.35 ? '#d8aa78' : '#e97c72'; ctx.fillRect(e.x - barWidth / 2, barY, Math.max(0, barWidth * e.hp / e.maxHp), 4)
  if (e.maxShield > 0 && e.shield > 0) { ctx.fillStyle = '#7ac8d6'; ctx.fillRect(e.x - barWidth / 2, barY - 3, barWidth * e.shield / e.maxShield, 2) }
  if (e.slowTimer > 0) { ctx.fillStyle = '#9bd6e9'; ctx.font = '9px Consolas, monospace'; ctx.textAlign = 'center'; ctx.fillText('减速', e.x, barY - 6) }
}

function drawProjectile(ctx: CanvasRenderingContext2D, shot: Projectile, detailed: boolean) {
  ctx.save()
  ctx.translate(shot.x, shot.y)
  ctx.rotate(shot.angle ?? 0)
  ctx.globalCompositeOperation = 'lighter'
  ctx.fillStyle = shot.color; ctx.shadowColor = shot.color; ctx.shadowBlur = detailed ? (shot.kind === 'comet' ? 18 : 10) : 0
  const tailLength = shot.kind === 'comet' ? 43 : shot.kind === 'needle' ? 28 : 24
  const trail = ctx.createLinearGradient(-tailLength, 0, 5, 0)
  trail.addColorStop(0, `${shot.color}00`); trail.addColorStop(0.75, shot.color); trail.addColorStop(1, '#ffffec')
  ctx.strokeStyle = trail; ctx.lineWidth = shot.kind === 'comet' ? 5 : 3; ctx.lineCap = 'round'
  ctx.beginPath(); ctx.moveTo(-tailLength, 0); ctx.lineTo(4, 0); ctx.stroke()
  if (shot.kind === 'comet') {
    polygon(ctx, [[12, 0], [0, -5], [-10, -4], [-6, 0], [-10, 4], [0, 5]], '#fff1c6', shot.color, 1.5)
    ctx.fillStyle = '#ffcf7a'; ctx.beginPath(); ctx.ellipse(-9, 0, 9, 3, 0, 0, Math.PI * 2); ctx.fill()
  } else if (shot.kind === 'cold') {
    polygon(ctx, [[11, 0], [0, -6], [-7, 0], [0, 6]], '#ecffff', shot.color, 1.5)
    ctx.strokeStyle = shot.color; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-3, -9); ctx.lineTo(3, 9); ctx.moveTo(3, -9); ctx.lineTo(-3, 9); ctx.stroke()
  } else if (shot.kind === 'drone') {
    polygon(ctx, [[9, 0], [0, -4], [-7, -3], [-9, 0], [-7, 3], [0, 4]], '#e6f6bf', shot.color, 1.2)
    ctx.strokeStyle = '#e5f5d2'; ctx.beginPath(); ctx.moveTo(-2, -3); ctx.lineTo(-7, -8); ctx.moveTo(-2, 3); ctx.lineTo(-7, 8); ctx.stroke()
  } else {
    ctx.strokeStyle = '#ffffe8'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(-6, 0); ctx.lineTo(8, 0); ctx.stroke()
  }
  ctx.restore()
}

function drawEffect(ctx: CanvasRenderingContext2D, effect: Battle['effects'][number], time: number, detailed: boolean) {
  const progress = 1 - effect.life / effect.maxLife
  const fade = Math.max(0, 1 - progress)
  ctx.save(); ctx.globalAlpha = Math.pow(fade, 0.65)
  if (effect.kind === 'muzzle') {
    ctx.translate(effect.x, effect.y); ctx.rotate(effect.angle ?? 0)
    ctx.globalCompositeOperation = 'lighter'
    ctx.shadowColor = effect.color; ctx.shadowBlur = detailed ? 22 : 0
    const length = (effect.weapon === 'rail' ? 32 : effect.weapon === 'comet' ? 24 : 19) * (0.4 + fade * 0.6)
    polygon(ctx, [[-6, 0], [1, -7 * fade], [7, -3], [length, 0], [7, 3], [1, 7 * fade]], effect.color, '#fff8d9', 1.3)
    ctx.fillStyle = '#ffffed'; ctx.beginPath(); ctx.arc(0, 0, 3 + 3 * fade, 0, Math.PI * 2); ctx.fill()
    if (detailed) { ctx.strokeStyle = effect.color; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, 0, 7 + progress * 15, -1.6, 1.6); ctx.stroke() }
  } else if (effect.kind === 'beam') {
    ctx.lineCap = 'round'; ctx.strokeStyle = effect.color; ctx.shadowColor = effect.color; ctx.shadowBlur = detailed ? 18 : 0
    if (detailed) { ctx.globalAlpha *= 0.3; ctx.lineWidth = 11 * fade; ctx.beginPath(); ctx.moveTo(effect.x, effect.y); ctx.lineTo(effect.x2 ?? effect.x, effect.y2 ?? effect.y); ctx.stroke(); ctx.globalAlpha = Math.pow(fade, 0.65) }
    ctx.lineWidth = effect.weapon === 'rail' ? 4 : 3; ctx.beginPath(); ctx.moveTo(effect.x, effect.y); ctx.lineTo(effect.x2 ?? effect.x, effect.y2 ?? effect.y); ctx.stroke()
    ctx.lineWidth = 1.3; ctx.strokeStyle = '#ffffe8'; ctx.beginPath(); ctx.moveTo(effect.x, effect.y); ctx.lineTo(effect.x2 ?? effect.x, effect.y2 ?? effect.y); ctx.stroke()
  } else if (effect.kind === 'arc' && effect.points) {
    ctx.strokeStyle = effect.color; ctx.shadowColor = effect.color; ctx.shadowBlur = detailed ? 17 : 0; ctx.lineWidth = 3.5
    let last = { x: effect.x, y: effect.y }
    for (const point of effect.points) {
      ctx.beginPath(); ctx.moveTo(last.x, last.y)
      const dx = point.x - last.x; const dy = point.y - last.y
      for (let i = 1; i < 7; i += 1) ctx.lineTo(last.x + dx * i / 7 + Math.sin(time * 20 + i) * (detailed ? 7 : 3), last.y + dy * i / 7 + Math.cos(time * 18 + i) * (detailed ? 7 : 3))
      ctx.lineTo(point.x, point.y); ctx.stroke()
      ctx.save(); ctx.strokeStyle = '#edfff4'; ctx.lineWidth = 1; ctx.stroke(); ctx.restore(); last = point
    }
  } else if (effect.kind === 'spark') {
    ctx.translate(effect.x, effect.y); ctx.globalCompositeOperation = 'lighter'
    ctx.strokeStyle = effect.color; ctx.shadowColor = effect.color; ctx.shadowBlur = detailed ? 15 : 0; ctx.lineWidth = 2
    const radius = (effect.radius ?? 20) * (0.35 + progress * 0.85)
    ctx.beginPath(); ctx.arc(0, 0, radius * 0.6, 0, Math.PI * 2); ctx.stroke()
    const count = detailed ? 8 : 4
    for (let i = 0; i < count; i += 1) {
      const angle = (effect.angle ?? 0) + i * Math.PI * 2 / count
      ctx.beginPath(); ctx.moveTo(Math.cos(angle) * radius * 0.55, Math.sin(angle) * radius * 0.55); ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius); ctx.stroke()
      if (effect.weapon === 'cold' && detailed) { ctx.beginPath(); ctx.moveTo(Math.cos(angle) * radius, Math.sin(angle) * radius); ctx.lineTo(Math.cos(angle + 0.25) * radius * 0.65, Math.sin(angle + 0.25) * radius * 0.65); ctx.stroke() }
    }
    ctx.fillStyle = '#ffffeb'; ctx.beginPath(); ctx.arc(0, 0, 2 + 4 * fade, 0, Math.PI * 2); ctx.fill()
  } else {
    const radius = (effect.radius ?? 25) * (effect.kind === 'pulse' ? 0.35 + progress * 0.85 : 0.35 + progress * 0.65)
    ctx.strokeStyle = effect.color; ctx.fillStyle = `${effect.color}22`; ctx.lineWidth = effect.kind === 'warning' ? 2 : 1.5
    ctx.beginPath(); ctx.arc(effect.x, effect.y, radius, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
    if (effect.kind === 'blast' || effect.kind === 'burst') {
      ctx.shadowColor = effect.color; ctx.shadowBlur = detailed ? 20 * fade : 0
      ctx.beginPath(); ctx.arc(effect.x, effect.y, radius * 0.55, 0, Math.PI * 2); ctx.strokeStyle = '#f0bd81'; ctx.stroke()
      ctx.fillStyle = '#f1a86f'; ctx.beginPath(); ctx.arc(effect.x, effect.y, Math.max(2, radius * (0.2 + (1 - progress) * 0.32)), 0, Math.PI * 2); ctx.fill()
      if (detailed) {
        ctx.strokeStyle = effect.color; ctx.lineWidth = 2
        for (let i = 0; i < 10; i += 1) { const a = i * Math.PI / 5 + 0.25; ctx.beginPath(); ctx.moveTo(effect.x + Math.cos(a) * radius * 0.8, effect.y + Math.sin(a) * radius * 0.8); ctx.lineTo(effect.x + Math.cos(a) * radius * 1.2, effect.y + Math.sin(a) * radius * 1.2); ctx.stroke() }
      }
    }
  }
  if (effect.label) {
    ctx.font = effect.kind === 'warning' ? 'bold 13px Consolas, monospace' : '10px Consolas, monospace'
    ctx.textAlign = 'center'; ctx.fillStyle = effect.color; ctx.fillText(effect.label, effect.x, effect.y - (effect.radius ?? 18) - 12 - progress * 8)
  }
  ctx.restore()
}

function drawBoardLabels(ctx: CanvasRenderingContext2D, b: Battle, run: RunState) {
  ctx.fillStyle = 'rgba(211,223,211,.52)'; ctx.font = '9px Consolas, monospace'; ctx.textAlign = 'left'
  const names = ['ICE BELT / N-04', 'DERELICT MINE / K-17', 'RELAY GRAVEYARD / S-09']
  ctx.fillText(names[b.zone], 19, 22)
  ctx.textAlign = 'right'; ctx.fillStyle = 'rgba(225,184,126,.65)'; ctx.fillText(`SECTOR ${String(run.mapLayer + 1).padStart(2, '0')}`, 978, 22)
  ctx.save(); ctx.translate(26, H - 27); ctx.strokeStyle = 'rgba(195,212,201,.28)'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(71, 0); ctx.moveTo(0, -4); ctx.lineTo(0, 4); ctx.moveTo(71, -4); ctx.lineTo(71, 4); ctx.stroke(); ctx.fillStyle = 'rgba(195,212,201,.4)'; ctx.textAlign = 'center'; ctx.font = '8px Consolas, monospace'; ctx.fillText('150 M', 35, -7); ctx.restore()
  if (b.isBoss && !b.waveCleared) {
    const boss = b.enemies.find(e => e.kind === 'boss')
    if (boss) {
      const x = 310; const y = 34; const width = 380
      ctx.fillStyle = 'rgba(7,12,16,.82)'; ctx.fillRect(x, y, width, 23)
      ctx.strokeStyle = 'rgba(222,157,117,.6)'; ctx.strokeRect(x, y, width, 23)
      ctx.fillStyle = 'rgba(221,100,82,.36)'; ctx.fillRect(x + 1, y + 1, (width - 2) * Math.max(0, boss.hp / boss.maxHp), 21)
      ctx.fillStyle = 'rgba(227,204,179,.86)'; ctx.textAlign = 'center'; ctx.font = '10px Consolas, monospace'; ctx.fillText(`「断界者」  /  PHASE ${boss.bossPhase}   ${Math.ceil(Math.max(0, boss.hp))} hull`, x + width / 2, y + 15)
    }
  }
}

function polygon(ctx: CanvasRenderingContext2D, points: number[][], fill: string, stroke: string, width = 1) {
  ctx.beginPath(); points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.stroke()
}
