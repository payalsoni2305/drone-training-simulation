import type { HudState, ToastMessage } from '../sim/Simulator'
import { formatTime } from './controls'

function Stick({ x, y, label }: { x: number; y: number; label: string }) {
  return (
    <div className="stick" aria-label={label}>
      <div className="stick-box">
        <span className="stick-dot" style={{ left: `${50 + x * 42}%`, top: `${50 - y * 42}%` }} />
      </div>
      <small>{label}</small>
    </div>
  )
}

export interface ToastItem extends ToastMessage {
  id: number
}

export function Hud({ hud, title, toasts }: { hud: HudState; title: string; toasts: ToastItem[] }) {
  const active = hud.objectives.find((o) => o.status === 'active')
  const batteryClass = hud.battery < 10 ? 'danger' : hud.battery < 25 ? 'warn' : ''

  return (
    <div className="hud" aria-live="polite">
      {hud.cameraMode === 'fpv' && (
        <div className="reticle" aria-hidden>
          <i />
        </div>
      )}
      <div key={hud.shutter} className={hud.shutter > 0 ? 'shutter-flash' : ''} />

      <div className="hud-top-left">
        <div className="hud-title">{title}</div>
        <div className="hud-sub">
          {formatTime(hud.elapsed)} · {hud.cameraMode === 'fpv' ? 'DRONE CAM' : 'CHASE VIEW'}
        </div>
      </div>

      <div className="toasts">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.kind}`}>
            {t.text}
          </div>
        ))}
      </div>

      <div className="hud-top-right">
        <div className="telemetry">
          <div>
            <span>ALT</span>
            <b>{hud.altitude.toFixed(1)} m</b>
          </div>
          <div>
            <span>SPEED</span>
            <b>{(hud.speed * 3.6).toFixed(0)} km/h</b>
          </div>
          <div>
            <span>V/S</span>
            <b>{hud.verticalSpeed.toFixed(1)} m/s</b>
          </div>
          <div>
            <span>HOME</span>
            <b>{hud.distanceFromPad.toFixed(0)} m</b>
          </div>
        </div>
        <div className={`battery ${batteryClass}`}>
          <div className="battery-fill" style={{ width: `${hud.battery}%` }} />
          <span>{hud.battery.toFixed(0)}%</span>
        </div>
      </div>

      <aside className="objectives">
        <h3>Objectives</h3>
        <ol>
          {hud.objectives.map((o) => (
            <li key={o.label} className={o.status}>
              <span className="check" aria-hidden>
                {o.status === 'done' ? '✓' : ''}
              </span>
              <span>
                {o.label}
                {o.progress && <em> {o.progress}</em>}
              </span>
            </li>
          ))}
        </ol>
        {active && (
          <p className="coach">
            <b>Tip:</b> {active.hint}
          </p>
        )}
      </aside>

      <div className="hud-bottom-left">
        <Stick x={hud.sticks.yaw} y={hud.sticks.throttle} label="W/S · A/D" />
        <Stick x={hud.sticks.roll} y={hud.sticks.pitch} label="Arrow keys" />
      </div>

      <div className="hud-bottom-center">
        {hud.armProgress > 0 && hud.armProgress < 1 && (
          <div className="armbar">
            <div style={{ width: `${hud.armProgress * 100}%` }} />
          </div>
        )}
        <div className={`status-pill ${hud.armed ? 'armed' : ''}`}>
          {hud.armed ? 'ARMED' : 'DISARMED · hold SPACE to arm'}
        </div>
      </div>

      <div className="hud-bottom-right">
        {hud.recording && (
          <div className="rec">
            <i /> REC {formatTime(hud.recSeconds)}
          </div>
        )}
        <div className="camera-info">
          <span>ZOOM {hud.zoom.toFixed(1)}×</span>
          <span>TILT {hud.gimbalDeg.toFixed(0)}°</span>
        </div>
        <div className="keyhint">
          <kbd>H</kbd> controls · <kbd>P</kbd> photo · <kbd>V</kbd> video · <kbd>C</kbd> camera
        </div>
      </div>
    </div>
  )
}
