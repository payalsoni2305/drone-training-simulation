import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { api } from '../api/client'
import type { LessonMeta, LessonProgress } from '../api/client'
import { useLearner } from '../learner/context'
import { useSelectedLocation } from '../learner/selectedLocation'
import { getLessonDef } from '../sim/lessons'

export default function LessonsPage() {
  const { learner, loading } = useLearner()
  const place = useSelectedLocation()
  const [lessons, setLessons] = useState<LessonMeta[] | null>(null)
  const [progress, setProgress] = useState<LessonProgress[]>([])
  const [error, setError] = useState<string | null>(null)
  const learnerId = learner?.id

  useEffect(() => {
    if (!learnerId) return
    Promise.all([api.lessons(), api.progress(learnerId)])
      .then(([l, p]) => {
        setLessons(l)
        setProgress(p)
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load lessons'))
  }, [learnerId])

  if (loading) return <p className="center-note">Loading…</p>
  if (!learner) return <Navigate to="/" replace />
  if (!place) return <Navigate to="/map" replace />
  if (error) return <p className="center-note error">{error}</p>
  if (!lessons) return <p className="center-note">Loading lessons…</p>

  const byId = new Map(progress.map((p) => [p.lessonId, p]))
  const flyable = lessons.filter((l) => getLessonDef(l.id))
  const done = flyable.filter((l) => byId.get(l.id)?.completed).length
  const scores = flyable.map((l) => byId.get(l.id)?.bestScore).filter((s): s is number => s != null)
  const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null
  const totalAttempts = progress.reduce((n, p) => n + p.attempts, 0)
  const next = flyable.find((l) => !byId.get(l.id)?.completed) ?? null

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <p className="eyebrow">Pilot training</p>
          <h1>Welcome, {learner.name}</h1>
        </div>
        {next && (
          <Link className="btn primary" to={`/fly/${place.id}/${next.id}`}>
            {done === 0 ? 'Start first lesson' : `Continue: ${next.title}`}
          </Link>
        )}
      </div>

      <div className="place-banner">
        <div>
          <span className="tiny muted">Flying over</span>
          <b>
            {place.name}, {place.city}
          </b>
        </div>
        <Link className="btn small" to="/map">
          Change location
        </Link>
      </div>

      <dl className="stats strip">
        <div>
          <dt>Lessons passed</dt>
          <dd>
            {done} / {flyable.length}
          </dd>
        </div>
        <div>
          <dt>Average best score</dt>
          <dd>{avg ?? '–'}</dd>
        </div>
        <div>
          <dt>Flights logged</dt>
          <dd>{totalAttempts}</dd>
        </div>
      </dl>

      <div className="cards">
        {flyable.map((lesson) => {
          const p = byId.get(lesson.id)
          return (
            <article key={lesson.id} className={`card ${p?.completed ? 'done' : ''}`}>
              <div className="card-top">
                <span className="num">{lesson.order}</span>
                <span className={`tag ${lesson.difficulty}`}>{lesson.difficulty}</span>
              </div>
              <h3>{lesson.title}</h3>
              <p className="muted">{lesson.summary}</p>
              <div className="card-foot">
                <span className="tiny muted">
                  {p?.completed
                    ? `Passed · best ${p.bestScore}`
                    : p?.attempts
                      ? `${p.attempts} attempt${p.attempts > 1 ? 's' : ''} · best ${p.bestScore}`
                      : `Pass mark ${lesson.passScore}`}
                </span>
                <Link className="btn small" to={`/fly/${place.id}/${lesson.id}`}>
                  {p?.attempts ? 'Fly again' : 'Fly'}
                </Link>
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}
