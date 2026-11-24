// Pure geography helpers (no browser or Three.js imports) so they also run in Node scripts.

export const TILE_SIZE = 256
const EARTH_RADIUS = 6371008.8
const METRES_PER_DEGREE = (EARTH_RADIUS * Math.PI) / 180

export interface LatLon {
  lat: number
  lon: number
}

/** Position in the simulator's local frame: x = east (m), z = south (m). Forward at yaw 0 is north. */
export interface Local {
  x: number
  z: number
}

/** Global Web-Mercator pixel coordinates at a zoom level. */
export function mercatorPixel(p: LatLon, zoom: number): { x: number; y: number } {
  const scale = TILE_SIZE * 2 ** zoom
  const s = Math.sin((p.lat * Math.PI) / 180)
  return {
    x: ((p.lon + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * scale,
  }
}

/** Ground size of one imagery pixel in true metres at this latitude. */
export function metresPerPixel(lat: number, zoom: number): number {
  return (156543.03392 * Math.cos((lat * Math.PI) / 180)) / 2 ** zoom
}

/** Convert a coordinate to metres east/south of `origin` (accurate at city scale). */
export function toLocal(origin: LatLon, p: LatLon): Local {
  return {
    x: (p.lon - origin.lon) * METRES_PER_DEGREE * Math.cos((origin.lat * Math.PI) / 180),
    z: -(p.lat - origin.lat) * METRES_PER_DEGREE,
  }
}

export interface TileSpec {
  z: number
  x: number
  y: number
  /** Top-left corner of the tile in local metres. */
  localX: number
  localZ: number
  /** Edge length in metres. */
  size: number
}

/** The (2r+1) x (2r+1) block of imagery tiles around `origin`, positioned in local metres. */
export function tileGrid(origin: LatLon, zoom: number, radius: number): TileSpec[] {
  const mpp = metresPerPixel(origin.lat, zoom)
  const centre = mercatorPixel(origin, zoom)
  const cx = Math.floor(centre.x / TILE_SIZE)
  const cy = Math.floor(centre.y / TILE_SIZE)
  const max = 2 ** zoom
  const tiles: TileSpec[] = []
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const x = cx + dx
      const y = cy + dy
      if (x < 0 || y < 0 || x >= max || y >= max) continue
      tiles.push({
        z: zoom,
        x,
        y,
        localX: (x * TILE_SIZE - centre.x) * mpp,
        localZ: (y * TILE_SIZE - centre.y) * mpp,
        size: TILE_SIZE * mpp,
      })
    }
  }
  return tiles
}
