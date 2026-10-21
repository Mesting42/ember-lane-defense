// Render the actual battle painter with native canvas for deterministic visual checks.
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { build } from 'esbuild'
const require=createRequire(import.meta.url)
const {createCanvas,Image,GlobalFonts}=require(process.env.EMBER_CANVAS_MODULE||'@napi-rs/canvas')
GlobalFonts.registerFromPath('C:/Windows/Fonts/msyh.ttc','Microsoft YaHei')
globalThis.Image=class extends Image {set src(value){super.src=typeof value==='string'&&value.startsWith('/')?path.join(process.cwd(),'public',value):value}get src(){return super.src}}
const source=fs.readFileSync('src/Battlefield.tsx','utf8')+'\nexport {renderBattle,preloadTowerSprites,preloadEnemySprites,getBattleResolution}; export {makeRun,createMeta,createBattle,TOWER_ORDER,spawnEnemy,placeStructure,recalculateGrid,positionAt,fireTower,getTowerStats} from "./engine";'
// Private engine functions are exported only in this temporary in-memory bundle.
const output=await build({stdin:{contents:source,resolveDir:path.resolve('src'),loader:'tsx'},plugins:[{name:'qa-engine-exports',setup(b){b.onLoad({filter:/[\\/]engine\.ts$/},args=>({contents:fs.readFileSync(args.path,'utf8')+'\nexport {spawnEnemy,positionAt,fireTower};',loader:'ts'}))}}],jsx:'automatic',bundle:true,platform:'node',format:'cjs',write:false,external:['react'],logLevel:'silent'})
const Module=require('node:module'),module=new Module(path.resolve('render-qa.cjs'));module.filename=path.resolve('render-qa.cjs');module.paths=Module._nodeModulePaths(process.cwd());module._compile(output.outputFiles[0].text,module.filename);const api=module.exports
await Promise.all([api.preloadTowerSprites(),api.preloadEnemySprites(),api.preloadTowerSprites('standard'),api.preloadEnemySprites('standard')])
for(const css of [354,776,1000,2000,3200]) for(const dpr of [1,1.5,2,3]) {
  const high=api.getBattleResolution(css,dpr,'high'), low=api.getBattleResolution(css,dpr,'standard')
  assert(high.width>=Math.min(4096,Math.round(css*dpr)))
  assert(high.width<=4096);assert(low.width<=1600);assert(high.width>=low.width)
  assert(Math.abs(high.height/high.width-0.6)<0.002)
}
assert.equal(api.getBattleResolution(2000,1,'high').width,3000)
const metadata=JSON.parse(fs.readFileSync('src/generated/enemy-atlas.json','utf8'))
const directory='art-source/verification';fs.mkdirSync(directory,{recursive:true})
let images=0,frames=0
for(const kind of Object.keys(metadata.enemies)){
  const image=new Image();await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=reject;image.src=fs.readFileSync(`public/assets/enemies/${kind}.webp`)});assert.equal(image.width,1536);assert.equal(image.height,768);images++
const canvas=createCanvas(192,192),ctx=canvas.getContext('2d')
  for(let frame=0;frame<32;frame++){
    ctx.clearRect(0,0,192,192);ctx.drawImage(image,frame%8*192,Math.floor(frame/8)*192,192,192,0,0,192,192)
    const data=ctx.getImageData(0,0,192,192).data;let count=0
    for(let y=0;y<192;y++)for(let x=0;x<192;x++){const alpha=data[(y*192+x)*4+3];if(alpha>8){count++;assert(x>1&&x<190&&y>1&&y<190,`${kind} frame ${frame} clipped`)}}
    assert(count>300,`${kind} frame ${frame} has ${count} visible pixels`);frames++
  }
}
const timings=[]
for(const zone of [0,1,2]){
  const r=api.makeRun('render-preview','standard',api.createMeta());r.generator=100;r.metal=10000;r.activeNode={...r.nodes[0][0],seed:zone};r.battle=api.createBattle(r,r.activeNode);const b=r.battle
  api.TOWER_ORDER.forEach((kind,slot)=>{api.placeStructure(r,kind,slot);const t=b.structures.at(-1);t.powered=t.connected=true})
  let index=0
  for(const kind of Object.keys(metadata.enemies)){const enemy=api.spawnEnemy(r,b,kind);enemy.dist=150+index++*(b.pathLength-300)/8;const p=api.positionAt(b.path,enemy.dist);enemy.x=p.x;enemy.y=p.y;b.enemies.push(enemy)}
  for(const t of b.structures.filter(t=>t.powered)){const p=b.pads[t.slot],enemy=b.enemies.reduce((a,z)=>Math.hypot(a.x-p.x,a.y-p.y)<Math.hypot(z.x-p.x,z.y-p.y)?a:z);api.fireTower(r,b,t,enemy,api.getTowerStats(t,r))}
  const canvas=createCanvas(1600,960),native=canvas.getContext('2d');native.scale(1.6,1.6)
  // Use an installed CJK font for this offline renderer's labels.
  const ctx=new Proxy(native,{get(target,p){const v=Reflect.get(target,p,target);return typeof v==='function'?v.bind(target):v},set(target,p,value){if(p==='font')value=value.replace('Consolas, monospace','"Microsoft YaHei"');return Reflect.set(target,p,value,target)}})
  const props={run:r,revision:0,buildType:null,selectedId:null,targetSkill:false,effects:true,quality:'high'}
  const start=performance.now();for(let f=0;f<10;f++)api.renderBattle(ctx,props,2000+f*16,null);timings.push({zone,millisecondsPerFrame:Math.round((performance.now()-start)/10*100)/100})
  fs.writeFileSync(`${directory}/battle-zone-${zone}.png`,canvas.toBuffer('image/png'))
  for(const width of [776,354]){const scaled=createCanvas(width,Math.round(width*.6));scaled.getContext('2d').drawImage(canvas,0,0,scaled.width,scaled.height);fs.writeFileSync(`${directory}/battle-zone-${zone}-${width}.png`,scaled.toBuffer('image/png'))}
}
fs.writeFileSync(`${directory}/render-regression.json`,JSON.stringify({date:new Date().toISOString(),enemyImages:images,enemyFrames:frames,clipped:0,battleMaps:3,scaledBoards:[1000,776,354],timings,scope:'Offline canvas rendering and coordinate scale; not browser CSS layout'},null,2))
console.log(JSON.stringify({enemyImages:images,enemyFrames:frames,clipped:0,maps:3,timings}))
