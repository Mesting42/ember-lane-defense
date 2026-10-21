import { useEffect, useRef, useState } from 'react'
import Battlefield from './Battlefield'
import { getTowerStats, getTowerStatus, placeStructure, tickRun, TOWER_SPECS, upgradeStructure } from './engine'
import type { TowerKind } from './engine'
import { playCombatSfx, playSfx, startAudio } from './audio'
import { createTrainingRun, spawnTrainingTargets, TRAINING_LESSONS, trainingLessonComplete, trainingReady } from './training'
import { useRotationPause } from './useRotationPause'

const PROGRESS_KEY = 'ember-lane-training-v2'
const COURSE_LABELS: Record<string, string> = { reactor: '独立作战', offline: '针蜂 · 部署', needle: '针蜂 · 开火', upgrade: '针蜂 · 升级', counter: '震荡塔 · 强化', review: '训练总结' }
type Progress = { index: number; completed: string[]; skipped: string[]; finished: boolean }
function readProgress(progressKey = PROGRESS_KEY): Progress {
  try {
    const p = JSON.parse(localStorage.getItem(progressKey) ?? 'null')
    if (p && Number.isInteger(p.index) && Array.isArray(p.completed)) return { index: Math.max(0, Math.min(TRAINING_LESSONS.length - 1, p.index)), completed: p.completed.filter((id: unknown) => typeof id === 'string'), skipped: Array.isArray(p.skipped) ? p.skipped : [], finished: p.finished === true }
  } catch { /* Start at the first lesson if the training record cannot be read. */ }
  return { index: 0, completed: [], skipped: [], finished: false }
}

