import { describe, expect, it } from 'vitest'
import { createDroneState, hitsObstacle, stepDrone } from './physics'
import type { ControlInput } from './types'

const idle: ControlInput = { throttle: 0, yaw: 0, pitch: 0, roll: 0 }
const run = (s: ReturnType<typeof createDroneState>, input: ControlInput, seconds: number) => {
  const events = []
  for (let t = 0; t < seconds; t += 1 / 120) events.push(...stepDrone(s, input, 1 / 120))
  return events
}

describe('drone physics', () => {
  it('stays put on the ground while disarmed', () => {
    const s = createDroneState()
    run(s, { ...idle, throttle: 1 }, 2)
    expect(s.position.y).toBe(0)
  })

  it('takes off when armed and holds altitude when the stick is centred', () => {
    const s = createDroneState()
    s.armed = true
    const events = run(s, { ...idle, throttle: 1 }, 2)
    expect(events.some((e) => e.type === 'liftoff')).toBe(true)
    expect(s.position.y).toBeGreaterThan(3)
    run(s, idle, 1) // brief coast while the climb rate decays
    const settled = s.position.y
    run(s, idle, 2)
    expect(Math.abs(s.position.y - settled)).toBeLessThan(0.05)
  })

  it('moves forward (towards -Z) when pitch is pushed', () => {
    const s = createDroneState()
    s.armed = true
    run(s, { ...idle, throttle: 1 }, 1)
    run(s, { ...idle, pitch: 1 }, 2)
    expect(s.position.z).toBeLessThan(-1)
  })

  it('touches down softly when descending gently', () => {
    const s = createDroneState()
    s.armed = true
    run(s, { ...idle, throttle: 1 }, 1)
    const events = run(s, { ...idle, throttle: -0.4 }, 6)
    expect(events.some((e) => e.type === 'touchdown')).toBe(true)
    expect(s.crashed).toBe(false)
    expect(s.onGround).toBe(true)
  })

  it('crashes when it falls with the motors off', () => {
    const s = createDroneState()
    s.armed = true
    run(s, { ...idle, throttle: 1 }, 3)
    s.armed = false
    const events = run(s, idle, 4)
    expect(events.some((e) => e.type === 'crash')).toBe(true)
    expect(s.crashed).toBe(true)
  })

  it('drains the battery only while armed', () => {
    const s = createDroneState()
    run(s, idle, 5)
    expect(s.battery).toBe(100)
    s.armed = true
    run(s, idle, 5)
    expect(s.battery).toBeLessThan(100)
  })

  it('detects obstacle collisions only below the obstacle height', () => {
    const s = createDroneState()
    s.position = { x: 5, y: 3, z: 0 }
    const tree = { x: 5.5, z: 0, radius: 1, height: 6 }
    expect(hitsObstacle(s, [tree])).toBe(tree)
    s.position.y = 8
    expect(hitsObstacle(s, [tree])).toBeNull()
  })
})
