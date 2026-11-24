# Drone Training Simulator

A one-on-one training simulator that teaches people to fly a drone and capture aerial photos and video, controlled entirely with the keyboard.

Longer term it grows into three tracks: Pilot Training, Surveillance & Reconnaissance, and Tactical Range Training (simulated). See [PLAN.md](./PLAN.md) for the full vision.

## Status: Phase 1, "Fly and Capture"

- Fly over **real India**: pick a place on an India map (New Delhi, Agra, Mumbai, Jaipur, Bengaluru) and fly over the real world drawn by CesiumJS: real 3D buildings and terrain with a free Cesium ion token, or satellite imagery without one
- 5 guided lessons: first flight, waypoint navigation, photo basics, video recording, aerial survey (every lesson works at every location)
- Keyboard flight controls, chase and drone-camera views, gimbal and zoom
- Photo and video capture saved to a gallery, scoring and a pilot log

Details, demo script and roadmap: [docs/PHASE-1-AND-ROADMAP.md](./docs/PHASE-1-AND-ROADMAP.md)

## Structure

```
frontend/   React + TypeScript + Vite + CesiumJS (real world) + Three.js (drone and overlay)
backend/    Node.js + Express API (pilots, attempts, media uploads)
docs/       Phase plans and roadmap
```

## Run it

Requires Node.js 22+.

```bash
npm run install:all   # first time only
npm run dev           # API on http://localhost:4000, app on http://localhost:5173
npm test              # backend and frontend tests
```

The real world is drawn by CesiumJS. For real terrain, sharp aerial imagery and 3D buildings, create a free token at [ion.cesium.com](https://ion.cesium.com) (Access Tokens > Default Token), then copy `frontend/.env.example` to `frontend/.env` and set `VITE_CESIUM_ION_TOKEN`. Without a token the simulator falls back to Esri satellite imagery, streamed through the backend. Nothing is stored on disk, so internet is needed while flying.

## Keyboard controls

| Key | Action |
|-----|--------|
| `Space` (hold) | Arm / disarm |
| `W` / `S` | Climb / descend |
| `A` / `D` | Turn left / right |
| Arrow keys (or `I J K L`) | Move forward, back, left, right |
| `R` / `F` | Camera tilt up / down |
| `Z` / `X` | Zoom in / out |
| `C` | Chase view / drone camera |
| `P` / `V` | Photo / start-stop video |
| `Esc`, `Backspace`, `M`, `H` | Pause, restart lesson, mute, controls guide |

## Deploy (free)

The backend serves the built web app, so the whole product is one Node service. `render.yaml` is a [Render](https://render.com) Blueprint for the free plan:

1. Push this repo, then in Render choose **New > Blueprint** and select it (or create a Web Service with build command `npm run build:deploy` and start command `npm start`).
2. Set `VITE_CESIUM_ION_TOKEN` (see above) for the real 3D world, then redeploy. It is baked in at build time.

Notes for the free plan: the service sleeps after ~15 minutes idle (the first request takes about a minute to wake it), and its disk is not persistent, so pilots, scores and captured media reset on each restart or redeploy. Move to a database and object storage before real use.

Locally, `npm run build` then `npm start` serves everything on http://localhost:4000.
