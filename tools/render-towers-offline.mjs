// Deterministic CPU rasterizer for the original GLB geometry; no browser or GPU required.
import fs from 'node:fs'
import path from 'node:path'
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { profiles, prepareModel } from './tower-models.js'

const CELL=192, RES=384, FRAMES=32, COLS=8, WORLD_SIZE=134.4
const output=path.resolve('art-source/zsky/rendered-raw')
fs.mkdirSync(output,{recursive:true})
// Keep the world scale while reserving space for the rail cannon at every heading.
const camera=new THREE.OrthographicCamera(-3.6,3.6,4.5,-2.7,0.1,100)
camera.position.set(0,10,7);camera.lookAt(0,0,0);camera.updateMatrixWorld()
const view=camera.position.clone().normalize()
const lights=[{direction:new THREE.Vector3(-4,8,6).normalize(),color:[0.96,1.02,1.06],power:0.95},{direction:new THREE.Vector3(5,3,-5).normalize(),color:[0.48,0.78,0.94],power:0.46},{direction:new THREE.Vector3(-4,4,-4).normalize(),color:[1,0.69,0.4],power:0.4}]
const loader=new GLTFLoader()
const projection=p=>{const v=p.clone().project(camera);return [(v.x+1)*CELL/2,(1-v.y)*CELL/2].map(x=>Math.round(x*100)/100)}
const srgb=v=>Math.round(255*Math.min(1,Math.max(0,v<=0.0031308?v*12.92:1.055*Math.pow(v,1/2.4)-0.055)))

function render(root) {
  root.updateMatrixWorld(true)
  const pixels=new Uint8Array(RES*RES*4),depth=new Float32Array(RES*RES).fill(Infinity)
  const edges=[]
  root.traverseVisible(mesh=>{
    if(mesh.isLineSegments){edges.push(mesh);return}
    if(!mesh.isMesh)return
    const geometry=mesh.geometry,positions=geometry.attributes.position,normals=geometry.attributes.normal,indices=geometry.index
    const transformed=[],world=[],normal=[],normalMatrix=new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld)
    for(let i=0;i<positions.count;i++) {
      const p=new THREE.Vector3().fromBufferAttribute(positions,i).applyMatrix4(mesh.matrixWorld),q=p.clone().project(camera)
      world.push(p);transformed.push([(q.x+1)*RES/2,(1-q.y)*RES/2,q.z])
      normal.push(normals?new THREE.Vector3().fromBufferAttribute(normals,i).applyMatrix3(normalMatrix).normalize():new THREE.Vector3(0,1,0))
    }
    const material=mesh.material
    const count=indices?indices.count:positions.count
    for(let i=0;i<count;i+=3) {
      const ids=[0,1,2].map(j=>indices?indices.getX(i+j):i+j),[a,b,c]=ids.map(j=>transformed[j])
      const face=new THREE.Vector3().subVectors(world[ids[1]],world[ids[0]]).cross(new THREE.Vector3().subVectors(world[ids[2]],world[ids[0]])).normalize()
      const facing=face.dot(view)
      if(facing<=0&&material.side!==THREE.DoubleSide)continue
      const n=new THREE.Vector3().add(normal[ids[0]]).add(normal[ids[1]]).add(normal[ids[2]]).normalize()
      if(facing<0)n.negate()
      const rgb=[material.color.r,material.color.g,material.color.b],emissive=material.emissive??new THREE.Color(0),illumination=[0.2,0.25,0.3]
      const hemi=0.1+0.1*Math.max(0,n.y)
      for(let channel=0;channel<3;channel++)illumination[channel]+=hemi
      let specular=0
      for(const light of lights) {
        const diffuse=Math.max(0,n.dot(light.direction))*light.power
        for(let channel=0;channel<3;channel++)illumination[channel]+=diffuse*light.color[channel]
        const halfway=light.direction.clone().add(view).normalize()
        specular+=Math.pow(Math.max(0,n.dot(halfway)),26)*light.power*(0.14+material.metalness*0.3)
      }
      const colors=rgb.map((v,k)=>srgb(v*illumination[k]+specular*[0.74,0.89,1][k]+[emissive.r,emissive.g,emissive.b][k]*(material.emissiveIntensity??0)))
      const denominator=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1])
      if(Math.abs(denominator)<0.00001)continue
      const minX=Math.max(0,Math.floor(Math.min(a[0],b[0],c[0]))),maxX=Math.min(RES-1,Math.ceil(Math.max(a[0],b[0],c[0])))
      const minY=Math.max(0,Math.floor(Math.min(a[1],b[1],c[1]))),maxY=Math.min(RES-1,Math.ceil(Math.max(a[1],b[1],c[1])))
      for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++) {
        const u=((b[1]-c[1])*(x+0.5-c[0])+(c[0]-b[0])*(y+0.5-c[1]))/denominator
        const v=((c[1]-a[1])*(x+0.5-c[0])+(a[0]-c[0])*(y+0.5-c[1]))/denominator,w=1-u-v
        if(u< -0.0001||v< -0.0001||w< -0.0001)continue
        const z=u*a[2]+v*b[2]+w*c[2],index=y*RES+x
        if(z>=depth[index])continue
        depth[index]=z;pixels[index*4]=colors[0];pixels[index*4+1]=colors[1];pixels[index*4+2]=colors[2];pixels[index*4+3]=255
      }
    }
  })
  for(const edge of edges){
    const attribute=edge.geometry.attributes.position
    for(let i=0;i<attribute.count;i+=2){
      const pair=[i,i+1].map(j=>{const p=new THREE.Vector3().fromBufferAttribute(attribute,j).applyMatrix4(edge.matrixWorld).project(camera);return [(p.x+1)*RES/2,(1-p.y)*RES/2,p.z]})
      const [a,b]=pair,steps=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1]))
      for(let s=0;s<=steps;s++){
        const t=steps?s/steps:0,x=Math.round(a[0]+(b[0]-a[0])*t),y=Math.round(a[1]+(b[1]-a[1])*t),z=a[2]+(b[2]-a[2])*t
        if(x<0||y<0||x>=RES||y>=RES)continue
        const index=y*RES+x
        if(z>depth[index]+0.0004)continue
        for(let k=0;k<3;k++)pixels[index*4+k]=Math.round(pixels[index*4+k]*0.78+[156,185,193][k]*0.22)
        pixels[index*4+3]=255
      }
    }
  }
  return pixels
}

