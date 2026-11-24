import { describe, expect, it } from 'vitest'
import { cameraInfo } from './framing'
import { evaluateShot, getLessonDef, LESSONS, LessonRunner } from './lessons'
import { getLocation, resolveLocation } from './locations'
import type { ResolvedSubject } from './locations'
import { createDroneState } from './physics'
import type { DroneState, SimEvent } from './types'

const aspect = 16 / 9
// Agra: the pad is ~100 m south of the Taj Mahal, so the monument is straight ahead (north).
const agra = resolveLocation(getLocation('agra')!)
const dome = agra.subjects[0]

function droneAt(x: number, y: number, z: number, yaw = 0): DroneState {
  const d = createDroneState()
  d.position = { x, y, z }
  d.yaw = yaw
  d.armed = true
  d.onGround = false
  return d
}

/** Camera that looks straight at `subject` from `from`, facing north. */
function cameraFacing(
  subject: ResolvedSubject,
  from: { x: number; y: number; z: number },
  zoom = 1,
) {
  const drone = droneAt(from.x, from.y, from.z)
  const camY = from.y + 0.25
  const run = Math.abs(subject.aim.z - (from.z - 0.3))
  const tilt = Math.atan2(subject.aim.y - camY, run)
  return { drone, camera: cameraInfo(drone, tilt, zoom, aspect) }
}

describe('lesson catalog', () => {
  it('has unique ids that match the backend catalog', () => {
    const ids = LESSONS.map((l) => l.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toEqual([
      'first-flight',
      'move-and-navigate',
      'camera-basics',
      'record-video',
      'aerial-survey',
    ])
  })
})

describe('evaluateShot', () => {
  it('accepts a centred, well-sized shot', () => {
    const { camera } = cameraFacing(dome, { x: 0, y: 30, z: -40 })
    const shot = evaluateShot(camera, dome)
    expect(shot.ok).toBe(true)
    expect(shot.quality).toBeGreaterThan(0.8)
  })

  it('rejects a shot where the subject is too small, but zooming fixes it', () => {
    const far = { x: 0, y: 30, z: 150 }
    expect(evaluateShot(cameraFacing(dome, far).camera, dome).ok).toBe(false)
    expect(evaluateShot(cameraFacing(dome, far, 4).camera, dome).ok).toBe(true)
  })

  it('rejects a shot when the subject is behind the camera', () => {
    const d = droneAt(0, 30, -40, Math.PI)
    const shot = evaluateShot(cameraInfo(d, 0, 1, aspect), dome)
    expect(shot.ok).toBe(false)
    expect(shot.reason).toMatch(/not in the frame/)
  })

  it('rejects a shot taken too close', () => {
    const { camera } = cameraFacing(dome, { x: 0, y: 50, z: -80 })
    const shot = evaluateShot(camera, dome)
    expect(shot.ok).toBe(false)
    expect(shot.reason).toMatch(/too close/i)
  })
})

describe('LessonRunner: first flight', () => {
  const lesson = getLessonDef('first-flight')!
  const camera = cameraInfo(createDroneState(), 0, 1, aspect)

  const tick = (r: LessonRunner, d: DroneState, seconds: number, events: SimEvent[] = []) => {
    for (let t = 0; t < seconds; t += 0.05) {
      r.update({ dt: 0.05, drone: d, events: t === 0 ? events : [], camera, recording: false })
    }
  }

  it('walks through arm, takeoff, hover and landing, then scores the run', () => {
    const r = new LessonRunner(lesson, agra)
    const d = createDroneState()
    tick(r, d, 1)
    expect(r.index).toBe(0)

    d.armed = true
    tick(r, d, 0.1)
    expect(r.current?.kind).toBe('altitude')

    Object.assign(d, droneAt(0, 2.5, 0))
    tick(r, d, 0.1)
    expect(r.current?.kind).toBe('hover')

    tick(r, d, 5.2)
    expect(r.current?.kind).toBe('land')

    const touchdown: SimEvent = {
      type: 'touchdown',
      speed: 0.5,
      horizontalSpeed: 0.1,
      position: { x: 0.3, y: 0, z: 0.2 },
    }
    d.position.y = 0
    d.onGround = true
    tick(r, d, 0.05, [touchdown])
    expect(r.complete).toBe(true)

    const result = r.result(d)
    expect(result.score).toBeGreaterThanOrEqual(60)
    expect(result.metrics.landingOffsetM).toBeGreaterThan(0)
  })

  it('resets hover progress when the drone drifts', () => {
    const r = new LessonRunner(lesson, agra)
    const d = droneAt(0, 2.5, 0)
    tick(r, d, 0.2)
    tick(r, d, 0.2)
    expect(r.current?.kind).toBe('hover')
    tick(r, d, 3)
    d.velocity = { x: 3, y: 0, z: 0 }
    tick(r, d, 0.1)
    expect(r.views()[2].progress).toBe('0.0 / 5 s')
  })

  it('ignores a touchdown away from the pad and asks for another landing', () => {
    const r = new LessonRunner(lesson, agra)
    r.index = lesson.objectives.length - 1
    const d = createDroneState()
    tick(r, d, 0.05, [
      { type: 'touchdown', speed: 0.5, horizontalSpeed: 0, position: { x: 12, y: 0, z: 0 } },
    ])
    expect(r.complete).toBe(false)
  })
})

describe('LessonRunner: photo objectives', () => {
  const lesson = getLessonDef('camera-basics')!

  it('names the subject of the current objective for this location', () => {
    const r = new LessonRunner(lesson, agra)
    expect(r.views()[2].label).toBe('Photograph the Main Dome')
    expect(r.views()[3].label).toBe('Photograph the South-East Minaret')
  })

  it('only advances on a good photo of the right subject', () => {
    const r = new LessonRunner(lesson, agra)
    r.index = 2 // photo of the main dome

    const bad = cameraFacing(agra.subjects[1], { x: 36, y: 25, z: -20 })
    expect(r.onPhoto(bad.camera, bad.drone).kind).toBe('warn')
    expect(r.index).toBe(2)

    const good = cameraFacing(dome, { x: 0, y: 30, z: -40 })
    expect(r.onPhoto(good.camera, good.drone).kind).toBe('good')
    expect(r.index).toBe(3)
  })
})

describe('LessonRunner: video objective', () => {
  it('needs enough usable footage before the recording is accepted', () => {
    const lesson = getLessonDef('record-video')!
    const r = new LessonRunner(lesson, agra)
    r.index = 2
    const { drone, camera } = cameraFacing(dome, { x: 0, y: 30, z: -40 })
    r.onRecordStart()
    for (let t = 0; t < 4; t += 0.05)
      r.update({ dt: 0.05, drone, events: [], camera, recording: true })
    expect(r.onRecordStop().kind).toBe('warn')
    expect(r.index).toBe(2)

    r.onRecordStart()
    for (let t = 0; t < 9; t += 0.05)
      r.update({ dt: 0.05, drone, events: [], camera, recording: true })
    expect(r.onRecordStop().kind).toBe('good')
    expect(r.index).toBe(3)
  })
})

describe('ring course', () => {
  it('is used only by the navigation lesson and follows the location', () => {
    const nav = new LessonRunner(getLessonDef('move-and-navigate')!, agra)
    expect(nav.waypoints).toEqual(agra.course)
    expect(new LessonRunner(getLessonDef('first-flight')!, agra).waypoints).toEqual([])
  })
})
