import fs from 'node:fs'
import path from 'node:path'
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { createRasterizer } from './cpu-rasterizer.mjs'

const CELL=192, RES=384, FRAMES=32, COLS=8
const output=path.resolve('art-source/kenney/rendered-raw')
fs.mkdirSync(output,{recursive:true})
const camera=new THREE.OrthographicCamera(-3.5,3.5,3.5,-3.5,0.1,100)
camera.position.set(0,10,7);camera.lookAt(0,0,0);camera.updateMatrixWorld()
const render=createRasterizer(camera,RES),loader=new GLTFLoader()
const profiles={
  scout:{name:'快速侦察机',model:'craft_speederA',size:58,accent:'#b85d44',energy:'#f2a566'},
  siege:{name:'重装攻城机',model:'craft_miner',size:82,accent:'#9c6450',energy:'#ed9963'},
  splitter:{name:'裂解型单位',model:'craft_speederB',size:67,accent:'#a7544d',energy:'#f2bd71'},
  jammer:{name:'干扰机',model:'craft_speederC',size:72,accent:'#79527e',energy:'#dd9cec'},
  jumper:{name:'跃迁单位',model:'craft_racer',size:64,accent:'#78618f',energy:'#b9a2f2'},
  carrier:{name:'护盾运输机',model:'craft_cargoA',size:88,accent:'#9a7651',energy:'#8adad7'},
  mite:{name:'裂解子机',model:'craft_speederD',size:40,accent:'#b57550',energy:'#ffd18c'},
  boss:{name:'断界者旗舰',model:'craft_cargoB',size:190,accent:'#995147',energy:'#ffb363'},
}
const metal=new THREE.MeshStandardMaterial({color:'#3a4653',metalness:0.65,roughness:0.4})
function part(parent,geometry,material,position){const mesh=new THREE.Mesh(geometry,material);mesh.position.set(...position);parent.add(mesh);return mesh}
const metadata={version:1,cell:CELL,frames:FRAMES,columns:COLS,anchor:[96,96],enemies:{}}
for(const [kind,p] of Object.entries(profiles)){
  const data=fs.readFileSync(`art-source/kenney/models/${p.model}.glb`)
  const gltf=await loader.parseAsync(data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength),'')
  const model=gltf.scene,box=new THREE.Box3().setFromObject(model),center=box.getCenter(new THREE.Vector3()),bounds=box.getSize(new THREE.Vector3())
  model.position.sub(center);model.updateMatrixWorld(true)
  const root=new THREE.Group();root.add(model);root.scale.setScalar(3.9/Math.max(bounds.x,bounds.z))
  const trim=new THREE.MeshStandardMaterial({color:p.accent,metalness:0.55,roughness:0.32})
  const glow=new THREE.MeshStandardMaterial({color:p.energy,emissive:p.energy,emissiveIntensity:0.5,roughness:0.25})
  model.traverse(o=>{if(!o.isMesh)return;const n=o.material.name;o.material=n==='metalRed'?trim:new THREE.MeshStandardMaterial({color:n==='metal'?'#59606a':n==='metalDark'?'#39414c':'#1d2632',metalness:0.6,roughness:0.4})})
  // Distinct modules make each threat readable even when scaled down on the battle board.
  const localBox=new THREE.Box3().setFromObject(model),s=localBox.getSize(new THREE.Vector3())
  const y=s.y*0.2,z=s.z*0.3
  for(const side of [-1,1])part(model,new THREE.BoxGeometry(s.x*0.07,s.y*0.15,s.z*0.07),glow,[-model.position.x+side*s.x*0.16,y-model.position.y,z-model.position.z])
  if(kind==='jammer')for(const side of [-1,1]){const ring=part(model,new THREE.TorusGeometry(s.x*0.24,s.x*0.025,6,20),glow,[-model.position.x+side*s.x*0.42,y+s.y*0.2-model.position.y,-model.position.z]);ring.rotation.y=Math.PI/2}
  if(kind==='carrier'){const ring=part(model,new THREE.TorusGeometry(s.x*0.48,s.x*0.02,6,28),glow,[-model.position.x,y-model.position.y,-model.position.z]);ring.rotation.x=Math.PI/2}
  if(kind==='boss'){
    for(const side of [-1,1]){part(model,new THREE.BoxGeometry(s.x*0.13,s.y*0.5,s.z*0.8),metal,[-model.position.x+side*s.x*0.52,-model.position.y,-model.position.z]);part(model,new THREE.BoxGeometry(s.x*0.08,s.y*0.13,s.z*0.24),glow,[-model.position.x+side*s.x*0.52,y-model.position.y,s.z*0.32-model.position.z])}
    part(model,new THREE.BoxGeometry(s.x*0.3,s.y*0.45,s.z*0.25),trim,[-model.position.x,s.y*0.55-model.position.y,-model.position.z])
  }
  for(let frame=0;frame<FRAMES;frame++){
    const angle=frame*Math.PI*2/FRAMES
    // Kenney craft point along -Z, opposite to the turret models.
    root.rotation.y=Math.atan2(Math.cos(angle),Math.sin(angle)/Math.sin(Math.atan2(10,7)))+Math.PI
    fs.writeFileSync(path.join(output,`${kind}-${frame}.rgba`),render(root))
  }
  metadata.enemies[kind]={model:p.model,size:p.size,name:p.name}
  console.log(`${p.name}: ${FRAMES} directions`)
}
fs.writeFileSync(path.join(output,'enemy-atlas.json'),JSON.stringify(metadata))
