import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

/**
 * Tiny JSON-file store. Plenty for a single-learner demo; the surface is kept
 * small on purpose so it can be swapped for Postgres/SQLite later without
 * touching the routes.
 */
export class Store {
  /** @param {string} dataDir */
  constructor(dataDir) {
    this.dataDir = dataDir
    this.mediaDir = path.join(dataDir, 'media')
    this.file = path.join(dataDir, 'db.json')
    fs.mkdirSync(this.mediaDir, { recursive: true })
    this.db = { learners: {}, attempts: [], media: [] }
    if (fs.existsSync(this.file)) {
      this.db = { ...this.db, ...JSON.parse(fs.readFileSync(this.file, 'utf8')) }
    }
  }

  save() {
    // Write-then-rename so a crash never leaves a half-written file.
    const tmp = `${this.file}.tmp`
    fs.writeFileSync(tmp, JSON.stringify(this.db, null, 2))
    fs.renameSync(tmp, this.file)
  }

  createLearner(name) {
    const learner = { id: crypto.randomUUID(), name, createdAt: new Date().toISOString() }
    this.db.learners[learner.id] = learner
    this.save()
    return learner
  }

  getLearner(id) {
    return this.db.learners[id] ?? null
  }

  addAttempt(learnerId, data) {
    const attempt = {
      id: crypto.randomUUID(),
      learnerId,
      createdAt: new Date().toISOString(),
      ...data,
    }
    this.db.attempts.push(attempt)
    this.save()
    return attempt
  }

  listAttempts(learnerId) {
    return this.db.attempts.filter((a) => a.learnerId === learnerId)
  }

  /** Per-lesson summary: best score, attempts, completion. */
  progress(learnerId, lessons) {
    const attempts = this.listAttempts(learnerId)
    return lessons.map((lesson) => {
      const mine = attempts.filter((a) => a.lessonId === lesson.id)
      const best = mine.reduce((m, a) => Math.max(m, a.score), 0)
      return {
        lessonId: lesson.id,
        attempts: mine.length,
        bestScore: mine.length ? best : null,
        completed: mine.some((a) => a.passed),
        lastAttemptAt: mine.length ? mine[mine.length - 1].createdAt : null,
      }
    })
  }

  addMedia(item) {
    const media = { createdAt: new Date().toISOString(), ...item }
    this.db.media.push(media)
    this.save()
    return media
  }

  listMedia(learnerId) {
    return this.db.media
      .filter((m) => m.learnerId === learnerId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  getMedia(learnerId, mediaId) {
    return this.db.media.find((m) => m.learnerId === learnerId && m.id === mediaId) ?? null
  }

  deleteMedia(learnerId, mediaId) {
    const media = this.getMedia(learnerId, mediaId)
    if (!media) return false
    this.db.media = this.db.media.filter((m) => m !== media)
    this.save()
    fs.rmSync(path.join(this.mediaDir, media.learnerId, media.filename), { force: true })
    return true
  }
}
