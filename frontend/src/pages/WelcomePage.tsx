import { useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useLearner } from '../learner/context'

export default function WelcomePage() {
  const { learner, loading, error, signIn, retry } = useLearner()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  if (loading) return <p className="center-note">Loading…</p>
  if (learner) return <Navigate to="/map" replace />

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setBusy(true)
    setFormError(null)
    try {
      await signIn(name.trim())
      navigate('/map')
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="welcome">
      <div className="welcome-copy">
        <p className="eyebrow">One-on-one flight training</p>
        <h1>Learn to fly a drone, and capture the shot.</h1>
        <p className="lead">
          A guided simulator that teaches takeoff, hovering, navigation, landing and aerial photo
          and video, entirely with your keyboard. Crash as often as you like. Nothing breaks.
        </p>
        <ul className="bullets">
          <li>Step-by-step lessons with live coaching and scoring</li>
          <li>
            Fly over real India: satellite imagery of Delhi, Agra, Mumbai, Jaipur and Bengaluru
          </li>
          <li>Your progress and captures are saved to your pilot log</li>
        </ul>
      </div>
      <form className="panel" onSubmit={submit}>
        <h2>Start training</h2>
        <label htmlFor="pilot-name">Pilot name</label>
        <input
          id="pilot-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Your Name"
          maxLength={60}
          autoFocus
        />
        {(formError || error) && <p className="error">{formError ?? error}</p>}
        <button className="btn primary" disabled={busy || !name.trim()}>
          {busy ? 'Creating…' : 'Begin'}
        </button>
        {error && (
          <button type="button" className="btn ghost" onClick={retry}>
            Retry connection
          </button>
        )}
      </form>
    </div>
  )
}
