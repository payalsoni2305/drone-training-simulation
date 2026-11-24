import type { CameraInfo, DroneState, Vec3 } from './types'

/** Camera field of view at 1x zoom (vertical, degrees). */
export const BASE_FOV = 75
export const MAX_ZOOM = 4
export const DEFAULT_GIMBAL = (-10 * Math.PI) / 180
export const GIMBAL_MIN = (-90 * Math.PI) / 180
export const GIMBAL_MAX = (20 * Math.PI) / 180

const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z
const cross = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
})

export function fovForZoom(zoom: number): number {
  const half = Math.tan((BASE_FOV / 2) * (Math.PI / 180))
  return 2 * Math.atan(half / zoom) * (180 / Math.PI)
}

/** Stabilised gimbal camera mounted at the nose of the drone. */
export function cameraInfo(
  drone: DroneState,
  gimbalTilt: number,
  zoom: number,
  aspect: number,
): CameraInfo {
  const cosT = Math.cos(gimbalTilt)
  const forward: Vec3 = {
    x: -Math.sin(drone.yaw) * cosT,
    y: Math.sin(gimbalTilt),
    z: -Math.cos(drone.yaw) * cosT,
  }
  const right: Vec3 = { x: Math.cos(drone.yaw), y: 0, z: -Math.sin(drone.yaw) }
  const up = cross(right, forward)
  return {
    position: {
      x: drone.position.x - Math.sin(drone.yaw) * 0.3,
      y: drone.position.y + 0.25,
      z: drone.position.z - Math.cos(drone.yaw) * 0.3,
    },
    forward,
    right,
    up,
    fovDeg: fovForZoom(zoom),
    aspect,
  }
}

export interface Framing {
  distance: number
  /** Angle between the camera axis and the target, degrees. */
  offAxisDeg: number
  inFrame: boolean
}

export function computeFraming(camera: CameraInfo, target: Vec3): Framing {
  const d: Vec3 = {
    x: target.x - camera.position.x,
    y: target.y - camera.position.y,
    z: target.z - camera.position.z,
  }
  const distance = Math.hypot(d.x, d.y, d.z)
  if (distance < 1e-6) return { distance: 0, offAxisDeg: 0, inFrame: true }
  const z = dot(d, camera.forward)
  const x = dot(d, camera.right)
  const y = dot(d, camera.up)
  const offAxisDeg = (Math.acos(Math.max(-1, Math.min(1, z / distance))) * 180) / Math.PI
  const tanV = Math.tan((camera.fovDeg / 2) * (Math.PI / 180))
  const tanH = tanV * camera.aspect
  const inFrame = z > 0 && Math.abs(x / z) <= tanH && Math.abs(y / z) <= tanV
  return { distance, offAxisDeg, inFrame }
}
