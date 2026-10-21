// Engine regression suite. Uses the real game code without changing browser saves.
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { build } from 'esbuild'
const require=createRequire(import.meta.url)
const result=await build({stdin:{contents:fs.readFileSync('src/engine.ts','utf8')+'\nexport { spawnEnemy, tickStructures, tickEnemies, tickProjectiles, positionAt, fireTower };',resolveDir:path.resolve('src'),loader:'ts'},bundle:true,platform:'node',format:'cjs',write:false,logLevel:'silent'})
const Module=require('node:module'),module=new Module(path.resolve('engine-qa.cjs'));module.filename=path.resolve('engine-qa.cjs');module.paths=Module._nodeModulePaths(process.cwd());module._compile(result.outputFiles[0].text,module.filename)
const e=module.exports,rows=[]
const check=(name,fn)=>{try{const detail=fn();rows.push({name,pass:true,detail});console.log('PASS '+name+(detail?' '+JSON.stringify(detail):''))}catch(error){rows.push({name,pass:false,error:error.stack});console.error('FAIL '+name+': '+error.message)}}
function setup(zone=0){const r=e.makeRun('regression','standard',e.createMeta());r.metal=10000;r.generator=100;r.activeNode={...r.nodes[0][0],seed:zone};r.battle=e.createBattle(r,r.activeNode);r.battle.path=[{x:0,y:400},{x:1000,y:400}];r.battle.pathLength=1000;r.battle.pads=[{x:150,y:460,high:false,blocked:false},{x:205,y:465,high:false,blocked:false}];return r}
function target(r,kind='siege',distance=210){const enemy=e.spawnEnemy(r,r.battle,kind);enemy.dist=distance;Object.assign(enemy,e.positionAt(r.battle.path,distance));enemy.hp=enemy.maxHp=100000;enemy.shield=enemy.maxShield=0;r.battle.enemies.push(enemy);return enemy}
function tower(r,kind,slot=0){assert.equal(e.placeStructure(r,kind,slot).ok,true);const t=r.battle.structures.at(-1);t.cooldown=0;return t}

