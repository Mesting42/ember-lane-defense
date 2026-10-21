import { useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import Battlefield from './Battlefield'
import Tutorial from './Tutorial'
import ModuleBadge from './ModuleBadge'
import { useRotationPause } from './useRotationPause'
import {
  applyEventChoice,
  completeNode,
  createBattle,
  createMeta,
  ENEMY_NAMES,
  finishRun,
  formatNumber,
  formatTime,
  getTowerStats,
  getTowerStatus,
  getBattleSalvage,
  getDeploymentReserve,
  makeRun,
  openShop,
  placeStructure,
  random,
  recalculateGrid,
  selectBoon,
  shopItem,
  startWave,
  getNextWaveCountdown,
  TOWER_ORDER,
  TOWER_SPECS,
  tickRun,
  upgradeStructure,
  useSkill,
  sellStructure,
} from './engine'
import type { Branch, Difficulty, MapNode, MetaProgress, NodeKind, RunState, TowerKind } from './engine'
import { configureAudio, playCombatSfx, playSfx, startAudio } from './audio'

type Screen = 'menu' | 'map' | 'battle' | 'reward' | 'shop' | 'event' | 'repair' | 'supply' | 'settings' | 'guide' | 'ending'
type Settings = { music: number; effects: number; reduceMotion: boolean; quality: 'standard' | 'high' }
type Store = { meta: MetaProgress; run: RunState | null; screen: Screen; settings: Settings }
const STORE_KEY = 'ember-lane-defense-v1'
const ALLOWED_SCREENS: Screen[] = ['menu', 'map', 'battle', 'reward', 'shop', 'event', 'repair', 'supply', 'settings', 'guide', 'ending']
const DEFAULT_SETTINGS: Settings = { music: 0.2, effects: 0.42, reduceMotion: false, quality: 'high' }

function readStore(storageKey = STORE_KEY): Store {
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return { meta: createMeta(), run: null, screen: 'menu', settings: { ...DEFAULT_SETTINGS } }
    const parsed = JSON.parse(raw) as Partial<Store>
    const meta = parsed.meta && Array.isArray(parsed.meta.records) ? parsed.meta as MetaProgress : createMeta()
    const run = parsed.run && typeof parsed.run.seed === 'string' && Array.isArray(parsed.run.nodes) ? parsed.run as RunState : null
    if (run?.battle) {
      run.battle.nextWaveIn = getNextWaveCountdown(run.battle)
      for (const pad of run.battle.pads) { pad.x = Math.max(72, Math.min(928, pad.x)); pad.y = Math.max(84, Math.min(535, pad.y)) }
      recalculateGrid(run)
    }
    const settings = { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}) }
    const screen = ALLOWED_SCREENS.includes(parsed.screen as Screen) ? parsed.screen as Screen : 'menu'
    return { meta, run, screen, settings }
  } catch {
    return { meta: createMeta(), run: null, screen: 'menu', settings: { ...DEFAULT_SETTINGS } }
  }
}

function clampSetting(value: number) { return Math.max(0, Math.min(1, value)) }

const NODE_INFO: Record<NodeKind, { name: string; icon: string; tint: string }> = {
  battle: { name: '防守战', icon: '⌁', tint: 'ice' },
  elite: { name: '精英战', icon: '◆', tint: 'ember' },
  shop: { name: '补给站', icon: '▤', tint: 'gold' },
  repair: { name: '维修平台', icon: '✚', tint: 'green' },
  event: { name: '未知事件', icon: '◌', tint: 'violet' },
  supply: { name: '回收点', icon: '⌑', tint: 'gold' },
  boss: { name: '旗舰战', icon: '✦', tint: 'red' },
}

const SHOP_INFO: Record<string, { name: string; detail: string; price: number; icon: string }> = {
  metal: { name: '货舱合金', detail: '即时换取 55 合金。', price: 0, icon: '▧' },
  repair: { name: '舰体焊补', detail: '恢复 28 点舰队核心耐久。', price: 48, icon: '✚' },
  cells: { name: '能源电池', detail: '获得 3 点指挥电池。', price: 36, icon: '▥' },
  module: { name: '密封模块', detail: '安装一件随机永久模块。', price: 64, icon: '⌘' },
  shield: { name: '相位涂层', detail: '恢复 35 点核心护盾。', price: 42, icon: '⬡' },
  draw: { name: '火控校准', detail: '所有建筑射速提高 7%；已有模块则返还费用。', price: 52, icon: 'ϟ' },
}

const BOON_LABELS: Record<string, string> = {
  coil: '磁芯重铸', ember: '余烬弹链', coldAftershock: '凝霜回响', droneCare: '蜂巢协议', relaySync: '火控协同', alloy: '钨铼弹芯', bossBreaker: '旗舰识别码', salvage: '战场回收',
}

function copyMeta(meta: MetaProgress): MetaProgress { return JSON.parse(JSON.stringify(meta)) as MetaProgress }

