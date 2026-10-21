import { towerAimOrigin, towerAngleToFrame, towerMuzzle } from './towerGeometry'

export type NodeKind = 'battle' | 'elite' | 'shop' | 'repair' | 'event' | 'supply' | 'boss'
export type TowerKind = 'needle' | 'rail' | 'arc' | 'comet' | 'cold' | 'drone' | 'relay' | 'shield' | 'lure'
export type EnemyKind = 'scout' | 'siege' | 'splitter' | 'jammer' | 'jumper' | 'carrier' | 'mite' | 'boss'
export type Branch = 'A' | 'B'
export type Difficulty = 'standard' | 'storm'

export interface MapNode {
  id: string
  layer: number
  col: number
  kind: NodeKind
  title: string
  detail: string
  seed: number
}

export interface Structure {
  id: string
  type: TowerKind
  slot: number
  level: number
  branch: Branch | null
  powered: boolean
  connected: boolean
  jammed: number
  cooldown: number
  repairTimer: number
  health: number
  maxHealth: number
  targetMode: 'first' | 'strong' | 'support'
  shotsFired?: number
}

export interface Enemy {
  id: string
  kind: EnemyKind
  dist: number
  x: number
  y: number
  hp: number
  maxHp: number
  shield: number
  maxShield: number
  slow: number
  slowTimer: number
  burn: number
  burnTimer: number
  attackTimer: number
  teleportTimer: number
  lureTimer: number
  lureCooldown?: number
  lureSeed: number
  bossPhase: number
}

export interface Projectile {
  id: string
  kind: 'needle' | 'cold' | 'comet' | 'drone'
  x: number
  y: number
  target: string
  speed: number
  damage: number
  splash: number
  color: string
  source: string
  angle?: number
  branch?: Branch | null
}

export interface CombatCue {
  kind: 'fire' | 'impact'
  weapon: TowerKind
  x: number
  y: number
}

type CombatFeedback = (cue: CombatCue) => void

export interface BattleEffect {
  kind: 'beam' | 'arc' | 'blast' | 'burst' | 'spark' | 'pulse' | 'warning' | 'muzzle'
  life: number
  maxLife: number
  x: number
  y: number
  x2?: number
  y2?: number
  points?: { x: number; y: number }[]
  radius?: number
  color: string
  label?: string
  angle?: number
  source?: string
  weapon?: TowerKind
  frame?: number
}

export interface Battle {
  nodeId: string
  zone: number
  path: { x: number; y: number }[]
  pathLength: number
  pads: { x: number; y: number; high: boolean; blocked: boolean }[]
  structures: Structure[]
  enemies: Enemy[]
  projectiles: Projectile[]
  effects: BattleEffect[]
  wave: number
  maxWaves: number
  waveQueue: EnemyKind[]
  spawnTimer: number
  waveCleared: boolean
  nextWaveIn?: number | null
  elapsed: number
  isBoss: boolean
  bossAttackTimer: number
  bossWarning: { kind: 'sweep' | 'reinforce' | 'jam'; timer: number; x: number; y: number } | null
  buildCount: number
  damageDealt: number
  lastGridCheck: number
  gridUsed: number
  gridMax: number
  disruption: number
}

export interface RecordRow {
  date: string
  won: boolean
  score: number
  seed: string
  kills: number
  duration: number
}

export interface MetaProgress {
  wins: number
  losses: number
  research: number
  bestScore: number
  unlocks: string[]
  records: RecordRow[]
}

export interface RunState {
  seed: string
  rng: number
  difficulty: Difficulty
  nodes: MapNode[][]
  mapLayer: number
  visited: string[]
  activeNode: MapNode | null
  metal: number
  cells: number
  core: number
  maxCore: number
  coreShield: number
  shieldTimer: number
  generator: number
  fleetPressure: number
  battle: Battle | null
  boons: string[]
  skillCooldowns: Record<string, number>
  elapsed: number
  kills: number
  leaks: number
  structuresBuilt: number
  upgradesMade: number
  score: number
  pendingBoons: { id: string; name: string; description: string }[]
  end: 'victory' | 'defeat' | null
  shopItems: string[]
  eventOffer: string
  eventResult: string
  serviceDone: boolean
  campaignHistory: string[]
}

export interface TowerSpec {
  id: TowerKind
  name: string
  short: string
  role: string
  cost: number
  power: number
  range: number
  damage: number
  cooldown: number
  color: string
  icon: string
  description: string
  branchA: string
  branchB: string
}

export const TOWER_SPECS: Record<TowerKind, TowerSpec> = {
  needle: { id: 'needle', name: '针蜂', short: '速射炮', role: '近距压制', cost: 42, power: 0, range: 145, damage: 23, cooldown: 0.38, color: '#e7b36e', icon: '✳', description: '快速点杀轻型目标，连续命中可提高短时射速。', branchA: '蜂群弹链：弹丸弹射至邻近敌人', branchB: '穿甲针：对重甲与领航单位造成额外伤害' },
  rail: { id: 'rail', name: '轨矛', short: '磁轨炮', role: '直线贯穿', cost: 76, power: 0, range: 260, damage: 145, cooldown: 2.4, color: '#c0d4ce', icon: '╱', description: '蓄能后穿透直线上的敌群，射程受高地加成。', branchA: '折跃电弧：首个命中后弹射', branchB: '破城弹芯：对装甲与旗舰加伤' },
  arc: { id: 'arc', name: '弧光', short: '电弧塔', role: '集群跳跃', cost: 68, power: 0, range: 150, damage: 35, cooldown: 1.05, color: '#78d8d0', icon: '⌁', description: '电流在相邻敌人之间跳跃，削弱护盾编队。', branchA: '多级线圈：额外跳跃两次', branchB: '过载脉冲：命中护盾时爆发冲击' },
  comet: { id: 'comet', name: '彗星', short: '导弹井', role: '追踪爆破', cost: 84, power: 0, range: 255, damage: 105, cooldown: 2.15, color: '#ed8969', icon: '◆', description: '追踪导弹命中后造成范围伤害，锁定重型单位。', branchA: '子母弹：爆炸后散出小型弹头', branchB: '热核锥：集中破甲，扩大首击伤害' },
  cold: { id: 'cold', name: '冷凝', short: '减速塔', role: '冻结控场', cost: 58, power: 0, range: 125, damage: 10, cooldown: 0.82, color: '#8ebce0', icon: '❄', description: '冷凝弹显著减速，适合为重型火力延长攻击窗口。', branchA: '绝对零度：扩大射程并优先压制精英', branchB: '相变裂隙：提高伤害并持续灼伤目标' },
  drone: { id: 'drone', name: '巡游蜂巢', short: '无人机平台', role: '火力 / 维修', cost: 88, power: 0, range: 170, damage: 27, cooldown: 0.75, color: '#a8bd8c', icon: '⌖', description: '无人机攻击敌人，并周期维修射程内的受损设施。', branchA: '维修蜂：加强建筑修复能力', branchB: '猎杀蜂：提高齐射伤害与射速' },
  relay: { id: 'relay', name: '脉冲哨塔', short: '脉冲炮', role: '能量点射', cost: 40, power: 0, range: 175, damage: 28, cooldown: 0.9, color: '#e8c16d', icon: '⌘', description: '独立发射脉冲光束，可直接部署在任意空闲平台。', branchA: '高频振荡：提高自身射速', branchB: '聚焦透镜：增加自身射程与伤害' },
  shield: { id: 'shield', name: '护盾冲击塔', short: '冲击护盾', role: '攻击 / 护盾', cost: 70, power: 0, range: 160, damage: 30, cooldown: 1.4, color: '#75bcd0', icon: '⬡', description: '独立释放范围冲击攻击敌人，同时持续恢复舰队核心护盾。', branchA: '相位穹顶：每波开始提供额外护盾', branchB: '逆向屏障：提高护盾恢复速度' },
  lure: { id: 'lure', name: '诱导震荡塔', short: '震荡诱导', role: '范围伤害 / 牵制', cost: 48, power: 0, range: 150, damage: 24, cooldown: 1.5, color: '#d68483', icon: '◉', description: '独立向周围敌人释放伤害震荡，并短暂牵制普通敌人。', branchA: '广域信标：扩大诱导半径', branchB: '反击强化：提高震荡伤害与频率' },
}

