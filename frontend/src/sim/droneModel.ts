import * as THREE from 'three'
import type { DroneState } from './types'

export interface DroneModel {
  group: THREE.Group
  /** Camera pod; pitched by the gimbal. */
  gimbal: THREE.Object3D
  props: THREE.Mesh[]
  /** Apply the physics state to the mesh transform. */
  sync(state: DroneState): void
  spin(dt: number, load: number): void
}

const ARM = 0.42

export function createDroneModel(): DroneModel {
  const group = new THREE.Group()
  const dark = new THREE.MeshStandardMaterial({ color: 0x23272e, roughness: 0.5, metalness: 0.4 })
  const mid = new THREE.MeshStandardMaterial({ color: 0x3a404a, roughness: 0.5, metalness: 0.3 })

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.1, 0.42), dark)
  body.position.y = 0.12
  group.add(body)

  const canopy = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.06, 0.26), mid)
  canopy.position.set(0, 0.2, 0.02)
  group.add(canopy)

  const props: THREE.Mesh[] = []
  const corners: [number, number, boolean][] = [
    [1, -1, true], // front right
    [-1, -1, true], // front left
    [1, 1, false], // back right
    [-1, 1, false], // back left
  ]
  for (const [sx, sz, front] of corners) {
    const len = Math.hypot(ARM, ARM)
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.04, len), mid)
    arm.position.set((sx * ARM) / 2, 0.12, (sz * ARM) / 2)
    arm.rotation.y = Math.atan2(sx, sz)
    group.add(arm)

    const motor = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.07, 12), dark)
    motor.position.set(sx * ARM, 0.15, sz * ARM)
    group.add(motor)

    const prop = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.22, 0.008, 24),
      new THREE.MeshBasicMaterial({
        color: front ? 0xffffff : 0xff5a4a,
        transparent: true,
        opacity: 0.28,
        depthWrite: false,
      }),
    )
    prop.position.set(sx * ARM, 0.2, sz * ARM)
    group.add(prop)
    props.push(prop)

    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.006, 0.03), dark)
    blade.position.y = 0.004
    prop.add(blade)

    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.12, 6), mid)
    leg.position.set(sx * ARM * 0.7, 0.05, sz * ARM * 0.7)
    group.add(leg)
  }

  // Direction LEDs: green at the front, red at the back.
  const ledFront = new THREE.Mesh(
    new THREE.SphereGeometry(0.025, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0x3dff8a }),
  )
  ledFront.position.set(0, 0.13, -0.22)
  const ledBack = new THREE.Mesh(
    new THREE.SphereGeometry(0.025, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xff3b3b }),
  )
  ledBack.position.set(0, 0.13, 0.22)
  group.add(ledFront, ledBack)

  const gimbal = new THREE.Group()
  gimbal.position.set(0, 0.08, -0.22)
  const cam = new THREE.Mesh(new THREE.SphereGeometry(0.06, 14, 14), dark)
  const lens = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03, 0.03, 0.05, 12),
    new THREE.MeshStandardMaterial({ color: 0x0a0c10, metalness: 0.8, roughness: 0.2 }),
  )
  lens.rotation.x = Math.PI / 2
  lens.position.z = -0.05
  gimbal.add(cam, lens)
  group.add(gimbal)

  group.traverse((o) => {
    if (o instanceof THREE.Mesh && !props.includes(o)) o.castShadow = true
  })
  // The whole model is scaled up a little so it is easy to see from the chase view.
  group.scale.setScalar(1.25)

  const euler = new THREE.Euler(0, 0, 0, 'YXZ')
  return {
    group,
    gimbal,
    props,
    sync(s) {
      group.position.set(s.position.x, s.position.y, s.position.z)
      euler.set(-s.pitch, s.yaw, -s.roll, 'YXZ')
      group.setRotationFromEuler(euler)
    },
    spin(dt, load) {
      const speed = load * 70
      props.forEach((p, i) => {
        p.rotation.y += (i % 2 === 0 ? 1 : -1) * speed * dt
      })
    },
  }
}
