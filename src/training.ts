import { createBattle, createMeta, makeRun, placeStructure } from './engine'
import type { Enemy, EnemyKind, RunState, TowerKind } from './engine'

export type LessonId = 'reactor' | 'offline' | 'relay' | 'needle' | 'upgrade' | 'rail' | 'arc' | 'comet' | 'cold' | 'drone' | 'shield' | 'lure' | 'counter' | 'review'
export interface TrainingLesson {
  id: LessonId
  title: string
  type?: TowerKind
  build?: TowerKind
  slot?: number
  brief: string
  task: string
  tip: string
  success: string
  practice?: boolean
}

export const TRAINING_LESSONS: TrainingLesson[] = [
  { id: 'reactor', title: '每座建筑都能独立攻击', brief: '九类防御建筑自带能源与武器，放在任意空闲平台即可使用，不需要连接反应堆或先建其他建筑。', task: '了解新规则后，点击“开始部署训练”。', tip: '只需关注位置、射程与目标类型。护盾、维修、诱导是额外效果，不是开火前提。', success: '接下来在远端平台独立部署第一座炮塔。' },
  { id: 'offline', title: '在远端平台直接部署', type: 'needle', build: 'needle', slot: 1, brief: '针蜂是近距离速射炮。即使平台离舰队很远，也能直接独立部署，无需铺设任何供电线路。', task: '选择“针蜂”，放到标记的 02 号平台，确认显示“独立就绪”。', tip: '所有空闲平台遵循同样规则。建筑不会再因为未接电或电量不足而停火。', success: '针蜂已独立就绪，没有其他建筑也可以攻击。' },
  { id: 'relay', title: '脉冲哨塔：独立能量点射', type: 'relay', build: 'relay', slot: 0, practice: true, brief: '原中继站现已改为脉冲哨塔，雷达碟会锁定敌人并发射能量光束。它无需为其他建筑供电。', task: '选择“脉冲哨塔”，部署到 01 号平台，再启动演练，观察光束造成伤害。', tip: '造价低、射程适中，适合补充火力。A 路线提高自身射速，B 路线强化自身射程和伤害。', success: '脉冲光束已命中敌人。哨塔独自就能构成一道火力。' },
  { id: 'needle', title: '让针蜂自动开火', type: 'needle', build: 'needle', slot: 1, practice: true, brief: '建筑部署后自动就绪。敌人进入射程就会攻击，不用点选敌人，也不用建其他设施。', task: '部署针蜂，点击“启动演练”，观察枪口闪光和弹道。', tip: '针蜂射速快、射程较短。先覆盖敌人的必经之处，之后可以按需要选配控制或范围火力。', success: '针蜂已独自开火并命中。正式战役中也遵循相同条件。' },
  { id: 'upgrade', title: '给针蜂选择专精', type: 'needle', practice: true, brief: '选中建筑后可以升级。每座建筑有 A / B 两条路线，选定后沿同一路线继续强化，最高三级。', task: '点击“A · 蜂群弹链”完成升级，再启动演练，观察弹射命中第二个目标。', tip: '针蜂 A 路线擅长清理相邻敌人；B 路线提高单发伤害。升级需要合金，训练中已备足。', success: '专精已生效：弹丸命中后，额外伤害了邻近敌人。' },
  { id: 'rail', title: '轨矛：远程贯穿', type: 'rail', build: 'rail', slot: 1, practice: true, brief: '轨矛伤害高、射程长，但装填较慢。磁轨光束能贯穿同一直线上的多个目标。', task: '部署轨矛并启动演练，观察磁轨光束命中重装目标。', tip: '适合覆盖长直线和对付重装、旗舰。高地可增加射程；“重型目标”优先级会优先锁定强敌。', success: '轨矛已命中重装目标。慢速武器可搭配速射炮清理轻型敌人。' },
  { id: 'arc', title: '弧光：连锁电流', type: 'arc', build: 'arc', slot: 1, practice: true, brief: '弧光会把电流传给附近敌人，密集编队越多，连锁攻击越有效，也能削弱护盾。', task: '部署弧光并启动演练，让同一次电弧伤害至少两个目标。', tip: '适合拦截密集敌群。目标间距太远时无法继续跳跃，可与冷凝搭配聚集火力。', success: '电弧已跳跃到第二个目标，完成集群打击。' },
  { id: 'comet', title: '彗星：追踪与范围爆破', type: 'comet', build: 'comet', slot: 1, practice: true, brief: '彗星发射追踪导弹，命中后造成范围伤害。导弹可以绕过地形，对成群重型单位尤其有效。', task: '部署彗星并启动演练，观察导弹命中和范围爆炸。', tip: '导弹飞行需要时间。不要把最后一道防线全部交给慢速导弹，可用针蜂补刀。', success: '导弹已命中并爆炸，周围目标受到范围伤害。' },
  { id: 'cold', title: '冷凝：为火力争取时间', type: 'cold', build: 'cold', slot: 1, practice: true, brief: '冷凝弹伤害较低，主要作用是显著减慢敌人，让轨矛、彗星等武器多攻击几次。', task: '部署冷凝并启动演练，看到敌人出现“减速”状态。', tip: '冷凝是控制火力，不能独自承担全部输出。放在主火力射程重叠的位置最实用。', success: '目标已减速，移动速度降低。将控场与伤害型炮塔配合使用。' },
  { id: 'drone', title: '巡游蜂巢：攻击与维修', type: 'drone', build: 'drone', slot: 1, practice: true, brief: '蜂巢派出无人机攻击敌人，也会周期维修射程内受损的友军建筑。下方预置了一座受损针蜂。', task: '部署巡游蜂巢并启动演练，观察无人机攻击，同时修复受损针蜂。', tip: '蜂巢放下即可独立攻击与维修，受损设施要在蜂巢射程内。A 路线强化维修，B 路线强化火力。', success: '无人机已发起攻击，受损针蜂的耐久也已恢复。' },
  { id: 'shield', title: '护盾冲击塔：攻击与护盾', type: 'shield', build: 'shield', slot: 1, practice: true, brief: '护盾冲击塔会独立释放范围冲击，对周围敌人造成伤害，同时自动为舰队核心恢复护盾。', task: '部署护盾冲击塔并启动演练，看到敌人受伤，同时让核心护盾恢复至少 6 点。', tip: '无需其他建筑即可兼顾攻防。A 路线每波额外补盾，B 路线加快恢复。', success: '冲击已伤害敌人，舰队护盾也已增加。' },
  { id: 'lure', title: '诱导震荡塔：伤害与牵制', type: 'lure', build: 'lure', slot: 1, practice: true, brief: '基础形态就能独立向范围内敌人释放伤害震荡，同时短暂吸引普通敌人偏离航道。', task: '部署诱导震荡塔并启动演练，观察敌人受到震荡伤害并被诱导。', tip: '伤害攻击对所有范围内敌人生效；额外诱导对旗舰和跃迁单位无效，并有冷却。', success: '震荡已造成伤害，诱导也已发生。无需升级就有攻击能力。' },
  { id: 'counter', title: '震荡塔 B：强化自身攻击', type: 'lure', practice: true, brief: '每座建筑都有可选专精，升级是强化已有能力。诱导震荡塔 B 路线提高伤害与攻击频率。', task: '点击“B · 反击强化”，再启动演练，观察强化后的伤害震荡。', tip: '基础建筑已经可以攻击；按需要选择更强输出或更广控制范围。', success: '强化攻击已命中。你已经练习了九类独立防御建筑。' },
  { id: 'review', title: '准备进入正式航道', brief: '九类建筑全部可以独立攻击。正式战役只需选好平台、花费合金部署，再根据敌人调整火力与专精。', task: '排查顺序：建筑是否损毁或受干扰 → 敌人是否在射程内 → 直射路线是否受阻。无需检查供电。', tip: '先用喜欢的建筑守住航道，需要时再添加减速、护盾或诱导。这些能力是额外收益。', success: '训练完成，可以返回主菜单开始战役，或回看任意课程。' },

]

