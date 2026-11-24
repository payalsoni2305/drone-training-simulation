import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createApp } from '../src/app.js'

let dir
let app
let learnerId

beforeAll(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dronesim-'))
  app = createApp({ dataDir: dir, logger: false }).app
  const res = await request(app).post('/api/learners').send({ name: 'Payal' })
  learnerId = res.body.learner.id
})

afterAll(() => fs.rmSync(dir, { recursive: true, force: true }))

describe('API', () => {
  it('reports health', async () => {
    const res = await request(app).get('/api/health')
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })

  it('lists lessons in order', async () => {
    const res = await request(app).get('/api/lessons')
    expect(res.body.lessons[0].id).toBe('first-flight')
    expect(res.body.lessons.length).toBeGreaterThanOrEqual(5)
  })

  it('validates learner names', async () => {
    const res = await request(app).post('/api/learners').send({ name: '   ' })
    expect(res.status).toBe(400)
  })

  it('404s for unknown learners', async () => {
    const res = await request(app).get('/api/learners/not-an-id/progress')
    expect(res.status).toBe(404)
  })

  it('records attempts and computes progress', async () => {
    const base = `/api/learners/${learnerId}`
    const fail = await request(app)
      .post(`${base}/attempts`)
      .send({ lessonId: 'first-flight', score: 40, passed: true, durationSec: 80 })
    // score under the pass mark is never a pass, whatever the client says
    expect(fail.body.attempt.passed).toBe(false)

    await request(app)
      .post(`${base}/attempts`)
      .send({ lessonId: 'first-flight', score: 88, passed: true, durationSec: 70 })

    const progress = await request(app).get(`${base}/progress`)
    const first = progress.body.progress.find((p) => p.lessonId === 'first-flight')
    expect(first).toMatchObject({ attempts: 2, bestScore: 88, completed: true })
  })

  it('rejects attempts for unknown lessons', async () => {
    const res = await request(app)
      .post(`/api/learners/${learnerId}/attempts`)
      .send({ lessonId: 'nope', score: 90, passed: true, durationSec: 10 })
    expect(res.status).toBe(400)
  })

  it('uploads, lists, serves and deletes media', async () => {
    const base = `/api/learners/${learnerId}/media`
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64',
    )
    const up = await request(app)
      .post(base)
      .field('lessonId', 'camera-basics')
      .attach('file', png, { filename: 'x.png', contentType: 'image/png' })
    expect(up.status).toBe(201)
    expect(up.body.media.kind).toBe('photo')

    const file = await request(app).get(up.body.media.url)
    expect(file.status).toBe(200)

    const list = await request(app).get(base)
    expect(list.body.media).toHaveLength(1)

    const del = await request(app).delete(`${base}/${up.body.media.id}`)
    expect(del.status).toBe(204)
    expect((await request(app).get(base)).body.media).toHaveLength(0)
  })

  it('rejects unsupported media types', async () => {
    const res = await request(app)
      .post(`/api/learners/${learnerId}/media`)
      .attach('file', Buffer.from('hi'), { filename: 'x.txt', contentType: 'text/plain' })
    expect(res.status).toBe(415)
  })
})
