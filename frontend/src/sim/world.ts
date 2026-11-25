import * as THREE from 'three'
import { buildLandmarkModel } from './landmarkModels'
import { PAD, WAYPOINT_RADIUS } from './layout'
import type { LessonDef } from './lessons'
import type { ResolvedLocation } from './locations'
import type { Obstacle } from './physics'
import { PHYSICS } from './physics'

export interface MapProgress {
  loaded: number
  failed: number
  total: number
}

export interface World {
  scene: THREE.Scene
  sun: THREE.DirectionalLight
  obstacles: Obstacle[]
  /** Simplified 3D landmark. Only shown when the real 3D buildings are not available. */
  landmark: THREE.Object3D
  /** Rings and markers. Hidden when a photo is taken. */
  helpers: THREE.Group
  /** Colour the waypoint rings and show the marker over the active photo subject. */
  setProgress(p: { waypointsDone: number; waypointActive: boolean; subject: number | null }): void
  /** Keep shadow-catching ground under the drone (call each frame with its position). */
  follow(x: number, z: number, groundY: number): void
  update(time: number): void
  dispose(): void
}

function makePadTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 256
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#2f3542'
  ctx.fillRect(0, 0, 256, 256)
  ctx.strokeStyle = '#ffd24a'
  ctx.lineWidth = 10
  ctx.beginPath()
  ctx.arc(128, 128, 116, 0, Math.PI * 2)
  ctx.stroke()
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 150px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('H', 128, 138)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  return tex
}

/**
 * The overlay scene: drone, pad, rings, markers and (as a fallback) a landmark model. It is drawn
 * with a transparent background on top of the real world rendered by CesiumJS (see earth.ts).
 */
export function buildWorld(lesson: LessonDef, location: ResolvedLocation): World {
  const scene = new THREE.Scene()

  scene.add(new THREE.HemisphereLight(0xdcefff, 0x6b6a58, 1.15))
  const sun = new THREE.DirectionalLight(0xfff1d6, 2.2)
  sun.position.set(40, 70, 25)
  sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048)
  const sc = sun.shadow.camera
  sc.left = -70
  sc.right = 70
  sc.top = 70
  sc.bottom = -70
  sc.near = 1
  sc.far = 260
  sun.shadow.bias = -0.0004
  sun.shadow.normalBias = 0.05
  scene.add(sun, sun.target)

  // A transparent plane catches the drone's and landmark's shadows on the real ground.
  const shadowCatcher = new THREE.Mesh(
    new THREE.PlaneGeometry(400, 400),
    new THREE.ShadowMaterial({ opacity: 0.38 }),
  )
  shadowCatcher.rotation.x = -Math.PI / 2
  shadowCatcher.position.y = 0.015
  shadowCatcher.receiveShadow = true
  scene.add(shadowCatcher)

  // Launch pad
  const pad = new THREE.Mesh(
    new THREE.CircleGeometry(PAD.radius, 48),
    new THREE.MeshBasicMaterial({ map: makePadTexture(), toneMapped: false }),
  )
  pad.rotation.x = -Math.PI / 2
  pad.position.set(PAD.x, 0.03, PAD.z)
  scene.add(pad)

  // Geofence ring
  const fence = new THREE.Mesh(
    new THREE.RingGeometry(PHYSICS.maxRange - 2, PHYSICS.maxRange, 512),
    new THREE.MeshBasicMaterial({
      color: 0xff5a4a,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide,
    }),
  )
  fence.rotation.x = -Math.PI / 2
  fence.position.y = 0.05
  scene.add(fence)

  // The landmark
  const landmark = buildLandmarkModel(location.def.landmark.model)
  landmark.position.set(location.landmark.x, 0, location.landmark.z)
  landmark.visible = false
  scene.add(landmark)

  const obstacles: Obstacle[] = location.obstacles.map((o) => ({ ...o }))

  // --- Helpers: waypoint rings and subject marker ----------------------------------------------
  const helpers = new THREE.Group()
  scene.add(helpers)

  const course = lesson.useCourse ? location.course : []
  const rings: THREE.Mesh[] = []
  const ringGeo = new THREE.TorusGeometry(WAYPOINT_RADIUS - 0.4, 0.16, 12, 48)
  course.forEach((wp, i) => {
    const ring = new THREE.Mesh(
      ringGeo,
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 }),
    )
    const prev = i === 0 ? { x: PAD.x, y: wp.y, z: PAD.z } : course[i - 1]
    ring.position.set(wp.x, wp.y, wp.z)
    ring.lookAt(wp.x + (wp.x - prev.x), wp.y + (wp.y - prev.y), wp.z + (wp.z - prev.z))
    helpers.add(ring)
    rings.push(ring)
  })

  const marker = new THREE.Mesh(
    new THREE.ConeGeometry(0.9, 1.8, 4),
    new THREE.MeshBasicMaterial({ color: 0xffc233 }),
  )
  marker.rotation.x = Math.PI
  marker.scale.setScalar(2)
  marker.visible = false
  helpers.add(marker)
  let markerBase = 0

  const state = { waypointsDone: 0, waypointActive: false, subject: null as number | null }
  const apply = () => {
    rings.forEach((ring, i) => {
      const m = ring.material as THREE.MeshBasicMaterial
      if (i < state.waypointsDone) {
        m.color.set(0x3ddc84)
        m.opacity = 0.35
      } else if (i === state.waypointsDone && state.waypointActive) {
        m.color.set(0xffd23f)
        m.opacity = 1
      } else {
        m.color.set(0xffffff)
        m.opacity = 0.45
      }
    })
    const subject = state.subject === null ? null : location.subjects[state.subject]
    marker.visible = !!subject
    if (subject) {
      markerBase = subject.aim.y + subject.size * 0.55 + 3
      marker.position.set(subject.aim.x, markerBase, subject.aim.z)
    }
  }

  return {
    scene,
    sun,
    obstacles,
    landmark,
    helpers,
    setProgress(p) {
      state.waypointsDone = p.waypointsDone
      state.waypointActive = p.waypointActive
      state.subject = p.subject
      apply()
    },
    follow(x, z, groundY) {
      shadowCatcher.position.set(x, groundY + 0.015, z)
    },
    update(time) {
      const pulse = 1 + Math.sin(time * 4) * 0.08
      rings.forEach((ring, i) => {
        const active = i === state.waypointsDone && state.waypointActive
        ring.scale.setScalar(active ? pulse : 1)
      })
      if (marker.visible) {
        marker.position.y = markerBase + Math.sin(time * 3) * 0.6
        marker.rotation.y = time * 1.5
      }
    },
    dispose() {
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose()
          const materials = Array.isArray(o.material) ? o.material : [o.material]
          for (const m of materials) {
            ;(m as THREE.MeshBasicMaterial).map?.dispose()
            m.dispose()
          }
        }
      })
    },
  }
}