export const ENEMY_NAMES: Record<EnemyKind, string> = {
  scout: '快速侦察机', siege: '重装攻城机', splitter: '裂解型单位', jammer: '干扰机', jumper: '跃迁单位', carrier: '护盾运输机', mite: '裂解子机', boss: '「断界者」旗舰',
}

export const TOWER_ORDER: TowerKind[] = ['needle', 'rail', 'arc', 'comet', 'cold', 'drone', 'relay', 'shield', 'lure']

const MAPS = [
  {
    path: [{ x: -24, y: 355 }, { x: 170, y: 355 }, { x: 170, y: 145 }, { x: 465, y: 145 }, { x: 465, y: 405 }, { x: 755, y: 405 }, { x: 755, y: 205 }, { x: 1024, y: 205 }],
    pads: [[75, 245], [80, 480], [285, 260], [300, 72], [350, 475], [410, 250], [575, 80], [600, 320], [640, 505], [850, 335], [870, 100], [860, 500]],
  },
  {
    path: [{ x: -25, y: 495 }, { x: 220, y: 495 }, { x: 220, y: 275 }, { x: 435, y: 275 }, { x: 435, y: 75 }, { x: 710, y: 75 }, { x: 710, y: 355 }, { x: 1025, y: 355 }],
    pads: [[90, 405], [90, 550], [115, 190], [315, 405], [325, 170], [520, 165], [530, 485], [625, 270], [815, 230], [830, 450], [920, 480], [850, 35]],
  },
  {
    path: [{ x: -20, y: 165 }, { x: 240, y: 165 }, { x: 240, y: 430 }, { x: 505, y: 430 }, { x: 505, y: 195 }, { x: 790, y: 195 }, { x: 790, y: 455 }, { x: 1020, y: 455 }],
    pads: [[100, 70], [105, 300], [335, 75], [355, 520], [420, 300], [600, 75], [625, 340], [700, 520], [885, 90], [900, 305], [930, 530], [65, 520]],
  },
]

const LAYER_TITLES: Record<number, string[]> = {
  0: ['碎冰巡防', '失联前哨'],
  1: ['裂谷航道', '旧轨补给', '盲区信标'],
  2: ['矿环争夺', '熔毁平台'],
  3: ['寒潮裂隙', '维修泊位', '漂流货舱'],
  4: ['旗舰外环', '最后壁垒'],
  5: ['断界旗舰'],
}

const LAYER_KINDS: NodeKind[][] = [
  ['battle', 'elite'],
  ['battle', 'shop', 'event'],
  ['battle', 'elite'],
  ['battle', 'repair', 'supply'],
  ['battle', 'elite'],
  ['boss'],
]


const NODE_DETAILS: Record<NodeKind, string> = {
  battle: '常规防守 · 4 波',
  elite: '精英拦截 · 5 波 · 额外战利品',
  shop: '补给交易 · 购买后继续航行',
  repair: '维修平台 · 修复舰队与设施',
  event: '未知信号 · 代价与收益并存',
  supply: '资源回收 · 择一带走',
  boss: '旗舰遭遇 · 阶段式攻防',
}

export function hashSeed(seed: string): number {
  let h = 2166136261
  for (let i = 0; i < seed.length; i += 1) h = Math.imul(h ^ seed.charCodeAt(i), 16777619)
  return (h >>> 0) || 1
}

export function random(run: Pick<RunState, 'rng'>): number {
  run.rng = (run.rng + 0x6d2b79f5) | 0
  let t = run.rng
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

export function createMeta(): MetaProgress {
  return { wins: 0, losses: 0, research: 0, bestScore: 0, unlocks: ['needle', 'rail', 'arc', 'comet', 'cold', 'drone', 'relay', 'shield', 'lure'], records: [] }
}

export function makeRun(seedText: string, difficulty: Difficulty, meta: MetaProgress): RunState {
  const seed = seedText.trim() || `${new Date().toISOString().slice(0, 10)}-${Math.random().toString(36).slice(2, 7)}`
  const run: RunState = {
    seed,
    rng: hashSeed(seed),
    difficulty,
    nodes: [],
    mapLayer: 0,
    visited: [],
    activeNode: null,
    metal: 155,
    cells: 4,
    core: 100,
    maxCore: 100,
    coreShield: 0,
    shieldTimer: 0,
    generator: 16,
    fleetPressure: 0,
    battle: null,
    boons: [],
    skillCooldowns: { strike: 0, stasis: 0, shield: 0, repair: 0 },
    elapsed: 0,
    kills: 0,
    leaks: 0,
    structuresBuilt: 0,
    upgradesMade: 0,
    score: 0,
    pendingBoons: [],
    end: null,
    shopItems: [],
    eventOffer: '',
    eventResult: '',
    serviceDone: false,
    campaignHistory: [],
  }
  run.nodes = LAYER_KINDS.map((kinds, layer) => kinds.map((kind, col) => {
    const titles = LAYER_TITLES[layer]
    return { id: `${layer}-${col}`, layer, col, kind, title: titles[col] ?? '航道节点', detail: NODE_DETAILS[kind], seed: Math.floor(random(run) * 2147483000) }
  }))
  if (meta.wins >= 1) run.boons.push('coldAftershock')
  return run
}

export function getCurrentLayerNodes(run: RunState): MapNode[] {
  return run.nodes[run.mapLayer] ?? []
}

export function getDeploymentReserve(node: MapNode): number {
  return node.kind === 'boss' ? 360 : 118 + node.layer * 24
}

export function getBattleSalvage(run: RunState): number {
  return Math.floor((run.battle?.structures ?? []).reduce((sum, t) => sum + (TOWER_SPECS[t.type].cost + (t.level >= 2 ? 62 : 0) + (t.level >= 3 ? 92 : 0)) * (t.health > 0 ? 0.6 : 0.25), 0))
}

export function createBattle(run: RunState, node: MapNode): Battle {
  const zone = Math.abs(node.seed % MAPS.length)
  const map = MAPS[zone]
  const path = map.path.map((p, i) => ({ x: p.x + (i > 0 && i < map.path.length - 1 ? ((node.seed >>> (i % 12)) % 17) - 8 : 0), y: p.y + (i > 0 && i < map.path.length - 1 ? (((node.seed >>> ((i + 5) % 16)) % 19) - 9) : 0) }))
  const pathLength = path.slice(1).reduce((sum, p, i) => sum + Math.hypot(p.x - path[i].x, p.y - path[i].y), 0)
  const pads = map.pads.map(([x, y], i) => ({ x: Math.max(72, Math.min(928, x + ((node.seed >>> (i % 16)) % 13) - 6)), y: Math.max(84, Math.min(535, y + ((node.seed >>> ((i + 7) % 16)) % 13) - 6)), high: i % 4 === (zone + 1) % 4, blocked: false }))
  return {
    nodeId: node.id,
    zone,
    path,
    pathLength,
    pads,
    structures: [],
    enemies: [],
    projectiles: [],
    effects: [],
    wave: -1,
    maxWaves: node.kind === 'boss' ? 1 : node.kind === 'elite' ? 5 : 4,
    waveQueue: [],
    spawnTimer: 0,
    waveCleared: true,
    nextWaveIn: null,
    elapsed: 0,
    isBoss: node.kind === 'boss',
    bossAttackTimer: 10,
    bossWarning: null,
    buildCount: 0,
    damageDealt: 0,
    lastGridCheck: 0,
    gridUsed: 0,
    gridMax: run.generator,
    disruption: 0,
  }
}

export const WAVE_INTERVAL_SECONDS = 3

// Missing countdowns in older saves begin with a full preparation interval.
export function getNextWaveCountdown(b: Battle): number | null {
  if (!b.waveCleared || b.wave < 0 || b.wave >= b.maxWaves - 1 || b.isBoss) return null
  return typeof b.nextWaveIn === 'number' && Number.isFinite(b.nextWaveIn)
    ? Math.max(0, Math.min(WAVE_INTERVAL_SECONDS, b.nextWaveIn)) : WAVE_INTERVAL_SECONDS
}

export function startWave(run: RunState): boolean {
  const b = run.battle
  if (!b || run.end || run.core <= 0 || !b.waveCleared || b.wave >= b.maxWaves - 1) return false
  b.wave += 1
  b.waveCleared = false
  b.nextWaveIn = null
  b.spawnTimer = 0.35
  b.waveQueue = createWaveQueue(run, b)
  for (const t of b.structures) if (t.type === 'shield' && t.branch === 'A' && t.powered && t.health > 0 && t.jammed <= 0) run.coreShield = Math.min(70, run.coreShield + 18)
  b.effects.push({ kind: 'pulse', life: 1.1, maxLife: 1.1, x: 500, y: 300, radius: 115, color: '#7bd1c7', label: `WAVE ${String(b.wave + 1).padStart(2, '0')}` })
  if (b.isBoss) {
    b.bossAttackTimer = 13
    b.effects.push({ kind: 'warning', life: 3.4, maxLife: 3.4, x: 760, y: 280, radius: 145, color: '#ee8069', label: '旗舰信号 · 锁定' })
  }
  return true
}

function createWaveQueue(run: RunState, b: Battle): EnemyKind[] {
  const wave = b.wave
  const q: EnemyKind[] = []
  if (b.isBoss) {
    q.push('scout', 'scout', 'jammer', 'carrier', 'boss', 'jumper', 'splitter')
    return q
  }
  const count = b.nodeId.startsWith('0-') ? 8 : 8 + Math.min(4, Math.floor(wave / 2))
  for (let i = 0; i < count; i += 1) {
    const r = random(run)
    if (wave === 0) q.push(r < 0.78 ? 'scout' : 'siege')
    else if (wave === 1) q.push(r < 0.42 ? 'scout' : r < 0.7 ? 'splitter' : r < 0.88 ? 'carrier' : 'siege')
    else if (wave === 2) q.push(r < 0.24 ? 'jumper' : r < 0.5 ? 'jammer' : r < 0.71 ? 'scout' : r < 0.88 ? 'splitter' : 'siege')
    else q.push(r < 0.18 ? 'jumper' : r < 0.36 ? 'jammer' : r < 0.58 ? 'carrier' : r < 0.78 ? 'siege' : 'splitter')
  }
  if (b.wave >= 3) q.push('carrier', 'jammer')
  if (run.nodes[b.nodeId.split('-').map(Number)[0]]?.[Number(b.nodeId.split('-')[1])]?.kind === 'elite') q.push('siege', 'jumper')
  return shuffle(run, q)
}

function shuffle<T>(run: RunState, items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random(run) * (i + 1))
    ;[items[i], items[j]] = [items[j], items[i]]
  }
  return items
}

