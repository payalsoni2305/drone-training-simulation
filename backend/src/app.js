import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import multer from 'multer'
import { z, ZodError } from 'zod'
import { LESSONS, getLesson } from './lessons.js'
import { Store } from './store.js'
import { createTilesRouter } from './tiles.js'

const MEDIA_TYPES = {
  'image/jpeg': { kind: 'photo', ext: 'jpg' },
  'image/png': { kind: 'photo', ext: 'png' },
  'video/webm': { kind: 'video', ext: 'webm' },
  'video/mp4': { kind: 'video', ext: 'mp4' },
}

const idSchema = z.uuid()

const learnerSchema = z.object({ name: z.string().trim().min(1).max(60) })

const attemptSchema = z.object({
  lessonId: z.string(),
  locationId: z.string().max(40).optional(),
  score: z.number().int().min(0).max(100),
  passed: z.boolean(),
  crashed: z.boolean().default(false),
  durationSec: z
    .number()
    .min(0)
    .max(60 * 60),
  metrics: z.record(z.string(), z.union([z.number(), z.string(), z.boolean()])).default({}),
})

const mediaMetaSchema = z.object({
  lessonId: z.string().max(60).optional(),
  locationId: z.string().max(40).optional(),
  durationSec: z.coerce
    .number()
    .min(0)
    .max(60 * 60)
    .optional(),
})

class HttpError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

/**
 * @param {{
 *   dataDir: string,
 *   corsOrigins?: string[],
 *   maxUploadMb?: number,
 *   logger?: boolean,
 *   tileUrl?: string,
 *   fetchImpl?: typeof fetch,
 *   staticDir?: string,
 * }} opts
 */
