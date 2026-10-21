// Development-only entry. Fixtures never touch the player's campaign or training.
import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import type { ComponentProps } from 'react'
import App from '../src/App'
import { createBattle, createMeta, finishRun, makeRun, openShop, placeStructure, selectBoon } from '../src/engine'
import '../src/styles.css'

type Store = NonNullable<ComponentProps<typeof App>['initialStore']>
const scenes = ['menu', 'map', 'battle', 'reward', 'settings', 'guide', 'shop', 'event', 'repair', 'supply', 'victory', 'defeat'] as const
type Scene = typeof scenes[number]
function fixture(scene: Scene): Store {
  let meta = createMeta()
  const run = makeRun('responsive-browser-qa', 'standard', meta)
  run.metal = 500; run.core = 76; run.boons = ['relaySync']
  const service = ['shop', 'event', 'repair', 'supply'].includes(scene)
  const node = run.nodes.flat().find(n => n.kind === (service ? scene : 'battle'))!
  run.activeNode = node; run.mapLayer = node.layer
  run.battle = createBattle(run, node)
  placeStructure(run, 'needle', 0)
  placeStructure(run, 'shield', 1)
  run.pendingBoons = selectBoon(run)
  if (scene === 'shop') openShop(run)
  if (scene === 'event') run.eventOffer = '未知信号要求译码'
  if (scene === 'victory' || scene === 'defeat') meta = finishRun(run, scene, meta)
  return { meta, run, screen: scene === 'victory' || scene === 'defeat' ? 'ending' : scene, settings: { music: 0, effects: 0, reduceMotion: false, quality: 'high' } }
}
function Preview() {
  const [scene, setScene] = useState<Scene>('menu')
  const [version, setVersion] = useState(0)
  const [hidden, setHidden] = useState(false)
  return <>
    <aside style={{ position: 'fixed', bottom: 4, right: 4, zIndex: 100, background: '#142128', border: '1px solid #72968c', padding: 4, fontSize: 12, color: '#d8e0d7' }}>
      {!hidden && <><label>独立检查场景 <select aria-label="独立检查场景" value={scene} onChange={e => { setScene(e.target.value as Scene); setVersion(v => v + 1) }}>{scenes.map(id => <option key={id}>{id}</option>)}</select></label><button onClick={() => setVersion(v => v + 1)}>重置场景</button></>}
      <button onClick={() => setHidden(v => !v)}>{hidden ? '显示检查栏' : '收起检查栏'}</button>
    </aside>
    <App key={`${scene}-${version}`} initialStore={fixture(scene)} storageKey="ember-lane-responsive-qa-v1" />
  </>
}
createRoot(document.getElementById('preview')!).render(<Preview />)