const ENEMY_BASE: Record<EnemyKind, { hp: number; speed: number; shield: number; size: number; bounty: number; core: number; armor: number }> = {
  scout: { hp: 74, speed: 73, shield: 0, size: 12, bounty: 3, core: 7, armor: 0 },
  siege: { hp: 380, speed: 34, shield: 0, size: 23, bounty: 8, core: 21, armor: 0.22 },
  splitter: { hp: 164, speed: 51, shield: 0, size: 17, bounty: 5, core: 11, armor: 0.05 },
  jammer: { hp: 235, speed: 43, shield: 0, size: 18, bounty: 7, core: 10, armor: 0.08 },
  jumper: { hp: 138, speed: 59, shield: 0, size: 15, bounty: 6, core: 9, armor: 0 },
  carrier: { hp: 276, speed: 36, shield: 115, size: 22, bounty: 9, core: 12, armor: 0.1 },
  mite: { hp: 54, speed: 78, shield: 0, size: 9, bounty: 1, core: 4, armor: 0 },
  boss: { hp: 4300, speed: 16, shield: 900, size: 45, bounty: 0, core: 35, armor: 0.16 },
}

function spawnEnemy(run: RunState, b: Battle, kind: EnemyKind): Enemy {
  const base = ENEMY_BASE[kind]
  const difficulty = run.difficulty === 'storm' ? 1.28 : 1
  const sector = 1 + run.mapLayer * 0.12
  const waveScale = kind === 'boss' ? 1 : 1 + Math.max(0, b.wave) * 0.11
  const hp = Math.round(base.hp * difficulty * sector * waveScale)
  const shield = Math.round(base.shield * difficulty * sector)
  const serial = Math.floor(random(run) * 0xffffffff).toString(36)
  const enemy: Enemy = {
    id: `${kind}-${serial}`,
    kind,
    dist: 0,
    x: b.path[0].x,
    y: b.path[0].y,
    hp,
    maxHp: hp,
    shield,
    maxShield: shield,
    slow: 0,
    slowTimer: 0,
    burn: 0,
    burnTimer: 0,
    attackTimer: 1.3,
    teleportTimer: 3.5,
    lureTimer: 0,
    lureSeed: Math.floor(random(run) * 628),
    bossPhase: 1,
  }
  return enemy
}

function positionAt(path: Battle['path'], distance: number): { x: number; y: number; angle: number } {
  let remaining = Math.max(0, distance)
  for (let i = 1; i < path.length; i += 1) {
    const a = path[i - 1]
    const b = path[i]
    const len = Math.hypot(b.x - a.x, b.y - a.y)
    if (remaining <= len) return { x: a.x + (b.x - a.x) * (remaining / len), y: a.y + (b.y - a.y) * (remaining / len), angle: Math.atan2(b.y - a.y, b.x - a.x) }
    remaining -= len
  }
  const a = path[path.length - 2]
  const z = path[path.length - 1]
  return { x: z.x, y: z.y, angle: Math.atan2(z.y - a.y, z.x - a.x) }
}

export function getEnemyPosition(b: Battle, enemy: Enemy): { x: number; y: number; angle: number } {
  const pathPosition = positionAt(b.path, enemy.dist)
  return { x: enemy.x, y: enemy.y, angle: pathPosition.angle }
}

export function getTowerStats(tower: Structure, run: RunState): { range: number; damage: number; cooldown: number; power: number; linkRange: number } {
  const s = TOWER_SPECS[tower.type]
  const levelScale = tower.level > 1 ? 1 + (tower.level - 1) * 0.22 : 1
  let range = s.range
  let damage = s.damage * levelScale
  let cooldown = s.cooldown * (tower.level > 1 ? 1 - (tower.level - 1) * 0.07 : 1)
  let linkRange = 205
  if (tower.type === 'rail' && run.battle?.pads[tower.slot]?.high) range *= 1.18
  if (tower.branch === 'A') {
    if (tower.type === 'needle') damage *= 0.92
    if (tower.type === 'rail') cooldown *= 0.86
    if (tower.type === 'arc') damage *= 0.9
    if (tower.type === 'comet') damage *= 0.86
    if (tower.type === 'cold') range *= 1.1
    if (tower.type === 'drone') cooldown *= 1.1
    if (tower.type === 'relay') { cooldown *= 0.72; linkRange = 250 }
    if (tower.type === 'shield') range *= 1.1
    if (tower.type === 'lure') range *= 1.35
  } else if (tower.branch === 'B') {
    if (tower.type === 'needle') damage *= 1.28
    if (tower.type === 'rail') damage *= 1.34
    if (tower.type === 'arc') damage *= 1.25
    if (tower.type === 'comet') damage *= 1.26
    if (tower.type === 'cold') damage *= 1.4
    if (tower.type === 'drone') { damage *= 1.34; cooldown *= 0.88 }
    if (tower.type === 'relay') { range *= 1.3; damage *= 1.2; linkRange = 188 }
    if (tower.type === 'shield') range *= 0.94
    if (tower.type === 'lure') { damage *= 1.5; cooldown *= 0.8 }
  }
  if (run.boons.includes('coil') && ['rail', 'arc'].includes(tower.type)) damage *= 1.16
  if (run.boons.includes('ember') && tower.type === 'needle') cooldown *= 0.84
  if (run.boons.includes('droneCare') && tower.type === 'drone') cooldown *= 0.86
  if (run.boons.includes('relaySync')) cooldown *= 0.93
  if (run.boons.includes('alloy') && ['rail', 'comet'].includes(tower.type)) damage *= 1.1

  return { range, damage, cooldown, power: 0, linkRange }
}

