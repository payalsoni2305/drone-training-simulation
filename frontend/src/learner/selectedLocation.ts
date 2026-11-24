import { useSyncExternalStore } from 'react'
import { getLocation } from '../sim/locations'
import type { LocationDef } from '../sim/locations'

const KEY = 'drone-sim:location'
const listeners = new Set<() => void>()

function read(): string | null {
  return localStorage.getItem(KEY)
}

function subscribe(callback: () => void) {
  listeners.add(callback)
  window.addEventListener('storage', callback)
  return () => {
    listeners.delete(callback)
    window.removeEventListener('storage', callback)
  }
}

export function setSelectedLocationId(id: string) {
  localStorage.setItem(KEY, id)
  listeners.forEach((l) => l())
}

/** The place the learner picked on the India map (remembered across visits). */
export function useSelectedLocation(): LocationDef | null {
  const id = useSyncExternalStore(subscribe, read, () => null)
  return getLocation(id) ?? null
}
