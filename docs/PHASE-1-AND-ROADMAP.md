# Phase 1 and Roadmap to a Company Demo

## Product focus right now

Teach **one learner at a time (one-on-one)** to **fly a drone and capture photos and video**, using only the **keyboard**. Surveillance analysis, tactical range training, VR and tablet come later (see [PLAN.md](../PLAN.md)).

## Phase 1: "Fly and Capture" (built)

Goal: a learner can open the app, enter a name, work through guided lessons, fly with the keyboard, take photos and record video, and see their score and captures afterwards.

### What Phase 1 contains

| Area | What is in it |
|------|---------------|
| **Flight** | Beginner-friendly "angle mode" quadcopter model: self-levelling, altitude hold, drag, battery drain, hard-landing and obstacle crashes, 120 m range limit, 120 m altitude limit |
| **Keyboard control** | Keys become smooth analogue "sticks" (ramped input). Hold `Space` to arm like a real transmitter. Full guide in-app (`H`) |
| **Views** | Chase camera and drone camera (FPV) with a centre reticle. On-screen stick indicators show what the keys are doing |
| **Camera** | Gimbal tilt (`R`/`F`), zoom 1–4× (`Z`/`X`), photo (`P`), video (`V`). Photos are taken from the drone camera without the drone body or guide markers |
| **Real India map** | An India map screen (outline from the datameet Survey-of-India-aligned boundary) with 5 pins. Choosing a place flies you over the real world drawn by CesiumJS: with a free Cesium ion token, Google Photorealistic 3D Tiles (real photogrammetry of buildings, trees and roads; sharpest from about 30 to 120 m up), falling back to Cesium World Terrain, Bing aerial imagery and OpenStreetMap 3D buildings; without a token, Esri satellite imagery plus a simplified 3D model of the landmark (India Gate, Taj Mahal, Gateway of India, Hawa Mahal, Vidhana Soudha). Photo and video targets are real parts of each landmark |
| **Choosing a place** | Pick a pin on the India map, see a live satellite preview, press "Train at ...". The choice is remembered; Lessons, the briefing and the Gallery all show the place. "Change location" is one click away |
| **Real-world map loading** | The briefing shows map loading progress and enables **Start flight** only when the world is ready. It says whether you are in real 3D mode or satellite mode. Attribution (Esri, Google, Cesium) is always visible |
| **Two world modes** | **Real 3D** (Google Photorealistic 3D Tiles, or Cesium terrain, Bing imagery and OSM buildings, through Cesium ion; needs a free token) or **satellite** (Esri imagery, no token). The app switches to satellite automatically if the 3D tiles cannot load |
| **Lessons (5)** | 1. First Flight, 2. Move & Navigate (waypoint rings), 3. Camera Basics (photos), 4. Record a Video Clip, 5. Aerial Survey Mission |
| **Coaching** | Briefing screen per lesson, live objective checklist, contextual tip, toast feedback ("Too close, zoom out (X)") |
| **Scoring** | Precision (landing offset and softness, framing quality) + time bonus + battery left. Pass marks per lesson; crash = fail |
| **Pilot log** | Express API stores pilots, attempts, best scores, and uploaded media (JSON file store, swappable later) |
| **Gallery** | Browse, play, download and delete captured photos and videos. Each capture shows its place and lesson. Photos and videos include the real world and the drone camera view |
| **Audio** | Procedural motor sound and camera shutter (mute with `M`) |
| **Storage** | Map tiles are streamed and **never stored on disk**. Only your own captured photos and videos are saved (`backend/data/media`) |
| **Quality** | 44 frontend tests (physics, scoring, framing, lessons, map maths and per-location layout checks) and 11 backend tests (API and tile proxy) |

### Tech

- **Frontend** (`frontend/`): React 19, TypeScript, Vite, CesiumJS (real world), Three.js (drone, rings and markers drawn over it), React Router.
- **Backend** (`backend/`): Node.js, Express 5, Zod validation, Multer uploads, Helmet, CORS, and a satellite-tile proxy (streams, stores nothing) (`/api/tiles/:z/:x/:y`).
- The browser only talks to Vite in development. `/api` and `/media` are proxied to Express on port 4000.

### How to run

