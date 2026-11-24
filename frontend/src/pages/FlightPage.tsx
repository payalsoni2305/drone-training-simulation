import { useCallback, useEffect, useRef, useState } from 'react'
import { useMemo } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { api } from '../api/client'
import type { LessonMeta } from '../api/client'
import { Hud } from '../components/Hud'
import type { ToastItem } from '../components/Hud'
import { Briefing, HelpOverlay, Paused, Result } from '../components/Overlays'
import type { ResultInfo } from '../components/Overlays'
import { useLearner } from '../learner/context'
import { Simulator } from '../sim/Simulator'
import type { FinishInfo, HudState, ToastMessage } from '../sim/Simulator'
import { getLessonDef, LESSONS } from '../sim/lessons'
import { getLocation, resolveLocation } from '../sim/locations'
import type { ResolvedLocation } from '../sim/locations'

function canUseWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas')
    return !!(canvas.getContext('webgl2') ?? canvas.getContext('webgl'))
  } catch {
    return false
  }
}

export default function FlightPage() {
  const { lessonId = '', locationId = '' } = useParams()
  const lesson = getLessonDef(lessonId)
  const def = getLocation(locationId)
  const location = useMemo(() => (def ? resolveLocation(def) : null), [def])
  if (!lesson) return <Navigate to="/lessons" replace />
  if (!location) return <Navigate to="/map" replace />
  // Remount the whole simulator when the lesson or place changes.
  return <Flight key={`${location.def.id}/${lesson.id}`} lessonId={lesson.id} location={location} />
}

function Flight({ lessonId, location }: { lessonId: string; location: ResolvedLocation }) {
  const lesson = getLessonDef(lessonId)!
  const locationId = location.def.id
  const { learner } = useLearner()
  const containerRef = useRef<HTMLDivElement>(null)
  const simRef = useRef<Simulator | null>(null)
  const toastId = useRef(0)
  const learnerId = learner?.id

  const [hud, setHud] = useState<HudState | null>(null)
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [help, setHelp] = useState(false)
  const [result, setResult] = useState<ResultInfo | null>(null)
  const [webglOk] = useState(canUseWebGL)
  const [meta, setMeta] = useState<LessonMeta[]>([])

  useEffect(() => {
    api
      .lessons()
      .then(setMeta)
      .catch(() => setMeta([]))
  }, [])
  const passScore = meta.find((m) => m.id === lessonId)?.passScore ?? lesson.passScore

  const pushToast = useCallback((t: ToastMessage) => {
    const id = ++toastId.current
    setToasts((list) => [...list.slice(-3), { ...t, id }])
    window.setTimeout(() => setToasts((list) => list.filter((x) => x.id !== id)), 4200)
  }, [])

  // Keep the latest values available to the simulator's long-lived callbacks.
  const latest = useRef({ passScore, learnerId, pushToast })
  useEffect(() => {
    latest.current = { passScore, learnerId, pushToast }
  })

  useEffect(() => {
    const container = containerRef.current
    if (!container || !webglOk) return
    const sim = new Simulator(container, lesson, location, {
      onHud: setHud,
      onToast: (t) => latest.current.pushToast(t),
      onMedia: async (media) => {
        const { learnerId: id, pushToast: toast } = latest.current
        if (!id) return
        try {
          await api.uploadMedia(id, media.blob, {
            lessonId,
            locationId,
            durationSec: media.durationSec,
          })
          toast({
            kind: 'info',
            text: `${media.kind === 'photo' ? 'Photo' : 'Video'} saved to Gallery`,
          })
        } catch (e) {
          toast({ kind: 'error', text: e instanceof Error ? e.message : 'Upload failed' })
        }
      },
      onFinish: (info: FinishInfo) => {
        const { passScore: pass, learnerId: id } = latest.current
        const crashed = info.outcome === 'crashed'
        const passed = !crashed && info.score >= pass
        setResult({
          ...info,
          passed,
          passScore: pass,
          crashReason: info.crashReason ?? null,
          saved: 'saving',
        })
        if (!id) return
        api
          .saveAttempt(id, {
            lessonId,
            locationId,
            score: info.score,
            passed,
            crashed,
            durationSec: info.durationSec,
            metrics: info.metrics,
          })
          .then(() => setResult((r) => (r ? { ...r, saved: 'saved' } : r)))
          .catch(() => setResult((r) => (r ? { ...r, saved: 'error' } : r)))
      },
    })
    simRef.current = sim
    return () => {
      sim.dispose()
      simRef.current = null
    }
  }, [lesson, lessonId, location, locationId, webglOk])

  const status = hud?.status
  const statusRef = useRef(status)
  useEffect(() => {
    statusRef.current = status
  })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'KeyH' && !e.repeat && statusRef.current !== 'briefing') setHelp((h) => !h)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const retry = () => simRef.current?.reset()
  const currentIndex = LESSONS.findIndex((l) => l.id === lessonId)
  const nextLessonId = LESSONS[currentIndex + 1]?.id ?? null
  const nextHref = nextLessonId ? `/fly/${locationId}/${nextLessonId}` : null

  if (!webglOk) {
    return (
      <div className="center-card">
        <h2>Simulator could not start</h2>
        <p className="muted">
          This browser or device does not support WebGL, which the 3D simulator needs. Try a recent
          version of Chrome, Edge or Firefox with hardware acceleration enabled.
        </p>
      </div>
    )
  }

  return (
    <div className="flight">
      <div className="viewport" ref={containerRef} />
      {hud && <Hud hud={hud} title={lesson.title} toasts={toasts} />}
      {hud?.status === 'briefing' && (
        <Briefing
          lesson={lesson}
          location={location}
          map={hud.mapTiles}
          mapMode={hud.mapMode}
          onStart={() => simRef.current?.begin()}
        />
      )}
      {hud?.status === 'paused' && (
        <Paused onResume={() => simRef.current?.togglePause()} onRestart={retry} />
      )}
      {help && hud?.status !== 'briefing' && <HelpOverlay onClose={() => setHelp(false)} />}
      {result && (hud?.status === 'complete' || hud?.status === 'failed') && (
        <Result info={result} nextHref={nextHref} onRetry={retry} />
      )}
    </div>
  )
}