check('Nine weapons independently fire and hit on all three maps, levels and branches',()=>{
  let combinations=0
  for(const zone of [0,1,2])for(const kind of e.TOWER_ORDER)for(const branch of [null,'A','B']){
    const r=setup(zone),t=tower(r,kind),victim=target(r);if(branch){t.branch=branch;t.level=3}
    let fires=0,impacts=0
    for(let i=0;i<360;i++)e.tickRun(r,1/60,c=>{if(c.kind==='fire')fires++;else impacts++})
    assert(fires>0,`${zone}/${kind}/${branch} did not fire`);assert(impacts>0,`${kind} did not impact`);assert(victim.hp<victim.maxHp,`${kind} dealt no damage`);combinations++
  }
  return {combinations}
})
check('Every tower works at a distant pad without a reactor or another tower',()=>{
  for(const kind of e.TOWER_ORDER){const r=setup();r.generator=0;r.battle.pads[0]={x:900,y:460,high:false,blocked:false};const t=tower(r,kind),victim=target(r,'siege',880);assert(t.powered&&t.connected);assert.equal(e.getTowerStats(t,r).power,0);let fires=0;for(let frame=0;frame<180;frame++)e.tickRun(r,1/60,c=>{if(c.kind==='fire')fires++});assert(fires>0,kind);assert(victim.hp<victim.maxHp,kind);assert.equal(r.battle.structures.length,1)}
})
check('Legacy power flags recover, jam expires and destroyed towers remain disabled',()=>{
  const r=setup(),t=tower(r,'needle');r.generator=0;t.powered=t.connected=false;e.recalculateGrid(r);assert(t.powered);t.jammed=0.2;target(r);let fires=0;for(let i=0;i<120;i++)e.tickRun(r,1/60,c=>{if(c.kind==='fire')fires++});assert(fires>0);t.health=0;e.recalculateGrid(r);assert(!t.powered);assert.equal(e.getTowerStatus(r,t).label,'设施损毁')
})
check('Dead targets cannot consume another tower shot',()=>{
  const r=setup(),t=tower(r,'needle'),dead=target(r),alive=target(r,'scout',180);dead.hp=0;t.targetMode='first';e.tickStructures(r,r.battle,1/60);assert.equal(r.battle.projectiles[0].target,alive.id)
})
check('Projectiles retarget surviving enemies and do not lose a volley on wrecks',()=>{
  const r=setup(),t=tower(r,'needle'),dead=target(r),alive=target(r,'scout',180);e.fireTower(r,r.battle,t,dead,e.getTowerStats(t,r));dead.hp=0;for(let i=0;i<80;i++)e.tickProjectiles(r,r.battle,1/60);assert(alive.hp<alive.maxHp)
})
check('Lured enemies render at their actual position and destroyed enemies are removed',()=>{
  const r=setup();tower(r,'lure');const enemy=target(r,'scout',170);e.tickEnemies(r,r.battle,1/60);assert(enemy.lureTimer>0);const p=e.getEnemyPosition(r.battle,enemy);assert.equal(p.x,enemy.x);assert.equal(p.y,enemy.y);enemy.hp=0;e.tickEnemies(r,r.battle,1/60);assert.equal(r.battle.enemies.length,0);assert.equal(r.kills,1)
})
check('Attraction ends and cannot indefinitely stall a wave',()=>{
  const r=setup();tower(r,'lure');const enemy=target(r,'scout',170);for(let i=0;i<600;i++)e.tickEnemies(r,r.battle,1/60);assert(enemy.dist>500)
})
check('Shield, repair drone, relay and lure support abilities',()=>{
  const r=setup(),shield=tower(r,'shield'),drone=tower(r,'drone',1);shield.health=50;e.tickStructures(r,r.battle,1/60);assert(r.coreShield>0);assert(shield.health>50);assert.equal(drone.branch,null);assert(e.getTowerStatus(r,shield).attacking)
  const r2=setup(),lure=tower(r2,'lure');lure.branch='B';lure.level=2;const enemy=target(r2,'scout',170);let cues=0;e.tickStructures(r2,r2.battle,1/60,()=>cues++);assert(enemy.hp<enemy.maxHp);assert(cues>0)
})
check('Terrain blocks direct fire while guided weapons remain usable',()=>{
  const r=setup(1);r.battle.pads[0]={x:370,y:170,high:false,blocked:false};r.battle.path=[{x:450,y:230},{x:1000,y:230}];r.battle.pathLength=550;const enemy=target(r,'scout',10),t=tower(r,'needle');t.connected=t.powered=true;assert.equal(e.getTowerTargets(r,t).length,0);assert.equal(e.getTowerStatus(r,t).label,'射线受阻');t.type='comet';assert.equal(e.getTowerTargets(r,t)[0],enemy)
})
check('All enemy classes die, split or leak and waves terminate',()=>{
  for(const kind of Object.keys(e.ENEMY_NAMES)){const r=setup(),enemy=target(r,kind,10);enemy.hp=0;e.tickEnemies(r,r.battle,1/60);assert.equal(r.kills,1);assert.equal(r.battle.enemies.length,kind==='splitter'?2:0)}
  const r=setup(),enemy=target(r,'scout',999);r.coreShield=1;const hp=r.core;e.tickEnemies(r,r.battle,1);assert.equal(r.core,hp-6);assert.equal(r.battle.enemies.length,0)
})
check('Skills, cooldowns, upgrades, selling and JSON save round trip',()=>{
  const r=setup(),t=tower(r,'needle');assert(e.upgradeStructure(r,t.id,'A').ok);assert(!e.upgradeStructure(r,t.id,'B').ok);t.health=0;t.jammed=3;assert(e.useSkill(r,'repair').ok);assert(t.health>0&&t.jammed===0);assert(!e.useSkill(r,'repair').ok);target(r);assert(e.useSkill(r,'stasis').ok);assert(r.battle.enemies[0].slowTimer>0);assert(e.useSkill(r,'strike').needsTarget);assert(e.useSkill(r,'strike',200,400).ok);assert(e.useSkill(r,'shield').ok);const restored=JSON.parse(JSON.stringify(r));assert.doesNotThrow(()=>e.tickRun(restored,1/60));assert(e.sellStructure(restored,t.id).ok)
})
check('Failure takes precedence over clearing the final wave',()=>{
  const r=setup();r.battle.wave=3;r.battle.waveCleared=false;r.core=0;assert.equal(e.tickRun(r,1/60),'defeat')
})
check('Boss attacks stop after destruction',()=>{
  const r=setup();r.battle.isBoss=true;r.battle.wave=0;r.battle.waveCleared=false;r.battle.bossAttackTimer=0;const boss=target(r,'boss',300);boss.hp=0;e.tickRun(r,1/60);assert(!r.battle.bossWarning)
})
check('An escaped flagship cannot produce a false victory',()=>{
  const r=setup();r.battle.isBoss=true;r.battle.wave=0;r.battle.waveCleared=false;target(r,'boss',999.9);assert.equal(e.tickRun(r,0.06),'defeat')
})
check('First wave uses the opening enemy pool and stasis noticeably slows movement',()=>{
  const r=setup();e.startWave(r);assert(r.battle.waveQueue.every(k=>['scout','siege'].includes(k)));const enemy=target(r,'scout',100);e.useSkill(r,'stasis');e.tickEnemies(r,r.battle,1);assert(enemy.dist<110)
})
check('Clearing a wave schedules three seconds and starts the next wave exactly once',()=>{
  const r=setup(),b=r.battle,cells=r.cells;e.startWave(r);b.waveQueue=[]
  assert.equal(e.tickRun(r,1/60),'wave');assert.equal(b.nextWaveIn,3);assert.equal(r.cells,cells+1)
  for(let i=0;i<179;i++){assert.equal(e.tickRun(r,1/60),null);assert.equal(b.wave,0);assert.equal(b.enemies.length,0)}
  assert.equal(e.tickRun(r,1/60),'wave-start');assert.equal(b.wave,1);assert.equal(b.waveCleared,false);assert.equal(b.nextWaveIn,null);assert.equal(b.enemies.length,1)
  assert.equal(e.tickRun(r,1/60),null);assert.equal(b.wave,1);assert.equal(r.cells,cells+1)
})
check('Preparation allows building and upgrading, saves remaining time and survives legacy saves',()=>{
  const r=setup();e.startWave(r);r.battle.waveQueue=[];e.tickRun(r,1/60)
  assert(e.placeStructure(r,'needle',0).ok);assert(e.upgradeStructure(r,r.battle.structures[0].id,'A').ok)
  for(let i=0;i<60;i++)e.tickRun(r,1/60)
  const restored=JSON.parse(JSON.stringify(r));assert(Math.abs(restored.battle.nextWaveIn-2)<1e-8)
  for(let i=0;i<119;i++)assert.equal(e.tickRun(restored,1/60),null)
  assert.equal(e.tickRun(restored,1/60),'wave-start')
  const old=setup();old.battle.wave=0;delete old.battle.nextWaveIn;assert.equal(e.getNextWaveCountdown(old.battle),3);e.tickRun(old,1/60);assert(old.battle.nextWaveIn<3)
})
check('Three seconds of preparation remain available at triple speed',()=>{
  const r=setup();r.battle.wave=0;r.battle.nextWaveIn=3
  for(let i=0;i<539;i++)assert.equal(e.tickRun(r,1/60,undefined,1/180),null)
  assert.equal(r.battle.wave,0);assert.equal(e.tickRun(r,1/60,undefined,1/180),'wave-start');assert.equal(r.battle.wave,1)
})
check('Opening deployment, final clear, boss clear and defeat never schedule an extra wave',()=>{
  const opening=setup();for(let i=0;i<240;i++)e.tickRun(opening,1/60);assert.equal(opening.battle.wave,-1);assert.equal(e.getNextWaveCountdown(opening.battle),null)
  for(const boss of [false,true]){const r=setup(),b=r.battle;b.isBoss=boss;b.maxWaves=boss?1:4;b.wave=b.maxWaves-1;b.waveCleared=false;assert.equal(e.tickRun(r,1/60),'victory');assert.equal(e.getNextWaveCountdown(b),null);for(let i=0;i<240;i++)assert.notEqual(e.tickRun(r,1/60),'wave-start');assert.equal(b.wave,b.maxWaves-1)}
  const dead=setup();dead.battle.wave=0;dead.battle.nextWaveIn=0;dead.core=0;assert.equal(e.tickRun(dead,1/60),'defeat');assert.equal(dead.battle.wave,0);assert.equal(e.startWave(dead),false)
})
check('Pulse tower upgrades only itself and shield A activates each wave',()=>{
  const r=setup(),pulse=tower(r,'relay'),weapon=tower(r,'needle',1),base=e.getTowerStats(pulse,r),other=e.getTowerStats(weapon,r);pulse.branch='A';assert(e.getTowerStats(pulse,r).cooldown<base.cooldown);assert.equal(e.getTowerStats(weapon,r).cooldown,other.cooldown);pulse.branch='B';assert(e.getTowerStats(pulse,r).range>base.range);weapon.type='shield';weapon.branch='A';r.coreShield=0;e.startWave(r);assert.equal(r.coreShield,18)
})
check('Needle bounce and cluster missile specialization produce additional impacts',()=>{
  for(const kind of ['needle','comet']){const r=setup(),t=tower(r,kind),one=target(r,'siege',200),two=target(r,'siege',220);t.branch='A';e.fireTower(r,r.battle,t,one,e.getTowerStats(t,r));for(let i=0;i<90;i++)e.tickProjectiles(r,r.battle,1/60);assert(two.hp<two.maxHp);if(kind==='comet')assert(r.battle.effects.filter(f=>f.kind==='blast').length>=4)}
})
check('Battle recovery and deployment reserve fund later defenses using the same rules as the UI',()=>{
  const r=setup(),t=tower(r,'rail');e.upgradeStructure(r,t.id,'B');assert.equal(e.getBattleSalvage(r),Math.floor((76+62)*0.6));t.health=0;assert.equal(e.getBattleSalvage(r),Math.floor((76+62)*0.25));assert.equal(e.getDeploymentReserve({...r.nodes[0][0],kind:'boss',layer:5}),360)
})

