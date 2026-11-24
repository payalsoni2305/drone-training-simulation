import * as THREE from 'three'
import type { ModelId } from './locations'

// Simplified 3D proxies of real monuments, built from primitives. The real building is visible in
// the satellite imagery underneath; these give the drone something solid to fly around and
// photograph. Each model is centred on the landmark origin with y up.

const mat = (color: number) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.02 })

function box(
  g: THREE.Group,
  [w, h, d]: [number, number, number],
  [x, y, z]: [number, number, number],
  color: number,
) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color))
  m.position.set(x, y + h / 2, z)
  g.add(m)
  return m
}

function cylinder(
  g: THREE.Group,
  [rTop, rBottom, h]: [number, number, number],
  [x, y, z]: [number, number, number],
  color: number,
  segments = 20,
) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, h, segments), mat(color))
  m.position.set(x, y + h / 2, z)
  g.add(m)
  return m
}

/** Upper half of a sphere, optionally stretched into an onion shape. */
function dome(
  g: THREE.Group,
  radius: number,
  [x, y, z]: [number, number, number],
  color: number,
  stretch = 1,
) {
  const m = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 28, 16, 0, Math.PI * 2, 0, Math.PI / 2),
    mat(color),
  )
  m.scale.y = stretch
  m.position.set(x, y, z)
  g.add(m)
  return m
}

function cone(
  g: THREE.Group,
  [r, h]: [number, number],
  [x, y, z]: [number, number, number],
  color: number,
) {
  const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, 16), mat(color))
  m.position.set(x, y + h / 2, z)
  g.add(m)
}

function indiaGate(): THREE.Group {
  const g = new THREE.Group()
  const stone = 0xc79a72
  box(g, [30, 1.5, 44], [0, 0, 0], 0xa88b6d)
  box(g, [22, 1.5, 36], [0, 1.5, 0], 0xb59678)
  // Two pillars with the arch opening running east-west between them.
  box(g, [9, 30, 9], [0, 3, -8.5], stone)
  box(g, [9, 30, 9], [0, 3, 8.5], stone)
  box(g, [9, 9, 26], [0, 33, 0], stone)
  box(g, [10, 3, 27], [0, 42, 0], 0xb48a63)
  box(g, [8, 0.8, 12], [0, 20, 0], 0x8a6a4c) // inscription band
  return g
}

function gateway(): THREE.Group {
  const g = new THREE.Group()
  const basalt = 0xb39a6c
  box(g, [18, 1.2, 30], [0, 0, 0], 0x9d8860)
  box(g, [15, 16, 8], [0, 1.2, -9], basalt)
  box(g, [15, 16, 8], [0, 1.2, 9], basalt)
  box(g, [15, 6, 26], [0, 17.2, 0], basalt)
  dome(g, 7, [0, 23.2, 0], 0xa89060, 0.9)
  for (const z of [-12.5, 12.5]) {
    for (const x of [-6, 6]) {
      cylinder(g, [1.3, 1.6, 22], [x, 1.2, z], basalt, 12)
      dome(g, 1.6, [x, 23.2, z], 0x9a8355)
    }
  }
  return g
}

function tajMahal(): THREE.Group {
  const g = new THREE.Group()
  const marble = 0xf3efe6
  box(g, [100, 1, 100], [0, 0, 0], 0xcfc7b4) // red-sandstone terrace
  box(g, [58, 6, 58], [0, 1, 0], marble) // marble plinth
  box(g, [40, 34, 40], [0, 7, 0], marble) // main block
  box(g, [8, 22, 1], [0, 8, 20.4], 0xe0dacd) // iwan (arched portal) on each side
  box(g, [8, 22, 1], [0, 8, -20.4], 0xe0dacd)
  box(g, [1, 22, 8], [20.4, 8, 0], 0xe0dacd)
  box(g, [1, 22, 8], [-20.4, 8, 0], 0xe0dacd)
  cylinder(g, [11, 12, 6], [0, 41, 0], marble, 32) // drum
  dome(g, 16, [0, 47, 0], marble, 1.15)
  cylinder(g, [0.3, 0.5, 8], [0, 65, 0], 0xe5c76b, 8) // finial
  for (const [x, z] of [
    [-14, -14],
    [14, -14],
    [-14, 14],
    [14, 14],
  ]) {
    cylinder(g, [2.2, 3, 8], [x, 41, z], marble, 12) // chhatris
    dome(g, 2.8, [x, 49, z], marble)
  }
  for (const [x, z] of [
    [-36, -36],
    [36, -36],
    [-36, 36],
    [36, 36],
  ]) {
    cylinder(g, [2.2, 2.8, 36], [x, 1, z], marble, 14) // minarets
    cylinder(g, [3.2, 3.2, 1.2], [x, 37, z], 0xe0dacd, 14)
    cylinder(g, [2.4, 2.4, 3], [x, 38.2, z], marble, 12)
    dome(g, 2.6, [x, 41.2, z], marble)
  }
  return g
}

function hawaMahal(): THREE.Group {
  const g = new THREE.Group()
  const pink = 0xe39a86
  const widths = [40, 34, 28, 22, 16]
  let y = 0
  widths.forEach((w, i) => {
    const h = i === 0 ? 4.5 : 3
    box(g, [8, h, w], [0, y, 0], i % 2 === 0 ? pink : 0xd98672)
    // rows of jharokha windows on the east (+x) face
    const cols = Math.floor(w / 3.4)
    for (let c = 0; c < cols; c++) {
      const z = (c - (cols - 1) / 2) * 3.4
      box(g, [0.4, h * 0.55, 1.5], [4.1, y + h * 0.2, z], 0xf6e3d6)
    }
    y += h
  })
  // small domed pavilions along the top
  for (const z of [-5, 0, 5]) {
    box(g, [3, 2.2, 3], [0, y, z], pink)
    dome(g, 1.7, [0, y + 2.2, z], 0xf1b9a6)
  }
  return g
}

function vidhanaSoudha(): THREE.Group {
  const g = new THREE.Group()
  const granite = 0xb9b3a8
  box(g, [100, 2, 44], [0, 0, 0], 0x9b968c) // podium
  box(g, [96, 18, 36], [0, 2, 0], granite)
  box(g, [32, 22, 8], [0, 2, 21], 0xc4beb2) // portico
  for (let i = -3; i <= 3; i++) cylinder(g, [0.9, 0.9, 16], [i * 4, 2, 26], 0xd8d2c6, 10)
  box(g, [28, 10, 28], [0, 20, 0], granite)
  box(g, [22, 14, 22], [0, 30, 0], 0xc4beb2)
  dome(g, 9, [0, 44, 0], 0xa09a8f, 0.9)
  cone(g, [0.8, 8], [0, 51, 0], 0xcfa84a)
  for (const x of [-44, 44]) {
    for (const z of [-14, 14]) {
      box(g, [8, 8, 8], [x, 20, z], 0xc4beb2)
      dome(g, 4, [x, 28, z], 0xa09a8f)
    }
  }
  return g
}

const BUILDERS: Record<ModelId, () => THREE.Group> = {
  indiaGate,
  gateway,
  tajMahal,
  hawaMahal,
  vidhanaSoudha,
}

export function buildLandmarkModel(model: ModelId): THREE.Group {
  const group = BUILDERS[model]()
  group.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.castShadow = true
      o.receiveShadow = true
    }
  })
  return group
}
