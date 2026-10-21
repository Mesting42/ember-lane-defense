// DOM integration checks run in an isolated virtual document, never the user's browser.
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { build } from 'esbuild'
import { Window } from 'happy-dom'
const require=createRequire(import.meta.url)
const canvas=require(process.env.EMBER_CANVAS_MODULE||'@napi-rs/canvas')
const {act}=require('react'),{createRoot}=require('react-dom/client')
const w=new Window({url:'http://localhost/'}),nativeCanvases=new WeakMap(),frames=new Map();let frameSerial=0,now=performance.now(),root=null,boardWidth=1000
for(const key of ['window','document','navigator','HTMLElement','HTMLCanvasElement','Event','MouseEvent','PointerEvent','KeyboardEvent','localStorage'])Object.defineProperty(globalThis,key,{value:key==='window'?w:w[key],configurable:true})
globalThis.IS_REACT_ACT_ENVIRONMENT=true
globalThis.ResizeObserver=class{observe(){}disconnect(){}}
globalThis.requestAnimationFrame=callback=>{const id=++frameSerial;frames.set(id,callback);return id}
globalThis.cancelAnimationFrame=id=>frames.delete(id)
globalThis.Image=class extends canvas.Image{set src(value){super.src=typeof value==='string'&&value.startsWith('/')?path.join(process.cwd(),'public',value):value}get src(){return super.src}}
w.HTMLCanvasElement.prototype.getContext=function(type){if(type!=='2d')return null;if(!nativeCanvases.has(this))nativeCanvases.set(this,canvas.createCanvas(2000,1200));return nativeCanvases.get(this).getContext('2d')}
w.HTMLCanvasElement.prototype.getBoundingClientRect=()=>({left:0,top:0,right:boardWidth,bottom:boardWidth*0.6,width:boardWidth,height:boardWidth*0.6,x:0,y:0,toJSON(){}})
w.AudioContext=undefined
const bundle=await build({stdin:{contents:fs.readFileSync('src/App.tsx','utf8')+'\nexport { readStore }; export {makeRun,createMeta,createBattle,placeStructure,startWave,finishRun} from "./engine";',resolveDir:path.resolve('src'),loader:'tsx'},jsx:'automatic',bundle:true,platform:'node',format:'cjs',write:false,external:['react','react-dom'],logLevel:'silent'})
const Module=require('node:module'),module=new Module(path.resolve('ui-qa.cjs'));module.filename=path.resolve('ui-qa.cjs');module.paths=Module._nodeModulePaths(process.cwd());module._compile(bundle.outputFiles[0].text,module.filename);const api=module.exports
const React=require('react'),rows=[],key='ember-lane-defense-v1'
async function check(name,fn){try{await fn();rows.push({name,pass:true});console.log('PASS '+name)}catch(error){rows.push({name,pass:false,error:error.stack});console.error('FAIL '+name+': '+error.message)}}
async function mount(store,appProps={}){if(root)await act(async()=>root.unmount());frames.clear();document.body.innerHTML='<div id="root"></div>';localStorage.clear();if(store)localStorage.setItem(key,JSON.stringify(store));root=createRoot(document.getElementById('root'));await act(async()=>root.render(React.createElement(api.default,appProps)));await new Promise(resolve=>setImmediate(resolve))}
function findButton(text){const list=[...document.querySelectorAll('button')].filter(b=>b.textContent.includes(text));assert(list.length,`Button absent: ${text}`);return list[0]}
async function click(button){assert(!button.disabled,'Cannot click disabled button');await act(async()=>button.dispatchEvent(new w.MouseEvent('click',{bubbles:true})))}
function saved(){return JSON.parse(localStorage.getItem(key))}
async function advance(seconds,fps=30){now=Math.max(now,performance.now());for(let i=0;i<Math.ceil(seconds*fps);i++){now+=1000/fps;const current=[...frames.values()];frames.clear();await act(async()=>{for(const cb of current)cb(now)})}}
function store(run,screen='battle'){return{meta:api.createMeta(),run,screen,settings:{music:0,effects:0.4,reduceMotion:false,quality:'standard'}}}
await check('Main menu and new campaign route selection',async()=>{await mount();assert(document.body.textContent.includes('余烬防线'));await click(findButton('启动新战役'));assert(document.body.textContent.includes('星域航路'));assert.equal(saved().screen,'map')})
await check('Route node enters deployment; tower portrait, placement and status work',async()=>{const button=document.querySelector('.map-node.available');assert(button);await click(button);assert.equal(saved().screen,'battle');assert.equal(document.querySelectorAll('.tower-portrait').length,9);await click(document.querySelector('.tower-card.needle')??[...document.querySelectorAll('.tower-card')][0]);const b=saved().run.battle;const slot=b.pads.findIndex(p=>Math.hypot(p.x-78,p.y-546)<370);const p=b.pads[slot];await act(async()=>document.querySelector('canvas').dispatchEvent(new w.PointerEvent('pointerdown',{bubbles:true,clientX:p.x,clientY:p.y})));assert.equal(saved().run.battle.structures.length,1);assert(document.querySelector('.facility-status'));assert(!document.querySelector('.facility-status').textContent.includes('未接入'))})
await check('Wave start, pause and 3x simulation on a 30 FPS screen',async()=>{await click(findButton('启动'));await advance(0.2);let before=saved().run.elapsed;await click([...document.querySelectorAll('.speed-group button')].find(b=>b.textContent==='3×'));await advance(2);await click(document.querySelector('.time-controls>button'));const state=saved();assert(state.run.elapsed-before>5,'3x speed dropped simulation time');const elapsed=state.run.elapsed;await advance(1);assert.equal(saved().run.elapsed,elapsed);assert(document.querySelector('.pause-stamp'))})
await check('Reload restores the ongoing battle paused with the same towers',async()=>{const state=saved(),count=state.run.battle.structures.length;await mount(state);assert.equal(document.querySelectorAll('.tower-portrait').length,9);assert(document.querySelector('.pause-stamp'));assert.equal(saved().run.battle.structures.length,count)})
await check('Facility upgrade and dismantling update the same save',async()=>{const state=saved();state.run.metal=300;await mount(state);const p=state.run.battle.pads[state.run.battle.structures[0].slot];await act(async()=>document.querySelector('canvas').dispatchEvent(new w.PointerEvent('pointerdown',{bubbles:true,clientX:p.x,clientY:p.y})));await click(document.querySelector('.branch-choice button'));assert.equal(saved().run.battle.structures[0].level,2);await click(findButton('拆解设施'));assert.equal(saved().run.battle.structures.length,0)})
await check('Enemy handbook displays all eight replacement models',async()=>{await mount();await click(findButton('如何操作'));await click(findButton('敌群识别'));assert.equal(document.querySelectorAll('.enemy-portrait img').length,8);for(const image of document.querySelectorAll('.enemy-portrait img'))assert(fs.existsSync(path.join('public',image.getAttribute('src'))))})
await check('Pointer coordinates deploy to the right pad at desktop, tablet and phone scales',async()=>{for(const width of [1000,776,354]){boardWidth=width;const r=api.makeRun('touch-scale-check','standard',api.createMeta());r.activeNode=r.nodes[0][0];r.battle=api.createBattle(r,r.activeNode);const slot=r.battle.pads.findIndex(p=>Math.hypot(p.x-78,p.y-546)<370),p=r.battle.pads[slot];await mount(store(r));await click(document.querySelector('.tower-card'));await act(async()=>document.querySelector('canvas').dispatchEvent(new w.PointerEvent('pointerdown',{bubbles:true,pointerType:'touch',clientX:p.x*width/1000,clientY:p.y*width/1000})));assert.equal(saved().run.battle.structures[0].slot,slot)}boardWidth=1000})
await check('HD is the default; quality changes, display scaling and window resize update the canvas',async()=>{
  await mount();await click(findButton('系统设置'));assert(findButton('高清').classList.contains('active'))
  const r=api.makeRun('resolution-check','standard',api.createMeta());r.activeNode=r.nodes[0][0];r.battle=api.createBattle(r,r.activeNode)
  const state=store(r);state.settings.quality='high';boardWidth=2000;const oldDpr=w.devicePixelRatio;Object.defineProperty(w,'devicePixelRatio',{value:1,writable:true,configurable:true})
  try{
    await mount(state);assert.equal(document.querySelector('canvas').width,3000);assert.equal(document.querySelector('canvas').height,1800)
    await click(document.querySelector('[aria-label="系统设置"]'));await click(findButton('流畅'));await click(findButton('完成设置'));assert.equal(document.querySelector('canvas').width,1600);assert.equal(saved().settings.quality,'standard')
    await click(document.querySelector('[aria-label="系统设置"]'));await click(findButton('高清'));await click(findButton('完成设置'));assert.equal(document.querySelector('canvas').width,3000);assert.equal(saved().settings.quality,'high')
    boardWidth=776;await act(async()=>w.dispatchEvent(new w.Event('resize')));assert.equal(document.querySelector('canvas').width,1164);assert.equal(document.querySelector('canvas').height,698)
    w.devicePixelRatio=2;await advance(.04);assert.equal(document.querySelector('canvas').width,1552);assert.equal(document.querySelector('canvas').height,931)
  }finally{boardWidth=1000;w.devicePixelRatio=oldDpr}
})
await check('Waves continue automatically after three real seconds; building, pause, reload and speed work',async()=>{
  const r=api.makeRun('auto-wave-check','standard',api.createMeta());r.activeNode=r.nodes[0][0];r.battle=api.createBattle(r,r.activeNode);r.metal=500;r.battle.wave=0;r.battle.waveCleared=false
  await mount(store(r));await click(document.querySelector('.time-controls>button'));await advance(.1)
  assert(document.querySelector('.wave-announcement').textContent.includes('第 2 波敌人来袭'));assert(!document.querySelector('.pause-stamp'));assert.equal(document.querySelectorAll('button.wave-launch').length,0)
  await click(document.querySelector('.tower-card'));const p=r.battle.pads[0];await act(async()=>document.querySelector('canvas').dispatchEvent(new w.PointerEvent('pointerdown',{bubbles:true,clientX:p.x,clientY:p.y})));assert.equal(saved().run.battle.structures.length,1)
  await act(async()=>document.querySelector('canvas').dispatchEvent(new w.PointerEvent('pointerdown',{bubbles:true,clientX:p.x,clientY:p.y})));await click(document.querySelector('.branch-choice button'));assert.equal(saved().run.battle.structures[0].level,2)
  await click([...document.querySelectorAll('.speed-group button')].find(b=>b.textContent==='3×'));await advance(1);assert.equal(saved().run.battle.wave,0)
  await act(async()=>w.dispatchEvent(new w.KeyboardEvent('keydown',{key:'p',code:'KeyP',bubbles:true})));const remaining=saved().run.battle.nextWaveIn;assert(remaining>1.8&&remaining<2.1)
  await advance(4);assert.equal(saved().run.battle.nextWaveIn,remaining);assert(document.querySelector('.wave-announcement').textContent.includes('已暂停'))
  const snapshot=saved();await mount(snapshot);assert.equal(saved().run.battle.nextWaveIn,remaining);assert(document.querySelector('.time-controls>button').getAttribute('aria-label')==='继续')
  await click(document.querySelector('[aria-label="系统设置"]'));await advance(4);assert.equal(saved().run.battle.nextWaveIn,remaining);await click(findButton('完成设置'))
  await click(document.querySelector('.time-controls>button'));await advance(remaining+.2);assert.equal(saved().run.battle.wave,1);assert.equal(saved().run.battle.nextWaveIn,null);assert(!document.querySelector('.wave-announcement'));assert(document.body.textContent.includes('第 2 波敌人来袭'))
})
await check('Reward badges bind to all eight module IDs regardless of card order',async()=>{
  const ids=['salvage','coil','relaySync','bossBreaker','ember','alloy','coldAftershock','droneCare','unknown-legacy-module']
  for(let start=0;start<ids.length;start+=3){
    const r=api.makeRun('badge-check','standard',api.createMeta());r.activeNode=r.nodes[0][0];r.pendingBoons=ids.slice(start,start+3).map(id=>({id,name:id,description:'Module description'}));await mount(store(r,'reward'))
    assert.equal(document.querySelector('.reward-symbol img').getAttribute('src'),'/assets/modules/module.webp')
    const cards=[...document.querySelectorAll('.reward-card')];assert.equal(cards.length,3)
    cards.forEach((card,i)=>{const id=r.pendingBoons[i].id,expected=id.startsWith('unknown')?'module':id,image=card.querySelector('.module-badge');assert.equal(image.getAttribute('src'),`/assets/modules/${expected}.webp`);assert(fs.existsSync(`public/assets/modules/${expected}.webp`));assert.equal(image.alt,'');assert.equal(image.getAttribute('aria-hidden'),'true')})
  }
})
await check('Reward choice completes node and advances campaign',async()=>{const r=api.makeRun('reward-check','standard',api.createMeta());r.activeNode=r.nodes[0][0];r.pendingBoons=[{id:'coil',name:'磁芯重铸',description:'TEST'}];await mount(store(r,'reward'));await click(document.querySelector('.reward-card'));assert.equal(saved().run.mapLayer,1);assert(saved().run.boons.includes('coil'));assert.equal(saved().screen,'map')})
await check('Shop, event, repair and supply nodes apply resources once and return to the route',async()=>{
  for(const screen of ['shop','event','repair','supply']){
    const r=api.makeRun('service-check','standard',api.createMeta());r.metal=100;r.core=50;const node=r.nodes.flat().find(n=>n.kind===screen);r.activeNode=node;r.mapLayer=node.layer;if(screen==='shop')r.shopItems=['cells']
    await mount(store(r,screen))
    if(screen==='shop'){await click(document.querySelector('.buy-button'));assert.equal(saved().run.metal,64);assert.equal(saved().run.cells,7);assert.equal(document.querySelectorAll('.buy-button').length,0);await click(findButton('离开补给站'))}
    if(screen==='event'){await click(findButton('回收可见补给'));assert.equal(saved().run.metal,142);assert.equal(saved().run.core,58);assert(saved().run.serviceDone);await click(findButton('继续航行'))}
    if(screen==='repair'){await click(findButton('焊补舰队核心'));assert.equal(saved().run.metal,76);assert.equal(saved().run.core,84);assert(document.querySelector('.repair-choices button').disabled);await click(findButton('检修完成'))}
    if(screen==='supply'){await click(findButton('精炼合金'));assert.equal(saved().run.metal,162);assert(document.querySelector('.supply-options>button').disabled);await click(findButton('离开回收点'))}
    assert.equal(saved().screen,'map');assert.equal(saved().run.mapLayer,node.layer+1)
  }
})
await check('Training teaches all fourteen lessons, saves independently and resumes without altering the campaign',async()=>{
  const r=api.makeRun('preserve-campaign','standard',api.createMeta());r.metal=137;r.activeNode=r.nodes[0][0];r.battle=api.createBattle(r,r.activeNode);api.placeStructure(r,'needle',0);r.kills=12
  await mount(store(r,'menu'));const baseline=JSON.stringify(saved().run)
  await click(findButton('新手训练营'));assert.equal(document.querySelectorAll('.training-courses button').length,14)
  assert(findButton('开始部署训练'));await click(findButton('开始部署训练'));await click(findButton('下一课'))
  await click(findButton('选择针蜂'));await click(document.querySelectorAll('.training-platforms button')[1]);assert(document.querySelector('.training-objective').textContent.includes('目标已完成'));assert(!document.querySelector('.facility-status').textContent.includes('未接入'));assert(document.querySelector('.facility-status').textContent.includes('独立就绪'))
  await click(findButton('下一课'));await click(findButton('选择脉冲哨塔'));await click(document.querySelectorAll('.training-platforms button')[0]);await click(findButton('启动演练'));await advance(4);assert(document.querySelector('.training-objective').textContent.includes('目标已完成'))
  await click(findButton('下一课'))
  for(let lesson=3;lesson<=12;lesson++){
    const build=document.querySelector('.training-build');if(build){await click(build);await click(document.querySelectorAll('.training-platforms button')[1])}
    const upgrade=document.querySelector('.training-upgrade');if(upgrade)await click(upgrade)
    const launch=document.querySelector('.training-console>.training-launch');assert(launch&&!launch.disabled);await click(launch);await advance(4)
    assert(document.querySelector('.training-objective').textContent.includes('目标已完成'),'Lesson '+lesson+' did not finish in the UI')
    assert.equal(JSON.stringify(saved().run),baseline)
    await click(findButton('下一课'))
  }
  await click(findButton('完成训练'));assert.equal(JSON.parse(localStorage.getItem('ember-lane-training-v2')).completed.length,14);await click(findButton('返回主菜单'));assert.equal(JSON.stringify(saved().run),baseline)
  await click(findButton('新手训练营'));assert(document.querySelector('.training-brief h2').textContent.includes('准备进入'));await click(document.querySelectorAll('.training-courses button')[5]);assert(document.querySelector('.training-brief h2').textContent.includes('轨矛'));await click(findButton('跳过本课'));assert(JSON.parse(localStorage.getItem('ember-lane-training-v2')).skipped.includes('rail'));await click(findButton('重试本课'));assert(!document.querySelector('.training-objective').textContent.includes('目标已完成'));await click(findButton('退出训练'));assert.equal(JSON.stringify(saved().run),baseline)
})
await check('Victory and defeat both render valid ending screens',async()=>{for(const result of ['victory','defeat']){const r=api.makeRun('ending-check','standard',api.createMeta());const meta=api.finishRun(r,result,api.createMeta());const state=store(r,'ending');state.meta=meta;await mount(state);assert(document.querySelector('.ending-screen'));assert.equal(saved().run.end,result);assert.equal(saved().meta.records.length,1)}})
await check('Phone orientation changes pause combat and its remaining wave countdown',async()=>{
  const original={width:w.innerWidth,height:w.innerHeight};Object.defineProperty(w,'innerWidth',{value:390,writable:true,configurable:true});Object.defineProperty(w,'innerHeight',{value:844,writable:true,configurable:true})
  try{const r=api.makeRun('rotation-check','standard',api.createMeta());r.activeNode=r.nodes[0][0];r.battle=api.createBattle(r,r.activeNode);await mount(store(r));await click(findButton('启动第一波'));await advance(.2)
    w.innerWidth=844;w.innerHeight=390;await act(async()=>w.dispatchEvent(new w.Event('resize')));assert.equal(document.querySelector('.time-controls>button').getAttribute('aria-label'),'继续');const time=saved().run.elapsed;await advance(1);assert.equal(saved().run.elapsed,time)
    await click(document.querySelector('.phone-battle-controls>button'));await advance(.2);await click(document.querySelector('.phone-battle-controls>button'));assert(saved().run.elapsed>time)
  }finally{w.innerWidth=original.width;w.innerHeight=original.height}
})
await check('Browser fixture campaigns and training use isolated save keys',async()=>{
  const r=api.makeRun('isolated-check','standard',api.createMeta());r.activeNode=r.nodes[0][0];r.battle=api.createBattle(r,r.activeNode);const state=store(r),baseline=JSON.stringify(state);await mount(state,{initialStore:JSON.parse(baseline),storageKey:'qa-isolation'});await click(findButton('启动第一波'));assert.equal(JSON.stringify(saved()),baseline);assert.equal(JSON.parse(localStorage.getItem('qa-isolation')).run.battle.wave,0)
  await click(document.querySelector('[aria-label="系统设置"]'));await click(findButton('返回主菜单'));await click(findButton('新手训练营'));await click(findButton('开始部署训练'));assert(localStorage.getItem('qa-isolation-training'));assert.equal(localStorage.getItem('ember-lane-training-v2'),null);assert.equal(JSON.stringify(saved()),baseline)
})
await check('Phone touch targets tolerate a twenty-pixel finger offset without changing mouse precision',async()=>{
  boardWidth=354;try{const r=api.makeRun('finger-check','standard',api.createMeta());r.activeNode=r.nodes[0][0];r.battle=api.createBattle(r,r.activeNode);await mount(store(r));await click(document.querySelector('.tower-card'));const p=r.battle.pads[0],canvas=document.querySelector('canvas'),coords={bubbles:true,clientX:p.x*.354+20,clientY:p.y*.354};await act(async()=>canvas.dispatchEvent(new w.PointerEvent('pointerdown',{...coords,pointerType:'mouse'})));assert.equal(saved().run.battle.structures.length,0);await click(document.querySelector('.tower-card'));await act(async()=>canvas.dispatchEvent(new w.PointerEvent('pointerdown',{...coords,pointerType:'touch'})));assert.equal(saved().run.battle.structures[0].slot,0)}finally{boardWidth=1000}
})
await check('Malformed local storage falls back to a playable menu',async()=>{if(root)await act(async()=>root.unmount());root=null;document.body.innerHTML='<div id="root"></div>';localStorage.setItem(key,'{bad JSON');root=createRoot(document.getElementById('root'));await act(async()=>root.render(React.createElement(api.default)));assert(document.querySelector('.landing-screen'))})
if(root)await act(async()=>root.unmount());await w.happyDOM.abort()
fs.mkdirSync('art-source/verification',{recursive:true});fs.writeFileSync('art-source/verification/ui-regression.json',JSON.stringify({date:new Date().toISOString(),environment:'Isolated Happy DOM + native canvas; not a live browser or layout test',rows},null,2));console.log(`${rows.filter(r=>r.pass).length}/${rows.length} DOM checks passed`);if(rows.some(r=>!r.pass))process.exitCode=1