export function placeStructure(run: RunState, type: TowerKind, slot: number): { ok: boolean; message: string } {
  const b = run.battle
  const spec = TOWER_SPECS[type]
  if (!b) return { ok: false, message: '当前没有战场。' }
  if (!b.pads[slot] || b.pads[slot].blocked || b.structures.some(s => s.slot === slot)) return { ok: false, message: '此平台不可用。' }
  if (run.metal < spec.cost) return { ok: false, message: `需要 ${spec.cost} 合金。` }
  run.metal -= spec.cost
  const id = `${type}-${b.buildCount + 1}-${slot}`
  const maxHealth = type === 'relay' ? 150 : type === 'shield' ? 190 : 135
  b.structures.push({ id, type, slot, level: 1, branch: null, powered: false, connected: false, jammed: 0, cooldown: random(run) * 0.25, repairTimer: 0, health: maxHealth, maxHealth, targetMode: type === 'comet' || type === 'rail' ? 'strong' : 'first' })
  b.buildCount += 1
  run.structuresBuilt += 1
  run.score += 3
  recalculateGrid(run)
  return { ok: true, message: `${spec.name} 已部署。` }
}

export function upgradeStructure(run: RunState, id: string, branch: Branch): { ok: boolean; message: string } {
  const b = run.battle
  const t = b?.structures.find(s => s.id === id)
  if (!b || !t) return { ok: false, message: '设施已不存在。' }
  const cost = t.level === 1 ? 62 : 92
  if (run.metal < cost) return { ok: false, message: `升级需要 ${cost} 合金。` }
  if (t.level >= 3) return { ok: false, message: '已达到最高等级。' }
  if (t.branch && t.branch !== branch) return { ok: false, message: '当前专精路线不可更换。' }
  run.metal -= cost
  t.branch = branch
  t.level += 1
  t.maxHealth += 35
  t.health = Math.min(t.maxHealth, t.health + 35)
  run.upgradesMade += 1
  run.score += 8
  const spec = TOWER_SPECS[t.type]
  if (t.type === 'shield') run.coreShield = Math.min(run.coreShield + 18, 70)
  recalculateGrid(run)
  return { ok: true, message: `${spec.name} 改装完成 · ${branch === 'A' ? spec.branchA : spec.branchB}` }
}

export function sellStructure(run: RunState, id: string): { ok: boolean; message: string } {
  const b = run.battle
  const i = b?.structures.findIndex(s => s.id === id) ?? -1
  if (!b || i < 0) return { ok: false, message: '设施已不存在。' }
  const tower = b.structures[i]
  const refund = Math.floor(TOWER_SPECS[tower.type].cost * 0.58 + Math.max(0, tower.level - 1) * 22)
  b.structures.splice(i, 1)
  run.metal += refund
  recalculateGrid(run)
  return { ok: true, message: `设施拆解 · 返还 ${refund} 合金。` }
}

export function recalculateGrid(run: RunState): void {
  const b = run.battle
  if (!b) return
  // Retain legacy flags for save compatibility; every intact tower is self powered.
  for (const tower of b.structures) {
    tower.connected = tower.health > 0
    tower.powered = tower.health > 0
  }
  b.gridUsed = 0
  b.gridMax = 0

}

export function useSkill(run: RunState, skill: 'strike' | 'stasis' | 'shield' | 'repair', x?: number, y?: number): { ok: boolean; message: string; needsTarget?: boolean } {
  const b = run.battle
  if (!b) return { ok: false, message: '该技能只能在战场中使用。' }
  if (run.cells <= 0) return { ok: false, message: '指挥电池已耗尽。' }
  if ((run.skillCooldowns[skill] ?? 0) > 0) return { ok: false, message: '技能仍在冷却。' }
  if (skill === 'strike' && (x === undefined || y === undefined)) return { ok: false, message: '请选择轨道轰击位置。', needsTarget: true }
  run.cells -= 1
  if (skill === 'strike') {
    const radius = 100
    for (const enemy of b.enemies) if (Math.hypot(enemy.x - x!, enemy.y - y!) <= radius + (enemy.kind === 'boss' ? 35 : 0)) damageEnemy(run, enemy, 560, 'skill')
    b.effects.push({ kind: 'blast', life: 0.8, maxLife: 0.8, x: x!, y: y!, radius, color: '#f2a86f', label: '轨道打击' })
    run.skillCooldowns.strike = 35
    run.score += 3
    return { ok: true, message: '轨道轰击已执行。' }
  }
  if (skill === 'stasis') {
    for (const enemy of b.enemies) { enemy.slow = Math.max(enemy.slow, 0.88); enemy.slowTimer = Math.max(enemy.slowTimer, 4.5) }
    b.effects.push({ kind: 'pulse', life: 1.1, maxLife: 1.1, x: 500, y: 300, radius: 490, color: '#8cc9e5', label: '全域冻结' })
    run.skillCooldowns.stasis = 52
    return { ok: true, message: '全域冻结 · 敌人行动受限。' }
  }
  if (skill === 'shield') {
    run.coreShield = Math.min(70, run.coreShield + 42)
    run.shieldTimer = Math.max(run.shieldTimer, 24)
    b.effects.push({ kind: 'pulse', life: 0.8, maxLife: 0.8, x: 500, y: 300, radius: 145, color: '#73cae0', label: '舰队护盾' })
    run.skillCooldowns.shield = 62
    return { ok: true, message: '舰队护盾已展开。' }
  }
  let repaired = 0
  for (const t of b.structures) {
    const amount = Math.min(t.maxHealth - t.health, 70)
    if (amount > 0) { t.health += amount; repaired += 1 }
    t.jammed = 0
  }
  run.core = Math.min(run.maxCore, run.core + 14)
  b.effects.push({ kind: 'pulse', life: 0.9, maxLife: 0.9, x: 500, y: 300, radius: 240, color: '#a7c98b', label: '维修蜂群' })
  run.skillCooldowns.repair = 72
  return { ok: true, message: `维修完成 · 恢复 ${repaired} 座设施与舰队耐久。` }
}

export function tickRun(run: RunState, rawDt: number, onCombat?: CombatFeedback, preparationDt = rawDt): 'victory' | 'defeat' | 'wave' | 'wave-start' | null {
  if (run.end) return run.end
  if (run.core <= 0) return 'defeat'
  const dt = Math.min(rawDt, 0.06)
  run.elapsed += dt
  if (run.shieldTimer > 0) run.shieldTimer = Math.max(0, run.shieldTimer - dt)
  for (const key of Object.keys(run.skillCooldowns)) run.skillCooldowns[key] = Math.max(0, (run.skillCooldowns[key] ?? 0) - dt)
  const b = run.battle
  if (!b) return null
  let waveStarted = false
  const countdown = getNextWaveCountdown(b)
  if (countdown !== null) {
    // The app passes real active time here so 2x/3x retains three seconds to build.
    b.nextWaveIn = Math.max(0, countdown - Math.min(dt, Math.max(0, preparationDt)))
    if (b.nextWaveIn < 1e-8 && startWave(run)) {
      b.spawnTimer = 0
      waveStarted = true
    }
  }
  b.elapsed += dt
  if (b.disruption > 0) b.disruption = Math.max(0, b.disruption - dt)
  b.lastGridCheck += dt
  if (b.lastGridCheck >= 0.4) { b.lastGridCheck = 0; recalculateGrid(run) }
  if (!b.waveCleared) {
    b.spawnTimer -= dt
    if (b.waveQueue.length && b.spawnTimer <= 0) {
      const kind = b.waveQueue.shift()!
      b.enemies.push(spawnEnemy(run, b, kind))
      b.spawnTimer = kind === 'boss' ? 2.5 : b.isBoss ? 0.92 : 0.8 + random(run) * 0.26
    }
  }
  tickEnemies(run, b, dt)
  tickStructures(run, b, dt, onCombat)
  tickProjectiles(run, b, dt, onCombat)
  tickBoss(run, b, dt)
  b.effects = b.effects.filter(effect => (effect.life -= dt) > 0)
  if (run.core <= 0) return 'defeat'
  if (b.wave >= 0 && !b.waveCleared && b.waveQueue.length === 0 && b.enemies.length === 0 && b.projectiles.length === 0) {
    b.waveCleared = true
    finishBattleWave(run)
    if (b.wave >= b.maxWaves - 1) return 'victory'
    b.nextWaveIn = WAVE_INTERVAL_SECONDS
    return 'wave'
  }
  return waveStarted ? 'wave-start' : null
}

