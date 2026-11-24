import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createApp } from '../src/app.js'

let dir
let app

beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dronesim-static-'))
  const web = path.join(dir, 'web')
  fs.mkdirSync(path.join(web, 'assets'), { recursive: true })
  fs.writeFileSync(path.join(web, 'index.html'), '<!doctype html><title>Sim</title>')
  fs.writeFileSync(path.join(web, 'assets', 'app.js'), 'console.log(1)')
  app = createApp({ dataDir: path.join(dir, 'data'), logger: false, staticDir: web }).app
})

afterAll(() => fs.rmSync(dir, { recursive: true, force: true }))

describe('serving the built web app', () => {
  it('serves index.html at the root and for client-side routes', async () => {
    for (const url of ['/', '/map', '/fly/agra/first-flight']) {
      const res = await request(app).get(url)
      expect(res.status, url).toBe(200)
      expect(res.text).toContain('<title>Sim</title>')
    }
  })

  it('serves static assets', async () => {
    const res = await request(app).get('/assets/app.js')
    expect(res.status).toBe(200)
    expect(res.text).toBe('console.log(1)')
  })

  it('keeps API and media misses as JSON 404s, not the web app', async () => {
    const api = await request(app).get('/api/nope')
    expect(api.status).toBe(404)
    expect(api.body.error).toBeDefined()
    const media = await request(app).get('/media/x/y.jpg')
    expect(media.status).toBe(404)
  })

  it('sends a content security policy that allows Cesium workers', async () => {
    const res = await request(app).get('/')
    expect(res.headers['content-security-policy']).toMatch(/worker-src 'self' blob:/)
    expect(res.headers['content-security-policy']).toMatch(/script-src [^;]*'unsafe-eval'/)
    expect(res.headers['content-security-policy']).not.toMatch(/upgrade-insecure-requests/)
  })
})
