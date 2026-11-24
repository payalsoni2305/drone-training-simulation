# Drone Training Simulator — Project Plan

> A desktop, VR and tablet application that teaches people to fly drones safely and professionally — from first takeoff to complex missions — without risking real equipment.


> **Scope update (2026-11-24):** The first build narrows to one-on-one flight training plus photo/video capture, keyboard only, with a React frontend and Express backend. See [docs/PHASE-1-AND-ROADMAP.md](./docs/PHASE-1-AND-ROADMAP.md). The tech stack below was superseded: the backend is Node.js/Express and the web app is React + Three.js.

---

## 1. Vision & Goals

| Goal | Description |
|------|-------------|
| Teach, not just play | Structured lessons, scored exercises, feedback and certificates — not a free-flight toy. |
| Safe practice | Crashes, emergencies and signal loss cost nothing; learners can repeat until confident. |
| Realistic enough to transfer | Believable flight physics, camera/FPV behaviour and controller feel so skills carry to real drones. |
| Keyboard-first, controller-ready | Fully flyable by keyboard from day one; gamepad / RC transmitter / VR / touch supported as add-ons. |
| One codebase, three platforms | Desktop, VR headset and tablet share simulation, lessons and content. |

### Non-goals
- Not a game with real weapons or real-world targeting data.
- Not a replacement for legally required real-world flight hours or licensing exams.
- No multiplayer in v1 (considered for v2: instructor/student sessions).

---

## 2. Training Tracks

### Track 1 — Pilot Training
| Module | Key skills | Example exercises |
|--------|-----------|-------------------|
| 1.1 Basics | Parts of a drone, pre-flight checklist, arm/disarm, takeoff, hover, land | Hover in a 2 m box for 30 s |
| 1.2 Controls | Throttle/yaw/pitch/roll, orientation, nose-in vs nose-out | Fly a square, rotate in place |
| 1.3 Flight modes | Stabilized/Angle, Altitude Hold, Loiter/GPS, Acro, Return-to-Home | Switch modes mid-flight, compare behaviour |
| 1.4 Manoeuvres | Figure-8, orbit, slalom, precision landing | Cone slalom, landing on pad within 20 cm |
| 1.5 FPV | Goggle view, OSD (battery, altitude, speed), latency, camera tilt | Gate course, FPV racing track |
| 1.6 Weather & environment | Wind, gusts, rain, low light, GPS drift | Hold position in 15 km/h gusts |
| 1.7 Emergencies | Low battery, motor failure, flyaway, GPS loss, signal loss, RTH failsafe | Scenario drills with pass/fail |
| 1.8 Regulations | Airspace classes, no-fly zones, max altitude, VLOS, privacy, licensing categories | Quiz + map-based airspace exercise |
| 1.9 Final assessment | Combined exam | Scored practical + theory test → certificate |

### Track 2 — Surveillance & Reconnaissance
| Module | Key skills | Example exercises |
|--------|-----------|-------------------|
| 2.1 Camera operation | Gimbal control, zoom, focus, exposure, photo/video capture | Frame a subject, capture still + clip |
| 2.2 Area survey | Grid / lawnmower patterns, overlap, altitude vs. resolution | Survey a field, produce coverage map |
| 2.3 Search patterns | Expanding square, sector, parallel track | Locate a missing person in a forest |
| 2.4 Target ID | Identify vehicles/objects/persons from altitude, classify, report | Spot & tag N objects, false-positive penalty |
| 2.5 Tracking | Follow a moving subject, keep it framed, maintain safe distance | Follow a vehicle through a town |
| 2.6 Thermal & night | Thermal palettes, white/black-hot, IR vs. visible, low-light limits | Find heat signatures at night |
| 2.7 Reporting | Mission log, tagged waypoints, exported report (PDF/JSON) | Debrief screen with captured evidence |

### Track 3 — Tactical Range Training (simulated)
> **Scope guard:** All content is a *virtual training range*. Targets are abstract marked objects; no real-world weapon, munition or targeting instructions are included. Focus is on precision flying, decision-making, rules and safety.

