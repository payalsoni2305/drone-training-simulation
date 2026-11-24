import type { ControlInput, DroneState, SimEvent, Vec3 } from './types'

/**
 * Beginner-friendly "angle mode" quadcopter model:
 *  - sticks command a tilt angle (self-levelling when released)
 *  - throttle commands a climb rate (altitude hold when centred)
 *  - horizontal acceleration comes from the tilt, limited by air drag
 */
export const PHYSICS = {
  gravity: 9.81,
  maxTilt: (30 * Math.PI) / 180,
  attitudeTau: 0.12,
  climbTau: 0.25,
  maxClimb: 3,
  maxDescent: 2.5,
  yawRate: (100 * Math.PI) / 180,
  drag: 0.8,
  crashVerticalSpeed: 4,
  crashHorizontalSpeed: 6,
  maxRange: 120,
  batteryBase: 0.08, // % per second while armed
  batteryPerSpeed: 0.015,
  batteryClimb: 0.02,
} as const

export function createDroneState(): DroneState {
  return {
    position: { x: 0, y: 0, z: 0 },
    velocity: { x: 0, y: 0, z: 0 },
    yaw: 0,
    pitch: 0,
    roll: 0,
    armed: false,
    onGround: true,
    crashed: false,
    battery: 100,
  }
}

export function forwardVector(yaw: number): Vec3 {
  return { x: -Math.sin(yaw), y: 0, z: -Math.cos(yaw) }
}

export function rightVector(yaw: number): Vec3 {
  return { x: Math.cos(yaw), y: 0, z: -Math.sin(yaw) }
}

export function horizontalSpeed(s: DroneState): number {
  return Math.hypot(s.velocity.x, s.velocity.z)
}

function resolveGround(s: DroneState, events: SimEvent[]) {
  if (s.position.y <= 0) {
    if (!s.onGround) {
      const impact = Math.max(0, -s.velocity.y)
      const hs = horizontalSpeed(s)
      s.position.y = 0
      s.velocity.y = 0
      s.onGround = true
      s.pitch = 0
      s.roll = 0
      if (impact > PHYSICS.crashVerticalSpeed) {
        s.crashed = true
        s.armed = false
        s.velocity.x = 0
        s.velocity.z = 0
        events.push({ type: 'crash', reason: 'Hit the ground too hard' })
      } else if (hs > PHYSICS.crashHorizontalSpeed) {
        s.crashed = true
        s.armed = false
        s.velocity.x = 0
        s.velocity.z = 0
        events.push({ type: 'crash', reason: 'Landed while moving too fast' })
      } else {
        s.velocity.x *= 0.2
        s.velocity.z *= 0.2
        events.push({
          type: 'touchdown',
          speed: impact,
          horizontalSpeed: hs,
          position: { ...s.position },
        })
      }
    } else {
      s.position.y = 0
      if (s.velocity.y < 0) s.velocity.y = 0
    }
  } else if (s.onGround) {
    s.onGround = false
    events.push({ type: 'liftoff' })
  }
}

/** Advance the drone by `dt` seconds. Returns the events that occurred. */
export function stepDrone(
  s: DroneState,
  input: ControlInput,
  dt: number,
  wind: Vec3 = { x: 0, y: 0, z: 0 },
): SimEvent[] {
  const events: SimEvent[] = []
  const P = PHYSICS

  if (s.crashed) return events

  if (s.armed) {
    const drain =
      P.batteryBase +
      P.batteryPerSpeed * horizontalSpeed(s) +
      P.batteryClimb * Math.abs(s.velocity.y)
    s.battery = Math.max(0, s.battery - drain * dt)
    if (s.battery <= 0) {
      s.armed = false
      events.push({ type: 'battery-empty' })
    }
  }

  if (!s.armed) {
    if (s.onGround) {
      s.velocity = { x: 0, y: 0, z: 0 }
      s.pitch = 0
      s.roll = 0
      return events
    }
    // Motors off in the air: free fall.
    s.velocity.y -= P.gravity * dt
    const damp = Math.exp(-0.8 * dt)
    s.velocity.x *= damp
    s.velocity.z *= damp
    s.pitch *= damp
    s.roll *= damp
  } else {
    const kAtt = 1 - Math.exp(-dt / P.attitudeTau)
    if (s.onGround) {
      s.pitch = 0
      s.roll = 0
    } else {
      s.pitch += (input.pitch * P.maxTilt - s.pitch) * kAtt
      s.roll += (input.roll * P.maxTilt - s.roll) * kAtt
    }
    s.yaw -= input.yaw * P.yawRate * dt

    const targetVy =
      input.throttle >= 0 ? input.throttle * P.maxClimb : input.throttle * P.maxDescent
    const kV = 1 - Math.exp(-dt / P.climbTau)
    s.velocity.y += (targetVy - s.velocity.y) * kV

    if (s.onGround) {
      s.velocity.x = 0
      s.velocity.z = 0
    } else {
      const f = forwardVector(s.yaw)
      const r = rightVector(s.yaw)
      const aF = P.gravity * Math.tan(s.pitch)
      const aR = P.gravity * Math.tan(s.roll)
      s.velocity.x += (f.x * aF + r.x * aR - P.drag * (s.velocity.x - wind.x)) * dt
      s.velocity.z += (f.z * aF + r.z * aR - P.drag * (s.velocity.z - wind.z)) * dt
    }
  }

  s.position.x += s.velocity.x * dt
  s.position.y += s.velocity.y * dt
  s.position.z += s.velocity.z * dt

  const range = Math.hypot(s.position.x, s.position.z)
  if (range > P.maxRange) {
    const k = P.maxRange / range
    s.position.x *= k
    s.position.z *= k
    s.velocity.x = 0
    s.velocity.z = 0
  }

  resolveGround(s, events)
  return events
}

export interface Obstacle {
  x: number
  z: number
  radius: number
  height: number
}

/** Cylinder-vs-point collision against scenery (trees, buildings). */
export function hitsObstacle(
  s: DroneState,
  obstacles: Obstacle[],
  droneRadius = 0.45,
): Obstacle | null {
  for (const o of obstacles) {
    if (s.position.y > o.height) continue
    const d = Math.hypot(s.position.x - o.x, s.position.z - o.z)
    if (d < o.radius + droneRadius) return o
  }
  return null
}
