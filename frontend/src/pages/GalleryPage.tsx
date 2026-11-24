import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { api } from '../api/client'
import type { MediaItem } from '../api/client'
import { useLearner } from '../learner/context'
import { LESSONS } from '../sim/lessons'
import { getLocation } from '../sim/locations'

type Filter = 'all' | 'photo' | 'video'

export default function GalleryPage() {
  const { learner, loading } = useLearner()
  const [media, setMedia] = useState<MediaItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [open, setOpen] = useState<MediaItem | null>(null)
  const learnerId = learner?.id

  useEffect(() => {
    if (!learnerId) return
    api
      .media(learnerId)
      .then(setMedia)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load gallery'))
  }, [learnerId])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(null)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (loading) return <p className="center-note">Loading…</p>
  if (!learner) return <Navigate to="/" replace />
  if (error) return <p className="center-note error">{error}</p>
  if (!media) return <p className="center-note">Loading gallery…</p>

  const shown = media.filter((m) => filter === 'all' || m.kind === filter)
  const lessonName = (id: string | null) => LESSONS.find((l) => l.id === id)?.title ?? 'Free flight'
  const placeName = (id: string | null) => getLocation(id)?.name

  const remove = async (item: MediaItem) => {
    if (!window.confirm('Delete this capture permanently?')) return
    await api.deleteMedia(learner.id, item.id)
    setMedia((list) => list?.filter((m) => m.id !== item.id) ?? null)
    setOpen(null)
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <p className="eyebrow">Captured from your flights</p>
          <h1>Gallery</h1>
        </div>
        <div className="seg" role="tablist">
          {(['all', 'photo', 'video'] as Filter[]).map((f) => (
            <button key={f} className={filter === f ? 'on' : ''} onClick={() => setFilter(f)}>
              {f === 'all' ? 'All' : f === 'photo' ? 'Photos' : 'Videos'}
            </button>
          ))}
        </div>
      </div>

      {shown.length === 0 ? (
        <div className="empty">
          <p>No captures yet.</p>
          <Link className="btn primary" to="/lessons">
            Go to lessons and take your first aerial photo
          </Link>
        </div>
      ) : (
        <div className="grid">
          {shown.map((m) => (
            <figure key={m.id} className="thumb" onClick={() => setOpen(m)}>
              {m.kind === 'photo' ? (
                <img src={m.url} alt={`Photo from ${lessonName(m.lessonId)}`} loading="lazy" />
              ) : (
                <video src={m.url} muted preload="metadata" />
              )}
              <figcaption>
                <span>{lessonName(m.lessonId)}</span>
                <span className="tiny muted">
                  {placeName(m.locationId) ? `${placeName(m.locationId)} · ` : ''}
                  {m.kind === 'video' && m.durationSec ? `${m.durationSec}s · ` : ''}
                  {new Date(m.createdAt).toLocaleString()}
                </span>
              </figcaption>
              {m.kind === 'video' && <span className="badge">VIDEO</span>}
            </figure>
          ))}
        </div>
      )}

      {open && (
        <div className="overlay" onClick={() => setOpen(null)}>
          <div className="lightbox" onClick={(e) => e.stopPropagation()}>
            {open.kind === 'photo' ? (
              <img src={open.url} alt="Captured photo" />
            ) : (
              <video src={open.url} controls autoPlay />
            )}
            <div className="actions">
              <a className="btn" href={open.url} download>
                Download
              </a>
              <button className="btn danger" onClick={() => remove(open)}>
                Delete
              </button>
              <button className="btn primary" onClick={() => setOpen(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
