import { Link } from 'react-router-dom'
import { fillSubject } from '../sim/lessons'
import type { LessonDef } from '../sim/lessons'
import type { ResolvedLocation } from '../sim/locations'
import type { EarthMode } from '../sim/earth'
import type { MapProgress } from '../sim/world'
import { ControlGuide } from './ControlGuide'

export function Briefing({
  lesson,
  location,
  map,
  mapMode,
  onStart,
}: {
  lesson: LessonDef
  location: ResolvedLocation
  map: MapProgress
  mapMode: EarthMode
  onStart: () => void
}) {
  const done = map.loaded + map.failed
  const ready = done >= map.total
  const pct = Math.round((done / Math.max(1, map.total)) * 100)
  return (
    <div className="overlay">
      <div className="panel wide">
        <p className="eyebrow">
          Lesson briefing · {location.def.name}, {location.def.city}
        </p>
        <h2>{lesson.title}</h2>
        <ul className="bullets">
          {lesson.intro.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <h4>You will</h4>
        <ol className="plain-list">
          {lesson.objectives.map((o, i) => (
            <li key={i}>{fillSubject(o.label, o, location)}</li>
          ))}
        </ol>
        <ControlGuide />
        <div className="actions">
          <Link className="btn ghost" to="/lessons">
            Back to lessons
          </Link>
          <div className="map-status" aria-live="polite">
            {ready ? (
              map.failed > 0 ? (
                <span className="warn-text">
                  {map.failed} map tile{map.failed > 1 ? 's' : ''} unavailable (offline?)
                </span>
              ) : (
                <span className="good-text">
                  {mapMode === 'photoreal'
                    ? 'Real 3D map ready'
                    : 'Satellite map ready (add a Cesium token for 3D buildings)'}
                </span>
              )
            ) : (
              <>
                <span>Loading real-world map… {pct}%</span>
                <span className="meter">
                  <i style={{ width: `${pct}%` }} />
                </span>
              </>
            )}
          </div>
          <button className="btn primary" onClick={onStart} disabled={!ready} autoFocus>
            Start flight
          </button>
        </div>
      </div>
    </div>
  )
}

export function Paused({ onResume, onRestart }: { onResume: () => void; onRestart: () => void }) {
  return (
    <div className="overlay">
      <div className="panel">
        <h2>Paused</h2>
        <div className="actions">
          <Link className="btn ghost" to="/lessons">
            Exit lesson
          </Link>
          <button className="btn" onClick={onRestart}>
            Restart
          </button>
          <button className="btn primary" onClick={onResume} autoFocus>
            Resume
          </button>
        </div>
      </div>
    </div>
  )
}

export function HelpOverlay({ onClose }: { onClose: () => void }) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className="panel wide" onClick={(e) => e.stopPropagation()}>
        <h2>Keyboard controls</h2>
        <ControlGuide />
        <div className="actions">
          <button className="btn primary" onClick={onClose} autoFocus>
            Close (H)
          </button>
        </div>
      </div>
    </div>
  )
}

export interface ResultInfo {
  outcome: 'complete' | 'crashed'
  score: number
  passed: boolean
  passScore: number
  durationSec: number
  metrics: Record<string, number>
  crashReason: string | null
  saved: 'saving' | 'saved' | 'error'
}

export function Result({
  info,
  nextHref,
  onRetry,
}: {
  info: ResultInfo
  nextHref: string | null
  onRetry: () => void
}) {
  const crashed = info.outcome === 'crashed'
  const m = info.metrics
  return (
    <div className="overlay">
      <div className="panel">
        <p className={`eyebrow ${crashed || !info.passed ? 'bad' : 'good'}`}>
          {crashed ? 'Flight ended' : info.passed ? 'Lesson passed' : 'Not quite'}
        </p>
        {crashed ? (
          <>
            <h2>Crashed</h2>
            <p className="muted">
              {info.crashReason ?? 'The drone crashed.'} Take it slower and try again.
            </p>
          </>
        ) : (
          <>
            <div className={`score ${info.passed ? 'good' : 'bad'}`}>
              {info.score}
              <small>/ 100</small>
            </div>
            <p className="muted">
              Pass mark {info.passScore}.{' '}
              {info.passed
                ? 'Nice flying!'
                : 'Fly smoother and finish faster to improve your score.'}
            </p>
            <dl className="stats">
              <div>
                <dt>Precision</dt>
                <dd>{m.precision}%</dd>
              </div>
              <div>
                <dt>Time</dt>
                <dd>{info.durationSec}s</dd>
              </div>
              <div>
                <dt>Battery left</dt>
                <dd>{m.batteryLeft}%</dd>
              </div>
              {m.photos > 0 && (
                <div>
                  <dt>Photos</dt>
                  <dd>{m.photos}</dd>
                </div>
              )}
              {m.landingOffsetM > 0 && (
                <div>
                  <dt>Landing offset</dt>
                  <dd>{m.landingOffsetM} m</dd>
                </div>
              )}
            </dl>
          </>
        )}
        <p className="tiny muted">
          {info.saved === 'saving' && 'Saving result…'}
          {info.saved === 'saved' && 'Result saved to your pilot log.'}
          {info.saved === 'error' && 'Could not save the result (server unreachable).'}
        </p>
        <div className="actions">
          <Link className="btn ghost" to="/lessons">
            Lessons
          </Link>
          {!crashed && (
            <Link className="btn ghost" to="/gallery">
              Gallery
            </Link>
          )}
          <button className="btn" onClick={onRetry}>
            Retry
          </button>
          {info.passed && nextHref && (
            <Link className="btn primary" to={nextHref} autoFocus>
              Next lesson
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
