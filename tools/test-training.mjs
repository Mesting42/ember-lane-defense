import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { build } from 'esbuild'
const require=createRequire(import.meta.url)
const output=await build({stdin:{contents:fs.readFileSync('src/training.ts','utf8')+'\nexport {placeStructure,upgradeStructure,tickRun} from "./engine";',resolveDir:path.resolve('src'),loader:'ts'},bundle:true,platform:'node',format:'cjs',write:false,logLevel:'silent'})
const Module=require('node:module'),module=new Module(path.resolve('training-qa.cjs'));module.filename=path.resolve('training-qa.cjs');module.paths=Module._nodeModulePaths(process.cwd());module._compile(output.outputFiles[0].text,module.filename)
const api=module.exports,rows=[]
for(const lesson of api.TRAINING_LESSONS.filter(l=>!['reactor','review'].includes(l.id))){
  try{
    const run=api.createTrainingRun(lesson)
    assert(!api.trainingLessonComplete(run,lesson),'Lesson was completed before performing the task')
    if(lesson.build){assert(api.placeStructure(run,lesson.build,lesson.slot).ok)}
    if(lesson.id==='upgrade'||lesson.id==='counter'){const t=run.battle.structures.find(t=>t.slot===1);assert(api.upgradeStructure(run,t.id,lesson.id==='upgrade'?'A':'B').ok)}
    let seconds=0
    if(lesson.practice){assert(api.trainingReady(run,lesson),'Scenario has no power');api.spawnTrainingTargets(run,lesson);for(let frame=0;frame<1500;frame++){api.tickRun(run,1/60);seconds=(frame+1)/60;if(api.trainingLessonComplete(run,lesson))break}}
    assert(api.trainingLessonComplete(run,lesson),'Objective did not complete in 25 seconds')
    rows.push({lesson:lesson.id,title:lesson.title,pass:true,seconds:Math.round(seconds*100)/100});console.log('PASS '+lesson.id+' '+seconds.toFixed(2)+'s')
  }catch(error){rows.push({lesson:lesson.id,pass:false,error:error.stack});console.error('FAIL '+lesson.id+': '+error.message)}
}
fs.mkdirSync('art-source/verification',{recursive:true});fs.writeFileSync('art-source/verification/training-regression.json',JSON.stringify({date:new Date().toISOString(),rows},null,2));if(rows.some(r=>!r.pass))process.exitCode=1