function tickEnemies(run: RunState, b: Battle, dt: number): void {
  const survivors: Enemy[] = []
  const children: Enemy[] = []
  for (const enemy of b.enemies) {
    // Remove destroyed units before movement, attraction, regeneration or attacks.
    if (enemy.hp <= 0) { onEnemyDeath(run, b, enemy, children); continue }
    const p = positionAt(b.path, enemy.dist)
    enemy.x = p.x
    enemy.y = p.y
    if (enemy.slowTimer > 0) enemy.slowTimer = Math.max(0, enemy.slowTimer - dt)
    else enemy.slow = 0
    if (enemy.burnTimer > 0) {
      enemy.burnTimer -= dt
      enemy.hp -= enemy.burn * dt
    }
    if (enemy.hp <= 0) { onEnemyDeath(run, b, enemy, children); continue }
    const carrier = b.enemies.find(other => other.hp > 0 && other.kind === 'carrier' && other !== enemy && Math.hypot(other.x - enemy.x, other.y - enemy.y) < 118)
    if (carrier && enemy.kind !== 'boss' && enemy.kind !== 'carrier') {
      enemy.maxShield = Math.max(enemy.maxShield, 38)
      enemy.shield = Math.min(enemy.maxShield, enemy.shield + 5 * dt)
    }
    enemy.lureCooldown = Math.max(0, (enemy.lureCooldown ?? 0) - dt)
    const lure = b.structures.filter(t => t.health > 0 && t.type === 'lure' && t.powered && t.jammed <= 0 && enemy.kind !== 'boss' && enemy.kind !== 'jumper')
      .find(t => Math.hypot(b.pads[t.slot].x - enemy.x, b.pads[t.slot].y - enemy.y) <= getTowerStats(t, run).range)
    if (enemy.lureTimer <= 0 && enemy.lureCooldown <= 0 && lure) { enemy.lureTimer = 1.45; enemy.lureCooldown = 8 }
    if (enemy.lureTimer > 0) {
      enemy.lureTimer = Math.max(0, enemy.lureTimer - dt)
      if (lure) {
        const lp = b.pads[lure.slot]
        const angle = enemy.lureSeed / 100 + b.elapsed * 3.8
        enemy.x = lp.x + Math.cos(angle) * 33
        enemy.y = lp.y + Math.sin(angle) * 21
      } else {
        const fallback = positionAt(b.path, enemy.dist)
        enemy.x = fallback.x; enemy.y = fallback.y
      }
      survivors.push(enemy)
      continue
    }
    const base = ENEMY_BASE[enemy.kind]
    let speed = base.speed * (1 - enemy.slow)
    if (enemy.kind === 'boss' && enemy.bossPhase >= 2) speed *= 1.15
    if (enemy.kind === 'jumper') {
      enemy.teleportTimer -= dt
      if (enemy.teleportTimer <= 0) { enemy.dist += 95; enemy.teleportTimer = 5.8; b.effects.push({ kind: 'burst', life: 0.35, maxLife: 0.35, x: enemy.x, y: enemy.y, radius: 24, color: '#b99be8' }) }
    }
    enemy.dist += speed * dt
    const newP = positionAt(b.path, enemy.dist)
    enemy.x = newP.x
    enemy.y = newP.y
    if (enemy.kind === 'jammer') {
      enemy.attackTimer -= dt
      if (enemy.attackTimer <= 0) {
        const target = b.structures.filter(t => t.health > 0).sort((a, z) => Math.hypot(b.pads[a.slot].x - enemy.x, b.pads[a.slot].y - enemy.y) - Math.hypot(b.pads[z.slot].x - enemy.x, b.pads[z.slot].y - enemy.y))[0]
        if (target && Math.hypot(b.pads[target.slot].x - enemy.x, b.pads[target.slot].y - enemy.y) < 170) {
          target.jammed = 3.4
          b.effects.push({ kind: 'beam', life: 0.5, maxLife: 0.5, x: enemy.x, y: enemy.y, x2: b.pads[target.slot].x, y2: b.pads[target.slot].y, color: '#c088d8', label: '链路干扰' })
        }
        enemy.attackTimer = 5.5
      }
    }
    if (enemy.kind === 'siege') {
      enemy.attackTimer -= dt
      if (enemy.attackTimer <= 0) {
        const target = b.structures.filter(t => Math.hypot(b.pads[t.slot].x - enemy.x, b.pads[t.slot].y - enemy.y) < 53)
          .sort((a, z) => Math.hypot(b.pads[a.slot].x - enemy.x, b.pads[a.slot].y - enemy.y) - Math.hypot(b.pads[z.slot].x - enemy.x, b.pads[z.slot].y - enemy.y))[0]
        if (target) {
          target.health = Math.max(0, target.health - 34)
          b.effects.push({ kind: 'beam', life: 0.28, maxLife: 0.28, x: enemy.x, y: enemy.y, x2: b.pads[target.slot].x, y2: b.pads[target.slot].y, color: '#e08a6d', label: '攻城冲击' })
        }
        enemy.attackTimer = 2.6
      }
    }
    if (enemy.hp <= 0) { onEnemyDeath(run, b, enemy, children); continue }
    if (enemy.dist >= b.pathLength) {
      // The flagship breaking through is a defeat, rather than an accidental clear.
      const damage = enemy.kind === 'boss' ? Math.max(base.core, run.core + run.coreShield) : base.core
      const absorbed = Math.min(run.coreShield, damage)
      run.coreShield -= absorbed
      run.core = Math.max(0, run.core - (damage - absorbed))
      run.leaks += 1
      run.fleetPressure += damage
      b.effects.push({ kind: 'burst', life: 0.42, maxLife: 0.42, x: 952, y: 295, radius: 42, color: '#e17468', label: `-${damage}` })
      continue
    }
    survivors.push(enemy)
  }
  b.enemies = survivors.concat(children)
}

function tickStructures(run: RunState, b: Battle, dt: number, onCombat?: CombatFeedback): void {
  for (const t of b.structures) {
    t.jammed = Math.max(0, t.jammed - dt)
    t.cooldown -= dt
    if (t.health <= 0) { t.powered = false; continue }
    if (t.type === 'shield' && t.health > 0 && t.jammed <= 0 && run.coreShield < 42) {
      t.repairTimer -= dt
      if (t.repairTimer <= 0) { run.coreShield = Math.min(42, run.coreShield + 1); t.repairTimer = t.branch === 'B' ? 0.17 : 0.28 }
    }
    if (t.type === 'drone' && t.health > 0 && t.jammed <= 0) {
      t.repairTimer -= dt
      if (t.repairTimer <= 0) {
        const damaged = b.structures.filter(s => s.id !== t.id && s.health > 0 && s.health < s.maxHealth && Math.hypot(b.pads[s.slot].x - b.pads[t.slot].x, b.pads[s.slot].y - b.pads[t.slot].y) <= getTowerStats(t, run).range).sort((a, z) => a.health / a.maxHealth - z.health / z.maxHealth)[0]
        if (damaged) { damaged.health = Math.min(damaged.maxHealth, damaged.health + (t.branch === 'A' ? 24 : 12)); b.effects.push({ kind: 'beam', life: 0.38, maxLife: 0.38, x: b.pads[t.slot].x, y: b.pads[t.slot].y - 12, x2: b.pads[damaged.slot].x, y2: b.pads[damaged.slot].y, color: '#a7cf91' }) }
        t.repairTimer = run.boons.includes('droneCare') ? 3.8 : 5.5
      }
    }
    if (t.jammed > 0) continue
    const stats = getTowerStats(t, run)
    if (t.cooldown > 0) continue
    const inRange = getTowerTargets(run, t)
    if (!inRange.length) continue
    let target = chooseTarget(inRange, t.targetMode, b.pathLength)
    if (t.type === 'cold' && t.branch === 'A') target = inRange.filter(e => e.kind === 'boss' || ['siege', 'carrier', 'jammer'].includes(e.kind)).sort((a, z) => z.maxHp - a.maxHp)[0] ?? target
    fireTower(run, b, t, target, stats, onCombat)
    t.cooldown = stats.cooldown || 1
  }
}

