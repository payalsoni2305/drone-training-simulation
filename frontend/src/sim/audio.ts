/** Procedural sound: motor hum that follows the drone, and a camera shutter click. */
export class SimAudio {
  private ctx: AudioContext | null = null
  private osc: OscillatorNode | null = null
  private gain: GainNode | null = null
  private filter: BiquadFilterNode | null = null
  muted = false

  /** Must be called from a user gesture (click / key press). */
  start() {
    if (this.ctx) {
      void this.ctx.resume()
      return
    }
    const Ctor = window.AudioContext
    if (!Ctor) return
    const ctx = new Ctor()
    const osc = ctx.createOscillator()
    osc.type = 'sawtooth'
    osc.frequency.value = 80
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 700
    const gain = ctx.createGain()
    gain.gain.value = 0
    osc.connect(filter).connect(gain).connect(ctx.destination)
    osc.start()
    this.ctx = ctx
    this.osc = osc
    this.gain = gain
    this.filter = filter
  }

  /** `load` is 0 when the motors are off and up to 1 when working hard. */
  setMotor(armed: boolean, load: number) {
    if (!this.ctx || !this.osc || !this.gain || !this.filter) return
    const t = this.ctx.currentTime
    const target = armed && !this.muted ? 0.035 + load * 0.05 : 0
    this.gain.gain.setTargetAtTime(target, t, 0.08)
    this.osc.frequency.setTargetAtTime(95 + load * 140, t, 0.1)
    this.filter.frequency.setTargetAtTime(600 + load * 900, t, 0.1)
  }

  click() {
    if (!this.ctx || this.muted) return
    const ctx = this.ctx
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = 'square'
    osc.frequency.value = 1400
    g.gain.setValueAtTime(0.06, ctx.currentTime)
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.06)
    osc.connect(g).connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.07)
  }

  setMuted(muted: boolean) {
    this.muted = muted
    if (muted) this.setMotor(false, 0)
  }

  dispose() {
    this.osc?.stop()
    void this.ctx?.close()
    this.ctx = null
  }
}