export default function Tutorial({ onExit, music, effects, reduceMotion, quality, progressKey = PROGRESS_KEY }: { onExit: () => void; music: number; effects: number; reduceMotion: boolean; quality: 'standard' | 'high'; progressKey?: string }) {
  const [progress, setProgress] = useState(() => readProgress(progressKey))
  const [index, setIndex] = useState(progress.index)
  const lesson = TRAINING_LESSONS[index]
  const [run, setRun] = useState(() => createTrainingRun(lesson))
  const runRef = useRef(run); runRef.current = run
  const [revision, setRevision] = useState(0)
  const [build, setBuild] = useState<TowerKind | null>(null)
  const [running, setRunning] = useState(false)
  const [done, setDone] = useState(false)
  const [note, setNote] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const b = run.battle!, main = b.structures.find(t => t.slot === 1)
  const current = b.structures.find(t => t.id === selected) ?? main
  const status = current ? getTowerStatus(run, current) : null
  const ready = trainingReady(run, lesson)

  const save = (next: Progress) => { setProgress(next); try { localStorage.setItem(progressKey, JSON.stringify(next)) } catch { /* Training remains usable without storage. */ } }
  useRotationPause(running, () => { setRunning(false); setNote('画面方向已切换，演练已暂停。点击“启动演练”继续练习。') })
  const complete = () => {
    setDone(true); setRunning(false); setBuild(null)
    save({ ...progress, index, completed: [...new Set([...progress.completed, lesson.id])], skipped: progress.skipped.filter(id => id !== lesson.id), finished: lesson.id === 'review' || progress.finished })
  }
  const load = (next: number) => {
    setRunning(false); setDone(false); setBuild(null); setSelected(null); setNote('')
    const bounded = Math.max(0, Math.min(TRAINING_LESSONS.length - 1, next))
    setIndex(bounded); setRun(createTrainingRun(TRAINING_LESSONS[bounded])); setRevision(v => v + 1)
    save({ ...progress, index: bounded })
    requestAnimationFrame(() => heading.current?.focus())
  }

  useEffect(() => {
    if (!running || done) return
    let raf = 0, last = performance.now(), elapsed = 0, repaint = 0, achieved = false
    const frame = (now: number) => {
      let dt = Math.min(0.08, Math.max(0, (now - last) / 1000)); last = now
      elapsed += dt; repaint += dt
      while (dt > 0) { const slice = Math.min(dt, 1 / 60); tickRun(runRef.current, slice, playCombatSfx); dt -= slice }
      achieved ||= trainingLessonComplete(runRef.current, lesson)
      // Keep the exercise visible long enough to see the shot, pulse or support action.
      if (achieved && elapsed >= 3.5) { complete(); setRevision(v => v + 1); return }
      if (!achieved && (elapsed >= 25 || runRef.current.core <= 0 || (elapsed > 3 && !runRef.current.battle!.enemies.length && lesson.id !== 'shield'))) { setRunning(false); setNote('这轮目标已经离场。点击“启动演练”即可补充目标再试，不会扣除正式战役资源。'); return }
      if (repaint > 0.08) { repaint = 0; setRevision(v => v + 1) }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [running, done, index]) // Each lesson owns an isolated simulation and freezes on success.

  useEffect(() => {
    const pause = () => { if (document.hidden) setRunning(false) }
    document.addEventListener('visibilitychange', pause)
    return () => document.removeEventListener('visibilitychange', pause)
  }, [])

  const place = (slot: number) => {
    if (done || running) return
    if (!build) { setNote('先选择右侧的建筑卡片，再点金色标记平台。'); return }
    if (slot !== lesson.slot) { setNote(`本课请点金色标记的 ${String((lesson.slot ?? 0) + 1).padStart(2, '0')} 号平台。`); return }
    const result = placeStructure(run, build, slot)
    setNote(result.message)
    if (result.ok) { setBuild(null); setSelected(b.structures[b.structures.length - 1]!.id); playSfx('build'); if (trainingLessonComplete(run, lesson)) complete() }
    setRevision(v => v + 1)
  }
  const start = () => {
    if (!ready || done) return
    void startAudio(music, effects)
    spawnTrainingTargets(run, lesson); setNote('观察战场：系统会在真实效果出现后自动完成本课。'); setRunning(true); setRevision(v => v + 1)
  }
  const upgrade = () => {
    if (!main || done || running) return
    const branch = lesson.id === 'counter' ? 'B' : 'A'
    const result = upgradeStructure(run, main.id, branch)
    setNote(result.message); setSelected(main.id); setRevision(v => v + 1)
    if (result.ok) playSfx('upgrade')
  }
  const skip = () => {
    const next = Math.min(index + 1, TRAINING_LESSONS.length - 1)
    const p = { ...progress, index: next, completed: progress.completed.filter(id => id !== lesson.id), skipped: [...new Set([...progress.skipped, lesson.id])] }
    setRunning(false); setDone(false); setBuild(null); setSelected(null); setNote(''); setIndex(next); setRun(createTrainingRun(TRAINING_LESSONS[next])); save(p)
  }
  const restart = () => {
    setRunning(false); setDone(false); setBuild(null); setSelected(null); setNote(''); setIndex(0); setRun(createTrainingRun(TRAINING_LESSONS[0]))
    save({ index: 0, completed: [], skipped: [], finished: false })
    requestAnimationFrame(() => heading.current?.focus())
  }

  return <main className="training-screen">
    <header className="training-header"><div><span className="eyebrow">边境航道防卫局 / 新手训练</span><h1>放下即可开火，独自守住航道。</h1></div><button className="quiet-button" onClick={onExit}>退出训练</button></header>
    <nav className="training-courses" aria-label="训练课程">{TRAINING_LESSONS.map((item, i) => <button key={item.id} title={item.title} className={`${i === index ? 'current' : ''}${progress.completed.includes(item.id) ? ' completed' : ''}`} aria-current={i === index ? 'step' : undefined} onClick={() => load(i)}><span>{progress.completed.includes(item.id) ? '✓' : String(i + 1).padStart(2, '0')}</span>{COURSE_LABELS[item.id] ?? (item.type ? TOWER_SPECS[item.type].name : item.title)}<small>{progress.skipped.includes(item.id) ? '已跳过' : ''}</small></button>)}</nav>
    <section className="training-brief"><div><p className="eyebrow">课程 {String(index + 1).padStart(2, '0')} / {TRAINING_LESSONS.length}</p><h2 ref={heading} tabIndex={-1}>{lesson.title}</h2><p>{lesson.brief}</p></div><div className={`training-objective${done ? ' complete' : ''}`} role="status" aria-live="polite"><b>{done ? '✓ 目标已完成' : '当前任务'}</b><p>{done ? lesson.success : lesson.task}</p></div></section>
    <div className="training-layout"><section className="training-board-panel"><div className="training-board-head"><span>{running ? '实操进行中' : done ? '观察完成 · 战场已暂停' : '部署阶段 · 演练尚未开始'}</span><span>训练合金 {run.metal} · 就绪 {b.structures.filter(t => t.health > 0).length} 座 · 核心护盾 {Math.ceil(run.coreShield)}</span></div>
      <Battlefield run={run} revision={revision} buildType={build} selectedId={selected} targetSkill={false} effects={!reduceMotion} quality={quality} onPad={place} onSelect={id => { setSelected(id); setNote('已选中设施，可在右侧查看攻击状态和用途。') }} onMiss={() => setNote('请点金色标记平台；训练可随时重试。')} onTarget={() => undefined} training={{ slot: done || !lesson.build || b.structures.some(t => t.slot === lesson.slot) ? undefined : lesson.slot, label: lesson.build ? `在这里部署${TOWER_SPECS[lesson.build].name}` : '' }} />
      <div className="training-platforms" aria-label="平台快捷部署"><span>也可直接点平台按钮：</span>{b.pads.map((pad, slot) => <button key={slot} disabled={running || done || slot !== lesson.slot || b.structures.some(t => t.slot === slot)} className={slot === lesson.slot ? 'target' : ''} onClick={() => place(slot)}>平台 {String(slot + 1).padStart(2, '0')}{b.structures.some(t => t.slot === slot) ? ' · 已部署' : pad.high ? ' · 高地' : ''}</button>)}</div>
    </section>
    <aside className="training-console" aria-label="训练操作台">
      {lesson.type && <div className="training-equipment"><img src={`/assets/towers/${lesson.type}-icon.png`} alt={TOWER_SPECS[lesson.type].name} /><div><span>独立攻击设施</span><h3>{TOWER_SPECS[lesson.type].name}</h3><p>{TOWER_SPECS[lesson.type].role}</p></div></div>}
      <div className="training-tip"><b>使用要点</b><p>{lesson.tip}</p></div>
      {lesson.build && <button className={`training-build${build ? ' selected' : ''}`} disabled={done || running || b.structures.some(t => t.slot === lesson.slot)} onClick={() => { setBuild(lesson.build!); setNote(`已选择${TOWER_SPECS[lesson.build!].name}，请点击金色标记平台。`) }}><span>选择{TOWER_SPECS[lesson.build].name}</span><small>{TOWER_SPECS[lesson.build].cost} 合金 · 独立攻击</small></button>}
      {(lesson.id === 'upgrade' || lesson.id === 'counter') && <button className="training-upgrade" disabled={done || running || !!main?.branch} onClick={upgrade}>{lesson.id === 'counter' ? 'B · 反击强化' : 'A · 蜂群弹链'}<small>升级到 LV.2 · 62 合金</small></button>}
      {status && current && <div className={`facility-status ${status.tone}`}><b>{TOWER_SPECS[current.type].name} · {status.label}</b><span>{status.detail}</span><span>耐久 {Math.ceil(current.health)}/{current.maxHealth} · 射程 {Math.round(getTowerStats(current, run).range)}</span></div>}
      {lesson.id === 'drone' && <p className="training-measure">受损针蜂耐久：<b>{Math.ceil(b.structures.find(t => t.slot === 2)?.health ?? 45)}</b> / 135</p>}
      {lesson.practice && <button className="training-launch" disabled={!ready || done || running} onClick={start}>{running ? '演练中…' : b.enemies.length ? '重新演练' : '启动演练'}</button>}
      {lesson.id === 'reactor' && !done && <button className="training-launch" onClick={complete}>开始部署训练</button>}
      {lesson.id === 'review' && !done && <><div className="training-summary"><b>训练记录</b><p>已完成 {progress.completed.filter(id => id !== 'review').length} / {TRAINING_LESSONS.length - 1} 课；跳过 {progress.skipped.length} 课。可从上方课程栏回看练习。</p></div><button className="training-launch" onClick={complete}>完成训练</button></>}
      {note && <p className="training-feedback" role="status">{note}</p>}
      <div className="training-next">{done && <button className="training-launch" onClick={() => index === TRAINING_LESSONS.length - 1 ? onExit() : load(index + 1)}>{index === TRAINING_LESSONS.length - 1 ? '返回主菜单' : '下一课 →'}</button>}<button className="quiet-button" onClick={() => load(index)}>重试本课</button>{!done && index < TRAINING_LESSONS.length - 1 && <button className="training-skip" onClick={skip}>跳过本课 →</button>}</div>
    </aside></div>
    <footer className="training-footer"><span>训练进度自动保存 · 离开后会从本课重新布置</span><span>训练与正式战役分别保存</span><button className="training-skip" onClick={restart}>从头重新训练</button></footer>
  </main>
}