| Module | Key skills | Example exercises |
|--------|-----------|-------------------|
| 3.1 Precision approach | Controlled low-speed approach, hold, descent profile | Reach a marker within tolerance radius |
| 3.2 Simulated payload release | Virtual drop on marked targets (wind, altitude, speed compensation) | Score by accuracy on range targets |
| 3.3 Rules of engagement (ROE) | Decision scenarios: authorised/unauthorised targets, abort criteria | Branching scenarios; wrong call = fail |
| 3.4 Collateral avoidance | Identify bystanders/protected zones, abort or reposition | Penalty for entering protected zones |
| 3.5 Degraded operations | GPS loss / jamming, video loss/lag/noise, link loss, manual recovery | Complete mission with failures injected |
| 3.6 Debrief & scoring | Timeline replay, ROE compliance, accuracy, safety score | After-action review screen |

---

## 3. Platforms & Input

| Platform | Primary input | Notes |
|----------|---------------|-------|
| Desktop (Win/macOS/Linux) | **Keyboard**, gamepad, USB RC transmitter | Main development target |
| VR headset (Quest / PCVR) | VR controllers, optional gamepad | FPV goggles view, cockpit-style ground-station UI |
| Tablet (iPad / Android) | On-screen virtual sticks, gyro | Touch UI, lower graphics preset |

### Keyboard controls (default — remappable)

| Action | Key | Alt |
|--------|-----|-----|
| Throttle up / down (altitude) | `W` / `S` | `↑` / `↓` on right cluster optional |
| Yaw left / right | `A` / `D` | |
| Pitch forward / back | `↑` / `↓` | `I` / `K` |
| Roll left / right | `←` / `→` | `J` / `L` |
| Arm / Disarm | `Space` (hold) | |
| Takeoff / Land (auto) | `T` / `G` | |
| Return to Home | `H` | |
| Cycle flight mode | `M` | |
| Gimbal tilt up / down | `R` / `F` | |
| Zoom in / out | `Z` / `X` | |
| Take photo / start-stop video | `P` / `V` | |
| Toggle camera: chase / FPV / ground | `C` | |
| Thermal / night toggle | `N` | |
| Release virtual payload (Track 3) | `B` | |
| Pause / menu | `Esc` | |
| Reset drone | `Backspace` | |

Input design principles: analog smoothing for keyboard (ramped stick input, expo/rates), configurable key bindings, on-screen key hints per lesson, same input abstraction for keyboard / gamepad / touch / VR.

---

## 4. Core Systems

1. **Flight dynamics** — rigid-body quadcopter model (thrust per motor, torque, drag, mass/inertia), PID attitude/rate controllers, mode logic (Stabilize, AltHold, Loiter, Acro, RTH), battery model, wind/gust model, ground & ceiling effect.
2. **Sensors & failure injection** — simulated GPS (noise, loss, jamming), IMU drift, barometer, video link (latency, noise, dropout), RC link loss, motor failure, battery sag.
3. **Camera & payload** — gimbal, zoom, FPV camera, thermal shader, night-vision shader, photo/video capture to disk, virtual payload ballistics for the range.
4. **World & scenarios** — terrain, buildings, vegetation, weather, day/night, moving actors (vehicles, people), no-fly-zone overlays.
5. **Training engine** — lesson/step state machine, objectives, scoring rubric, hints/coach, checklists, replay & flight log, pass/fail + certificates.
6. **Instructor tools** — scenario editor, failure injection panel, student progress dashboard.
7. **UI/UX** — HUD/OSD, minimap/map, ground-control-station view, tutorial overlays, debrief screens.
8. **Persistence** — profiles, progress, settings, key bindings, flight logs, captured media.
9. **Accessibility** — remappable controls, colourblind-safe palettes, subtitles, adjustable difficulty/assists.

---

## 5. Recommended Tech Stack

### Option A — Web-first (recommended)
One codebase covers desktop, VR and tablet.

| Layer | Choice |
|-------|--------|
| Language | TypeScript |
| 3D engine | Three.js (+ React Three Fiber for UI integration) |
| Physics | Rapier (WASM) for collisions; custom quadcopter dynamics |
| VR | WebXR (Quest Browser / PCVR) |
| Tablet | Responsive PWA + touch virtual sticks |
| Desktop packaging | Tauri (or Electron) wrapper |
| UI | React + Tailwind (HUD in canvas / DOM overlay) |
| State | Zustand |
| Audio | Howler.js / WebAudio (motor sound tied to RPM) |
| Backend (later) | Node/Fastify or Supabase for accounts, progress, certificates |
| Testing | Vitest, Playwright, deterministic physics replay tests |
| Tooling | Vite, ESLint, Prettier, GitHub Actions |

