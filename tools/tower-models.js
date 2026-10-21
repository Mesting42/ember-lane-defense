import * as THREE from 'three'

export const profiles = {
  needle: { name: '针蜂', model: 'GatelngGunTurret', emitter: 'PipesGatelngGunTurret' },
  rail: { name: '轨矛', model: 'RailGunTurret', emitter: 'GunRailGunTurret1' },
  arc: { name: '弧光', model: 'LightingTurret', emitter: 'BallLightingTurret1', center: true },
  comet: { name: '彗星', model: 'MissileTurret', emitter: 'GunsMissileTurret1', dual: true },
  cold: { name: '冷凝', model: 'PlasmaTurret', emitter: 'GunPlasmaTurret1' },
  drone: { name: '巡游蜂巢', model: 'HiveTurret', emitter: 'GunHiveTurret1' },
  relay: { name: '脉冲哨塔', model: 'EMPTurret1', emitter: 'RelayFeed', center: true },
  shield: { name: '护盾冲击塔', model: 'ShieldTurret', emitter: 'StorageShieldTurret1', center: true },
  lure: { name: '诱导震荡塔', model: 'EMPTurret1', emitter: 'Ring3EMPTurret1', center: true },
}

function material(source, kind) {
  const name = source.name.toLowerCase()
  let color = '#3d5363', metalness = 0.58, roughness = 0.36, emission = '#000000', intensity = 0
  if (name.startsWith('black')) { color = '#1d303b'; roughness = 0.43 }
  else if (name.startsWith('gray')) color = '#536c79'
  else if (/^(yellow|orange|red)/.test(name)) { color = '#99704b'; metalness = 0.65; roughness = 0.32 }
  else if (name.startsWith('blue')) color = '#304c60'
  else if (name.startsWith('purple')) color = '#66a9b4'
  if (/green|bluestorage|bluelasersight|purpleball/.test(name)) { color = '#8ce7e0'; emission = '#3ec2c6'; intensity = 0.65; metalness = 0.25; roughness = 0.22 }
  if (/orangebase|orangegun|yellowguns|redgun|orangestorage/.test(name)) { color = '#385566'; metalness = 0.64; roughness = 0.32 }
  if (kind === 'cold' && /yellowgun|orangestorage|redstorage/.test(name)) { color = '#608b9c'; emission = '#286b83'; intensity = 0.14 }
  if (kind === 'lure' && /yellowring/.test(name)) { color = '#ba9164'; emission = '#7c3c1b'; intensity = 0.25 }
  const result = new THREE.MeshStandardMaterial({color,metalness,roughness,emissive:emission,emissiveIntensity:intensity})
  result.name = source.name + '_Ember'
  return result
}

function addRelayDish(upper) {
  const metal = new THREE.MeshStandardMaterial({color:'#6f909e',metalness:0.75,roughness:0.3,side:THREE.DoubleSide})
  const copper = new THREE.MeshStandardMaterial({color:'#b88b5d',metalness:0.8,roughness:0.28})
  const glow = new THREE.MeshStandardMaterial({color:'#a4ece5',emissive:'#3bcbd3',emissiveIntensity:0.75,roughness:0.24,metalness:0.15})
  const dish = new THREE.Group()
  const bowl = new THREE.Mesh(new THREE.LatheGeometry([new THREE.Vector2(0.07,0),new THREE.Vector2(0.25,0.025),new THREE.Vector2(0.5,0.1),new THREE.Vector2(0.75,0.24),new THREE.Vector2(0.92,0.43)],28),metal)
  bowl.name='RelayDish'
  dish.add(bowl)
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.92,0.035,6,28),copper);rim.name='RelayRim';rim.rotation.x=Math.PI/2;rim.position.y=0.43;dish.add(rim)
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035,0.035,1.05,8),copper);pole.name='RelayPole';pole.position.y=0.5;dish.add(pole)
  const feed = new THREE.Mesh(new THREE.SphereGeometry(0.13,12,8),glow);feed.name='RelayFeed';feed.position.y=1.02;dish.add(feed)
  dish.position.set(0,2.9,0);dish.rotation.x=0.32;upper.add(dish)
  for(const sign of [-1,1]) {const mast=new THREE.Mesh(new THREE.CylinderGeometry(0.035,0.065,1.2,8),metal);mast.name='RelayMast';mast.position.set(sign*0.5,2.8,-0.1);upper.add(mast)}
}

export function prepareModel(kind, profile, gltf) {
  const original = gltf.scene
  original.updateMatrixWorld(true)
  const baseNode = original.children.find(n=>/^base/i.test(n.name))
  if(!baseNode) throw new Error(`Missing base: ${profile.model}`)
  const baseBox = new THREE.Box3().setFromObject(baseNode), size=baseBox.getSize(new THREE.Vector3()), center=baseBox.getCenter(new THREE.Vector3())
  const origin = new THREE.Vector3(center.x,baseBox.min.y,center.z)
  const scale = 2.6/Math.max(size.x,size.z)
  const root=new THREE.Group(), base=new THREE.Group(), head=new THREE.Group()
  for(const object of [...original.children]) {
    if(kind==='relay' && /^ring/i.test(object.name)) continue
    object.position.sub(origin)
    ;(/^base/i.test(object.name)?base:head).add(object)
  }
  if(kind==='relay') addRelayDish(head)
  root.add(base,head);root.scale.setScalar(scale)
  root.traverse(object=>{
    if(!object.isMesh) return
    if(!object.name.startsWith('Relay') && !object.material.name?.includes('Ember')) {
      object.material = Array.isArray(object.material)?object.material.map(m=>material(m,kind)):material(object.material,kind)
    }
    object.castShadow=true;object.receiveShadow=true
    const edges=new THREE.LineSegments(new THREE.EdgesGeometry(object.geometry,38),new THREE.LineBasicMaterial({color:'#afc5c8',transparent:true,opacity:0.14}))
    object.add(edges)
  })
  root.updateMatrixWorld(true)
  const emitter=root.getObjectByName(profile.emitter)
  if(!emitter) throw new Error(`Missing muzzle: ${profile.emitter}`)
  let muzzles=[]
  if(profile.center) muzzles=[new THREE.Box3().setFromObject(emitter).getCenter(new THREE.Vector3())]
  else {
    const points=[]
    emitter.traverse(mesh=>{
      if(!mesh.isMesh) return
      const attribute=mesh.geometry.getAttribute('position')
      for(let i=0;i<attribute.count;i++)points.push(new THREE.Vector3().fromBufferAttribute(attribute,i).applyMatrix4(mesh.matrixWorld))
    })
    const front=Math.max(...points.map(p=>p.z))
    const tips=points.filter(p=>front-p.z<0.065*scale)
    const average=list=>list.reduce((sum,p)=>sum.add(p),new THREE.Vector3()).multiplyScalar(1/list.length)
    muzzles=profile.dual?[average(tips.filter(p=>p.x<0)),average(tips.filter(p=>p.x>=0))]:[average(tips)]
  }
  return {root,base,head,muzzles,profile}
}