function blockedByTerrain(b: Battle, pad: { x: number; y: number }, enemy: Enemy): boolean {
  if (b.zone !== 1) return false
  const mx = (pad.x + enemy.x) / 2
  const my = (pad.y + enemy.y) / 2
  return ((mx > 385 && mx < 478 && my > 180 && my < 255) || (mx > 685 && mx < 760 && my > 225 && my < 300))
}

export function getTowerTargets(run: RunState, tower: Structure): Enemy[] {
  const b = run.battle
  if (!b) return []
  const pad = b.pads[tower.slot], stats = getTowerStats(tower, run)
  // Homing missiles and drones can pass around obstacles; direct weapons require sight.
  return b.enemies.filter(e => e.hp > 0 && Math.hypot(e.x - pad.x, e.y - pad.y) <= stats.range && (['comet', 'drone', 'relay', 'shield', 'lure'].includes(tower.type) || !blockedByTerrain(b, pad, e)))
}

export function getTowerStatus(run: RunState, tower: Structure): { label: string; detail: string; tone: 'good' | 'warn' | 'bad'; attacking: boolean } {
  if (tower.health <= 0) return { label: '设施损毁', detail: '使用维修蜂群修复，或拆解后重新部署。', tone: 'bad', attacking: false }
  if (tower.jammed > 0) return { label: '武器受干扰', detail: `${Math.ceil(tower.jammed)} 秒后自动恢复，维修蜂群可立即清除干扰。`, tone: 'warn', attacking: false }
  const targets = getTowerTargets(run, tower)
  if (!targets.length) {
    const b = run.battle!, pad = b.pads[tower.slot], range = getTowerStats(tower, run).range
    const occluded = b.enemies.some(e => e.hp > 0 && Math.hypot(e.x-pad.x,e.y-pad.y) <= range)
    return { label: occluded ? '射线受阻' : '等待敌人进入射程', detail: occluded ? '地形挡住直射路线，可换用导弹或无人机覆盖。' : '已独立就绪，敌人进入射程后自动攻击，无需其他建筑。', tone: occluded ? 'warn' : 'good', attacking: true }
  }
  return { label: tower.cooldown > 0 ? '武器装填中' : '目标已锁定', detail: '自动攻击中，可切换目标优先级。', tone: 'good', attacking: true }
}

function chooseTarget(enemies: Enemy[], mode: Structure['targetMode'], pathLength: number): Enemy {
  if (mode === 'strong') return [...enemies].sort((a, b) => (b.maxHp + b.maxShield) - (a.maxHp + a.maxShield) || b.dist - a.dist)[0]
  if (mode === 'support') return [...enemies].sort((a, b) => Number(['carrier', 'jammer', 'boss'].includes(b.kind)) - Number(['carrier', 'jammer', 'boss'].includes(a.kind)) || b.dist - a.dist)[0]
  return [...enemies].sort((a, b) => b.dist / pathLength - a.dist / pathLength)[0]
}

function fireTower(run: RunState, b: Battle, t: Structure, target: Enemy, stats: ReturnType<typeof getTowerStats>, onCombat?: CombatFeedback): void {
  const pad = b.pads[t.slot]
  const pivot = towerAimOrigin(t.type, pad)
  const aimAngle = Math.atan2(target.y - pivot.y, target.x - pivot.x)
  const frame = towerAngleToFrame(aimAngle)
  const origin = towerMuzzle(t.type, pad, frame, t.shotsFired ?? 0)
  const angle = Math.atan2(target.y - origin.y, target.x - origin.x)
  t.shotsFired = (t.shotsFired ?? 0) + 1
  const color = TOWER_SPECS[t.type].color
  b.effects.push({ kind: 'muzzle', life: 0.22, maxLife: 0.22, x: origin.x, y: origin.y, angle, frame, color, source: t.id, weapon: t.type })
  onCombat?.({ kind: 'fire', weapon: t.type, x: origin.x, y: origin.y })
  const impact = (enemy: Enemy) => b.effects.push({ kind: 'spark', life: 0.32, maxLife: 0.32, x: enemy.x, y: enemy.y, radius: t.type === 'rail' ? 27 : 22, color, angle, weapon: t.type })
  if (t.type === 'relay') {
    damageEnemy(run, target, stats.damage, t.id); impact(target)
    b.effects.push({ kind: 'beam', life: 0.28, maxLife: 0.28, x: origin.x, y: origin.y, x2: target.x, y2: target.y, color, weapon: t.type })
    onCombat?.({ kind: 'impact', weapon: t.type, x: target.x, y: target.y })
    return
  }
  if (t.type === 'shield' || t.type === 'lure') {
    for (const enemy of getTowerTargets(run, t)) { damageEnemy(run, enemy, stats.damage, t.id); impact(enemy) }
    b.effects.push({ kind: 'pulse', life: 0.5, maxLife: 0.5, x: pad.x, y: pad.y, radius: stats.range, color, weapon: t.type })
    b.effects.push({ kind: 'beam', life: 0.22, maxLife: 0.22, x: origin.x, y: origin.y, x2: target.x, y2: target.y, color, weapon: t.type })
    onCombat?.({ kind: 'impact', weapon: t.type, x: target.x, y: target.y })
    return
  }
  if (t.type === 'rail') {
    const hitOrigin = { x: pad.x, y: pad.y - 18 }
    const dx = target.x - hitOrigin.x
    const dy = target.y - hitOrigin.y
    const len2 = dx * dx + dy * dy || 1
    const hits = b.enemies.filter(e => {
      if (e.hp <= 0) return false
      const u = ((e.x - hitOrigin.x) * dx + (e.y - hitOrigin.y) * dy) / len2
      if (u < 0 || u > 1.08) return false
      const px = hitOrigin.x + u * dx
      const py = hitOrigin.y + u * dy
      return Math.hypot(e.x - px, e.y - py) < 25
    }).sort((a, z) => a.dist - z.dist)
    const pierce = t.branch === 'A' ? 4 : 3
    for (const enemy of hits.slice(0, pierce)) {
      damageEnemy(run, enemy, stats.damage * (enemy.kind === 'boss' && t.branch === 'B' ? 1.45 : 1), t.id)
      impact(enemy)
    }
    if (t.branch === 'A' && hits.length) {
      const first = hits[0]
      const chained = b.enemies.find(e => e.hp > 0 && !hits.slice(0, pierce).includes(e) && Math.hypot(e.x - first.x, e.y - first.y) < 115)
      if (chained) { damageEnemy(run, chained, stats.damage * 0.6, t.id); b.effects.push({ kind: 'arc', life: 0.3, maxLife: 0.3, x: first.x, y: first.y, points: [{ x: chained.x, y: chained.y }], color, weapon: t.type }) }
    }
    b.effects.push({ kind: 'beam', life: 0.36, maxLife: 0.36, x: origin.x, y: origin.y, x2: target.x, y2: target.y, color, weapon: t.type })
    onCombat?.({ kind: 'impact', weapon: t.type, x: target.x, y: target.y })
    return
  }
  if (t.type === 'arc') {
    const maxJumps = t.branch === 'A' ? 5 : 3
    const hit: Enemy[] = [target]
    let current = target
    while (hit.length < maxJumps) {
      const next = b.enemies.filter(e => e.hp > 0 && !hit.includes(e) && Math.hypot(e.x - current.x, e.y - current.y) < 100).sort((a, z) => Math.hypot(a.x - current.x, a.y - current.y) - Math.hypot(z.x - current.x, z.y - current.y))[0]
      if (!next) break
      hit.push(next); current = next
    }
    for (let i = 0; i < hit.length; i += 1) {
      const enemy = hit[i]
      damageEnemy(run, enemy, stats.damage * (i === 0 ? 1 : 0.72), t.id)
      impact(enemy)
      if (enemy.shield > 0) enemy.shield = Math.max(0, enemy.shield - (t.branch === 'B' ? 45 : 20))
    }
    b.effects.push({ kind: 'arc', life: 0.36, maxLife: 0.36, x: origin.x, y: origin.y, points: hit.map(e => ({ x: e.x, y: e.y })), color, weapon: t.type })
    onCombat?.({ kind: 'impact', weapon: t.type, x: target.x, y: target.y })
    return
  }
  if (t.type === 'comet' && t.branch === 'B') {
    damageEnemy(run, target, stats.damage * 1.2, t.id)
    b.effects.push({ kind: 'beam', life: 0.24, maxLife: 0.24, x: origin.x, y: origin.y, x2: target.x, y2: target.y, color, weapon: t.type })
    b.effects.push({ kind: 'blast', life: 0.42, maxLife: 0.42, x: target.x, y: target.y, radius: 34, color })
    onCombat?.({ kind: 'impact', weapon: t.type, x: target.x, y: target.y })
    return
  }
  const kind = t.type === 'comet' ? 'comet' : t.type === 'cold' ? 'cold' : t.type === 'drone' ? 'drone' : 'needle'
  b.projectiles.push({ id: `${t.id}-${Math.round(b.elapsed * 1000)}-${b.projectiles.length}`, kind, x: origin.x, y: origin.y, angle, target: target.id, speed: kind === 'comet' ? 205 : kind === 'cold' ? 315 : kind === 'drone' ? 420 : 530, damage: stats.damage, splash: t.type === 'comet' ? (t.branch === 'A' ? 90 : 75) : 0, color, source: t.id, branch: t.branch })
  if (t.type === 'cold' && t.branch === 'B') { target.burn = Math.max(target.burn, 9); target.burnTimer = Math.max(target.burnTimer, 2.8) }
}