### Option B — Engine-based
Unity (C#) or Godot 4: better VR/native performance and terrain tooling, but heavier builds, store packaging per platform, and a bigger learning curve for the web team.

**Decision to confirm:** Option A for fastest path to a keyboard-playable prototype; revisit Unity if VR performance or photorealistic terrain becomes a blocker.

---

## 6. Proposed Folder Structure

```
drone-training-simulator/
├── PLAN.md
├── README.md
├── docs/
│   ├── design/            # GDD, UX flows, control schemes
│   ├── curriculum/        # lesson scripts per track
│   └── safety-and-scope.md
├── apps/
│   └── web/               # Vite + React + Three.js app
│       ├── src/
│       │   ├── core/          # game loop, input abstraction, events
│       │   ├── physics/       # quadcopter model, PID, wind, battery
│       │   ├── sensors/       # GPS, IMU, video link, failures
│       │   ├── camera/        # chase, FPV, gimbal, thermal, night
│       │   ├── world/         # terrain, buildings, weather, actors
│       │   ├── training/      # lessons, objectives, scoring, replay
│       │   ├── tracks/
│       │   │   ├── pilot/
│       │   │   ├── surveillance/
│       │   │   └── tactical/
│       │   ├── ui/            # HUD, menus, debrief
│       │   ├── platform/      # desktop, vr (WebXR), touch adapters
│       │   └── storage/
│       └── public/            # models, textures, audio
├── packages/
│   └── shared/            # types, scoring schemas, lesson format
├── tools/
│   └── scenario-editor/
├── tests/
└── .github/workflows/
```

---

## 7. Roadmap & Milestones

| Phase | Name | Duration (est.) | Deliverables |
|-------|------|-----------------|--------------|
| 0 | Foundations | 1 week | Repo, tooling, CI, PLAN review, tech spikes (physics, WebXR) |
| 1 | **Flyable prototype** | 3 weeks | Quadcopter physics, keyboard controls, chase + FPV camera, basic terrain, HUD, arm/takeoff/land |
| 2 | Pilot Training (MVP) | 4 weeks | Lesson engine, modules 1.1–1.4, scoring, checklists, tutorials, audio |
| 3 | Flight modes & environment | 3 weeks | Modes, wind/weather, battery, failsafes, modules 1.5–1.7 |
| 4 | Tablet + gamepad | 2 weeks | Touch sticks, responsive UI, gamepad/RC mapping, key remapping |
| 5 | Surveillance & Recon | 5 weeks | Gimbal/zoom/capture, survey & search patterns, target ID, tracking, thermal/night, reporting |
| 6 | VR | 3 weeks | WebXR FPV goggles, VR UI, comfort options, performance tuning |
| 7 | Tactical Range (simulated) | 4 weeks | Precision approach, virtual payload, ROE scenarios, collateral avoidance, degraded ops, debrief |
| 8 | Instructor tools & progress | 3 weeks | Accounts, dashboard, scenario editor, certificates |
| 9 | Polish & release | 3 weeks | Performance, accessibility, QA, packaging (desktop/PWA), docs |

Total ≈ 31 weeks for one full-time developer; parallelisable with a 3D artist and a curriculum/SME reviewer.

### MVP definition (end of Phase 2)
A desktop browser build where a user can: pick Pilot Training → fly lessons 1.1–1.4 by keyboard → receive scores and feedback → save progress.

---

## 8. Team & Skills Needed

- **Gameplay/simulation engineer** — physics, controllers, flight modes.
- **Graphics/3D engineer** — shaders (thermal/night), terrain, VR performance.
- **Frontend/UI engineer** — HUD, menus, tablet UX.
- **3D/environment artist** — drone models, terrain, props, vehicles, people.
- **Curriculum designer / certified drone pilot (SME)** — lesson accuracy, regulations, scoring rubric.
- **QA** — device matrix (desktop, Quest, iPad/Android).
- **Legal/compliance reviewer** — regulation content, Track 3 scope and export considerations.

---

## 9. Assets & Content Needed

| Category | Items |
|----------|-------|
| 3D models | 2–3 drone types (quad, FPV racer, survey), props, buildings, vehicles, people, cones/gates/landing pads |
| Terrain | Heightmap + textures for training field, town, forest, coastline, night/thermal-ready materials |
| Audio | Motor RPM loops, wind, UI, voice coach lines |
| UI | HUD/OSD kit, icons, key-prompt glyphs, fonts |
| Content | Lesson scripts, quizzes, regulation summaries (per region, e.g. FAA / EASA / DGCA India) |
| Data | Airspace sample data for the regulations module |

Sources: CC0 libraries (Kenney, Quaternius, Poly Haven), Sketchfab (licensed), custom Blender work.

---

## 10. Scoring & Assessment Model

- Per-exercise score (0–100) = accuracy + smoothness + time + safety (no collisions, within limits).
- Pass thresholds per module; stars (1–3) for replay value.
- Safety violations (airspace breach, collision, low-battery ignore) cap the score.
- Track 3 adds **ROE compliance** and **collateral avoidance** as gating criteria — a high accuracy score with an ROE violation is still a fail.
- Flight data recorded (position, inputs, events) for replay and debrief.
- Certificates: completion per track, exportable PDF with a verification ID.

---

## 11. Quality, Performance & Testing

- Targets: Desktop 60+ fps; Tablet 30–60 fps; VR 72–90 fps stable.
- Fixed-timestep physics (e.g. 240 Hz) decoupled from render for determinism.
- Unit tests for physics, PID, scoring; golden replays for regression.
- Playwright E2E for menus and lesson flow.
- Device test matrix: Chrome/Firefox/Safari, Quest 2/3, iPad, mid-range Android tablet.
- Latency budget: input→visual < 50 ms desktop, < 20 ms VR motion-to-photon.

---

## 12. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Flight feel unrealistic / unfun | High | Early prototype, tune with real pilots, offer assist levels |
| VR performance on mobile headsets | High | Low-poly style, LODs, foveated rendering, early WebXR spike |
| Keyboard is a poor stand-in for analog sticks | Medium | Ramped input, expo/rates, strong gamepad/RC support, assist modes |
| Content/regulation accuracy | Medium | SME review, per-region content, disclaimer |
| Track 3 sensitivity (misuse, export, platform policy) | Medium | Virtual-only scope, abstract targets, no real-world munition or tactics data, legal review, clear audience gating |
| Scope creep | High | Strict MVP, phase gates, backlog triage |
| Asset cost/time | Medium | Use CC0/licensed packs first, custom art later |

---

## 13. Safety, Legal & Ethics

- Clear disclaimer: simulator does not replace regulatory licensing or real flight practice.
- Region-aware regulation content with versioning and "last reviewed" dates.
- Track 3 is a simulated range only; reviewed by legal/compliance before release; may be distributed to a restricted audience (e.g. institutional licence) if required.
- Privacy: minimal personal data, GDPR-friendly progress storage, opt-in telemetry.
- Accessibility and VR comfort (vignetting, snap-turn, seated mode, motion-sickness warnings).

---

## 14. Immediate Next Steps (first 2 weeks)

1. [ ] Confirm tech stack (Option A vs B) and target regions for regulations.
2. [ ] Scaffold `apps/web` (Vite + React + TypeScript + Three.js), lint, format, CI.
3. [ ] Implement input abstraction with the keyboard map above.
4. [ ] Build quadcopter physics v0 (thrust, torque, drag, stabilised attitude PID).
5. [ ] Chase camera + FPV camera + minimal HUD (altitude, speed, battery, mode).
6. [ ] Flat training field with cones, gates, landing pad.
7. [ ] Spike: WebXR session rendering the FPV view on a headset.
8. [ ] Draft `docs/curriculum/` for Module 1.1–1.4.
9. [ ] Define the lesson/scoring JSON schema in `packages/shared`.
10. [ ] First playtest with someone who has flown a real drone; collect feedback.

---

## 15. Open Questions

1. Target audience: hobbyists, commercial/inspection pilots, public-safety agencies, or all?
2. Which regulatory regions to cover first (India DGCA, FAA, EASA)?
3. Web-first (Option A) or native engine (Option B)?
4. Offline-only app, or online accounts/instructor dashboard from the start?
5. Who will provide curriculum review (certified pilot)?
6. Distribution model for Track 3 (public, or restricted/institutional)?
7. Budget/timeline and team size?