// The campaign simulations below use earned resources and the same reserve as the UI.
function deploy(r){
  const b=r.battle
  const coverage=(pad,range)=>{let score=0;for(let distance=0;distance<b.pathLength;distance+=25){const v=e.positionAt(b.path,distance);if(Math.hypot(v.x-pad.x,v.y-pad.y)<range)score++}return score}
  for(let attempt=0;attempt<4;attempt++){
    const available=b.pads.map((p,i)=>({p,i})).filter(v=>!b.structures.some(t=>t.slot===v.i))
    const count=kind=>b.structures.filter(t=>t.type===kind).length
    if(b.isBoss&&count('rail')>=2&&count('cold')){
      const upgrade=b.structures.find(t=>t.type==='rail'&&t.level<2&&t.powered)
      if(upgrade&&r.metal>=62){e.upgradeStructure(r,upgrade.id,'B');continue}
    }
    let kind=b.isBoss&&count('rail')<2?'rail':b.isBoss&&!count('cold')?'cold':!count('rail')?'rail':!count('needle')?'needle':!count('arc')&&r.metal>=68?'arc':!count('shield')&&count('needle')>=2&&r.metal>=70?'shield':'needle'
    if(!available.length)break
    if(r.metal<e.TOWER_SPECS[kind].cost)break
    available.sort((a,z)=>coverage(z.p,e.TOWER_SPECS[kind].range)-coverage(a.p,e.TOWER_SPECS[kind].range))
    e.placeStructure(r,kind,available[0].i)
  }
}

