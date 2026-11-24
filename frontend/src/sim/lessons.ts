import { computeFraming } from './framing'
import { PAD, WAYPOINT_RADIUS } from './layout'
import { BASE_COURSE } from './locations'
import type { ResolvedLocation, ResolvedSubject } from './locations'
import { horizontalSpeed } from './physics'
import type { CameraInfo, DroneState, SimEvent, Vec3 } from './types'

interface ObjectiveBase {
  label: string
  hint: string
}

export type ObjectiveDef = ObjectiveBase &
  (
    | { kind: 'arm' }
    | { kind: 'altitude'; min: number }
    | { kind: 'hover'; min: number; max: number; seconds: number }
    | { kind: 'waypoint'; index: number }
    | { kind: 'photo'; subject: number }
    | { kind: 'record'; subject: number; seconds: number }
    | { kind: 'land' }
  )

export interface LessonDef {
  /** Must match an id in the backend lesson catalog. */
  id: string
  title: string
  intro: string[]
  /** Show the waypoint ring course (rotated per location). */
  useCourse: boolean
  objectives: ObjectiveDef[]
  /** Fallbacks used if the backend is unreachable. */
  parSeconds: number
  passScore: number
}

const ARM: ObjectiveDef = {
  kind: 'arm',
  label: 'Arm the drone',
  hint: 'Hold SPACE until the arm bar fills. Motors spin up when armed.',
}

const takeoff = (min: number): ObjectiveDef => ({
  kind: 'altitude',
  min,
  label: `Take off to ${min} m`,
  hint: 'Hold W to climb. Release W and the drone holds its height.',
})

const LAND: ObjectiveDef = {
  kind: 'land',
  label: 'Land softly on the pad',
  hint: 'Fly over the H pad, then hold S gently to descend. Slow and level wins.',
}

/** `{subject}` in labels and hints is replaced with the subject's name at runtime. */
const photo = (subject: number): ObjectiveDef => ({
  kind: 'photo',
  subject,
  label: 'Photograph the {subject}',
  hint: 'Aim the camera at the gold marker over the {subject}: R/F tilts the gimbal, Z/X zooms. Keep it centred and fill about a third of the frame, then press P.',
})

export const LESSONS: LessonDef[] = [
  {
    id: 'first-flight',
    title: 'First Flight',
    intro: [
      'Learn the full flight cycle: arm, take off, hover and land.',
      'Use W/S for height and the arrow keys to drift if you need to.',
      'Small, gentle key taps give the smoothest flying.',
    ],
    useCourse: false,
    parSeconds: 90,
    passScore: 60,
    objectives: [
      ARM,
      takeoff(2),
      {
        kind: 'hover',
        min: 1.5,
        max: 4.5,
        seconds: 5,
        label: 'Hover steady for 5 seconds',
        hint: 'Keep between 1.5 and 4.5 m and nearly still. Let go of every key to stabilise.',
      },
      LAND,
    ],
  },
  {
    id: 'move-and-navigate',
    title: 'Move & Navigate',
    intro: [
      'Fly through the glowing rings in order, then come home.',
      'Arrow keys tilt the drone forward/back/left/right, A/D rotate it.',
      'Watch the trees: touching anything ends the flight.',
    ],
    useCourse: true,
    parSeconds: 150,
    passScore: 60,
    objectives: [
      ARM,
      takeoff(2),
      ...BASE_COURSE.map((_wp, index): ObjectiveDef => ({
        kind: 'waypoint',
        index,
        label: `Fly through ring ${index + 1} of ${BASE_COURSE.length}`,
        hint: 'Head for the glowing yellow ring. Use A/D to turn toward it and ↑ to move forward.',
      })),
      LAND,
    ],
  },
  {
    id: 'camera-basics',
    title: 'Camera Basics: Photos',
    intro: [
      'The camera sits on a gimbal: R/F tilt it up and down, Z/X zoom in and out.',
      'Press C to switch between chase view and the drone camera (FPV).',
      'P takes a photo from the drone camera. Photos are saved to your Gallery.',
    ],
    useCourse: false,
    parSeconds: 180,
    passScore: 60,
    objectives: [ARM, takeoff(5), photo(0), photo(1), LAND],
  },
  {
    id: 'record-video',
    title: 'Record a Video Clip',
    intro: [
      'V starts and stops video recording. Recording uses the drone camera view.',
      'Keep the landmark centred and clearly visible while you record.',
      'Fly smoothly: gentle inputs make better footage.',
    ],
    useCourse: false,
    parSeconds: 180,
    passScore: 60,
    objectives: [
      ARM,
      takeoff(6),
      {
        kind: 'record',
        subject: 0,
        seconds: 8,
        label: 'Record 8 s of the {subject}, then stop',
        hint: 'Press V to record. Keep the {subject} centred and clearly visible. Stop with V after enough footage.',
      },
      LAND,
    ],
  },
  {
    id: 'aerial-survey',
    title: 'Aerial Survey Mission',
    intro: [
      'Mission: photograph the three marked parts of the landmark, in order.',
      'Then land on the pad. Spare battery and good framing raise your score.',
      'Plan your route first: fewer wasted moves means more battery.',
    ],
    useCourse: false,
    parSeconds: 240,
    passScore: 65,
    objectives: [ARM, takeoff(6), photo(0), photo(1), photo(2), LAND],
  },
]

