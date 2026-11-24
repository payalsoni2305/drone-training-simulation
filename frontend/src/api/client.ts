export interface Learner {
  id: string
  name: string
  createdAt: string
}

export interface LessonMeta {
  id: string
  order: number
  track: string
  title: string
  summary: string
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  parSeconds: number
  passScore: number
}

export interface LessonProgress {
  lessonId: string
  attempts: number
  bestScore: number | null
  completed: boolean
  lastAttemptAt: string | null
}

export interface MediaItem {
  id: string
  locationId: string | null
  kind: 'photo' | 'video'
  mimeType: string
  url: string
  sizeBytes: number
  lessonId: string | null
  durationSec: number | null
  createdAt: string
}

export interface AttemptInput {
  lessonId: string
  locationId?: string
  score: number
  passed: boolean
  crashed: boolean
  durationSec: number
  metrics: Record<string, number>
}

export interface Attempt extends AttemptInput {
  id: string
  createdAt: string
}

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(`/api${path}`, init)
  } catch {
    throw new ApiError(0, 'Cannot reach the server. Is the backend running on port 4000?')
  }
  if (res.status === 204) return undefined as T
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(res.status, body.error ?? `Request failed (${res.status})`)
  return body as T
}

const json = (method: string, data: unknown): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data),
})

export const api = {
  lessons: () => request<{ lessons: LessonMeta[] }>('/lessons').then((r) => r.lessons),

  createLearner: (name: string) =>
    request<{ learner: Learner }>('/learners', json('POST', { name })).then((r) => r.learner),

  getLearner: (id: string) =>
    request<{ learner: Learner }>(`/learners/${id}`).then((r) => r.learner),

  progress: (id: string) =>
    request<{ progress: LessonProgress[] }>(`/learners/${id}/progress`).then((r) => r.progress),

  attempts: (id: string) =>
    request<{ attempts: Attempt[] }>(`/learners/${id}/attempts`).then((r) => r.attempts),

  saveAttempt: (id: string, attempt: AttemptInput) =>
    request<{ attempt: Attempt }>(`/learners/${id}/attempts`, json('POST', attempt)).then(
      (r) => r.attempt,
    ),

  media: (id: string) =>
    request<{ media: MediaItem[] }>(`/learners/${id}/media`).then((r) => r.media),

  uploadMedia: (
    id: string,
    blob: Blob,
    meta: { lessonId?: string; locationId?: string; durationSec?: number },
  ) => {
    const form = new FormData()
    if (meta.lessonId) form.append('lessonId', meta.lessonId)
    if (meta.locationId) form.append('locationId', meta.locationId)
    if (meta.durationSec !== undefined) form.append('durationSec', String(meta.durationSec))
    const ext = blob.type.includes('video') ? 'webm' : 'jpg'
    form.append('file', blob, `capture.${ext}`)
    return request<{ media: MediaItem }>(`/learners/${id}/media`, {
      method: 'POST',
      body: form,
    }).then((r) => r.media)
  },

  deleteMedia: (id: string, mediaId: string) =>
    request<void>(`/learners/${id}/media/${mediaId}`, { method: 'DELETE' }),
}
