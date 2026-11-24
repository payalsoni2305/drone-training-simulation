import * as THREE from 'three'
import { SimAudio } from './audio'
import { createDroneModel } from './droneModel'
import type { DroneModel } from './droneModel'
import { BASE_FOV, cameraInfo, DEFAULT_GIMBAL, GIMBAL_MAX, GIMBAL_MIN, MAX_ZOOM } from './framing'
import { KeyboardInput } from './input'
import type { Action } from './input'
import { PAD } from './layout'
import { LessonRunner } from './lessons'
import type { Feedback, LessonDef, ObjectiveView } from './lessons'
import type { ResolvedLocation } from './locations'
import {
  createDroneState,
  forwardVector,
  hitsObstacle,
  horizontalSpeed,
  stepDrone,
} from './physics'
import type { CameraMode, ControlInput, DroneState, SimEvent } from './types'
import { Earth } from './earth'
import type { EarthMode } from './earth'
import { buildWorld } from './world'
import type { MapProgress, World } from './world'

export type SimStatus = 'briefing' | 'flying' | 'paused' | 'complete' | 'failed'

export interface HudState {
  status: SimStatus
  armed: boolean
  onGround: boolean
  altitude: number
  speed: number
  verticalSpeed: number
  battery: number
  distanceFromPad: number
  cameraMode: CameraMode
  zoom: number
  gimbalDeg: number
  recording: boolean
  recSeconds: number
  armProgress: number
  elapsed: number
  objectives: ObjectiveView[]
  sticks: ControlInput
  crashReason: string | null
  muted: boolean
  mapTiles: MapProgress
  /** What the world is drawn with: real 3D buildings, satellite imagery, or not loaded yet. */
  mapMode: EarthMode
  /** Increments with every photo; the UI uses it to trigger a shutter flash. */
  shutter: number
}

export interface ToastMessage {
  kind: Feedback['kind'] | 'error'
  text: string
}

export interface MediaCapture {
  blob: Blob
  kind: 'photo' | 'video'
  durationSec?: number
}

export interface FinishInfo {
  outcome: 'complete' | 'crashed'
  score: number
  durationSec: number
  metrics: Record<string, number>
  crashReason?: string
}

export interface SimCallbacks {
  onHud(hud: HudState): void
  onToast(toast: ToastMessage): void
  onMedia(media: MediaCapture): void
  onFinish(info: FinishInfo): void
}

const STEP = 1 / 120
const GIMBAL_RATE = (45 * Math.PI) / 180 // rad/s
const ZOOM_RATE = 1.2 // e-folds per second
// 120 m (400 ft) is the usual legal ceiling for small drones; real imagery looks best up there.
const MAX_ALTITUDE = 120
const HUD_INTERVAL_MS = 66

function pickVideoType(): string | undefined {
  const candidates = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']
  return candidates.find((t) => MediaRecorder.isTypeSupported(t))
}

/**
 * Owns the Three.js scene, the physics loop, keyboard input, the lesson runner,
 * and photo/video capture for one lesson. React only sees it through callbacks.
 */
export class Simulator {
  private readonly container: HTMLElement
  private readonly lesson: LessonDef
  private readonly location: ResolvedLocation
  private readonly cb: SimCallbacks

  private renderer: THREE.WebGLRenderer
  private camera: THREE.PerspectiveCamera
  private world: World
  private model: DroneModel
  private input = new KeyboardInput()
  private audio = new SimAudio()
  private runner: LessonRunner
  private drone: DroneState = createDroneState()

  private status: SimStatus = 'briefing'
  private cameraMode: CameraMode = 'chase'
  private gimbal = DEFAULT_GIMBAL
  private zoom = 1
  private accumulator = 0
  private lastFrame = 0
  private lastHud = 0
  private raf = 0
  private time = 0
  private shutter = 0
  private mapTiles: MapProgress = { loaded: 0, failed: 0, total: 1 }
  private mapMode: EarthMode = 'loading'
  private earth: Earth | null = null
  private disposed = false
  /** Photo and video frames: the Cesium world and the Three.js overlay merged into one canvas. */
  private composite: HTMLCanvasElement | null = null
  private crashReason: string | null = null
  private finished = false
  private warnedBattery = new Set<number>()
  private warnedCeiling = false
  private chasePos = new THREE.Vector3()
  private chaseReady = false

