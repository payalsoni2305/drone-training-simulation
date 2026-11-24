# Backend (Express)

REST API for the Drone Training Simulator.

```bash
npm install
cp .env.example .env
npm run dev     # node --watch, http://localhost:4000
npm test
```

Data is stored in `data/db.json` and `data/media/` (git-ignored). The storage layer is in `src/store.js` and is intentionally small so it can be replaced by a database later.

## Endpoints (all under `/api`)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | Health check |
| GET | `/lessons` | Lesson catalog |
| POST | `/learners` | Create a pilot `{ name }` |
| GET | `/learners/:id` | Get a pilot |
| GET | `/learners/:id/progress` | Best score, attempts and completion per lesson |
| POST | `/learners/:id/attempts` | Save a flight result. The server decides pass/fail from the pass mark |
| GET | `/learners/:id/attempts` | List attempts, newest first |
| POST | `/learners/:id/media` | Upload a photo (JPEG/PNG) or video (WebM/MP4), multipart field `file` |
| GET | `/learners/:id/media` | List captures |
| DELETE | `/learners/:id/media/:mediaId` | Delete a capture |
| GET | `/tiles/:z/:x/:y` | Satellite map tile (zoom 0–19). Streamed from `TILE_URL`; nothing is stored on disk |

Uploaded files are served from `/media/<learnerId>/<file>`.

## Notes

- Phase 1 has no authentication. A pilot is identified by an unguessable UUID. Add real accounts before any public deployment.
- Config via `.env`: `PORT`, `DATA_DIR`, `CORS_ORIGINS`, `MAX_UPLOAD_MB`, `TILE_URL` (tile template with `{z}`, `{x}`, `{y}`; defaults to Esri World Imagery, check its terms for commercial use).
- The tile provider is server configuration only and the URL template is fixed, so clients cannot make the server fetch arbitrary addresses.
