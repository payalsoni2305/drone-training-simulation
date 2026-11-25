import { describe, expect, it } from 'vitest'
import { mercatorPixel, metresPerPixel, tileGrid, toLocal } from './geo'
import { LOCATIONS, resolveLocation } from './locations'

describe('geo', () => {
  it('converts lat/lon to the known Web-Mercator tile', () => {
    // India Gate sits in tile 18/187460? Verify via the standard slippy-map formulae.
    const p = mercatorPixel({ lat: 28.612912, lon: 77.22951 }, 18)
    const n = 2 ** 18
    expect(Math.floor(p.x / 256)).toBe(Math.floor(((77.22951 + 180) / 360) * n))
    const latRad = (28.612912 * Math.PI) / 180
    const ty = Math.floor(
      ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n,
    )
    expect(Math.floor(p.y / 256)).toBe(ty)
  })

  it('gives roughly half a metre per pixel at zoom 18 over Delhi', () => {
    expect(metresPerPixel(28.6, 18)).toBeCloseTo(0.524, 2)
  })

  it('maps north to -z and east to +x in local metres', () => {
    const origin = { lat: 20, lon: 78 }
    const north = toLocal(origin, { lat: 20.001, lon: 78 })
    const east = toLocal(origin, { lat: 20, lon: 78.001 })
    expect(north.z).toBeLessThan(-100)
    expect(Math.abs(north.x)).toBeLessThan(1e-6)
    expect(east.x).toBeGreaterThan(100)
    expect(Math.abs(east.z)).toBeLessThan(1e-6)
  })

  it('lays tiles out so the pad (origin) falls inside the centre tile and tiles abut', () => {
    const grid = tileGrid({ lat: 27.1741, lon: 78.04215 }, 18, 3)
    expect(grid).toHaveLength(49)
    const centre = grid.find(
      (t) => t.localX <= 0 && t.localZ <= 0 && t.localX + t.size > 0 && t.localZ + t.size > 0,
    )
    expect(centre).toBeDefined()
    const right = grid.find((t) => t.x === centre!.x + 1 && t.y === centre!.y)!
    expect(right.localX).toBeCloseTo(centre!.localX + centre!.size, 6)
    const below = grid.find((t) => t.x === centre!.x && t.y === centre!.y + 1)!
    expect(below.localZ).toBeCloseTo(centre!.localZ + centre!.size, 6)
  })
})

describe('locations', () => {
  it('have unique ids and three subjects each', () => {
    expect(new Set(LOCATIONS.map((l) => l.id)).size).toBe(LOCATIONS.length)
    for (const l of LOCATIONS) expect(l.subjects).toHaveLength(3)
  })

  for (const def of LOCATIONS) {
    describe(def.id, () => {
      const loc = resolveLocation(def)
      const dist = Math.hypot(loc.landmark.x, loc.landmark.z)

      it('keeps the landmark inside the flight range but away from the pad', () => {
        expect(dist).toBeGreaterThan(40)
        expect(dist).toBeLessThan(105)
      })

      it('keeps every subject close to the pad (well inside the flight range)', () => {
        for (const s of loc.subjects) expect(Math.hypot(s.aim.x, s.aim.z)).toBeLessThan(118)
      })

      it('keeps the ring course clear of all obstacles and inside the range', () => {
        for (const ring of loc.course) {
          expect(Math.hypot(ring.x, ring.z)).toBeLessThan(100)
          for (const o of loc.obstacles) {
            if (ring.y > o.height) continue
            expect(Math.hypot(ring.x - o.x, ring.z - o.z)).toBeGreaterThan(o.radius + 6)
          }
        }
      })

      it('leaves the pad itself clear of obstacles', () => {
        for (const o of loc.obstacles) expect(Math.hypot(o.x, o.z)).toBeGreaterThan(o.radius + 10)
      })
    })
  }
})
