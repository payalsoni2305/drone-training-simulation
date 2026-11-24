# Frontend (React + CesiumJS + Three.js)

```bash
npm install
npm run dev      # http://localhost:5173 (proxies /api and /media to the backend on :4000)
npm test         # physics, framing and lesson tests
npm run build
```

## Layout

```
src/sim/        Simulator engine (no React): physics, keyboard input, camera framing,
                lessons and scoring, Three.js world, drone model, audio, Simulator class
src/pages/      Welcome, Map (India), Lessons, Flight, Gallery
src/data/       India outline for the map screen (generated from datameet boundary)
src/components/ HUD, overlays, key guide, layout
src/api/        Typed client for the Express API
src/learner/    Pilot context (kept in localStorage)
```

To add a place: add an entry to `LOCATIONS` in `src/sim/locations.ts` (pad and landmark lat/lon, subjects, optional collision parts) and a model in `src/sim/landmarkModels.ts`; `npm test` checks its layout. The India map pin needs no extra code.

To add a lesson: add it to `backend/src/lessons.js` (catalog) and `src/sim/lessons.ts` (objectives), using the same `id`.
