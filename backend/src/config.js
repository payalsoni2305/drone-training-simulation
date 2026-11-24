import path from 'node:path'
import { fileURLToPath } from 'node:url'
import 'dotenv/config'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

export const config = {
  port: Number(process.env.PORT ?? 4000),
  dataDir: path.resolve(root, process.env.DATA_DIR ?? 'data'),
  corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:5173,http://127.0.0.1:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  // Satellite imagery provider. {z}/{x}/{y} are replaced per tile. The default is Esri World
  // Imagery, which requires attribution (shown in the app). Check Esri's terms for commercial use,
  // or point this at Mapbox / MapTiler / Bing with your own key.
  tileUrl:
    process.env.TILE_URL ??
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  maxUploadMb: Number(process.env.MAX_UPLOAD_MB ?? 100),
  // Built frontend, served by Express when it exists (production).
  staticDir: path.resolve(root, process.env.STATIC_DIR ?? '../frontend/dist'),
}