  private recorder: MediaRecorder | null = null
  private recordChunks: Blob[] = []
  private recordStart = 0
  private discardRecording = false

  private resizeObserver: ResizeObserver

  constructor(
    container: HTMLElement,
    lesson: LessonDef,
    location: ResolvedLocation,
    callbacks: SimCallbacks,
  ) {
    this.container = container
    this.lesson = lesson
    this.location = location
    this.cb = callbacks
    this.runner = new LessonRunner(lesson, location)
    if (import.meta.env.DEV) Object.assign(window, { __sim: this })

    container.style.position = 'absolute'
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    })
    this.renderer.setClearColor(0x000000, 0)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFShadowMap
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    container.appendChild(this.renderer.domElement)
    Object.assign(this.renderer.domElement.style, {
      position: 'absolute',
      inset: '0',
      display: 'block',
      pointerEvents: 'none',
    })

    this.camera = new THREE.PerspectiveCamera(60, 1, 0.1, 900)
    this.world = buildWorld(lesson, location)
    Earth.create(container, location, {
      onProgress: (p) => {
        this.mapTiles = p
      },
      onMode: (mode) => {
        this.mapMode = mode
        // Real buildings replace the simplified landmark model.
        this.world.landmark.visible = mode === 'satellite'
      },
    })
      .then((earth) => {
        if (this.disposed) earth.dispose()
        else {
          this.earth = earth
          earth.resize()
        }
      })
      .catch((err) => {
        console.error('Could not start the 3D world:', err)
        this.mapTiles = { loaded: 0, failed: 1, total: 1 }
        this.toast('error', 'The 3D world could not start. Check that WebGL is enabled.')
      })
    this.model = createDroneModel()
    this.world.scene.add(this.model.group)
    this.syncWorldProgress()

    this.input.onAction = (a) => this.handleAction(a)
    this.input.enabled = false
    this.input.attach()

    this.resizeObserver = new ResizeObserver(() => this.resize())
    this.resizeObserver.observe(container)
    this.resize()

    this.lastFrame = performance.now()
    this.raf = requestAnimationFrame(this.frame)
    this.emitHud()
  }

  // --- Public controls ----------------------------------------------------

  /** Leave the briefing and start flying. Call from a click so audio is allowed. */
  begin() {
    if (this.status !== 'briefing') return
    this.audio.start()
    this.setStatus('flying')
  }

  togglePause() {
    if (this.status === 'flying') {
      this.setStatus('paused')
      if (this.recorder?.state === 'recording') this.recorder.pause()
    } else if (this.status === 'paused') {
      this.setStatus('flying')
      if (this.recorder?.state === 'paused') this.recorder.resume()
    }
  }

  /** Restart the lesson from the pad. */
  reset() {
    this.stopRecording(true)
    this.drone = createDroneState()
    this.runner = new LessonRunner(this.lesson, this.location)
    this.gimbal = DEFAULT_GIMBAL
    this.zoom = 1
    this.cameraMode = 'chase'
    this.crashReason = null
    this.finished = false
    this.chaseReady = false
    this.accumulator = 0
    this.warnedBattery.clear()
    this.warnedCeiling = false
    this.syncWorldProgress()
    this.setStatus('flying')
  }

  setMuted(muted: boolean) {
    this.audio.setMuted(muted)
    this.emitHud()
  }

  dispose() {
    this.disposed = true
    cancelAnimationFrame(this.raf)
    this.input.detach()
    this.resizeObserver.disconnect()
    this.stopRecording(true)
    this.audio.dispose()
    this.world.dispose()
    this.earth?.dispose()
    this.renderer.dispose()
    this.renderer.domElement.remove()
  }

  // --- Internals ----------------------------------------------------------

  private setStatus(s: SimStatus) {
    this.status = s
    this.input.enabled = s === 'flying'
    this.emitHud()
  }

  private toast(kind: ToastMessage['kind'], text: string) {
    this.cb.onToast({ kind, text })
  }

  private handleAction(action: Action) {
    switch (action) {
      case 'pause':
        this.togglePause()
        return
      case 'mute':
        this.audio.setMuted(!this.audio.muted)
        this.emitHud()
        return
      case 'reset':
        if (this.status !== 'briefing') this.reset()
        return
      case 'help':
        return // handled by the UI layer
      default:
        break
    }
    if (this.status !== 'flying') return
    switch (action) {
      case 'toggleArm':
        this.toggleArm()
        break
      case 'toggleCamera':
        if (this.recorder?.state === 'recording') {
          this.toast('info', 'Camera view is locked to the drone camera while recording.')
        } else {
          this.cameraMode = this.cameraMode === 'chase' ? 'fpv' : 'chase'
        }
        break
      case 'photo':
        this.takePhoto()
        break
      case 'record':
        if (this.recorder) this.stopRecording(false)
        else this.startRecording()
        break
      default:
        break
    }
  }

  private toggleArm() {
    const d = this.drone
    if (d.crashed) return
    if (d.armed) {
      if (!d.onGround) {
        this.toast('warn', 'Land before disarming. Disarming in the air makes the drone fall.')
        return
      }
      d.armed = false
      this.toast('info', 'Disarmed')
    } else {
      if (d.battery < 5) {
        this.toast('warn', 'Battery too low to arm. Press Backspace to restart.')
        return
      }
      d.armed = true
      this.toast('info', 'Armed. Motors spinning')
    }
  }

  private currentCameraInfo() {
    return cameraInfo(this.drone, this.gimbal, this.zoom, this.camera.aspect)
  }

  private syncWorldProgress() {
    this.world.setProgress({
      waypointsDone: this.runner.waypointsDone,
      waypointActive: this.runner.activeWaypoint !== null,
      subject: this.runner.activeSubject,
    })
  }

  private takePhoto() {
    const info = this.currentCameraInfo()
    const fb = this.runner.onPhoto(info, this.drone)

    // Render the drone camera view without the drone body or guide markers.
    const wasVisible = this.model.group.visible
    this.model.group.visible = false
    this.world.helpers.visible = false
    this.applyDroneCamera(info)
    this.renderFrame()
    this.composeFrame().toBlob(
      (blob) => {
        if (blob) this.cb.onMedia({ blob, kind: 'photo' })
      },
      'image/jpeg',
      0.92,
    )
    this.model.group.visible = wasVisible
    this.world.helpers.visible = true

    this.shutter++
    this.audio.click()
    this.toast(fb.kind, fb.text)
    this.syncWorldProgress()
    this.emitHud()
  }

  private startRecording() {
    if (this.recorder) return
    if (typeof MediaRecorder === 'undefined') {
      this.toast('error', 'Video recording is not supported in this browser.')
      return
    }
    this.cameraMode = 'fpv'
    const stream = this.composeFrame().captureStream(30)
    const mimeType = pickVideoType()
    const recorder = new MediaRecorder(stream, {
      ...(mimeType ? { mimeType } : {}),
      videoBitsPerSecond: 6_000_000,
    })
    this.recordChunks = []
    this.discardRecording = false
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.recordChunks.push(e.data)
    }
    recorder.onstop = () => {
      const duration = (performance.now() - this.recordStart) / 1000
      if (!this.discardRecording && this.recordChunks.length) {
        const blob = new Blob(this.recordChunks, { type: 'video/webm' })
        this.cb.onMedia({ blob, kind: 'video', durationSec: Math.round(duration * 10) / 10 })
      }
      this.recordChunks = []
    }
    recorder.start(500)
    this.recorder = recorder
    this.recordStart = performance.now()
    this.runner.onRecordStart()
    this.toast('info', 'Recording started. Press V to stop.')
    this.emitHud()
  }

  private stopRecording(discard: boolean) {
    const recorder = this.recorder
    if (!recorder) return
    this.discardRecording = discard
    this.recorder = null
    if (recorder.state !== 'inactive') recorder.stop()
    if (!discard) {
      const fb = this.runner.onRecordStop()
      this.toast(fb.kind, fb.text)
      this.syncWorldProgress()
    }
    this.emitHud()
  }

  private frame = (now: number) => {
    if (this.disposed) return
    this.raf = requestAnimationFrame(this.frame)
    const dt = Math.min(0.05, (now - this.lastFrame) / 1000)
    this.lastFrame = now
    this.time += dt

    let controls: ControlInput = { throttle: 0, yaw: 0, pitch: 0, roll: 0 }
    if (this.status === 'flying') controls = this.step(dt)
    else this.input.update(0)

    // A crashed drone drops to the ground so the wreck rests there.
    if (this.drone.crashed && this.drone.position.y > 0) {
      this.drone.position.y = Math.max(0, this.drone.position.y - 9 * dt)
    }

    this.updateVisuals(dt, controls)
    this.renderFrame()
    if (this.recorder?.state === 'recording') this.composeFrame()

    if (now - this.lastHud >= HUD_INTERVAL_MS) {
      this.lastHud = now
      this.emitHud(controls)
    }
  }

  private step(dt: number): ControlInput {
    const controls = { ...this.input.update(dt) }
    const d = this.drone

    this.gimbal = Math.max(
      GIMBAL_MIN,
      Math.min(GIMBAL_MAX, this.gimbal + this.input.gimbal * GIMBAL_RATE * dt),
    )
    this.zoom = Math.max(
      1,
      Math.min(MAX_ZOOM, this.zoom * Math.exp(this.input.zoom * ZOOM_RATE * dt)),
    )

    const events: SimEvent[] = []
    this.accumulator += dt
    while (this.accumulator >= STEP) {
      this.accumulator -= STEP
      events.push(...stepDrone(d, controls, STEP))

      if (d.position.y > MAX_ALTITUDE) {
        d.position.y = MAX_ALTITUDE
        if (d.velocity.y > 0) d.velocity.y = 0
        if (!this.warnedCeiling) {
          this.warnedCeiling = true
          this.toast('warn', `Altitude limit: ${MAX_ALTITUDE} m`)
        }
      }

      if (!d.crashed && !d.onGround) {
        const hit = hitsObstacle(d, this.world.obstacles)
        if (hit) {
          d.crashed = true
          d.armed = false
          d.velocity = { x: 0, y: 0, z: 0 }
          events.push({ type: 'crash', reason: 'Collided with an obstacle' })
        }
      }
      if (d.crashed) break
    }

    for (const e of events) {
      if (e.type === 'crash') this.onCrash(e.reason)
      else if (e.type === 'battery-empty')
        this.toast('error', 'Battery empty. Motors have shut off!')
    }

    for (const level of [20, 10]) {
      if (d.armed && d.battery <= level && !this.warnedBattery.has(level)) {
        this.warnedBattery.add(level)
        this.toast('warn', `Low battery: ${level}%. Land soon.`)
      }
    }

    if (!this.finished) {
      const feedback = this.runner.update({
        dt,
        drone: d,
        events,
        camera: this.currentCameraInfo(),
        recording: this.recorder?.state === 'recording',
      })
      for (const f of feedback) this.toast(f.kind, f.text)
      this.syncWorldProgress()
      if (this.runner.complete) this.onComplete()
    }
    return controls
  }

  private onCrash(reason: string) {
    if (this.finished) return
    this.finished = true
    this.crashReason = reason
    this.stopRecording(true)
    const result = this.runner.result(this.drone)
    this.setStatus('failed')
    this.cb.onFinish({
      outcome: 'crashed',
      score: 0,
      durationSec: result.durationSec,
      metrics: result.metrics,
      crashReason: reason,
    })
  }

  private onComplete() {
    this.finished = true
    this.stopRecording(true)
    const result = this.runner.result(this.drone)
    this.setStatus('complete')
    this.cb.onFinish({ outcome: 'complete', ...result })
  }

  private applyDroneCamera(info = this.currentCameraInfo()) {
    const c = this.camera
    c.fov = info.fovDeg
    c.position.set(info.position.x, info.position.y, info.position.z)
    c.up.set(info.up.x, info.up.y, info.up.z)
    c.lookAt(
      info.position.x + info.forward.x,
      info.position.y + info.forward.y,
      info.position.z + info.forward.z,
    )
    c.updateProjectionMatrix()
  }

  private updateVisuals(dt: number, controls: ControlInput) {
    const d = this.drone
    this.model.sync(d)
    this.model.gimbal.rotation.x = this.gimbal
    const load = d.armed
      ? 0.35 + 0.65 * Math.min(1, Math.abs(controls.throttle) + horizontalSpeed(d) / 8)
      : 0
    this.model.spin(dt, load)
    this.audio.setMotor(d.armed, load)

    // Sun follows the drone so the shadow map stays sharp where it matters.
    this.world.sun.position.set(d.position.x + 40, 70, d.position.z + 25)
    this.world.sun.target.position.set(d.position.x, 0, d.position.z)
    this.world.update(this.time)

    this.model.group.visible = this.cameraMode === 'chase'

    if (this.cameraMode === 'fpv') {
      this.applyDroneCamera()
      this.chaseReady = false
    } else {
      this.camera.up.set(0, 1, 0)
      this.camera.fov = BASE_FOV - 10
      const f = forwardVector(d.yaw)
      const desired = new THREE.Vector3(
        d.position.x - f.x * 5.5,
        Math.max(1.2, d.position.y + 2.2),
        d.position.z - f.z * 5.5,
      )
      if (!this.chaseReady) {
        this.chasePos.copy(desired)
        this.chaseReady = true
      } else {
        this.chasePos.lerp(desired, 1 - Math.exp(-dt * 4))
      }
      this.camera.position.copy(this.chasePos)
      this.camera.lookAt(d.position.x, d.position.y + 0.6, d.position.z)
      this.camera.updateProjectionMatrix()
    }
  }

  /** Draw the real world, then our overlay (drone, rings) on top, with the same camera. */
  private renderFrame() {
    if (this.earth) {
      this.earth.syncCamera(this.camera)
      this.earth.render()
    }
    this.renderer.render(this.world.scene, this.camera)
  }

  /** Merge the world and the overlay into one canvas, for photos and video. */
  private composeFrame(): HTMLCanvasElement {
    const base = this.earth?.canvas
    const overlay = this.renderer.domElement
    const w = base?.width ?? overlay.width
    const h = base?.height ?? overlay.height
    const out = (this.composite ??= document.createElement('canvas'))
    if (out.width !== w || out.height !== h) {
      out.width = w
      out.height = h
    }
    const ctx = out.getContext('2d')!
    if (base) ctx.drawImage(base, 0, 0, w, h)
    else {
      ctx.fillStyle = '#0b1017'
      ctx.fillRect(0, 0, w, h)
    }
    ctx.drawImage(overlay, 0, 0, w, h)
    return out
  }

  private resize() {
    const w = this.container.clientWidth
    const h = this.container.clientHeight
    if (w === 0 || h === 0) return
    this.renderer.setSize(w, h)
    this.earth?.resize()
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
  }

  private emitHud(sticks?: ControlInput) {
    const d = this.drone
    this.cb.onHud({
      status: this.status,
      armed: d.armed,
      onGround: d.onGround,
      altitude: d.position.y,
      speed: horizontalSpeed(d),
      verticalSpeed: d.velocity.y,
      battery: d.battery,
      distanceFromPad: Math.hypot(d.position.x - PAD.x, d.position.z - PAD.z),
      cameraMode: this.cameraMode,
      zoom: this.zoom,
      gimbalDeg: (this.gimbal * 180) / Math.PI,
      recording: this.recorder !== null,
      recSeconds: this.recorder ? (performance.now() - this.recordStart) / 1000 : 0,
      armProgress: this.input.armProgress,
      elapsed: this.runner.elapsed,
      objectives: this.runner.views(),
      sticks: sticks ? { ...sticks } : { throttle: 0, yaw: 0, pitch: 0, roll: 0 },
      crashReason: this.crashReason,
      muted: this.audio.muted,
      mapTiles: this.mapTiles,
      mapMode: this.mapMode,
      shutter: this.shutter,
    })
  }
}
