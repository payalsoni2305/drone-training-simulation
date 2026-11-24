import express from 'express'

const MIN_ZOOM = 0
const MAX_ZOOM = 19

/**
 * Satellite tile proxy. Nothing is stored on the server's disk.
 *
 *  - The browser never talks to the imagery provider directly (no CORS issues, and the
 *    provider URL stays in server config).
 *  - Tiles are streamed straight through. The browser's own HTTP cache (Cache-Control) keeps
 *    repeat visits fast.
 *
 * @param {{ urlTemplate: string, fetchImpl?: typeof fetch }} opts
 */
export function createTilesRouter({ urlTemplate, fetchImpl = fetch }) {
  const router = express.Router()

  const upstreamUrl = (z, x, y) =>
    urlTemplate.replace('{z}', String(z)).replace('{x}', String(x)).replace('{y}', String(y))

  async function download(z, x, y) {
    const res = await fetchImpl(upstreamUrl(z, x, y), { signal: AbortSignal.timeout(15_000) })
    const type = res.headers.get('content-type') ?? ''
    if (!res.ok || !type.startsWith('image/')) {
      throw new Error(`Tile provider answered ${res.status}`)
    }
    return { bytes: Buffer.from(await res.arrayBuffer()), type }
  }

  router.get('/:z/:x/:y', async (req, res) => {
    const z = Number(req.params.z)
    const x = Number(req.params.x)
    const y = Number(req.params.y)
    const max = 2 ** z
    const valid =
      Number.isInteger(z) &&
      Number.isInteger(x) &&
      Number.isInteger(y) &&
      z >= MIN_ZOOM &&
      z <= MAX_ZOOM &&
      x >= 0 &&
      y >= 0 &&
      x < max &&
      y < max
    if (!valid) return res.status(400).json({ error: 'Invalid tile coordinates' })

    const key = `${z}/${x}/${y}`
    try {
      const { bytes, type } = await download(z, x, y)
      res.set('Cache-Control', 'public, max-age=86400')
      res.type(type)
      res.send(bytes)
    } catch (err) {
      console.error(`Tile ${key} failed:`, err.message)
      res.status(502).json({ error: 'Map tile unavailable' })
    }
  })

  return router
}
