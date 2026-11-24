import type { ControlInput } from './types'

export type Action =
  'toggleArm' | 'toggleCamera' | 'photo' | 'record' | 'reset' | 'pause' | 'help' | 'mute'

/** Time (s) the arm key must be held, like a real transmitter's arm switch. */
export const ARM_HOLD_SECONDS = 0.6

const GAME_KEYS = new Set([
  'Space',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Backspace',
  'Escape',
])

const RAMP_UP = 5 // stick units per second while a key is held
const RAMP_DOWN = 9 // return-to-centre speed

function approach(value: number, target: number, step: number): number {
  if (value < target) return Math.min(target, value + step)
  if (value > target) return Math.max(target, value - step)
  return value
}

/**
 * Keyboard-as-transmitter. Keys are converted into smooth analogue "sticks"
 * so the drone does not twitch like a digital on/off input would.
 */
export class KeyboardInput {
  private held = new Set<string>()
  private axes: ControlInput = { throttle: 0, yaw: 0, pitch: 0, roll: 0 }
  private armHeld = 0
  private armFired = false
  enabled = true
  onAction: (action: Action) => void = () => {}

  gimbal = 0 // -1 tilt down .. +1 tilt up
  zoom = 0 // -1 zoom out .. +1 zoom in

  private onKeyDown = (e: KeyboardEvent) => {
    if (GAME_KEYS.has(e.code)) e.preventDefault()
    if (e.repeat) return
    this.held.add(e.code)
    switch (e.code) {
      case 'KeyC':
        this.onAction('toggleCamera')
        break
      case 'KeyP':
        this.onAction('photo')
        break
      case 'KeyV':
        this.onAction('record')
        break
      case 'Backspace':
        this.onAction('reset')
        break
      case 'Escape':
        this.onAction('pause')
        break
      case 'KeyH':
        this.onAction('help')
        break
      case 'KeyM':
        this.onAction('mute')
        break
    }
  }

  private onKeyUp = (e: KeyboardEvent) => {
    this.held.delete(e.code)
    if (e.code === 'Space') {
      this.armHeld = 0
      this.armFired = false
    }
  }

  private onBlur = () => {
    this.held.clear()
    this.armHeld = 0
    this.armFired = false
  }

  attach() {
    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)
    window.addEventListener('blur', this.onBlur)
  }

  detach() {
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup', this.onKeyUp)
    window.removeEventListener('blur', this.onBlur)
    this.held.clear()
  }

  /** 0..1 progress of the "hold Space to arm/disarm" gesture. */
  get armProgress(): number {
    return this.armFired ? 1 : Math.min(1, this.armHeld / ARM_HOLD_SECONDS)
  }

  private axis(positive: string[], negative: string[]): number {
    const p = positive.some((k) => this.held.has(k)) ? 1 : 0
    const n = negative.some((k) => this.held.has(k)) ? 1 : 0
    return p - n
  }

  update(dt: number): ControlInput {
    if (!this.enabled) {
      this.axes = { throttle: 0, yaw: 0, pitch: 0, roll: 0 }
      this.gimbal = 0
      this.zoom = 0
      return this.axes
    }

    const target: ControlInput = {
      throttle: this.axis(['KeyW'], ['KeyS']),
      yaw: this.axis(['KeyD'], ['KeyA']),
      pitch: this.axis(['ArrowUp', 'KeyI'], ['ArrowDown', 'KeyK']),
      roll: this.axis(['ArrowRight', 'KeyL'], ['ArrowLeft', 'KeyJ']),
    }
    for (const key of Object.keys(target) as (keyof ControlInput)[]) {
      const t = target[key]
      const step = (t === 0 ? RAMP_DOWN : RAMP_UP) * dt
      this.axes[key] = approach(this.axes[key], t, step)
    }

    this.gimbal = this.axis(['KeyR'], ['KeyF'])
    this.zoom = this.axis(['KeyZ'], ['KeyX'])

    if (this.held.has('Space')) {
      this.armHeld += dt
      if (!this.armFired && this.armHeld >= ARM_HOLD_SECONDS) {
        this.armFired = true
        this.onAction('toggleArm')
      }
    }
    return this.axes
  }
}