export function getLessonDef(id: string): LessonDef | undefined {
  return LESSONS.find((l) => l.id === id)
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

export interface Feedback {
  kind: 'info' | 'good' | 'warn'
  text: string
}

export type ObjectiveStatus = 'pending' | 'active' | 'done'

export interface ObjectiveView {
  label: string
  hint: string
  status: ObjectiveStatus
  /** Live progress text for the active objective, e.g. "3.2 / 5 s". */
  progress: string | null
}

export interface RunnerContext {
  dt: number
  drone: DroneState
  events: SimEvent[]
  camera: CameraInfo
  recording: boolean
}

export interface LessonResult {
  score: number
  durationSec: number
  metrics: Record<string, number>
}

const MIN_COVERAGE = 0.15
const MAX_COVERAGE = 0.8
const IDEAL_COVERAGE = 0.4
const clamp01 = (v: number) => Math.max(0, Math.min(1, v))

export interface ShotEvaluation {
  ok: boolean
  quality: number
  reason: string
}

/** How good is a shot of `lm` from `camera`? Pure function, easy to test. */
export function evaluateShot(camera: CameraInfo, lm: ResolvedSubject): ShotEvaluation {
  const f = computeFraming(camera, lm.aim)
  if (!f.inFrame) {
    return { ok: false, quality: 0, reason: `The ${lm.name} is not in the frame.` }
  }
  const fov = (camera.fovDeg * Math.PI) / 180
  const coverage = (2 * Math.atan(lm.size / 2 / f.distance)) / fov
  if (coverage < MIN_COVERAGE) {
    return {
      ok: false,
      quality: 0,
      reason: `The ${lm.name} is too small in frame. Zoom in (Z) or fly closer.`,
    }
  }
  if (coverage > MAX_COVERAGE) {
    return {
      ok: false,
      quality: 0,
      reason: `Too close to the ${lm.name}. Zoom out (X) or back away.`,
    }
  }
  const centered = clamp01(1 - f.offAxisDeg / (camera.fovDeg / 2))
  if (centered < 0.4) {
    return {
      ok: false,
      quality: 0,
      reason: `The ${lm.name} is off-centre. Tilt the gimbal (R/F) or turn the drone (A/D).`,
    }
  }
  const coverageScore = clamp01(1 - Math.abs(coverage - IDEAL_COVERAGE) / IDEAL_COVERAGE)
  return { ok: true, quality: 0.6 * centered + 0.4 * coverageScore, reason: '' }
}

/** Replace `{subject}` in an objective's text with the subject's name at `location`. */
export function fillSubject(text: string, o: ObjectiveDef, location: ResolvedLocation): string {
  if (o.kind !== 'photo' && o.kind !== 'record') return text
  return text.replaceAll('{subject}', location.subjects[o.subject].name)
}

export class LessonRunner {
  index = 0
  elapsed = 0
  started = false
  complete = false
  photos = 0
  goodPhotos = 0
  clips = 0

  private qualities: number[] = []
  private hoverTime = 0
  private goodFootage = 0
  private recordTime = 0
  private notifiedEnough = false
  private missedLandings = 0
  private landingOffset = 0
  private pending: Feedback[] = []

  readonly lesson: LessonDef
  readonly location: ResolvedLocation
  /** Ring centres for this lesson at this location (empty when the lesson has no rings). */
  readonly waypoints: Vec3[]

  constructor(lesson: LessonDef, location: ResolvedLocation) {
    this.lesson = lesson
    this.location = location
    this.waypoints = lesson.useCourse ? location.course : []
  }

  /** Replace `{subject}` with the subject's name for this location. */
  private fill(text: string, o: ObjectiveDef): string {
    return fillSubject(text, o, this.location)
  }

  get current(): ObjectiveDef | null {
    return this.lesson.objectives[this.index] ?? null
  }

  /** Waypoint ring numbers that are finished (for ring colouring). */
  get waypointsDone(): number {
    return this.lesson.objectives.filter((o, i) => o.kind === 'waypoint' && i < this.index).length
  }

  get activeWaypoint(): number | null {
    const c = this.current
    return c?.kind === 'waypoint' ? c.index : null
  }

  /** Index of the subject to highlight, if the current objective is about one. */
  get activeSubject(): number | null {
    const c = this.current
    return c && (c.kind === 'photo' || c.kind === 'record') ? c.subject : null
  }

  views(): ObjectiveView[] {
    return this.lesson.objectives.map((o, i) => ({
      label: this.fill(o.label, o),
      hint: this.fill(o.hint, o),
      status: i < this.index ? 'done' : i === this.index ? 'active' : 'pending',
      progress: i === this.index ? this.progressText(o) : null,
    }))
  }

  private progressText(o: ObjectiveDef): string | null {
    if (o.kind === 'hover')
      return `${Math.min(o.seconds, this.hoverTime).toFixed(1)} / ${o.seconds} s`
    if (o.kind === 'record') {
      return `${Math.min(o.seconds, this.goodFootage).toFixed(1)} / ${o.seconds} s good footage`
    }
    return null
  }

  private advance(quality = 1) {
    this.qualities.push(clamp01(quality))
    this.index++
    this.hoverTime = 0
    this.goodFootage = 0
    this.recordTime = 0
    this.notifiedEnough = false
    if (this.index >= this.lesson.objectives.length) this.complete = true
  }

  private say(kind: Feedback['kind'], text: string) {
    this.pending.push({ kind, text })
  }

  update(ctx: RunnerContext): Feedback[] {
    const { drone, dt } = ctx
    if (!this.complete) {
      if (drone.armed) this.started = true
      if (this.started) this.elapsed += dt
    }

    for (const event of ctx.events) {
      if (event.type === 'touchdown') this.onTouchdown(event)
    }

    const o = this.current
    if (o && !this.complete) {
      switch (o.kind) {
        case 'arm':
          if (drone.armed) this.advance()
          break
        case 'altitude':
          if (!drone.onGround && drone.position.y >= o.min) this.advance()
          break
        case 'hover': {
          const steady =
            !drone.onGround &&
            drone.position.y >= o.min &&
            drone.position.y <= o.max &&
            horizontalSpeed(drone) < 1.2 &&
            Math.abs(drone.velocity.y) < 0.7
          this.hoverTime = steady ? this.hoverTime + dt : 0
          if (this.hoverTime >= o.seconds) this.advance()
          break
        }
        case 'waypoint': {
          const wp = this.waypoints[o.index]
          const d = Math.hypot(
            drone.position.x - wp.x,
            drone.position.y - wp.y,
            drone.position.z - wp.z,
          )
          if (d <= WAYPOINT_RADIUS) {
            this.say('good', `Ring ${o.index + 1} cleared`)
            this.advance()
          }
          break
        }
        case 'record':
          if (ctx.recording) this.trackFootage(ctx, this.location.subjects[o.subject], o.seconds)
          break
        default:
          break
      }
    }
    const out = this.pending
    this.pending = []
    return out
  }

  private trackFootage(ctx: RunnerContext, subject: ResolvedSubject, seconds: number) {
    this.recordTime += ctx.dt
    const shot = evaluateShot(ctx.camera, subject)
    if (shot.ok) this.goodFootage += ctx.dt
    if (!this.notifiedEnough && this.goodFootage >= seconds) {
      this.notifiedEnough = true
      this.say('good', 'Enough footage captured. Press V to stop recording.')
    }
  }

  private onTouchdown(event: Extract<SimEvent, { type: 'touchdown' }>) {
    const o = this.current
    if (!o || o.kind !== 'land') return
    const offset = Math.hypot(event.position.x - PAD.x, event.position.z - PAD.z)
    if (offset > PAD.radius) {
      this.missedLandings++
      this.say('warn', `Touched down ${offset.toFixed(1)} m from the pad. Take off and try again.`)
      return
    }
    const centring = 1 - (offset / PAD.radius) * 0.6
    const softness = 1 - clamp01(event.speed / 3)
    const quality = 0.6 * centring + 0.4 * softness - this.missedLandings * 0.15
    this.landingOffset = offset
    this.say('good', `Landed ${offset.toFixed(1)} m from the pad centre`)
    this.advance(quality)
  }

  /** Call when the learner presses P. Returns feedback for the shot. */
  onPhoto(camera: CameraInfo, drone: DroneState): Feedback {
    this.photos++
    const o = this.current
    if (!o || o.kind !== 'photo' || this.complete) {
      return { kind: 'info', text: 'Photo saved to your Gallery' }
    }
    if (drone.onGround) {
      return { kind: 'warn', text: 'Photo saved, but take off first for this objective.' }
    }
    const subject = this.location.subjects[o.subject]
    const shot = evaluateShot(camera, subject)
    if (!shot.ok) return { kind: 'warn', text: `Photo saved. ${shot.reason}` }
    this.goodPhotos++
    this.advance(shot.quality)
    return {
      kind: 'good',
      text: `Great shot of the ${subject.name}! Framing quality ${Math.round(shot.quality * 100)}%`,
    }
  }

  onRecordStart() {
    this.goodFootage = 0
    this.recordTime = 0
    this.notifiedEnough = false
  }

  onRecordStop(): Feedback {
    const o = this.current
    if (!o || o.kind !== 'record' || this.complete) {
      return { kind: 'info', text: 'Video saved to your Gallery' }
    }
    if (this.goodFootage >= o.seconds) {
      this.clips++
      const quality = clamp01(this.goodFootage / Math.max(this.recordTime, 0.01))
      this.advance(quality)
      return {
        kind: 'good',
        text: `Clip saved. ${Math.round(quality * 100)}% of it was usable footage.`,
      }
    }
    const got = this.goodFootage.toFixed(1)
    this.goodFootage = 0
    this.recordTime = 0
    return {
      kind: 'warn',
      text: `Only ${got} s of usable footage (need ${o.seconds} s). Keep the subject centred and try again.`,
    }
  }

  result(drone: DroneState): LessonResult {
    const q = this.qualities.length
      ? this.qualities.reduce((a, b) => a + b, 0) / this.qualities.length
      : 1
    const par = this.lesson.parSeconds
    const timeFactor = clamp01(1 - (this.elapsed - par) / par)
    const batteryFactor = clamp01(drone.battery / 50)
    const score = Math.round(75 * q + 15 * timeFactor + 10 * batteryFactor)
    return {
      score,
      durationSec: Math.round(this.elapsed),
      metrics: {
        precision: Math.round(q * 100),
        timeBonus: Math.round(timeFactor * 100),
        batteryLeft: Math.round(drone.battery),
        photos: this.photos,
        goodPhotos: this.goodPhotos,
        clips: this.clips,
        landingOffsetM: Math.round(this.landingOffset * 100) / 100,
        missedLandings: this.missedLandings,
      },
    }
  }
}
