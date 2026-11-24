export interface ControlHelp {
  keys: string[]
  action: string
  group: 'Fly' | 'Camera' | 'System'
}

/** Single source of truth for the on-screen key guide. Mirrors sim/input.ts. */
export const CONTROL_HELP: ControlHelp[] = [
  { group: 'Fly', keys: ['Space'], action: 'Hold to arm / disarm motors' },
  { group: 'Fly', keys: ['W', 'S'], action: 'Climb / descend' },
  { group: 'Fly', keys: ['A', 'D'], action: 'Turn (yaw) left / right' },
  { group: 'Fly', keys: ['↑', '↓'], action: 'Move forward / backward (or I / K)' },
  { group: 'Fly', keys: ['←', '→'], action: 'Move left / right (or J / L)' },
  { group: 'Camera', keys: ['R', 'F'], action: 'Tilt camera up / down' },
  { group: 'Camera', keys: ['Z', 'X'], action: 'Zoom in / out' },
  { group: 'Camera', keys: ['C'], action: 'Switch chase view / drone camera' },
  { group: 'Camera', keys: ['P'], action: 'Take a photo' },
  { group: 'Camera', keys: ['V'], action: 'Start / stop video recording' },
  { group: 'System', keys: ['Esc'], action: 'Pause' },
  { group: 'System', keys: ['Backspace'], action: 'Restart the lesson' },
  { group: 'System', keys: ['M'], action: 'Mute sound' },
  { group: 'System', keys: ['H'], action: 'Show / hide this guide' },
]

export function formatTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