export function createApp({
  dataDir,
  corsOrigins = [],
  maxUploadMb = 100,
  logger = true,
  tileUrl = '',
  fetchImpl,
  staticDir = '',
}) {
  const store = new Store(dataDir)
  const app = express()

  app.disable('x-powered-by')
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      // The page loads CesiumJS (web workers, WebAssembly, 3D tiles over https) and records
      // video from a canvas, so those need explicit permission. Everything else is same-origin.
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'wasm-unsafe-eval'", 'blob:'],
          workerSrc: ["'self'", 'blob:'],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
          mediaSrc: ["'self'", 'blob:'],
          fontSrc: ["'self'", 'data:'],
          connectSrc: ["'self'", 'https:', 'data:', 'blob:'],
          objectSrc: ["'none'"],
          upgradeInsecureRequests: null,
        },
      },
    }),
  )
  app.use(cors({ origin: corsOrigins }))
  if (logger) app.use(morgan('dev'))
  app.use(express.json({ limit: '100kb' }))

  // Recorded media. Filenames are random UUIDs, so they are not guessable.
  app.use('/media', express.static(store.mediaDir, { fallthrough: false, index: false }))

  const api = express.Router()

  api.get('/health', (_req, res) => {
    res.json({ ok: true, service: 'drone-sim-backend', time: new Date().toISOString() })
  })

  api.use('/tiles', createTilesRouter({ urlTemplate: tileUrl, fetchImpl }))

  api.get('/lessons', (_req, res) => {
    res.json({ lessons: LESSONS })
  })

  api.post('/learners', (req, res) => {
    const { name } = learnerSchema.parse(req.body)
    res.status(201).json({ learner: store.createLearner(name) })
  })

  // Everything below is scoped to an existing learner.
  const learnerRouter = express.Router({ mergeParams: true })
  api.use(
    '/learners/:learnerId',
    (req, _res, next) => {
      const parsed = idSchema.safeParse(req.params.learnerId)
      const learner = parsed.success ? store.getLearner(parsed.data) : null
      if (!learner) return next(new HttpError(404, 'Learner not found'))
      req.learner = learner
      next()
    },
    learnerRouter,
  )

  learnerRouter.get('/', (req, res) => {
    res.json({ learner: req.learner })
  })

  learnerRouter.get('/progress', (req, res) => {
    res.json({ progress: store.progress(req.learner.id, LESSONS) })
  })

  learnerRouter.post('/attempts', (req, res) => {
    const body = attemptSchema.parse(req.body)
    const lesson = getLesson(body.lessonId)
    if (!lesson) throw new HttpError(400, `Unknown lesson "${body.lessonId}"`)
    // The server decides whether a score is a pass.
    const passed = body.passed && !body.crashed && body.score >= lesson.passScore
    const attempt = store.addAttempt(req.learner.id, { ...body, passed })
    res.status(201).json({ attempt })
  })

  learnerRouter.get('/attempts', (req, res) => {
    res.json({ attempts: store.listAttempts(req.learner.id).reverse() })
  })

  // --- Media (photos & videos captured in the simulator) ---
  const upload = multer({
    storage: multer.diskStorage({
      destination: (req, _file, cb) => {
        const dir = path.join(store.mediaDir, req.learner.id)
        fs.mkdirSync(dir, { recursive: true })
        cb(null, dir)
      },
      filename: (req, file, cb) => {
        const type = MEDIA_TYPES[file.mimetype]
        req.mediaId = crypto.randomUUID()
        cb(null, `${req.mediaId}.${type.ext}`)
      },
    }),
    limits: { fileSize: maxUploadMb * 1024 * 1024, files: 1 },
    fileFilter: (_req, file, cb) => {
      if (MEDIA_TYPES[file.mimetype]) return cb(null, true)
      cb(new HttpError(415, 'Only JPEG/PNG photos and WebM/MP4 videos are allowed'))
    },
  })

  learnerRouter.post('/media', upload.single('file'), (req, res) => {
    if (!req.file) throw new HttpError(400, 'Missing "file" field')
    const meta = mediaMetaSchema.parse(req.body)
    const type = MEDIA_TYPES[req.file.mimetype]
    const media = store.addMedia({
      id: req.mediaId,
      learnerId: req.learner.id,
      kind: type.kind,
      mimeType: req.file.mimetype,
      filename: req.file.filename,
      sizeBytes: req.file.size,
      lessonId: meta.lessonId ?? null,
      locationId: meta.locationId ?? null,
      durationSec: meta.durationSec ?? null,
    })
    res.status(201).json({ media: withUrl(media) })
  })

  learnerRouter.get('/media', (req, res) => {
    res.json({ media: store.listMedia(req.learner.id).map(withUrl) })
  })

  learnerRouter.delete('/media/:mediaId', (req, res) => {
    const id = idSchema.safeParse(req.params.mediaId)
    if (!id.success || !store.deleteMedia(req.learner.id, id.data)) {
      throw new HttpError(404, 'Media not found')
    }
    res.status(204).end()
  })

  app.use('/api', api)

  // Production: serve the built web app from the same server (one deployable service).
  if (staticDir && fs.existsSync(path.join(staticDir, 'index.html'))) {
    app.use(express.static(staticDir, { index: false, maxAge: '1h' }))
    app.get(/^\/(?!api\/|media\/).*/, (_req, res) => {
      res.sendFile(path.join(staticDir, 'index.html'))
    })
  }

  app.use((_req, _res, next) => next(new HttpError(404, 'Not found')))

  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    if (err instanceof ZodError) {
      return res.status(400).json({ error: 'Invalid request', details: z.flattenError(err) })
    }
    if (err instanceof multer.MulterError) {
      const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400
      return res.status(status).json({ error: err.message })
    }
    if (err instanceof SyntaxError && 'body' in err) {
      return res.status(400).json({ error: 'Malformed JSON' })
    }
    const status = err.status ?? 500
    if (status >= 500) console.error(err)
    res.status(status).json({ error: status >= 500 ? 'Internal server error' : err.message })
  })

  return { app, store }
}

function withUrl(media) {
  return { ...media, url: `/media/${media.learnerId}/${media.filename}` }
}