function put(run: RunState, kind: TowerKind, slot: number) {
  placeStructure(run, kind, slot)
  return run.battle!.structures[run.battle!.structures.length - 1]!
}

export function createTrainingRun(lesson: TrainingLesson): RunState {
  const run = makeRun('训练航道', 'standard', createMeta())
  run.metal = 400; run.generator = 16; run.cells = 9
  const node = { ...run.nodes[0][0], seed: 0 }
  run.activeNode = node
  run.battle = createBattle(run, node)
  const b = run.battle
  b.path = [{ x: -25, y: 350 }, { x: 1025, y: 350 }]; b.pathLength = 1050
  b.pads = [{ x: 340, y: 460, high: false, blocked: false }, { x: 510, y: 445, high: lesson.id === 'rail', blocked: false }, { x: 580, y: 505, high: false, blocked: false }]
  if (lesson.id === 'upgrade') put(run, 'needle', 1)
  if (lesson.id === 'counter') put(run, 'lure', 1)
  if (lesson.id === 'drone') { const damaged = put(run, 'needle', 2); damaged.health = 45; damaged.cooldown = 999 }
  run.metal = 400
  return run
}

export function spawnTrainingTargets(run: RunState, lesson: TrainingLesson): void {
  const b = run.battle!
  b.enemies = []; b.projectiles = []; b.effects = []
  const kinds: EnemyKind[] = lesson.id === 'rail' ? ['siege', 'siege'] : lesson.id === 'arc' || lesson.id === 'comet' || lesson.id === 'upgrade' ? ['siege', 'siege', 'siege'] : ['scout', 'scout']
  for (let i = 0; i < kinds.length; i++) {
    const hp = lesson.id === 'rail' ? 600 : lesson.id === 'needle' || lesson.id === 'drone' ? 180 : 450
    const dist = 435 - i * 28
    const enemy: Enemy = { id: `training-${i}`, kind: kinds[i], dist, x: dist - 25, y: 350, hp, maxHp: hp, shield: 0, maxShield: 0, slow: 0, slowTimer: 0, burn: 0, burnTimer: 0, attackTimer: 999, teleportTimer: 999, lureTimer: 0, lureSeed: 0, bossPhase: 1 }
    b.enemies.push(enemy)
  }
  for (const t of b.structures) { if (t.slot !== 2) t.cooldown = 0; t.repairTimer = 0 }
}

