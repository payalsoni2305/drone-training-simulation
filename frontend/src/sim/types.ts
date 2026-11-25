export interface Vec3 {
  x: number
  y: number
  z: number
}

/** Normalised stick inputs, each in the range -1..1. */
export interface ControlInput {
  /** +1 climb, -1 descend */
  throttle: number
  /** +1 turn right, -1 turn left */
  yaw: number
  /** +1 forward, -1 backward */
  pitch: number
  /** +1 right, -1 left */
  roll: number
}

export interface DroneState {
  /** World position in metres. `y` is the height above the launch pad. */
  position: Vec3
  velocity: Vec3
  /** Radians. 0 faces -Z; positive turns left (counter-clockwise from above). */
  yaw: number
  /** Tilt in radians, positive = leaning forward / to the right. */
  pitch: number
  roll: number
  armed: boolean
  onGround: boolean
  crashed: boolean
  /** Percent, 0..100 */
  battery: number
  /** Height (m, above the pad) of the real ground, roof or treetop under the drone. */
  groundHeight: number
}

export interface CameraInfo {
  position: Vec3
  forward: Vec3
  right: Vec3
  up: Vec3
  /** Vertical field of view in degrees */
  fovDeg: number
  aspect: number
}

export type SimEvent =
  | { type: 'liftoff' }
  | {
      type: 'touchdown'
      speed: number
      horizontalSpeed: number
      position: Vec3
    }
  | { type: 'crash'; reason: string }
  | { type: 'battery-empty' }
  | { type: 'photo'; camera: CameraInfo; drone: DroneState }
  | { type: 'record-start' }
  | { type: 'record-stop'; duration: number }

export type CameraMode = 'chase' | 'fpv'