function tickProjectiles(run: RunState, b: Battle, dt: number, onCombat?: CombatFeedback): void {
  const keep: Projectile[] = []
  for (const shot of b.projectiles) {
    let target = b.enemies.find(e => e.id === shot.target && e.hp > 0)
    if (!target) target = b.enemies.filter(e => e.hp > 0 && Math.hypot(e.x - shot.x, e.y - shot.y) < 140).sort((a, z) => z.dist - a.dist)[0]
    if (!target) continue
    shot.target = target.id
    const dx = target.x - shot.x
    const dy = target.y - shot.y
    const dist = Math.hypot(dx, dy)
    shot.angle = Math.atan2(dy, dx)
    if (dist <= shot.speed * dt + 7) {
      shot.x = target.x; shot.y = target.y
      onCombat?.({ kind: 'impact', weapon: shot.kind, x: shot.x, y: shot.y })
      if (shot.kind === 'comet') {
        for (const enemy of b.enemies) if (enemy.hp > 0 && Math.hypot(enemy.x - shot.x, enemy.y - shot.y) <= shot.splash + (enemy.kind === 'boss' ? 25 : 0)) damageEnemy(run, enemy, shot.damage * (enemy === target ? 1 : 0.64), shot.source)
        b.effects.push({ kind: 'blast', life: 0.48, maxLife: 0.48, x: shot.x, y: shot.y, radius: shot.splash, color: shot.color, weapon: shot.kind })
        if (shot.branch === 'A') for (let i = 0; i < 3; i++) {
          const a = (shot.angle ?? 0) + i * Math.PI * 2 / 3, x = shot.x + Math.cos(a) * 42, y = shot.y + Math.sin(a) * 42
          for (const enemy of b.enemies) if (enemy.hp > 0 && Math.hypot(enemy.x - x, enemy.y - y) < 35) damageEnemy(run, enemy, shot.damage * 0.22, shot.source)
          b.effects.push({ kind: 'blast', life: 0.35, maxLife: 0.35, x, y, radius: 35, color: shot.color, weapon: shot.kind })
        }
      } else {
        damageEnemy(run, target, shot.damage, shot.source)
        if (shot.kind === 'needle' && shot.branch === 'A') {
          const next = b.enemies.find(e => e.hp > 0 && e !== target && Math.hypot(e.x - shot.x, e.y - shot.y) < 80)
          if (next) { damageEnemy(run, next, shot.damage * 0.55, shot.source); b.effects.push({ kind: 'beam', life: 0.18, maxLife: 0.18, x: shot.x, y: shot.y, x2: next.x, y2: next.y, color: shot.color, weapon: shot.kind }) }
        }
        if (shot.kind === 'cold' && target.hp > 0) { target.slow = Math.max(target.slow, 0.58); target.slowTimer = Math.max(target.slowTimer, 2.8) }
        if (shot.kind === 'cold' && run.boons.includes('coldAftershock')) {
          for (const nearby of b.enemies) if (nearby !== target && Math.hypot(nearby.x - shot.x, nearby.y - shot.y) < 56) damageEnemy(run, nearby, 24, shot.source)
          b.effects.push({ kind: 'pulse', life: 0.3, maxLife: 0.3, x: shot.x, y: shot.y, radius: 56, color: '#9bd4e5', label: '凝霜回响' })
        }
        b.effects.push({ kind: 'spark', life: 0.32, maxLife: 0.32, x: shot.x, y: shot.y, radius: shot.kind === 'cold' ? 27 : 20, color: shot.color, angle: shot.angle, weapon: shot.kind })
      }
    } else {
      shot.x += (dx / dist) * shot.speed * dt
      shot.y += (dy / dist) * shot.speed * dt
      keep.push(shot)
    }
  }
  b.projectiles = keep
}

function damageEnemy(run: RunState, enemy: Enemy, raw: number, source: string): void {
  const base = ENEMY_BASE[enemy.kind]
  let damage = raw * (1 - base.armor)
  if (enemy.kind === 'boss' && run.boons.includes('bossBreaker')) damage *= 1.25
  if (enemy.shield > 0) {
    const absorbed = Math.min(enemy.shield, damage)
    enemy.shield -= absorbed
    damage -= absorbed * 0.65
  }
  enemy.hp -= Math.max(0, damage)
  void source
  const b = run.battle
  if (b) b.damageDealt += Math.max(0, damage)
}

function onEnemyDeath(run: RunState, b: Battle, enemy: Enemy, children: Enemy[]): void {
  run.kills += 1
  run.metal += ENEMY_BASE[enemy.kind].bounty
  if (run.boons.includes('ember')) run.metal += 1
  run.score += enemy.kind === 'boss' ? 150 : ENEMY_BASE[enemy.kind].bounty
  if (enemy.kind === 'splitter') {
    for (let i = 0; i < 2; i += 1) {
      const child = spawnEnemy(run, b, 'mite')
      child.dist = Math.max(0, enemy.dist - 5 - i * 4)
      const p = positionAt(b.path, child.dist); child.x = p.x; child.y = p.y
      children.push(child)
    }
  }
  if (enemy.kind === 'boss') b.effects.push({ kind: 'blast', life: 1.2, maxLife: 1.2, x: enemy.x, y: enemy.y, radius: 125, color: '#ed9a6b', label: '断界者失能' })
  else b.effects.push({ kind: 'burst', life: 0.24, maxLife: 0.24, x: enemy.x, y: enemy.y, radius: enemy.kind === 'siege' ? 29 : 18, color: '#e6ac74' })
}

