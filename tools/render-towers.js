import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { zipSync, strToU8 } from 'fflate'
import { profiles, prepareModel } from './tower-models'

const CELL = 192, FRAMES = 32, COLS = 8, WORLD_SIZE = 134.4

const status = document.querySelector('#status')
const preview = document.querySelector('#preview')
const report = document.querySelector('#report')
const loader = new GLTFLoader()
let renderer


function canvas(width,height) {const c=document.createElement('canvas');c.width=width;c.height=height;return c}
async function bytes(c,format='image/png') {const blob=await new Promise(resolve=>c.toBlob(resolve,format,0.96));if(!blob)throw new Error('Image encoding failed');return new Uint8Array(await blob.arrayBuffer())}
function projection(point,camera) {const p=point.clone().project(camera);return [(p.x+1)*CELL/2,(1-p.y)*CELL/2].map(v=>Math.round(v*100)/100)}
function tightIcon(source) {
  const ctx=source.getContext('2d'),data=ctx.getImageData(0,0,source.width,source.height).data
  let left=source.width,top=source.height,right=0,bottom=0
  for(let y=0;y<source.height;y++)for(let x=0;x<source.width;x++)if(data[(y*source.width+x)*4+3]>10){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y)}
  const icon=canvas(192,192),out=icon.getContext('2d'),w=right-left+1,h=bottom-top+1,scale=172/Math.max(w,h)
  out.drawImage(source,left,top,w,h,(192-w*scale)/2,(192-h*scale)/2,w*scale,h*scale)
  return icon
}

document.querySelector('#bake').onclick=async()=>{
  const button=document.querySelector('#bake');button.disabled=true
  try {
    renderer??=new THREE.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true})
    renderer.setPixelRatio(1);renderer.setSize(CELL,CELL);renderer.setClearColor(0x000000,0)
    renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=0.95
    const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-3.6,3.6,4.5,-2.7,0.1,100)
    camera.position.set(0,10,7);camera.lookAt(0,0,0);camera.updateMatrixWorld()
    const pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment()
    const environment=pmrem.fromScene(room,0.04);scene.environment=environment.texture;scene.environmentIntensity=0.45;room.dispose();pmrem.dispose()
    scene.add(new THREE.HemisphereLight('#c6e4ee','#152332',0.9))
    for(const [color,intensity,position] of [['#e4f2f0',2.4,[-4,8,6]],['#75bfd7',1.1,[5,3,-5]],['#d9a06d',1.2,[-4,4,-4]]]){const light=new THREE.DirectionalLight(color,intensity);light.position.set(...position);scene.add(light)}
    const files={},metadata={version:1,frames:FRAMES,columns:COLS,cell:CELL,worldSize:WORLD_SIZE,anchor:projection(new THREE.Vector3(),camera),towers:{}}
    const contact=canvas(900,760),contactCtx=contact.getContext('2d')
    contactCtx.fillStyle='#101b22';contactCtx.fillRect(0,0,900,760);contactCtx.fillStyle='#d7e4df';contactCtx.font='bold 25px system-ui';contactCtx.fillText('余烬防线 / 九类防御设施',28,38);contactCtx.fillStyle='#8caeb7';contactCtx.font='12px system-ui';contactCtx.fillText('ZSKY MODELS · EMBER MATERIALS · 32 DIRECTION SPRITES',28,61)
    preview.replaceChildren()
    let index=0
    for(const [kind,profile] of Object.entries(profiles)) {
      status.textContent=`正在制作 ${profile.name}（${index+1}/9）…`
      const gltf=await loader.loadAsync(`/art-source/zsky/models/${profile.model}.glb`)
      const model=prepareModel(kind,profile,gltf);scene.add(model.root)
      const atlas=canvas(COLS*CELL,Math.ceil(FRAMES/COLS)*CELL),atlasCtx=atlas.getContext('2d')
      model.head.visible=false;renderer.render(scene,camera)
      const base=canvas(CELL,CELL);base.getContext('2d').drawImage(renderer.domElement,0,0)
      files[`${kind}-base.png`]=await bytes(base)
      model.head.visible=true;model.base.visible=false
      const anchors=[]
      const elevation=Math.sin(Math.atan2(10,7))
      for(let frame=0;frame<FRAMES;frame++) {
        const angle=frame*Math.PI*2/FRAMES,yaw=Math.atan2(Math.cos(angle),Math.sin(angle)/elevation)
        model.head.rotation.y=yaw;renderer.render(scene,camera)
        atlasCtx.drawImage(renderer.domElement,(frame%COLS)*CELL,Math.floor(frame/COLS)*CELL)
        anchors.push(model.muzzles.map(p=>projection(p.clone().applyAxisAngle(new THREE.Vector3(0,1,0),yaw),camera)))
      }
      files[`${kind}-head.webp`]=await bytes(atlas,'image/webp')
      metadata.towers[kind]={model:profile.model,aimOrigin:projection(new THREE.Vector3(0,model.muzzles[0].y,0),camera),muzzles:anchors}
      model.base.visible=true
      const iconAngle=-Math.PI/4;model.head.rotation.y=Math.atan2(Math.cos(iconAngle),Math.sin(iconAngle)/elevation)
      renderer.setSize(CELL*2,CELL*2);renderer.render(scene,camera)
      const highRes=canvas(CELL*2,CELL*2);highRes.getContext('2d').drawImage(renderer.domElement,0,0)
      const icon=tightIcon(highRes);files[`${kind}-icon.png`]=await bytes(icon)
      renderer.setSize(CELL,CELL)
      const x=(index%3)*300,y=80+Math.floor(index/3)*220
      contactCtx.strokeStyle='#2b424b';contactCtx.strokeRect(x+16,y+8,268,202);contactCtx.drawImage(icon,x+70,y+18,160,160)
      contactCtx.fillStyle='#d9c294';contactCtx.font='bold 15px system-ui';contactCtx.textAlign='center';contactCtx.fillText(profile.name,x+150,y+190);contactCtx.textAlign='left'
      const card=document.createElement('div');card.className='card';const img=new Image();img.src=icon.toDataURL();const label=document.createElement('b');label.textContent=profile.name;const info=document.createElement('small');info.textContent=profile.model;card.append(img,label,info);preview.append(card)
      scene.remove(model.root);model.root.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material){for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose()}})
      index++;await new Promise(resolve=>setTimeout(resolve,0))
    }
    files['tower-atlas.json']=strToU8(JSON.stringify(metadata))
    files['lineup.png']=await bytes(contact)
    files['ATTRIBUTION.txt']=strToU8('Low Poly Sci Fi Turrets by Zsky (@Zsky_01)\nhttps://zsky2000.itch.io/low-poly-sci-fi-turrets\nCC BY 4.0 https://creativecommons.org/licenses/by/4.0/\nModified for Ember Horizon: recolored metallic materials, custom relay dish, normalized scale, split base/head, pre-rendered directional sprites and muzzle anchors.\n')
    const archive=zipSync(files,{level:6}),url=URL.createObjectURL(new Blob([archive],{type:'application/zip'})),link=document.querySelector('#download')
    link.href=url;link.download='ember-tower-sprites.zip';link.hidden=false
    report.textContent=JSON.stringify({towers:index,frames:FRAMES,archiveBytes:archive.length,files:Object.fromEntries(Object.entries(files).map(([name,data])=>[name,data.length]))},null,2)
    status.textContent='已生成九类设施、32 方向炮头与枪口锚点。'
    environment.dispose();button.disabled=false
  } catch(error) {status.textContent='制作失败';report.textContent=error.stack;button.disabled=false}
}