export default function App({ initialStore, storageKey = STORE_KEY }: { initialStore?: Store; storageKey?: string } = {}) {
  const [trainingOpen, setTrainingOpen] = useState(false)
  const bootRef = useRef<Store | null>(null)
  if (!bootRef.current) bootRef.current = initialStore ?? readStore(storageKey)
  const boot = bootRef.current
  const runRef = useRef<RunState | null>(boot.run)
  const metaRef = useRef<MetaProgress>(boot.meta)
  const settingsRef = useRef<Settings>(boot.settings)
  const screenRef = useRef<Screen>(boot.run?.end ? 'ending' : boot.screen)
  const [screen, setScreen] = useState<Screen>(screenRef.current)
  const [meta, setMeta] = useState<MetaProgress>(boot.meta)
  const [settings, setSettings] = useState<Settings>(boot.settings)
  const [revision, setRevision] = useState(0)
  const [paused, setPaused] = useState(screenRef.current === 'battle')
  const pausedRef = useRef(paused)
  const [speed, setSpeed] = useState(1)
  const speedRef = useRef(1)
  const [seedField, setSeedField] = useState('')
  const [difficulty, setDifficulty] = useState<Difficulty>('standard')
  const [buildType, setBuildType] = useState<TowerKind | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [targetSkill, setTargetSkill] = useState(false)
  const [toast, setToast] = useState('')
  const [toastTone, setToastTone] = useState<'good' | 'bad' | 'neutral'>('neutral')
  const [confirmNew, setConfirmNew] = useState(false)
  const [guidePage, setGuidePage] = useState<'flow' | 'battle' | 'enemies' | 'controls'>('flow')
  const [settingsFrom, setSettingsFrom] = useState<Screen>('menu')
  const [savePulse, setSavePulse] = useState(false)
  const [mobilePanel, setMobilePanel] = useState<'armory' | 'details'>('armory')
  const saveTimeout = useRef<number | undefined>(undefined)
  const run = runRef.current

  const persist = useCallback((nextScreen?: Screen, nextRun?: RunState | null, nextMeta?: MetaProgress, nextSettings?: Settings) => {
    try {
      localStorage.setItem(storageKey, JSON.stringify({
        meta: nextMeta ?? metaRef.current,
        run: nextRun === undefined ? runRef.current : nextRun,
        screen: nextScreen ?? screenRef.current,
        settings: nextSettings ?? settingsRef.current,
      } satisfies Store))
      setSavePulse(true)
      window.clearTimeout(saveTimeout.current)
      saveTimeout.current = window.setTimeout(() => setSavePulse(false), 1300)
    } catch { setToast('自动保存失败：本地空间不可用。'); setToastTone('bad') }
  }, [storageKey])

  const refresh = useCallback((save = true) => {
    setRevision(value => value + 1)
    if (save) persist()
  }, [persist])

  const go = useCallback((next: Screen) => {
    screenRef.current = next
    setScreen(next)
    persist(next)
  }, [persist])

  const updateMeta = useCallback((next: MetaProgress) => {
    metaRef.current = next
    setMeta(next)
    persist(undefined, undefined, next)
  }, [persist])

  const changePaused = useCallback((next: boolean) => {
    if (!next) void startAudio(settingsRef.current.music, settingsRef.current.effects)
    pausedRef.current = next
    setPaused(next)
    if (next) persist()
  }, [persist])

  const changeSpeed = useCallback((next: number) => {
    speedRef.current = next
    setSpeed(next)
  }, [])

  useRotationPause(screen === 'battle', () => changePaused(true))

  const notify = useCallback((message: string, tone: 'good' | 'bad' | 'neutral' = 'neutral') => {
    setToast(message)
    setToastTone(tone)
    playSfx(tone === 'bad' ? 'error' : 'confirm')
    window.setTimeout(() => setToast(current => current === message ? '' : current), 2800)
  }, [])

  const beginNewRun = useCallback((seedOverride?: string) => {
    void startAudio(settingsRef.current.music, settingsRef.current.effects)
    const next = makeRun(seedOverride ?? seedField, difficulty, metaRef.current)
    runRef.current = next
    setSelectedId(null); setBuildType(null); setTargetSkill(false)
    changePaused(true); changeSpeed(1)
    setRevision(value => value + 1)
    go('map')
    persist('map', next)
    notify(`航路已生成 · 种子 ${next.seed}`, 'good')
  }, [seedField, difficulty, changePaused, changeSpeed, go, persist, notify])

  const requestNewRun = useCallback(() => {
    if (runRef.current && !runRef.current.end && runRef.current.visited.length > 0) setConfirmNew(true)
    else beginNewRun()
  }, [beginNewRun])

  const continueRun = useCallback(() => {
    const current = runRef.current
    if (!current) return
    void startAudio(settingsRef.current.music, settingsRef.current.effects)
    const nodeKind = current.activeNode?.kind
    const nextScreen: Screen = current.end ? 'ending'
      : current.pendingBoons.length ? 'reward'
      : nodeKind === 'shop' ? 'shop'
      : nodeKind === 'event' ? 'event'
      : nodeKind === 'repair' ? 'repair'
      : nodeKind === 'supply' ? 'supply'
      : nodeKind ? 'battle'
      : 'map'
    changePaused(nextScreen === 'battle')
    go(nextScreen)
    refresh(true)
  }, [changePaused, go, refresh])

  const launchNode = useCallback((node: MapNode) => {
    const current = runRef.current
    if (!current) return
    if (node.layer !== current.mapLayer) return
    let reserveGrant = 0
    current.activeNode = node
    current.serviceDone = false
    current.eventResult = ''
    current.eventOffer = node.kind === 'event'
      ? ['失联空间站发来求救脉冲', '废弃货舱仍有余热', '未知信号要求接入反应堆'][node.seed % 3]
      : ''
    if (node.kind === 'battle' || node.kind === 'elite' || node.kind === 'boss') {
      const deploymentReserve = getDeploymentReserve(node)
      reserveGrant = Math.max(0, deploymentReserve - current.metal)
      current.metal += reserveGrant
      current.battle = createBattle(current, node)
      setSelectedId(null); setBuildType(null); setTargetSkill(false)
      changePaused(true); changeSpeed(1)
      go('battle')
      playSfx(node.kind === 'boss' ? 'alert' : 'confirm')
    } else if (node.kind === 'shop') {
      openShop(current)
      go('shop')
    } else if (node.kind === 'event') go('event')
    else go(node.kind === 'repair' ? 'repair' : 'supply')
    refresh(true)
    if (reserveGrant > 0) notify(`紧急战备补给 · +${reserveGrant} 合金，可部署基础防线。`, 'good')
  }, [changePaused, changeSpeed, go, refresh, notify])

  const finishNode = useCallback(() => {
    const current = runRef.current
    const node = current?.activeNode
    if (!current || !node) return
    completeNode(current, node)
    setSelectedId(null); setBuildType(null); setTargetSkill(false)
    changePaused(true)
    go('map')
    refresh(true)
  }, [changePaused, go, refresh])

  const finishCampaign = useCallback((result: 'victory' | 'defeat') => {
    const current = runRef.current
    if (!current || current.end) return
    const nextMeta = finishRun(current, result, copyMeta(metaRef.current))
    updateMeta(nextMeta)
    changePaused(true)
    setSelectedId(null); setBuildType(null); setTargetSkill(false)
    go('ending')
    refresh(true)
    playSfx(result === 'victory' ? 'upgrade' : 'alert')
  }, [updateMeta, changePaused, go, refresh])

  const finishBattle = useCallback((result: 'victory' | 'defeat') => {
    const current = runRef.current
    if (!current?.activeNode) return
    if (result === 'defeat') { finishCampaign('defeat'); return }
    if (current.activeNode.kind === 'boss') { finishCampaign('victory'); return }
    current.pendingBoons = selectBoon(current)
    current.metal += (current.activeNode.kind === 'elite' ? 44 : 28) + getBattleSalvage(current)
    changePaused(true)
    go('reward')
    refresh(true)
    playSfx('upgrade')
  }, [finishCampaign, changePaused, go, refresh])

  const selectReward = useCallback((id: string) => {
    const current = runRef.current
    const node = current?.activeNode
    if (!current || !node) return
    current.boons.push(id)
    notify(`已安装模块 · ${BOON_LABELS[id] ?? id}`, 'good')
    finishNode()
  }, [finishNode, notify])

  const setSetting = useCallback((key: keyof Settings, value: number | boolean | 'standard' | 'high') => {
    const next = { ...settingsRef.current, [key]: value } as Settings
    settingsRef.current = next
    setSettings(next)
    configureAudio(next.music, next.effects)
    persist(undefined, undefined, undefined, next)
  }, [persist])

  const setBuild = useCallback((type: TowerKind | null) => {
    setSelectedId(null)
    setTargetSkill(false)
    setBuildType(current => type && current === type ? null : type)
    if (type) playSfx('confirm')
  }, [])

  const handlePlace = useCallback((slot: number) => {
    const current = runRef.current
    if (!current || !buildType) return
    const result = placeStructure(current, buildType, slot)
    if (!result.ok) { notify(result.message, 'bad'); return }
    playSfx('build')
    setBuildType(null)
    setSelectedId(current.battle?.structures[current.battle.structures.length - 1]?.id ?? null)
    setMobilePanel('details')
    notify(result.message, 'good')
    refresh(true)
  }, [buildType, notify, refresh])

  const handleUpgrade = useCallback((branch: Branch) => {
    const current = runRef.current
    if (!current || !selectedId) return
    const result = upgradeStructure(current, selectedId, branch)
    if (!result.ok) { notify(result.message, 'bad'); return }
    playSfx('upgrade')
    notify(result.message, 'good')
    refresh(true)
  }, [selectedId, notify, refresh])

  const handleSell = useCallback(() => {
    const current = runRef.current
    if (!current || !selectedId) return
    const result = sellStructure(current, selectedId)
    if (result.ok) { setSelectedId(null); notify(result.message, 'good'); refresh(true) }
  }, [selectedId, notify, refresh])

  const changeTargetMode = useCallback(() => {
    const current = runRef.current
    const tower = current?.battle?.structures.find(s => s.id === selectedId)
    if (!tower) return
    tower.targetMode = tower.targetMode === 'first' ? 'strong' : tower.targetMode === 'strong' ? 'support' : 'first'
    refresh(true)
  }, [selectedId, refresh])

  const activateSkill = useCallback((skill: 'strike' | 'stasis' | 'shield' | 'repair') => {
    const current = runRef.current
    if (!current) return
    if (skill === 'strike') {
      const result = useSkill(current, skill)
      if (result.needsTarget) {
        setBuildType(null); setSelectedId(null); setTargetSkill(true)
        notify('点击战场危险区域指定轨道轰击。')
        return
      }
      if (!result.ok) { notify(result.message, 'bad'); return }
      setBuildType(null); setSelectedId(null); setTargetSkill(true)
      notify('点击战场危险区域指定轨道轰击。')
      return
    }
    const result = useSkill(current, skill)
    if (!result.ok) { notify(result.message, 'bad'); return }
    playSfx(skill === 'repair' ? 'upgrade' : 'alert')
    notify(result.message, 'good')
    refresh(true)
  }, [notify, refresh])

  const handleTarget = useCallback((x: number, y: number) => {
    const current = runRef.current
    if (!current) return
    const result = useSkill(current, 'strike', x, y)
    setTargetSkill(false)
    if (!result.ok) { notify(result.message, 'bad'); return }
    playSfx('impact')
    notify(result.message, 'good')
    refresh(true)
  }, [notify, refresh])

  const handleWave = useCallback(() => {
    const current = runRef.current
    if (!current || !current.battle || current.battle.wave >= 0) return
    if (startWave(current)) {
      changePaused(false)
      setBuildType(null); setTargetSkill(false)
      playSfx('alert')
      notify(current.battle.isBoss ? '旗舰接战 · 保护舰队核心。' : `第 ${current.battle.wave + 1} 波敌人来袭！`, 'bad')
      refresh(true)
    }
  }, [changePaused, notify, refresh])

  const startService = useCallback((choice: 'repair' | 'shield' | 'power' | 'metal' | 'cells' | 'module' | 'risk' | 'safe' | 'tech') => {
    const current = runRef.current
    if (!current || current.serviceDone) return
    if (choice === 'risk' || choice === 'safe' || choice === 'tech') {
      const message = applyEventChoice(current, choice)
      notify(message, 'good')
    } else if (choice === 'repair') {
      current.core = Math.min(current.maxCore, current.core + 34)
      current.metal = Math.max(0, current.metal - 24)
      notify('舰队核心修复 34 点 · 消耗 24 合金。', 'good')
    } else if (choice === 'shield') {
      current.coreShield = Math.min(70, current.coreShield + 36)
      current.shieldTimer = 20
      notify('核心护盾恢复 36 点。', 'good')
    } else if (choice === 'power') {
      if (!current.boons.includes('relaySync')) current.boons.push('relaySync')
      else current.metal += 36
      notify('火控校准完成 · 已有模块则回收 36 合金。', 'good')
    } else if (choice === 'metal') {
      current.metal += 62
      notify('回收 62 合金。', 'good')
    } else if (choice === 'cells') {
      current.cells = Math.min(9, current.cells + 3)
      notify('获得 3 个能源电池。', 'good')
    } else if (choice === 'module') {
      const available = ['coil', 'ember', 'coldAftershock', 'droneCare', 'relaySync', 'alloy', 'bossBreaker'].filter(id => !current.boons.includes(id))
      const pick = available[Math.floor(random(current) * Math.max(1, available.length))]
      if (pick) current.boons.push(pick)
      notify(`回收模块 · ${BOON_LABELS[pick] ?? '获得资源'}`, 'good')
    }
    current.serviceDone = true
    refresh(true)
  }, [notify, refresh])

  const buyFromShop = useCallback((item: string) => {
    const current = runRef.current
    if (!current) return
    const result = shopItem(current, item)
    notify(result.message, result.ok ? 'good' : 'bad')
    refresh(true)
  }, [notify, refresh])

  const returnToSettings = useCallback(() => go(settingsFrom), [go, settingsFrom])
  const returnToMainMenu = useCallback(() => {
    changePaused(true)
    go('menu')
  }, [changePaused, go])

  useEffect(() => {
    configureAudio(settings.music, settings.effects)
  }, [settings.music, settings.effects])

  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden && screenRef.current === 'battle') {
        pausedRef.current = true
        setPaused(true)
        persist('battle')
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [persist])

  const finishBattleRef = useRef(finishBattle)
  finishBattleRef.current = finishBattle
  useEffect(() => {
    if (screen !== 'battle' || paused) return
    let last = performance.now()
    let saveTimer = 0
    let uiTimer = 0
    let raf = 0
    const step = (now: number) => {
      const current = runRef.current
      const dt = Math.min(0.075, Math.max(0, (now - last) / 1000)) * speedRef.current
      last = now
      if (current && !pausedRef.current) {
        // Preserve 2x/3x speed on slower screens without skipping simulation time.
        let remaining = dt
        let outcome: ReturnType<typeof tickRun> = null
        while (remaining > 0 && !outcome) {
          const slice = Math.min(1 / 60, remaining)
          outcome = tickRun(current, slice, playCombatSfx, slice / speedRef.current)
          remaining -= slice
        }
        if (outcome === 'wave') {
          playSfx('alert')
          persist('battle')
          setRevision(value => value + 1)
        } else if (outcome === 'wave-start') {
          notify(`第 ${current.battle!.wave + 1} 波敌人来袭！`, 'bad')
          persist('battle')
          setRevision(value => value + 1)
        } else if (outcome === 'victory' || outcome === 'defeat') finishBattleRef.current(outcome)
        uiTimer += dt
        saveTimer += dt
        if (uiTimer > 0.09) { uiTimer = 0; setRevision(value => value + 1) }
        if (saveTimer > 1.6) { saveTimer = 0; persist('battle') }
      }
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [screen, paused, notify, changePaused, persist])

  useEffect(() => {
    if (screen !== 'battle') return
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) return
      const key = event.key.toLowerCase()
      if (event.code === 'Space' || key === 'p') { event.preventDefault(); if (runRef.current?.battle?.wave === -1) handleWave(); else changePaused(!pausedRef.current) }
      else if (key === 'escape') { setBuildType(null); setSelectedId(null); setTargetSkill(false); notify('已取消当前选择。') }
      else if (key === '1') changeSpeed(1)
      else if (key === '2') changeSpeed(2)
      else if (key === '3') changeSpeed(3)
      else if (key === 'q') setBuild('needle')
      else if (key === 'w') setBuild('rail')
      else if (key === 'e') setBuild('arc')
      else if (key === 'r') setBuild('comet')
      else if (key === 't') setBuild('cold')
      else if (key === 'y') setBuild('drone')
      else if (key === 'u') setBuild('relay')
      else if (key === 'i') setBuild('shield')
      else if (key === 'o') setBuild('lure')
      else if (key === 'z') activateSkill('strike')
      else if (key === 'x') activateSkill('stasis')
      else if (key === 'c') activateSkill('shield')
      else if (key === 'v') activateSkill('repair')
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [screen, changeSpeed, changePaused, handleWave, setBuild, notify, activateSkill])

  const currentBattle = run?.battle ?? null
  const nextWaveIn = currentBattle ? getNextWaveCountdown(currentBattle) : null
  const selectedTower = currentBattle?.structures.find(t => t.id === selectedId) ?? null
  const currentNode = run?.activeNode ?? null
  const menu = (
    <main className="landing-screen">
      <div className="landing-topline">
        <div className="wordmark"><BrandMark /><span>EMBER / HORIZON</span></div>
        <div className="topline-status"><span className="status-dot" />航道防卫局 <span className="topline-sep">/</span> 边境档案 07-A</div>
        <button className="quiet-button" onClick={() => { setSettingsFrom('menu'); go('settings') }}>系统设置 <span aria-hidden="true">↗</span></button>
      </div>

      <section className="landing-grid">
        <div className="landing-copy">
          <p className="eyebrow"><span className="eyebrow-line" />移民舰队护航计划 <span className="eyebrow-code">OPERATION 07-A</span></p>
          <h1>边界航道<span>:</span><br /><em>余烬防线</em></h1>
          <p className="landing-deck">星门关闭之后，护航舰队只能沿着失守的轨道前进。<br />架设火力，守住航道，把最后一束信号送回家。</p>
          <div className="hero-facts">
            <div><b>15—25</b><span>分钟 / 完整战役</span></div>
            <div><b>06</b><span>星域战区</span></div>
            <div><b>01</b><span>旗舰目标</span></div>
          </div>
          <button className="training-entry" onClick={() => setTrainingOpen(true)}><span>⌘</span><span><b>新手训练营</b><small>放下即可攻击 · 逐课学习九类建筑</small></span><span>→</span></button>
          <div className="launch-controls">
            <button className="primary-action" onClick={requestNewRun}>
              <span className="action-glyph">▶</span><span><b>启动新战役</b><small>随机航路 · 随机构筑</small></span><span className="action-arrow">→</span>
            </button>
            {run && !run.end && <button className="resume-action" onClick={continueRun}><span>Ⅱ</span>继续战役 <small>{run.visited.length ? `已抵达第 ${run.mapLayer + 1} 区` : '尚未出发'}</small></button>}
          </div>
          <div className="launch-options">
            <label className="seed-input"><span>航路种子</span><input value={seedField} onChange={e => setSeedField(e.target.value)} placeholder="留空以随机生成" maxLength={24} aria-label="自定义航路种子" /></label>
            <div className="difficulty-toggle" aria-label="难度选择">
              <button className={difficulty === 'standard' ? 'active' : ''} onClick={() => setDifficulty('standard')}>常规</button>
              <button className={difficulty === 'storm' ? 'active' : ''} onClick={() => setDifficulty('storm')}>风暴 <span>+28%</span></button>
            </div>
          </div>
          <div className="landing-links"><button onClick={() => { setGuidePage('flow'); go('guide') }}>如何操作 <span>↗</span></button><i /> <button onClick={() => { setSettingsFrom('menu'); go('settings') }}>画面与音量 <span>↗</span></button><i /><a href="/credits.html" target="_blank" rel="noopener noreferrer">素材鸣谢 <span>↗</span></a></div>
        </div>
        <div className="landing-art" aria-label="星域轨道与护航舰队示意">
          <div className="art-caption"><span>区域扫描 / LIVE</span><span>边界扇区 04</span></div>
          <svg className="orbit-illustration" viewBox="0 0 760 620" role="img" aria-label="围绕冰封行星的舰队航线">
            <defs>
              <radialGradient id="icePlanet" cx="34%" cy="28%"><stop offset="0" stopColor="#9eaead" stopOpacity=".8"/><stop offset=".56" stopColor="#56696b" stopOpacity=".68"/><stop offset="1" stopColor="#1d2b30" stopOpacity=".2"/></radialGradient>
              <linearGradient id="burnline" x1="0" x2="1"><stop stopColor="#db8d5c" stopOpacity=".08"/><stop offset=".52" stopColor="#e9ad6b"/><stop offset="1" stopColor="#8ec5bd" stopOpacity=".2"/></linearGradient>
              <filter id="softGlow"><feGaussianBlur stdDeviation="7" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
            </defs>
            <g className="art-stars"><circle cx="100" cy="90" r="1.7"/><circle cx="638" cy="74" r="1"/><circle cx="680" cy="320" r="1.4"/><circle cx="129" cy="475" r="1.1"/><circle cx="532" cy="520" r="1.8"/><circle cx="245" cy="175" r=".9"/><circle cx="610" cy="144" r=".8"/><circle cx="67" cy="307" r=".8"/><circle cx="448" cy="88" r="1"/></g>
            <ellipse cx="395" cy="315" rx="263" ry="80" transform="rotate(-21 395 315)" fill="none" stroke="#9caca3" strokeOpacity=".2" strokeWidth="1" strokeDasharray="2 10"/>
            <ellipse cx="395" cy="315" rx="325" ry="117" transform="rotate(-21 395 315)" fill="none" stroke="#9caca3" strokeOpacity=".13" strokeWidth="1"/>
            <circle cx="390" cy="294" r="178" fill="url(#icePlanet)"/>
            <path d="M215 312c66 18 111 17 168-9 58-26 113-24 177 1" fill="none" stroke="#bac8bd" strokeOpacity=".3" strokeWidth="2"/>
            <path d="M252 365c49-10 93-1 136 20 52 25 99 20 149-7" fill="none" stroke="#d1d1b4" strokeOpacity=".18" strokeWidth="7"/>
            <path d="M32 518C147 422 221 434 296 389c79-48 140-144 237-171 72-20 124 9 199-83" fill="none" stroke="url(#burnline)" strokeWidth="2.2"/>
            <path d="M35 519C145 430 230 442 310 394" fill="none" stroke="#efb173" strokeOpacity=".36" strokeWidth="7" filter="url(#softGlow)"/>
            <g className="art-vessel" transform="translate(525 205) rotate(-23)"><path d="M35 0 12-9-27-5-43 0-27 5 12 9Z" fill="#c7c9b7" stroke="#e4ba7e" strokeWidth="1.3"/><path d="m-13-4-15-15 26 11m-11 12-15 15 26-11" fill="#607578" stroke="#9cb5ad" strokeWidth="1.2"/><path d="M-30 0h42" stroke="#f0a16e" strokeWidth="2"/><circle cx="17" cy="0" r="3.2" fill="#d6e4cf"/></g>
            <g className="art-vessel small" transform="translate(430 321) rotate(-38)"><path d="M20 0 5-5-17-3-25 0-17 3 5 5Z" fill="#9fada1" stroke="#b9c8bd"/><path d="m-6-2-8-10 14 6m-6 6-8 10 14-6" fill="#45595d" stroke="#829a96"/></g>
            <g className="art-vessel small" transform="translate(358 381) rotate(-18)"><path d="M20 0 5-5-17-3-25 0-17 3 5 5Z" fill="#9fada1" stroke="#b9c8bd"/><path d="m-6-2-8-10 14 6m-6 6-8 10 14-6" fill="#45595d" stroke="#829a96"/></g>
            <g transform="translate(142 432)"><circle r="17" fill="#25363a" stroke="#d89c68" strokeOpacity=".7"/><circle r="6" fill="#e8a768"/><path d="M-30 0h60M0-30v60" stroke="#d29b66" strokeOpacity=".45"/></g>
            <g transform="translate(706 112)"><path d="M0-20 12 0 0 20-12 0Z" fill="#26383c" stroke="#e27b68"/><circle r="3" fill="#ef8b6d"/></g>
            <text x="29" y="552" className="art-label">RIFT CORRIDOR / 07-A</text>
            <text x="579" y="147" className="art-label alert">SIGNAL LOST</text>
            <text x="394" y="500" className="art-coord">76° 14' N · 119° 08' W</text>
          </svg>
          <div className="art-side-note"><span>01</span><b>冰环战区</b><small>弱信号 / 低温轨道</small></div>
          <div className="art-footer"><span>护航编队</span><b>07</b><span>艘移民舰</span><i /><span>预计抵达</span><b>04</b><span>航段之后</span></div>
        </div>
      </section>

      <section className="landing-bottom">
        <div className="landing-notice"><span className="notice-mark">!</span><p><b>前方航道中断</b><span>机械集群正向边境聚拢。预计下次拦截将在进入冰环轨道后发生。</span></p><span className="notice-time">最后更新 · 03:17:42</span></div>
        <div className="career-stats"><div><span>完成战役</span><b>{String(meta.wins).padStart(2, '0')}</b></div><div><span>最佳评分</span><b>{formatNumber(meta.bestScore)}</b></div><div><span>研究点数</span><b>{String(meta.research).padStart(2, '0')}</b></div><button onClick={() => { setGuidePage('flow'); go('guide') }}>情报档案 <span>→</span></button></div>
      </section>
      {confirmNew && <div className="modal-scrim"><div className="confirm-card"><p className="eyebrow">航路覆盖提示</p><h2>开始新的护航任务？</h2><p>当前战役会保存在本地，但继续任务将从新航路开始。你仍可从主菜单重新打开现有存档。</p><div className="modal-actions"><button className="quiet-button" onClick={() => setConfirmNew(false)}>继续当前存档</button><button className="primary-action compact" onClick={() => { setConfirmNew(false); beginNewRun() }}>确认出发 <span>→</span></button></div></div></div>}
    </main>
  )

  const settingsScreen = (
    <PageShell title="系统设置" eyebrow="舰桥环境控制" backLabel={settingsFrom === 'battle' ? '返回战场' : '返回'} onBack={returnToSettings}>
      <div className="settings-layout">
        <div className="settings-intro"><span className="large-index">A / 07</span><h2>按你的舰桥习惯<br /><em>调整显示。</em></h2><p>设置自动保存在本机。离开战场或切换标签页时，舰队会自动暂停。</p><div className="settings-note"><span>LOCAL PROFILE</span><b>边境航道防卫局</b><small>配置版本 1.0 · 简体中文</small></div></div>
        <div className="settings-controls">
          <SettingSlider label="环境音乐" note="本地程序合成的低频航行氛围" value={settings.music} onChange={v => setSetting('music', v)} />
          <SettingSlider label="音效" note="部署、开火、命中与警报反馈" value={settings.effects} onChange={v => setSetting('effects', v)} />
          <div className="setting-row"><div><b>简化战场动效</b><small>减少光晕和粒子，保留弹道、命中与预警反馈</small></div><button className={`toggle-switch${settings.reduceMotion ? ' on' : ''}`} onClick={() => setSetting('reduceMotion', !settings.reduceMotion)} role="switch" aria-label="简化战场动效" aria-checked={settings.reduceMotion}><i /></button></div>
          <div className="setting-row"><div><b>画面质量</b><small>高清模式适配屏幕分辨率与高清模型；低配设备可选流畅</small></div><div className="segmented"><button className={settings.quality === 'standard' ? 'active' : ''} onClick={() => setSetting('quality', 'standard')}>流畅</button><button className={settings.quality === 'high' ? 'active' : ''} onClick={() => setSetting('quality', 'high')}>高清</button></div></div>
          <div className="setting-row"><div><b>显示语言</b><small>当前战役的任务文本与操作说明</small></div><div className="locale-value">简体中文 <span>已启用</span></div></div>
          <div className="setting-footer"><span><i className="status-dot" />设置已自动保存</span><div className="setting-actions"><button className="quiet-button settings-menu-button" onClick={returnToMainMenu}>返回主菜单</button><button className="primary-action compact" onClick={returnToSettings}>完成设置 <span>→</span></button></div></div>
          <a className="asset-credit" href="/credits.html" target="_blank" rel="noopener noreferrer">素材鸣谢 · Zsky 炮塔模型 / CC BY 4.0 <span>↗</span></a>
        </div>
      </div>
    </PageShell>
  )

  const guideScreen = (
    <PageShell title="航行手册" eyebrow="舰桥操作档案" backLabel="返回主菜单" onBack={() => go('menu')}>
      <div className="guide-layout">
        <nav className="guide-tabs" aria-label="操作手册章节">
          {([['flow', '战役流程'], ['battle', '战场部署'], ['enemies', '敌群识别'], ['controls', '操作与存档']] as const).map(([id, label]) => <button key={id} className={guidePage === id ? 'active' : ''} onClick={() => setGuidePage(id)}>{label}<span>→</span></button>)}
        </nav>
        <div className="guide-content">
          <button className="training-guide-entry" onClick={() => setTrainingOpen(true)}>进入实操训练营 <span>学习部署与九类建筑 →</span></button>
          {guidePage === 'flow' && <><p className="eyebrow">航路与补给</p><h2>每次选择都会改变<br /><em>下一段航程。</em></h2><p>从星域地图挑选相邻节点。防守战和精英战提供模块与电池；补给、维修、回收和事件节点能改变资源与舰队状态。不同种子会改变节点、地图、敌群与奖励。</p><div className="guide-steps"><GuideStep n="01" title="选取航道" text="每个星区会呈现不同风险与补给。冰环、矿环和废弃中继区有不同战场地形。"/><GuideStep n="02" title="准备防线" text="战斗开始前可自由布置。手动启动第一波后，敌群沿路径前进；清场 3 秒后自动进入下一波，期间可继续建造和升级。"/><GuideStep n="03" title="搭配构筑" text="每次战斗结束选择一件模块。四类战术指令与九类设施形成不同协同。"/><GuideStep n="04" title="抵达旗舰" text="跨越五段航路，在最终区域击败分阶段作战的断界者旗舰。"/></div></>}
          {guidePage === 'battle' && <><p className="eyebrow">战术部署</p><h2>建筑部署就绪，<br /><em>敌人进入射程即开火。</em></h2><p>点选右侧设施，再点一处空闲平台即可放置。半透明圆环表示射程。选中设施后可调整目标优先级、选择两条专精路线、升级或拆解。</p><div className="guide-rows"><GuideRow icon="ϟ" title="独立作战" text="九类建筑都能独立攻击。部署后自动就绪，无需反应堆、中继站或电量分配。护盾和诱导是攻击之外的额外能力。"/><GuideRow icon="⌖" title="地形与高地" text="高地提升轨矛射程。采矿站的几何结构会挡住直射武器，轨道轰击与范围爆炸不受遮挡。"/><GuideRow icon="▱" title="战术指令" text="轨道轰击需要点选区域；全域冻结、护盾和维修蜂群可直接施放。技能消耗指挥点并有独立冷却。"/><GuideRow icon="Ⅱ" title="暂停与加速" text="战斗中可暂停或切换 1×、2×、3×。暂停时所有实体、攻击、计时和技能冷却同步停止。"/></div></>}
          {guidePage === 'enemies' && <><p className="eyebrow">敌群识别手册</p><h2>识别威胁，<br /><em>再决定火力。</em></h2><div className="enemy-manual">{(['scout','siege','splitter','jammer','jumper','carrier','mite','boss'] as const).map(id => <div key={id}><span className={`enemy-stamp enemy-portrait ${id}`}><img src={`/assets/enemies/${id}-icon.png`} alt="" /></span><b>{ENEMY_NAMES[id]}</b><p>{id === 'scout' ? '高速成群，针蜂与弧光清理效率高。' : id === 'siege' ? '装甲厚、威胁高，轨矛与彗星适合重击。' : id === 'splitter' ? '被摧毁后分裂成两台快速子机。' : id === 'jammer' ? '会短暂干扰附近建筑的武器。' : id === 'jumper' ? '周期性短距跃迁，不能只靠单点封锁。' : id === 'carrier' ? '为附近敌人提供可见的护盾层。' : id === 'mite' ? '裂解后出现的小型快速子机，及时补充近距火力。' : '三阶段大型旗舰，会炮击防线、呼叫护航并干扰武器。'}</p></div>)}</div><div className="guide-boss"><span>旗舰情报 / 断界者</span><p>旗舰分三阶段变换威胁：扇区炮击、护航编队与能源压制。地图会显示红色预警圈，先转移或预留维修指令，再处理攻击窗口。</p></div></>}
          {guidePage === 'controls' && <><p className="eyebrow">输入与存档</p><h2>鼠标负责部署，<br /><em>快捷键负责响应。</em></h2><div className="key-list"><KeyLine keys="空格 / P" label="暂停 / 继续战斗与续波倒计时；首次部署启动第一波"/><KeyLine keys="1 / 2 / 3" label="切换 1×、2×、3×速度"/><KeyLine keys="Q W E R T Y U I O" label="快速选择九类设施"/><KeyLine keys="Z X C V" label="轨道轰击、冻结、护盾、维修"/><KeyLine keys="Esc" label="取消建造、技能目标或设施选中"/></div><p>页面会自动保存航路、当前战场、设施、资源、模块、最佳成绩和设置。刷新页面或离开标签后，游戏会回到战场暂停状态。</p><div className="guide-callout"><b>触屏提示</b><span>手机和平板可点按设施与平台，无需拖拽。战场按原比例缩放；建造、目标预览和技能仍可直接点选。</span></div></>}
        </div>
      </div>
    </PageShell>
  )

  const mapScreen = run && (
    <PageShell title="星域航路" eyebrow={`护航档案 / ${run.seed}`} backLabel="主菜单" onBack={() => go('menu')} right={<span className="save-indicator"><i className="status-dot" />{savePulse ? '已保存' : '本机自动存档'}</span>}>
      <div className="map-overview">
        <div className="map-brief"><div><p className="eyebrow">CURRENT VECTOR / {String(run.mapLayer + 1).padStart(2, '0')}</p><h2>{run.mapLayer === 5 ? '旗舰区已开放' : `选择第 ${run.mapLayer + 1} 段航路`}</h2><p>航路之间没有安全边缘。观察补给、威胁等级与核心耐久，决定舰队的穿越顺序。</p></div><div className="map-assets"><Metric value={`${Math.ceil(run.core)}%`} label="核心耐久" tone={run.core < 40 ? 'danger' : ''} /><Metric value={run.metal} label="合金" /><Metric value={run.structuresBuilt} label="累计部署" /><Metric value={run.cells} label="电池" /></div></div>
        <div className="star-map-wrap"><div className="star-map-head"><span>RIFT SECTOR ROUTE CHART</span><span>航路种子 / {run.seed}</span></div><div className="star-map"><div className="star-map-content">
          <svg viewBox="0 0 1000 310" preserveAspectRatio="none" aria-hidden="true">
            {run.nodes.slice(0, -1).flatMap((layer, layerIndex) => layer.flatMap((node, index) => (run.nodes[layerIndex + 1] ?? []).map((next, nextIndex) => {
              const x1 = 70 + layerIndex * 172, x2 = 70 + (layerIndex + 1) * 172
              const y1 = 155 + (index - (layer.length - 1) / 2) * 73
              const y2 = 155 + (nextIndex - ((run.nodes[layerIndex + 1]?.length ?? 1) - 1) / 2) * 73
              const reached = run.visited.includes(node.id) && run.visited.includes(next.id)
              const active = layerIndex === run.mapLayer - 1 && run.visited.includes(node.id)
              return <path key={`${node.id}-${next.id}`} d={`M ${x1} ${y1} C ${x1 + 50} ${y1}, ${x2 - 50} ${y2}, ${x2} ${y2}`} className={reached ? 'route-reached' : active ? 'route-active' : 'route-unseen'} />
            })))}
          </svg>
          {run.nodes.map((layer, layerIndex) => <div className="map-column" key={layerIndex} style={{ left: `${7 + layerIndex * 17.2}%` }}>
            <div className={`map-column-label${layerIndex === run.mapLayer ? ' current' : ''}`}>{layerIndex === 5 ? '终点 / 旗舰' : `航段 ${String(layerIndex + 1).padStart(2, '0')}`}</div>
            {layer.map((node, index) => {
              const info = NODE_INFO[node.kind]
              const available = layerIndex === run.mapLayer && !run.end
              const visited = run.visited.includes(node.id)
              return <button key={node.id} className={`map-node ${info.tint}${available ? ' available' : ''}${visited ? ' visited' : ''}${layerIndex < run.mapLayer && !visited ? ' passed' : ''}`} style={{ top: `${50 + (index - (layer.length - 1) / 2) * 23.5}%` }} disabled={!available} onClick={() => launchNode(node)} title={`${node.title} · ${node.detail}`}>
                <span className="node-glyph">{info.icon}</span><span className="node-title">{node.title}</span><small>{info.name}</small>{available && <i className="node-open">OPEN →</i>}
              </button>
            })}
          </div>)}
          <div className="map-origin"><span>ORIGIN</span><b>护航舰队</b></div>
        </div></div><div className="map-legend"><span><i className="legend-dot ice" />防守节点</span><span><i className="legend-dot gold" />补给 / 维修</span><span><i className="legend-dot red" />高威胁节点</span><span><i className="legend-dot passed" />已穿越</span><small>每一层至少有一条可用航道 · 点击开放节点进入</small></div></div>
        <div className="route-footer"><div><p className="eyebrow">舰队战备 / OPERATION READINESS</p><div className="boon-chips">{run.boons.length ? run.boons.map((id, i) => <span key={`${id}-${i}`}>{BOON_LABELS[id] ?? id}</span>) : <span className="empty-chip">尚未获得战术模块</span>}</div></div><div className="route-record"><span>已穿越节点</span><b>{run.visited.length} <small>/ 6</small></b></div><div className="route-record"><span>舰队损失</span><b>{run.leaks} <small>次突防</small></b></div></div>
      </div>
    </PageShell>
  )

  const battleScreen = run && currentBattle && currentNode && (
    <main className="battle-screen">
      <header className="battle-header">
        <button className="battle-brand" onClick={() => { changePaused(true); go('map') }} title="返回星域地图"><BrandMark small /><span>余烬防线<small>战术沙盘</small></span></button>
        <div className="battle-context"><span className="battle-context-tag">{currentNode.kind === 'boss' ? '旗舰遭遇' : currentNode.kind === 'elite' ? '精英拦截' : '航道防守'}</span><b>{currentNode.title}</b><small>区域 {String(run.mapLayer + 1).padStart(2, '0')} / {['冰环轨道', '失守矿环', '旧中继墓场'][currentBattle.zone]}</small></div>
        <div className="battle-clock"><span className="status-dot" />{paused ? '已暂停' : currentBattle.wave < 0 ? '部署阶段' : currentBattle.waveCleared ? '波次间整备' : '交战中'}<b>{formatTime(currentBattle.elapsed)}</b></div>
        <button className="header-icon-button" onClick={() => { setSettingsFrom('battle'); changePaused(true); go('settings') }} aria-label="系统设置">⚙</button>
        <button className="header-icon-button" onClick={() => { setGuidePage('battle'); changePaused(true); go('guide') }} aria-label="操作手册">?</button>
      </header>

      <p className="orientation-hint">建议横屏作战，战场与设施库可同时操作。竖屏也可继续游玩；切换方向会自动暂停。</p>
      <div className="battle-metrics">
        <div className="core-meter"><span className="metric-icon core-icon">◈</span><div className="metric-copy"><span>舰队核心</span><b>{Math.ceil(run.core)}<small> / {run.maxCore}</small></b><div className="meter-track"><i style={{ width: `${Math.max(0, run.core / run.maxCore * 100)}%`, background: run.core < 35 ? 'var(--danger)' : undefined }} /></div></div></div>
        <Metric icon="▧" value={run.metal} label="合金" tone="gold" /><Metric icon="⌖" value={currentBattle.structures.filter(t => t.health > 0 && t.jammed <= 0).length} label="可用建筑" tone="teal" />
        <Metric icon="▥" value={`${run.cells} / 9`} label="指挥电池" tone="violet" /><Metric icon="⌁" value={`${Math.max(0, currentBattle.wave + 1)} / ${currentBattle.maxWaves}`} label="作战波次" tone="ice" />
        {run.coreShield > 0 && <Metric icon="⬡" value={Math.ceil(run.coreShield)} label="核心护盾" tone="teal" />}
      </div>

      <section className="battle-layout">
        <aside className="brief-rail">
          <div className="rail-heading"><span>战术态势</span><i>{currentBattle.isBoss ? 'ALERT' : 'LIVE'}</i></div>
          <div className="wave-readout"><span className="wave-number">{currentBattle.wave < 0 ? '—' : String(currentBattle.wave + 1).padStart(2, '0')}</span><div><b>{currentBattle.wave < 0 ? '等待部署' : currentBattle.waveCleared ? '航道已清' : `第 ${currentBattle.wave + 1} 波`}</b><small>{currentBattle.enemies.length} 个敌方信号</small></div></div>
          <div className="brief-rule" />
          <p className="rail-label">来袭预警</p><div className="forecast-row">{(() => {
            const queue = currentBattle.waveQueue.slice(0, 6)
            const fallback = currentBattle.wave < 0 ? ['scout', 'siege', 'carrier', 'splitter'] as const : []
            const list = queue.length ? queue : fallback
            return list.map((enemy, i) => <span key={`${enemy}-${i}`} className={`forecast-chip ${enemy}`} title={ENEMY_NAMES[enemy]}><img src={`/assets/enemies/${enemy}-icon.png`} alt={ENEMY_NAMES[enemy]} /></span>)
          })()}</div>
          <div className="rail-status-list"><div><span>防线设施</span><b>{currentBattle.structures.length} 座</b></div><div><span>已击破单位</span><b>{formatNumber(run.kills)}</b></div><div><span>突防次数</span><b className={run.leaks > 0 ? 'text-danger' : ''}>{run.leaks}</b></div><div><span>作战模式</span><b>独立攻击</b></div></div>
          <div className="threat-note"><span className="note-sign">⌁</span><p><b>{currentBattle.isBoss ? '旗舰正在充能' : currentBattle.zone === 1 ? '结构遮挡已标记' : currentBattle.zone === 0 ? '侦察信号密集' : '旧中继设施过载'}</b><small>{currentBattle.isBoss ? '注意炮击圈，预留护盾与维修。' : currentBattle.zone === 1 ? '采矿构架会阻挡直射弹道。' : currentBattle.zone === 0 ? '高速轻型单位可能成群绕过。' : '高地平台适合长射程火力。'}</small></p></div>
          <div className="time-controls"><button className={paused ? 'paused' : ''} onClick={() => changePaused(!paused)} aria-label={paused ? '继续' : '暂停'}>{paused ? '▶' : 'Ⅱ'}<span>{paused ? '继续' : '暂停'}</span><kbd>P</kbd></button><div className="speed-group"><span>速度</span>{[1, 2, 3].map(value => <button key={value} className={speed === value ? 'active' : ''} onClick={() => changeSpeed(value)}>{value}×</button>)}</div></div>
          {currentBattle.wave < 0 ? <button className="wave-launch ready" onClick={handleWave}><span>▶</span><b>启动第一波</b><small>后续波次将在清场 3 秒后自动来袭</small></button> : <div className={`wave-launch wave-auto${nextWaveIn !== null ? ' ready' : ''}`}><span>{nextWaveIn !== null ? Math.ceil(nextWaveIn) : String(currentBattle.wave + 1).padStart(2, '0')}</span><b>{nextWaveIn !== null ? `第 ${currentBattle.wave + 2} 波即将来袭` : '波次交战中'}</b><small>{nextWaveIn !== null ? paused ? '倒计时已暂停 · 继续后自动出敌' : '自动续波 · 可继续建造和升级' : `${currentBattle.enemies.length} 个目标未清除`}</small></div>}
        </aside>

        <div className="battle-center">
          <div className="canvas-frame"><div className="frame-topline"><span>TACTICAL DISPLAY / SECTOR {String(run.mapLayer + 1).padStart(2, '0')}</span><span><i className="status-dot" />{buildType ? `部署预览 · ${TOWER_SPECS[buildType].name}` : targetSkill ? '选择轰击区域' : selectedTower ? `已选中 · ${TOWER_SPECS[selectedTower.type].name}` : '视野自动跟随航道'}</span></div>
            {nextWaveIn !== null && <div className="wave-announcement" role="status" aria-live="polite" aria-atomic="true"><div><strong>第 {currentBattle.wave + 2} 波敌人来袭</strong><span>{paused ? '倒计时已暂停，继续后自动出敌' : '可继续建造和升级 · 自动出敌'}</span></div><b aria-hidden="true">{Math.ceil(nextWaveIn)}<small>秒</small></b></div>}
            <Battlefield run={run} revision={revision} buildType={buildType} selectedId={selectedId} targetSkill={targetSkill} effects={!settings.reduceMotion} quality={settings.quality} onPad={handlePlace} onSelect={id => { setSelectedId(id); setBuildType(null); setMobilePanel('details') }} onMiss={() => { if (buildType) setBuildType(null); else setSelectedId(null) }} onTarget={handleTarget} />
            {paused && currentBattle.wave >= 0 && !currentBattle.waveCleared && <div className="pause-stamp"><span>Ⅱ</span><b>战斗已暂停</b><small>舰队状态已冻结</small><button onClick={() => changePaused(false)}>恢复作战</button></div>}
            <div className="canvas-footline"><span>敌方路线 <b>→</b> 舰队核心</span><span>点击平台部署 / 点击设施调整</span><span>平台 {currentBattle.pads.filter(p => !p.blocked).length - currentBattle.structures.length} / {currentBattle.pads.length} 可用</span></div>
          </div>
          <div className="skill-strip"><div className="skill-title"><span>战术指令</span><small>{run.cells} 个可用电池</small></div>
            <SkillButton id="strike" hotkey="Z" name="轨道轰击" note="指定区域 · 高范围伤害" cooldown={run.skillCooldowns.strike} charges={run.cells} onClick={() => activateSkill('strike')} />
            <SkillButton id="stasis" hotkey="X" name="全域冻结" note="全场减速 4.5 秒" cooldown={run.skillCooldowns.stasis} charges={run.cells} onClick={() => activateSkill('stasis')} />
            <SkillButton id="shield" hotkey="C" name="核心护盾" note="恢复 42 护盾" cooldown={run.skillCooldowns.shield} charges={run.cells} onClick={() => activateSkill('shield')} />
            <SkillButton id="repair" hotkey="V" name="维修蜂群" note="修复设施并清除干扰" cooldown={run.skillCooldowns.repair} charges={run.cells} onClick={() => activateSkill('repair')} />
          </div>
        </div>

        <aside className="arsenal-panel">
          <div className="phone-battle-controls" aria-label="手机作战控制">
            <button onClick={() => changePaused(!paused)} aria-label={paused ? '继续手机作战' : '暂停手机作战'}>{paused ? '继续' : '暂停'}</button>
            <div className="phone-speed" aria-label="作战速度">{[1, 2, 3].map(value => <button key={value} className={speed === value ? 'active' : ''} onClick={() => changeSpeed(value)} aria-label={`手机 ${value} 倍速`}>{value}×</button>)}</div>
            {currentBattle.wave < 0 ? <button className="phone-wave-start" onClick={handleWave}>启动第一波</button> : <span className="phone-wave-state">{nextWaveIn !== null ? `第 ${currentBattle.wave + 2} 波 · ${Math.ceil(nextWaveIn)} 秒${paused ? ' · 暂停' : ''}` : `第 ${currentBattle.wave + 1} 波 · ${currentBattle.enemies.length} 个目标`}</span>}
          </div>
          <div className="arsenal-tabs"><button className={mobilePanel === 'armory' ? 'active' : ''} onClick={() => setMobilePanel('armory')}>设施库</button><button className={mobilePanel === 'details' ? 'active' : ''} onClick={() => setMobilePanel('details')}>选中详情</button></div>
          <div className={`arsenal-content${mobilePanel === 'details' && selectedTower ? ' mobile-visible' : ''}`}>
            <div className="panel-section-head"><div><span className="eyebrow">DEPLOYMENT / {currentBattle.structures.length} BUILT</span><h3>设施库</h3></div><span className="metal-cost"><b>{run.metal}</b> 合金</span></div>
            <div className="tower-list">
              {TOWER_ORDER.map((id, index) => {
                const spec = TOWER_SPECS[id]
                const locked = !meta.unlocks.includes(id)
                const canAfford = run.metal >= spec.cost
                return <button key={id} className={`tower-card${buildType === id ? ' selected' : ''}${locked ? ' locked' : ''}`} onClick={() => locked ? notify('该设施蓝图尚未解锁。', 'bad') : setBuild(id)} disabled={locked}>
                  <TowerPortrait type={id} /><span className="tower-copy"><b>{spec.name}<small>{spec.short}</small></b><small>{spec.role}</small></span><span className={`tower-price${canAfford ? '' : ' short'}`}>{spec.cost}<small>独立攻击</small></span><kbd>{'QWERTYUIO'[index]}</kbd>
                </button>
              })}
            </div>
            {buildType && <div className="build-instruction"><span>✣</span><p><b>选择平台</b><small>点击战场上的空闲平台，预览射程后部署。按 Esc 取消。</small></p><button onClick={() => setBuildType(null)} aria-label="取消建造">×</button></div>}
            {selectedTower && currentBattle && <TowerDetail tower={selectedTower} run={run} onUpgrade={handleUpgrade} onSell={handleSell} onTargetMode={changeTargetMode} />}
            {!selectedTower && !buildType && <div className="selection-hint"><span>⌖</span><p><b>未选择设施</b><small>选择设施后可查看射程、状态与专精分支。</small></p></div>}
          </div>
        </aside>
      </section>
      {toast && <div className={`toast ${toastTone}`} role="status"><span>{toastTone === 'bad' ? '!' : toastTone === 'good' ? '✓' : '⌁'}</span>{toast}<button onClick={() => setToast('')}>×</button></div>}
    </main>
  )

  const rewardScreen = run && currentNode && (
    <PageShell title="波次结算" eyebrow={`任务完成 / ${currentNode.title}`} backLabel="暂停战役" onBack={() => go('map')}>
      <section className="reward-screen">
        <div className="reward-heading"><span className="reward-symbol"><ModuleBadge /></span><p className="eyebrow">战场已肃清 / FIELD SECURED</p><h2>选取一项<br /><em>战术模块。</em></h2><p>模块会在本次战役内持续生效。选择能补足当前防线或强化协同的一项。</p></div>
        <div className="reward-cards">{run.pendingBoons.map((boon, i) => <button key={boon.id} className="reward-card" onClick={() => selectReward(boon.id)}><span className="reward-card-index">{String(i + 1).padStart(2, '0')} / MODULE</span><div className="reward-card-icon"><ModuleBadge type={boon.id} /></div><h3>{boon.name}</h3><p>{boon.description}</p><span className="reward-pick">安装模块 <b>→</b></span></button>)}</div>
        <div className="reward-tally"><span>累计击破 <b>{run.kills}</b> 个目标</span><i /><span>剩余核心 <b>{Math.ceil(run.core)}%</b></span><i /><span>战利品与设施回收 <b>+{(currentNode.kind === 'elite' ? 44 : 28) + getBattleSalvage(run)}</b> 合金</span><i /><span>战术电池 <b>+1</b></span></div>
      </section>
    </PageShell>
  )

  const shopScreen = run && currentNode && (
    <PageShell title="补给交易" eyebrow={`航道停靠 / ${currentNode.title}`} backLabel="返回航图" onBack={finishNode} right={<span className="shop-wallet"><b>▧ {run.metal}</b><small>合金储备</small></span>}>
      <section className="service-screen shop-screen"><div className="service-intro"><p className="eyebrow">RECLAMATION PLATFORM / STOCK 04</p><h2>旧轨道里的东西，<br /><em>仍然有用。</em></h2><p>购买会立即扣除合金。你可以继续采购，也可以离开并保留剩余货物。</p><div className="shop-stall"><div className="stall-ring"><span>⌘</span></div><div><b>补给站 · 「白昼」二号货舱</b><small>回收许可已确认 / 交易记录自动保存</small></div></div></div><div className="shop-stock"><div className="stock-heading"><span>本次货单</span><small>{run.shopItems.length} 项可交易</small></div>{run.shopItems.map(item => {
        const info = SHOP_INFO[item]
        return <div className="stock-row" key={item}><span className="stock-icon">{info.icon}</span><div className="stock-copy"><b>{info.name}</b><small>{info.detail}</small></div><button className="buy-button" disabled={run.metal < info.price} onClick={() => buyFromShop(item)}>{info.price === 0 ? '领取' : `▧ ${info.price}`}</button></div>
      })}{!run.shopItems.length && <div className="empty-stock">货单已清空。<br />回到航图继续出发。</div>}<button className="primary-action continue-service" onClick={finishNode}><span><b>离开补给站</b><small>保留当前剩余资源</small></span><span className="action-arrow">→</span></button></div></section>
    </PageShell>
  )

  const eventScreen = run && currentNode && (
    <PageShell title="未知信号" eyebrow={`异常回波 / ${currentNode.title}`} backLabel="返回航图" onBack={finishNode}>
      <section className="service-screen event-screen"><div className="event-visual"><div className="event-orbit"><i /><i /><i /><b>?</b></div><span>UNKNOWN SOURCE / {String(currentNode.seed % 999).padStart(3, '0')}</span></div><div className="event-copy"><p className="eyebrow">随机事件 / SIGNAL INTERCEPT</p><h2>{run.eventOffer || '失联空间站发来求救脉冲'}</h2><p className="event-story">信号在碎冰带间断续闪烁。舰桥确认附近存在可回收物资，但空间站的反应堆仍在不稳定运行。你可以谨慎取用现成货物、尝试打开密封舱，或把信号接入舰队系统。</p>{run.eventResult ? <div className="event-result"><span>✓</span><div><b>事件处理完成</b><p>{run.eventResult}</p></div><button className="primary-action compact" onClick={finishNode}>继续航行 <span>→</span></button></div> : <div className="event-choices"><button onClick={() => startService('risk')}><span className="choice-mark">!</span><b>打开密封货舱</b><small>58% 获得 90 合金与电池，失败损失 18 耐久</small><i>高风险 / 高收益</i></button><button onClick={() => startService('safe')}><span className="choice-mark">▧</span><b>回收可见补给</b><small>获得 42 合金并修复 8 点耐久</small><i>稳妥方案</i></button><button onClick={() => startService('tech')}><span className="choice-mark">ϟ</span><b>接入未知信号</b><small>获得火控协同，所有建筑射速提高 7%</small><i>永久效果</i></button></div>}</div></section>
    </PageShell>
  )

  const repairScreen = run && currentNode && (
    <PageShell title="维修平台" eyebrow={`船坞许可 / ${currentNode.title}`} backLabel="返回航图" onBack={finishNode}>
      <section className="service-screen repair-screen"><div className="repair-graphic"><div className="repair-cross">✚</div><div className="repair-orbit orbit-one"/><div className="repair-orbit orbit-two"/><span>DOCKING BAY 04</span></div><div className="repair-copy"><p className="eyebrow">损伤评估 / SERVICE CREW READY</p><h2>先修复船体，<br /><em>再接下一仗。</em></h2><p>泊位有足够时间完成一项检修。核心耐久、护盾和火控强化会带入后续战斗。</p><div className="repair-choices"><button disabled={run.serviceDone || run.metal < 24} onClick={() => startService('repair')}><span>✚</span><b>焊补舰队核心</b><small>+34 耐久 · 消耗 24 合金</small></button><button disabled={run.serviceDone} onClick={() => startService('shield')}><span>⬡</span><b>校准护盾</b><small>+36 核心护盾 · 持续 20 秒</small></button><button disabled={run.serviceDone} onClick={() => startService('power')}><span>ϟ</span><b>校准火控</b><small>建筑射速 +7% · 已有则回收 36 合金</small></button></div><button className="primary-action continue-service" onClick={finishNode}><span><b>{run.serviceDone ? '检修完成，继续航行' : '跳过检修并离开'}</b><small>舰队当前耐久 {Math.ceil(run.core)} / {run.maxCore}</small></span><span className="action-arrow">→</span></button></div></section>
    </PageShell>
  )

  const supplyScreen = run && currentNode && (
    <PageShell title="资源回收点" eyebrow={`漂流货舱 / ${currentNode.title}`} backLabel="返回航图" onBack={finishNode}>
      <section className="service-screen supply-screen"><div className="supply-hero"><p className="eyebrow">SALVAGE HOLD / D-22</p><h2>货舱仍然<br /><em>密封完好。</em></h2><p>漂流货舱的锁定装置还能维持一段时间。最多回收一项物资，剩余货物留给后续航路。</p><div className="cargo-crate"><span>▧</span><i/><i/><i/></div></div><div className="supply-options"><div className="stock-heading"><span>回收选项</span><small>{run.serviceDone ? '本节点已回收' : '择一装载'}</small></div><button disabled={run.serviceDone} onClick={() => startService('metal')}><span className="supply-option-icon">▧</span><b>精炼合金</b><small>+62 合金</small><i>即时资源</i></button><button disabled={run.serviceDone} onClick={() => startService('cells')}><span className="supply-option-icon">▥</span><b>能源电池</b><small>+3 指挥电池</small><i>作战消耗品</i></button><button disabled={run.serviceDone} onClick={() => startService('module')}><span className="supply-option-icon">⌘</span><b>战术模块</b><small>随机永久强化</small><i>策略构筑</i></button><button className="primary-action continue-service" onClick={finishNode}><span><b>离开回收点</b><small>余下物资随航道抛弃</small></span><span className="action-arrow">→</span></button></div></section>
    </PageShell>
  )

  const endingScreen = run && (
    <main className={`ending-screen ${run.end === 'victory' ? 'victory' : 'defeat'}`}>
      <div className="ending-top"><div className="wordmark"><BrandMark /><span>EMBER / HORIZON</span></div><span className="ending-stamp">CAMPAIGN LOG / {run.seed}</span></div>
      <section className="ending-main"><div className="ending-emblem">{run.end === 'victory' ? '✦' : '⌁'}</div><p className="eyebrow">{run.end === 'victory' ? '旗舰信号消失 / CORRIDOR OPEN' : '护航任务中止 / SIGNAL LOST'}</p><h1>{run.end === 'victory' ? <>边界航道<br /><em>重新点亮。</em></> : <>余烬仍在，<br /><em>舰队撤离。</em></>}</h1><p className="ending-copy">{run.end === 'victory' ? '断界者旗舰已被击溃。护航舰队已通过最后一道阻截，边境航道暂时开放。' : '舰队核心无法维持。幸存船只进入紧急跃迁，战斗记录已经安全保存。'}</p><div className="debrief-board"><div className="debrief-heading"><span>战役记录</span><small>SEED / {run.seed}</small></div><div className="debrief-grid"><div><span>任务用时</span><b>{formatTime(run.elapsed)}</b></div><div><span>击破目标</span><b>{formatNumber(run.kills)}</b></div><div><span>建造设施</span><b>{run.structuresBuilt}</b></div><div><span>专精改装</span><b>{run.upgradesMade}</b></div><div><span>突防次数</span><b>{run.leaks}</b></div><div><span>剩余核心</span><b>{Math.ceil(run.core)}%</b></div><div className="debrief-score"><span>战役评分</span><b>{formatNumber(run.score)}</b><small>最佳记录 {formatNumber(meta.bestScore)}</small></div><div className="debrief-build"><span>主要构筑</span><b>{run.boons.length ? run.boons.map(id => BOON_LABELS[id] ?? id).join(' · ') : '未取得模块'}</b></div></div></div><div className="ending-actions"><button className="primary-action" onClick={() => { setSeedField(''); beginNewRun('') }}><span><b>再来一局</b><small>生成一条新的随机航路</small></span><span className="action-arrow">→</span></button><button className="quiet-button" onClick={() => go('menu')}>返回主菜单</button></div></section><div className="ending-footer"><span>边境航道防卫局 / 舰队档案已保存</span><span>研究点数 +{run.end === 'victory' ? 3 : 1} <b>{meta.research}</b></span></div>
    </main>
  )

  return (
    <div className={`app-shell${settings.reduceMotion ? ' reduced-motion' : ''}`}>
      {trainingOpen ? <Tutorial onExit={() => { setTrainingOpen(false); go('menu') }} music={settings.music} effects={settings.effects} reduceMotion={settings.reduceMotion} quality={settings.quality} progressKey={storageKey === STORE_KEY ? undefined : `${storageKey}-training`} /> : <>
      {screen === 'menu' && menu}
      {screen === 'settings' && settingsScreen}
      {screen === 'guide' && guideScreen}
      {screen === 'map' && mapScreen}
      {screen === 'battle' && battleScreen}
      {screen === 'reward' && rewardScreen}
      {screen === 'shop' && shopScreen}
      {screen === 'event' && eventScreen}
      {screen === 'repair' && repairScreen}
      {screen === 'supply' && supplyScreen}
      {screen === 'ending' && endingScreen}
      </>}
      <span className="sr-only" aria-live="polite">{toast}</span>
    </div>
  )
}

function PageShell({ children, title, eyebrow, backLabel, onBack, right }: { children: ReactNode; title: string; eyebrow: string; backLabel: string; onBack: () => void; right?: ReactNode }) {
  return <main className="page-shell"><header className="page-header"><button className="page-back" onClick={onBack}><span>←</span>{backLabel}</button><div className="page-brand"><BrandMark small /><span><small>{eyebrow}</small><b>{title}</b></span></div><div className="page-header-right">{right ?? <span className="wordmark-sub">边境航道防卫局 / EH-07</span>}</div></header>{children}</main>
}

function BrandMark({ small = false }: { small?: boolean }) {
  return <img className={`brand-icon${small ? ' small' : ''}`} src="/brand-mark.svg" alt="" aria-hidden="true" draggable={false} />
}

function Metric({ value, label, icon, tone = '' }: { value: React.ReactNode; label: string; icon?: string; tone?: string }) {
  return <div className={`metric${tone ? ` ${tone}` : ''}`}>{icon && <span className="metric-icon">{icon}</span>}<div><span>{label}</span><b>{value}</b></div></div>
}

function SettingSlider({ label, note, value, onChange }: { label: string; note: string; value: number; onChange: (value: number) => void }) {
  return <div className="setting-row slider-row"><div><b>{label}</b><small>{note}</small></div><div className="slider-wrap"><input type="range" min="0" max="100" value={Math.round(value * 100)} onChange={e => onChange(clampSetting(Number(e.target.value) / 100))} aria-label={label} style={{ '--range-progress': `${Math.round(value * 100)}%` } as CSSProperties} /><b>{Math.round(value * 100)}%</b></div></div>
}

function GuideStep({ n, title, text }: { n: string; title: string; text: string }) { return <div className="guide-step"><span>{n}</span><div><b>{title}</b><p>{text}</p></div></div> }
function GuideRow({ icon, title, text }: { icon: string; title: string; text: string }) { return <div className="guide-row"><span>{icon}</span><div><b>{title}</b><p>{text}</p></div></div> }
function KeyLine({ keys, label }: { keys: string; label: string }) { return <div className="key-line"><kbd>{keys}</kbd><span>{label}</span></div> }

function SkillButton({ id, hotkey, name, note, cooldown, charges, onClick }: { id: 'strike' | 'stasis' | 'shield' | 'repair'; hotkey: string; name: string; note: string; cooldown: number; charges: number; onClick: () => void }) {
  const names = { strike: '⌖', stasis: '❄', shield: '⬡', repair: '✚' }
  const ready = cooldown <= 0 && charges > 0
  return <button className={`skill-card ${id}${ready ? ' ready' : ''}`} disabled={!ready} onClick={onClick}><span className="skill-glyph">{names[id]}</span><span className="skill-copy"><b>{name}</b><small>{cooldown > 0 ? `${Math.ceil(cooldown)} 秒冷却` : charges > 0 ? note : '无可用电池'}</small></span><kbd>{hotkey}</kbd>{cooldown > 0 && <i className="cooldown-shade" style={{ height: `${Math.min(100, cooldown / ({ strike: 35, stasis: 52, shield: 62, repair: 72 }[id]) * 100)}%` }} />}</button>
}

function TowerPortrait({ type }: { type: TowerKind }) {
  return <span className={`tower-glyph tower-portrait ${type}`} aria-hidden="true"><img src={`/assets/towers/${type}-icon.png`} alt="" decoding="async" /></span>
}

function TowerDetail({ tower, run, onUpgrade, onSell, onTargetMode }: { tower: NonNullable<RunState['battle']>['structures'][number]; run: RunState; onUpgrade: (branch: Branch) => void; onSell: () => void; onTargetMode: () => void }) {
  const spec = TOWER_SPECS[tower.type]
  const stats = getTowerStats(tower, run)
  const status = getTowerStatus(run, tower)
  const nextCost = tower.level === 1 ? 62 : 92
  const branchName = tower.branch === 'A' ? spec.branchA : spec.branchB
  return <div className="tower-detail"><div className="detail-header"><TowerPortrait type={tower.type} /><div><p>已部署设施 / LV.{tower.level}</p><h4>{spec.name}</h4><small>{spec.role}</small></div><span className={`power-status ${tower.health > 0 && tower.jammed <= 0 ? 'on' : 'off'}`}>{tower.health <= 0 ? '已损毁' : tower.jammed > 0 ? '受干扰' : '独立就绪'}</span></div>
    <div className={`facility-status ${status.tone}`} role="status"><b>{status.label}</b><span>{status.detail}</span></div>
    <p className="detail-description">{spec.description}</p>
    <div className="detail-stats"><div><span>射程</span><b>{Math.round(stats.range)}m</b></div><div><span>基础伤害</span><b>{Math.round(stats.damage)}</b></div><div><span>攻击间隔</span><b>{stats.cooldown.toFixed(2)}s</b></div><div><span>耐久</span><b>{Math.ceil(tower.health)} / {tower.maxHealth}</b></div></div>
    {tower.branch ? <div className="branch-current"><span>专精路线 / {tower.branch}</span><b>{branchName}</b><small>路线已锁定 · 当前等级 {tower.level}</small></div> : <div className="branch-choice"><span>选择升级专精 / 62 合金</span><div><button disabled={run.metal < nextCost} onClick={() => onUpgrade('A')}><b>A · {spec.branchA.split('：')[0]}</b><small>{spec.branchA}</small></button><button disabled={run.metal < nextCost} onClick={() => onUpgrade('B')}><b>B · {spec.branchB.split('：')[0]}</b><small>{spec.branchB}</small></button></div></div>}
    {tower.branch && tower.level < 3 && <button className="detail-upgrade" disabled={run.metal < nextCost} onClick={() => onUpgrade(tower.branch!)}><span>继续 {tower.branch} 路线 · LV.{tower.level + 1}</span><b>▧ {nextCost}</b></button>}
    <div className="detail-actions"><button onClick={onTargetMode}>目标优先级 <b>{tower.targetMode === 'first' ? '最接近核心' : tower.targetMode === 'strong' ? '重型目标' : '战术威胁'}</b></button><button onClick={onSell}>拆解设施 <b>+{Math.floor(spec.cost * 0.58 + Math.max(0, tower.level - 1) * 22)} 合金</b></button></div>
  </div>
}
