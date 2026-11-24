import { createContext, useContext } from 'react'
import type { Learner } from '../api/client'

export interface LearnerState {
  learner: Learner | null
  loading: boolean
  /** Set when the saved pilot could not be loaded because the server is unreachable. */
  error: string | null
  signIn: (name: string) => Promise<void>
  signOut: () => void
  retry: () => void
}

export const LearnerContext = createContext<LearnerState | null>(null)

export function useLearner(): LearnerState {
  const ctx = useContext(LearnerContext)
  if (!ctx) throw new Error('useLearner must be used inside <LearnerProvider>')
  return ctx
}
