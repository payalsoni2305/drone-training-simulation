import { config } from './config.js'
import { createApp } from './app.js'

const { app } = createApp({
  dataDir: config.dataDir,
  corsOrigins: config.corsOrigins,
  maxUploadMb: config.maxUploadMb,
  tileUrl: config.tileUrl,
  staticDir: config.staticDir,
})

const server = app.listen(config.port, () => {
  console.log(`Drone Sim API listening on http://localhost:${config.port}`)
})

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => process.exit(0)))
}
