import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createApp } from '../src/app.js'

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0xff, 0xd9])

let dir
let app
const calls = []

const fakeFetch = vi.fn(async (url) => {
  calls.push(url)
  if (url.includes('/99/')) return new Response('nope', { status: 404 })
  return new Response(JPEG, { status: 200, headers: { 'content-type': 'image/jpeg' } })
})

beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dronesim-tiles-'))
  app = createApp({
    dataDir: dir,
    logger: false,
    tileUrl: 'https://tiles.test/{z}/{y}/{x}.jpg',
    fetchImpl: fakeFetch,
  }).app
})

afterAll(() => fs.rmSync(dir, { recursive: true, force: true }))

describe('tile proxy', () => {
  it('streams a tile from the provider and stores nothing on disk', async () => {
    const first = await request(app).get('/api/tiles/18/110100/187460')
    expect(first.status).toBe(200)
    expect(first.headers['content-type']).toMatch(/image\/jpeg/)
    expect(first.headers['cache-control']).toMatch(/max-age/)

    expect(fs.existsSync(path.join(dir, 'tiles'))).toBe(false)
    // The template order is {z}/{y}/{x}
    expect(calls[0]).toBe('https://tiles.test/18/187460/110100.jpg')
  })

  it('rejects out-of-range or malformed coordinates', async () => {
    for (const p of ['/18/-1/5', '/18/abc/5', '/18/999999999/5', '/25/1/1']) {
      const res = await request(app).get(`/api/tiles${p}`)
      expect(res.status, p).toBe(400)
    }
  })

  it('answers 502 when the provider has no tile', async () => {
    const res = await request(app).get('/api/tiles/19/1/1').query({})
    expect(res.status).toBe(200)
    const bad = createApp({
      dataDir: dir,
      logger: false,
      tileUrl: 'https://tiles.test/99/{z}/{y}/{x}',
      fetchImpl: fakeFetch,
    }).app
    const miss = await request(bad).get('/api/tiles/18/3/3')
    expect(miss.status).toBe(502)
  })
})