function tickBoss(run: RunState, b: Battle, dt: number): void {
  const boss = b.enemies.find(e => e.kind === 'boss')
  if (boss) {
    const ratio = boss.hp / boss.maxHp
    const phase = ratio > 0.64 ? 1 : ratio > 0.29 ? 2 : 3
    if (phase > boss.bossPhase) {
      boss.bossPhase = phase
      b.effects.push({ kind: 'warning', life: 1.5, maxLife: 1.5, x: boss.x, y: boss.y, radius: 120, color: '#f06e61', label: phase === 2 ? '旗舰二阶段 · 核心过载' : '旗舰终阶段 · 武器干扰' })
    }
  }
  if (!b.isBoss || b.wave < 0 || b.waveCleared || !boss || boss.hp <= 0) return
  b.bossAttackTimer -= dt
  if (b.bossWarning) {
    b.bossWarning.timer -= dt
    if (b.bossWarning.timer <= 0) {
      const warning = b.bossWarning
      if (warning.kind === 'sweep') {
        const damaged = b.structures.filter(t => Math.hypot(b.pads[t.slot].x - warning.x, b.pads[t.slot].y - warning.y) < 155)
        for (const t of damaged) {
          t.health -= 48
          if (t.health <= 0) { t.health = 0; t.powered = false }
        }
        if (damaged.length === 0) {
          if (run.coreShield > 0) run.coreShield = Math.max(0, run.coreShield - 18)
          else run.core = Math.max(0, run.core - 12)
        }
        b.effects.push({ kind: 'blast', life: 0.8, maxLife: 0.8, x: warning.x, y: warning.y, radius: 155, color: '#e16e64', label: '舰炮扫射' })
      } else if (warning.kind === 'reinforce') {
        for (const kind of ['scout', 'scout', 'jumper']) b.enemies.push(spawnEnemy(run, b, kind as EnemyKind))
        b.effects.push({ kind: 'warning', life: 0.7, maxLife: 0.7, x: warning.x, y: warning.y, radius: 80, color: '#e9ae6c', label: '护航编队入场' })
      } else {
        b.disruption = 0
        for (const t of b.structures.filter(s => s.health > 0 && Math.hypot(b.pads[s.slot].x - warning.x, b.pads[s.slot].y - warning.y) < 220)) t.jammed = 3
        recalculateGrid(run)
        b.effects.push({ kind: 'pulse', life: 0.9, maxLife: 0.9, x: warning.x, y: warning.y, radius: 220, color: '#d47b9d', label: '武器干扰脉冲' })
      }
      b.bossWarning = null
    }
  }
  if (b.bossAttackTimer <= 0 && !b.bossWarning) {
    const phase = boss?.bossPhase ?? 1
    const attacks: ('sweep' | 'reinforce' | 'jam')[] = phase === 1 ? ['sweep', 'reinforce'] : phase === 2 ? ['sweep', 'jam', 'reinforce'] : ['sweep', 'jam', 'sweep']
    const kind = attacks[Math.floor(random(run) * attacks.length)]
    const target = b.structures.length ? b.pads[b.structures[Math.floor(random(run) * b.structures.length)].slot] : { x: 550, y: 300 }
    b.bossWarning = { kind, timer: 2.3, x: target.x, y: target.y }
    b.bossAttackTimer = phase === 3 ? 9 : 12
    b.effects.push({ kind: 'warning', life: 2.3, maxLife: 2.3, x: target.x, y: target.y, radius: kind === 'sweep' ? 155 : 105, color: '#ec7065', label: kind === 'sweep' ? '旗舰炮击预警' : kind === 'reinforce' ? '护航信号预警' : '干扰脉冲预警' })
  }
}

export function selectBoon(run: RunState): { id: string; name: string; description: string }[] {
  const pool = [
    { id: 'coil', name: '磁芯重铸', description: '轨矛与弧光伤害提高 16%。' },
    { id: 'ember', name: '余烬弹链', description: '针蜂射速提高 16%，击杀额外返还合金。' },
    { id: 'coldAftershock', name: '凝霜回响', description: '冷凝命中后，附近敌人受到小范围冲击。' },
    { id: 'droneCare', name: '蜂巢协议', description: '巡游蜂巢修理频率提高。' },
    { id: 'relaySync', name: '火控协同', description: '所有防御建筑射速提高 7%。' },
    { id: 'alloy', name: '钨铼弹芯', description: '轨矛与彗星对所有目标造成额外伤害。' },
    { id: 'bossBreaker', name: '旗舰识别码', description: '所有武器对断界者的伤害提高。' },
    { id: 'salvage', name: '战场回收', description: '每波結束时回收 12 合金。' },
  ]
  const available = pool.filter(b => !run.boons.includes(b.id))
  const options: typeof pool = []
  while (options.length < Math.min(3, available.length)) {
    const pick = available.splice(Math.floor(random(run) * available.length), 1)[0]
    if (pick) options.push(pick)
  }
  return options
}

export function finishBattleWave(run: RunState): void {
  if (!run.battle) return
  if (run.boons.includes('salvage')) run.metal += 12
  run.cells = Math.min(9, run.cells + 1)
}

export function openShop(run: RunState): string[] {
  const items = ['metal', 'repair', 'cells', 'module', 'shield', 'draw']
  run.shopItems = shuffle(run, items).slice(0, 4)
  return run.shopItems
}

export function shopItem(run: RunState, item: string): { ok: boolean; message: string } {
  const prices: Record<string, number> = { metal: 0, repair: 48, cells: 36, module: 64, shield: 42, draw: 52 }
  const cost = prices[item] ?? 999
  if (!run.shopItems.includes(item)) return { ok: false, message: '商品已售出。' }
  if (run.metal < cost) return { ok: false, message: `需要 ${cost} 合金。` }
  run.metal -= cost
  run.shopItems = run.shopItems.filter(s => s !== item)
  if (item === 'metal') run.metal += 55
  if (item === 'repair') run.core = Math.min(run.maxCore, run.core + 28)
  if (item === 'cells') run.cells = Math.min(9, run.cells + 3)
  if (item === 'module') {
    const options = ['coil', 'ember', 'coldAftershock', 'droneCare', 'relaySync', 'alloy', 'bossBreaker'].filter(id => !run.boons.includes(id))
    if (!options.length) run.metal += 40
    else run.boons.push(options[Math.floor(random(run) * options.length)])
  }
  if (item === 'shield') { run.coreShield = Math.min(70, run.coreShield + 35); run.shieldTimer = 18 }
  if (item === 'draw') { if (!run.boons.includes('relaySync')) run.boons.push('relaySync'); else run.metal += 52 }
  return { ok: true, message: ({ metal: '回收货舱已换得 55 合金。', repair: '舰队核心修复 28 点。', cells: '获得 3 个能源电池。', module: '已安装一件随机战术模块。', shield: '核心护盾恢复 35 点。', draw: '火控校准完成 · 所有建筑射速提高 7%；已有模块时返还合金。' } as Record<string, string>)[item] }
}

export function applyEventChoice(run: RunState, choice: 'risk' | 'safe' | 'tech'): string {
  if (choice === 'risk') {
    if (random(run) < 0.58) { run.metal += 90; run.cells = Math.min(9, run.cells + 1); run.eventResult = '舱门锁解除 · 获得 90 合金与 1 电池。'; return run.eventResult }
    run.core = Math.max(1, run.core - 18); run.eventResult = '货舱核心失稳 · 舰队耐久损失 18。'; return run.eventResult
  }
  if (choice === 'safe') { run.metal += 42; run.core = Math.min(run.maxCore, run.core + 8); run.eventResult = '成功回收补给 · 获得 42 合金并修复 8 耐久。'; return run.eventResult }
  if (!run.boons.includes('relaySync')) run.boons.push('relaySync'); run.eventResult = '未知信号译码完成 · 获得火控协同，所有建筑射速提高 7%。'; return run.eventResult
}

export function completeNode(run: RunState, node: MapNode): void {
  run.visited.push(node.id)
  run.campaignHistory.push(node.title)
  run.activeNode = null
  run.battle = null
  run.pendingBoons = []
  run.eventResult = ''
  run.serviceDone = false
  run.mapLayer = Math.min(5, node.layer + 1)
}

export function finishRun(run: RunState, result: 'victory' | 'defeat', meta: MetaProgress): MetaProgress {
  run.end = result
  const won = result === 'victory'
  if (won) {
    run.score += Math.max(0, Math.round(run.core * 1.2 + run.kills * 2 + run.metal * 0.2 - run.elapsed / 5))
    meta.wins += 1
    meta.research += 3
    if (meta.wins === 1) meta.unlocks = [...new Set([...meta.unlocks, 'challengeStorm'])]
  } else {
    meta.losses += 1
    meta.research += 1
  }
  meta.bestScore = Math.max(meta.bestScore, run.score)
  meta.records.unshift({ date: new Date().toLocaleDateString('zh-CN'), won, score: run.score, seed: run.seed, kills: run.kills, duration: Math.round(run.elapsed) })
  meta.records = meta.records.slice(0, 8)
  return meta
}

export function formatTime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds))
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat('zh-CN').format(Math.max(0, Math.floor(n)))
}

export function waveForecast(run: RunState): EnemyKind[] {
  const b = run.battle
  if (!b) return []
  return b.waveQueue.slice(0, 8)
}