For real terrain, aerial imagery and 3D buildings: create a free token at [ion.cesium.com](https://ion.cesium.com) and put it in `frontend/.env` (copy `frontend/.env.example`) as `VITE_CESIUM_ION_TOKEN`. Add the asset **Google Photorealistic 3D Tiles** to your ion account (Asset Depot, free) for the photorealistic world; without it the app falls back to Cesium World Terrain, Bing aerial imagery and OpenStreetMap Buildings. Set `VITE_WORLD_SOURCE=cesium` to force the fallback world. Without a token the app falls back to satellite imagery. On Render, set the same variable and redeploy, because it is baked in at build time.

```bash
npm run install:all      # one time, from the project root
npm run dev              # API on :4000, web app on :5173 (copies Cesium runtime files first)
npm test                 # backend + frontend tests
npm run build            # production build of the web app
```

Open http://localhost:5173, enter a pilot name, and start with **First Flight**.

### Known limits of Phase 1 (deliberate)

- Single local user, no passwords or accounts (pilot id is kept in the browser).
- Simplified flight model (one mode, no wind or weather yet).
- **Flat physics ground:** the real world is drawn faithfully, but physics treats the ground as flat at the launch pad's height, and only the landmark has collision (invisible cylinders). Trees and other buildings can be flown through. The drone overlay is drawn on top of the world, so it is not hidden when it flies behind a real building. Landmark lat/lon are approximate.
- **Licences:** Cesium ion's free tier is for non-commercial use; Google, Bing and OSM data carry their own attribution (shown by Cesium). Do not store or scrape the tiles. The satellite fallback uses Esri World Imagery, free for development and demos; for commercial use confirm Esri's terms or change `TILE_URL` in `backend/.env`. Restrict the ion token to your site's URL in the ion dashboard.
- **Internet needed** while flying: map tiles are streamed live and not stored on disk (only the browser's own cache is used).
- **India boundary:** the outline is aligned with the official Survey of India boundary. Use an officially approved boundary file for any public or commercial release.
- Data lives in `backend/data/db.json` (pilots, attempts) and `backend/data/media/` (captured photos and videos).
- `frontend/public/cesium` is a generated copy of CesiumJS runtime files (workers, sky textures), ignored by git and rebuilt by `npm run dev` and `npm run build`.
- Desktop browsers with WebGL only. Video is recorded as WebM.

## Five-minute demo script

1. **Welcome and map (45 s):** Enter a name. Explain the one-on-one training idea, then click a pin on the India map (the Taj Mahal is the best opener) and show the real satellite preview, then press "Train at ...".
2. **Lesson 1 (90 s):** Briefing with the control guide. Arm (hold `Space`), take off, hover, land. Show the stick indicators and coaching tips. Show the score.
3. **Lesson 2 (60 s):** Fly through a couple of rings. Point out the guidance and the obstacles.
4. **Camera (90 s):** Switch to drone camera (`C`). Tilt, zoom, take a photo of the highlighted landmark target (for example the Taj Mahal's main dome), and show the feedback when framing is wrong.
5. **Video (30 s):** Record a short clip.
6. **Gallery and Lessons (30 s):** Show captured media and the progress and scores.

Tip: practise the route first and keep the browser full-screen for the best impression.

## Roadmap: what to add next

The aim is a convincing demo for a company first, then the full product.

### Phase 2: Demo polish (about 3–4 weeks)

Makes the product look and feel professional for a first company meeting.

- Ground-following physics and collision against the real 3D buildings (sampled from the tiles), altitude-above-ground in lessons, and more cities and landmarks (the places list is data-driven in `frontend/src/sim/locations.ts`).
- Better visuals: richer sky and lighting, water, more props, drone model upgrade.
- Realism options: wind and gusts, GPS-hold vs manual (acro/angle) flight modes, battery warnings and Return-to-Home.
- More lessons: emergency drills (low battery, signal loss), precision landing, orbit and figure-8, night flying.
- Instructor view: session summary, flight path replay, scoring breakdown, exportable PDF report and certificate.
- Onboarding: interactive "press this key" tutorial and a skippable intro.
- Branding and settings: logo, remappable keys, graphics quality, sensitivity.
- Reliability: accounts (login), database instead of JSON file, error and analytics logging.

### Phase 3: Surveillance & Reconnaissance track (about 4–6 weeks)

- Area survey patterns (grid / lawnmower) with coverage map and overlap score.
- Target search patterns and identification tasks with a reporting form.
- Subject tracking (moving vehicles/people), thermal and night camera modes.
- Mission reports with tagged captures and a map.

### Phase 4: Simulated tactical range (about 4 weeks)

Virtual range only, with abstract targets.

- Precision approach, simulated payload release on marked targets.
- Rules-of-engagement and collateral-avoidance decision scenarios.
- GPS-loss and video-loss degraded operations, after-action review.
- Legal and compliance review before any external release.

### Phase 5: Platforms and scale (about 4–6 weeks)

- Gamepad and RC transmitter support, then touch controls for tablet.
- WebXR / VR FPV goggles view.
- Packaged desktop app, multi-user organisations, instructor dashboard, SSO.

### Suggested order for a company pitch

1. Phase 1 (today): prove the core learning loop works.
2. Phase 2 (polish): make it impressive and credible, with reports and certificates.
3. Show the Phase 3 and 4 roadmap as the differentiator for their specific use case.
4. Add Phase 5 once the first customer confirms the target hardware (desktop, tablet or VR).

## Questions to settle with the company

- Who are the learners (hobby, commercial, public safety)?
- Which regulations should the theory content follow (DGCA, FAA, EASA)?
- Which hardware must it run on (office PCs, tablets, VR headsets)?
- Does it need to run offline or inside a private network?
- What reports or certificates do they need for compliance?
