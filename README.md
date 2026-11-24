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

The real world is drawn by CesiumJS. For real 3D buildings and terrain (Google Photorealistic 3D Tiles), create a free token at [ion.cesium.com](https://ion.cesium.com), add the asset "Google Photorealistic 3D Tiles" to your assets, then copy `frontend/.env.example` to `frontend/.env` and set `VITE_CESIUM_ION_TOKEN`. Without a token the simulator falls back to Esri satellite imagery, streamed through the backend. Nothing is stored on disk, so internet is needed while flying. See the imagery licence note in the [roadmap](./docs/PHASE-1-AND-ROADMAP.md).

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