export function trainingLessonComplete(run: RunState, lesson: TrainingLesson): boolean {
  const b = run.battle!, main = b.structures.find(t => t.slot === (lesson.id === 'relay' ? 0 : 1))
  const damaged = b.enemies.filter(e => e.hp < e.maxHp).length
  const fired = (main?.shotsFired ?? 0) > 0
  switch (lesson.id) {
    case 'offline': return !!main?.powered
    case 'relay': return fired && damaged > 0
    case 'needle': case 'rail': return fired && (damaged > 0 || run.kills > 0)
    case 'upgrade': case 'arc': case 'comet': return fired && damaged >= 2
    case 'cold': return fired && b.enemies.some(e => e.slow > 0.3 && e.slowTimer > 0)
    case 'drone': return fired && b.structures.some(t => t.slot === 2 && t.health > 45)
    case 'shield': return fired && damaged > 0 && run.coreShield >= 6
    case 'lure': return fired && damaged > 0 && b.enemies.some(e => e.lureTimer > 0)
    case 'counter': return main?.branch === 'B' && damaged > 0
    default: return false
  }
}

export function trainingReady(run: RunState, lesson: TrainingLesson): boolean {
  const tower = run.battle!.structures.find(t => t.slot === (lesson.id === 'relay' ? 0 : 1))
  return !!tower?.powered && (lesson.id !== 'upgrade' || tower.branch === 'A') && (lesson.id !== 'counter' || tower.branch === 'B')
}