const campaigns=[]
for(const difficulty of ['standard','storm'])for(let seed=0;seed<6;seed++){
  const r=e.makeRun('playable-'+seed,difficulty,e.createMeta());let outcome='victory',steps=0,stalled=false,waves=0,bossDefeated=false
  for(let layer=0;layer<r.nodes.length;layer++){
    r.mapLayer=layer;const node=r.nodes[layer].find(n=>['repair','supply','shop'].includes(n.kind))??r.nodes[layer][0];r.activeNode=node
    if(!['battle','elite','boss'].includes(node.kind)){
      if(node.kind==='shop'){e.openShop(r);if(r.shopItems.includes('draw'))e.shopItem(r,'draw');if(r.shopItems.includes('repair')&&r.core<75)e.shopItem(r,'repair')}
      if(node.kind==='repair'){if(r.core<70&&r.metal>=24){r.core=Math.min(r.maxCore,r.core+34);r.metal-=24}else if(!r.boons.includes('relaySync'))r.boons.push('relaySync');else r.metal+=36}
      if(node.kind==='supply')r.metal+=62
      e.completeNode(r,node);continue
    }
    r.metal=Math.max(r.metal,e.getDeploymentReserve(node));r.battle=e.createBattle(r,node)
    deploy(r);e.startWave(r);waves++;let event=null
      for(let frame=0;frame<60*240*r.battle.maxWaves;frame++){
        if(frame%180===0){
          if(r.battle.isBoss)deploy(r)
          if(r.coreShield<10&&r.cells>1&&r.skillCooldowns.shield<=0)e.useSkill(r,'shield')
          if(r.battle.structures.some(t=>t.health<60||t.jammed>1)&&r.skillCooldowns.repair<=0)e.useSkill(r,'repair')
          const boss=r.battle.enemies.find(t=>t.kind==='boss'),cluster=boss??r.battle.enemies[0]
          if(cluster&&(boss||r.battle.enemies.length>3)&&r.cells>0&&r.skillCooldowns.strike<=0)e.useSkill(r,'strike',cluster.x,cluster.y)
          if(cluster&&r.battle.enemies.length>2&&r.cells>1&&r.skillCooldowns.stasis<=0)e.useSkill(r,'stasis')
        }
        event=e.tickRun(r,1/60);steps++;if(r.battle.effects.some(f=>f.label==='断界者失能'))bossDefeated=true
        if(event==='wave'){deploy(r);event=null}
        else if(event==='wave-start'){waves++;event=null}
        else if(event)break
      }
      if(!event){stalled=true;outcome='stalled'}
      if(event==='defeat')outcome='defeat'
    if(outcome!=='victory')break
    if(node.kind!=='boss'){r.metal+=28+e.getBattleSalvage(r);const boon=e.selectBoon(r)[0];if(boon)r.boons.push(boon.id);e.completeNode(r,node)}
  }
  campaigns.push({seed:r.seed,difficulty,outcome,bossDefeated,waves,core:r.core,kills:r.kills,simulationSeconds:Math.round(steps/60)});
  check('Campaign '+difficulty+'/'+seed+' completes without stalling',()=>{assert(!stalled);return campaigns.at(-1)})
}
check('At least one standard campaign defeats the flagship with ordinary resources',()=>{assert(campaigns.some(c=>c.difficulty==='standard'&&c.outcome==='victory'&&c.bossDefeated));return {wins:campaigns.filter(c=>c.outcome==='victory').length,total:campaigns.length}})
fs.mkdirSync('art-source/verification',{recursive:true});fs.writeFileSync('art-source/verification/game-regression.json',JSON.stringify({date:new Date().toISOString(),rows,campaigns},null,2));console.log(`\n${rows.filter(r=>r.pass).length}/${rows.length} checks passed`);if(rows.some(r=>!r.pass))process.exitCode=1