const metadata={version:1,frames:FRAMES,columns:COLS,cell:CELL,worldSize:WORLD_SIZE,anchor:projection(new THREE.Vector3()),towers:{}}
for(const [kind,profile] of Object.entries(profiles)){
  const data=fs.readFileSync(`art-source/zsky/models/${profile.model}.glb`)
  const gltf=await loader.parseAsync(data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength),'')
  const model=prepareModel(kind,profile,gltf)
  model.head.visible=false;fs.writeFileSync(path.join(output,`${kind}-base.rgba`),render(model.root));model.head.visible=true;model.base.visible=false
  const anchors=[]
  for(let frame=0;frame<FRAMES;frame++){
    const angle=frame*Math.PI*2/FRAMES,yaw=Math.atan2(Math.cos(angle),Math.sin(angle)/Math.sin(Math.atan2(10,7)))
    model.head.rotation.y=yaw
    fs.writeFileSync(path.join(output,`${kind}-${frame}.rgba`),render(model.root))
    anchors.push(model.muzzles.map(p=>projection(p.clone().applyAxisAngle(new THREE.Vector3(0,1,0),yaw))))
  }
  metadata.towers[kind]={model:profile.model,aimOrigin:projection(new THREE.Vector3(0,model.muzzles[0].y,0)),muzzles:anchors}
  model.base.visible=true
  const angle=-Math.PI/4;model.head.rotation.y=Math.atan2(Math.cos(angle),Math.sin(angle)/Math.sin(Math.atan2(10,7)))
  fs.writeFileSync(path.join(output,`${kind}-icon.rgba`),render(model.root))
  console.log(`${profile.name}: base + ${FRAMES} directions + icon rendered`)
}
fs.writeFileSync(path.join(output,'tower-atlas.json'),JSON.stringify(metadata))
console.log('Raw render complete:',output)
