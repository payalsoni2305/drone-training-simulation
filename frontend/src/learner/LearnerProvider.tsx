import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { api, ApiError } from '../api/client'
import type { Learner } from '../api/client'
import { LearnerContext } from './context'

const STORAGE_KEY = 'drone-sim:learner-id'

export function LearnerProvider({ children }: { children: ReactNode }) {
  const [learner, setLearner] = useState<Learner | null>(null)
  // Only "loading" if there is a saved pilot to look up.
  const [loading, setLoading] = useState(() => localStorage.getItem(STORAGE_KEY) !== null)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const id = localStorage.getItem(STORAGE_KEY)
    if (!id) return
    let cancelled = false
    api
      .getLearner(id)
      .then((l) => {
        if (!cancelled) setLearner(l)
      })
      .catch((e: unknown) => {
        if (cancelled) return
        if (e instanceof ApiError && e.status === 404) localStorage.removeItem(STORAGE_KEY)
        else setError(e instanceof Error ? e.message : 'Could not load pilot')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [attempt])

  const signIn = useCallback(async (name: string) => {
    const created = await api.createLearner(name)
    localStorage.setItem(STORAGE_KEY, created.id)
    setLearner(created)
  }, [])

  const signOut = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    setLearner(null)
  }, [])

  const retry = useCallback(() => {
    setError(null)
    setLoading(true)
    setAttempt((n) => n + 1)
  }, [])

  const value = useMemo(
    () => ({ learner, loading, error, signIn, signOut, retry }),
    [learner, loading, error, signIn, signOut, retry],
  )
  return <LearnerContext.Provider value={value}>{children}</LearnerContext.Provider>
}
