import * as THREE from 'three'
import type * as CesiumNS from 'cesium'
import type { ResolvedLocation } from './locations'

/**
 * The real world, drawn by CesiumJS underneath our Three.js layer (drone, rings, markers).
 *
 *  - `photoreal`: Google Photorealistic 3D Tiles (real buildings and terrain) streamed through
 *    Cesium ion. Needs VITE_CESIUM_ION_TOKEN (free) in frontend/.env.
 *  - `satellite`: Esri satellite imagery draped on the globe, used when there is no token or
 *    the 3D tiles cannot be loaded.
 *
 * Simulator coordinates stay local: x east, y up, z south, origin = launch pad on the ground.
 * This class maps that frame onto the real globe at the pad's latitude and longitude.
 */

export type EarthMode = 'loading' | 'photoreal' | 'satellite'

export interface EarthProgress {
  loaded: number
  failed: number
  total: number
}

export interface EarthCallbacks {
  onProgress(p: EarthProgress): void
  onMode(mode: EarthMode): void
}

/** Google Photorealistic 3D Tiles on Cesium ion. */
const GOOGLE_3D_TILES_ASSET = 2275207
const SAMPLE_ATTEMPTS = 4

/** 'cesium' = World Terrain + Bing imagery + OSM Buildings; 'google' = Google Photorealistic 3D Tiles. */
const WORLD_SOURCE = import.meta.env.VITE_WORLD_SOURCE === 'google' ? 'google' : 'cesium'

export const CESIUM_TOKEN = (import.meta.env.VITE_CESIUM_ION_TOKEN as string | undefined)?.trim()
export const HAS_PHOTOREAL = Boolean(CESIUM_TOKEN)

type Cesium = typeof CesiumNS

const dir = new THREE.Vector3()
const up = new THREE.Vector3()

export class Earth {
  readonly canvas: HTMLCanvasElement
  mode: EarthMode = 'loading'

  private readonly C: Cesium
  private readonly widget: CesiumNS.CesiumWidget
  private readonly host: HTMLDivElement
  private readonly credits: HTMLDivElement
  private readonly location: ResolvedLocation
  private readonly cb: EarthCallbacks

  private tileset: CesiumNS.Cesium3DTileset | null = null
  private enu: CesiumNS.Matrix4
  private padReady = false
  private remaining = 0
  private globeRemaining = 0
  private peak = 0
  private frames = 0
  private lastDone = false
  private everReady = false
  private destroyed = false

  // Scratch values reused every frame.
  private readonly pos: CesiumNS.Cartesian3
  private readonly dirE: CesiumNS.Cartesian3
  private readonly upE: CesiumNS.Cartesian3
  private readonly tmp: CesiumNS.Cartesian3

  private constructor(
    C: Cesium,
    container: HTMLElement,
    location: ResolvedLocation,
    cb: EarthCallbacks,
  ) {
    this.C = C
    this.location = location
    this.cb = cb

    this.host = document.createElement('div')
    Object.assign(this.host.style, { position: 'absolute', inset: '0' })
    this.credits = document.createElement('div')
    this.credits.className = 'earth-credits'
    container.prepend(this.host)
    container.appendChild(this.credits)

    this.widget = new C.CesiumWidget(this.host, {
      baseLayer: false,
      scene3DOnly: true,
      useDefaultRenderLoop: false,
      creditContainer: this.credits,
      msaaSamples: 4,
    })
    this.canvas = this.widget.canvas

    const scene = this.widget.scene
    scene.globe.depthTestAgainstTerrain = true
    scene.globe.baseColor = C.Color.fromCssColorString('#8b8f7a')
    scene.screenSpaceCameraController.enableInputs = false
    this.widget.camera.frustum.near = 0.1

    this.pos = new C.Cartesian3()
    this.dirE = new C.Cartesian3()
    this.upE = new C.Cartesian3()
    this.tmp = new C.Cartesian3()
    this.enu = this.buildFrame(0)
  }

  static async create(
    container: HTMLElement,
    location: ResolvedLocation,
    cb: EarthCallbacks,
  ): Promise<Earth> {
    Object.assign(window, { CESIUM_BASE_URL: '/cesium/' })
    await import('cesium/Build/Cesium/Widgets/widgets.css')
    const C = await import('cesium')
    const earth = new Earth(C, container, location, cb)
    await earth.start()
    if (import.meta.env.DEV) Object.assign(window, { __earth: earth })
    return earth
  }

  // --- Setup -----------------------------------------------------------------------------------

  private async start() {
    const C = this.C
    if (CESIUM_TOKEN) {
      try {
        C.Ion.defaultAccessToken = CESIUM_TOKEN
        if (WORLD_SOURCE === 'cesium') {
          await this.useCesiumWorld()
          return
        }
        const tileset = await C.Cesium3DTileset.fromIonAssetId(GOOGLE_3D_TILES_ASSET, {
          // Lower error = sharper tiles when the drone is only a few metres up.
          maximumScreenSpaceError: 6,
        })
        if (this.destroyed) return
        this.widget.scene.globe.show = false
        this.widget.scene.primitives.add(tileset)
        tileset.loadProgress.addEventListener((pending, processing) => {
          this.remaining = pending + processing
        })
        this.tileset = tileset
        this.setMode('photoreal')
        void this.findGroundHeight()
        return
      } catch (err) {
        console.error('Photorealistic 3D tiles unavailable:', err)
      }
    }
    this.useSatellite()
  }

  /**
   * Cesium's own data: World Terrain (real elevation), Bing aerial imagery (sharp, about 0.3 m per
   * pixel in cities) and OSM Buildings (every mapped building extruded to its real height).
   */
  private async useCesiumWorld() {
    const C = this.C
    const scene = this.widget.scene
    const terrain = await C.createWorldTerrainAsync()
    const imagery = await C.IonImageryProvider.fromAssetId(2)
    const buildings = await C.createOsmBuildingsAsync()
    if (this.destroyed) return

    scene.terrainProvider = terrain
    this.widget.imageryLayers.addImageryProvider(imagery)
    scene.primitives.add(buildings)
    scene.globe.tileLoadProgressEvent.addEventListener((n) => {
      this.globeRemaining = n
    })
    buildings.loadProgress.addEventListener((pending, processing) => {
      this.remaining = pending + processing
    })
    this.tileset = buildings
    this.setMode('photoreal')

    try {
      const [p] = await C.sampleTerrainMostDetailed(terrain, [
        C.Cartographic.fromDegrees(this.location.pad.lon, this.location.pad.lat),
      ])
      this.setFrame(Number.isFinite(p?.height) ? p.height : 0)
    } catch (err) {
      console.warn('Terrain height sample failed, using 0:', err)
      this.setFrame(0)
    }
    this.padReady = true
  }

  private useSatellite() {
    const C = this.C
    const scene = this.widget.scene
    if (this.tileset) this.tileset.show = false
    scene.globe.show = true
    if (this.widget.imageryLayers.length === 0) {
      this.widget.imageryLayers.addImageryProvider(
        new C.UrlTemplateImageryProvider({
          // Tiles are streamed through our backend (it hides the provider URL; nothing is stored).
          url: '/api/tiles/{z}/{x}/{y}',
          maximumLevel: 19,
          credit: new C.Credit('Imagery © Esri, Maxar, Earthstar Geographics'),
        }),
      )
    }
    scene.globe.tileLoadProgressEvent.addEventListener((n) => {
      this.remaining = n
    })
    this.padReady = true
    this.setFrame(0)
    this.setMode('satellite')
  }

  /** Measure the real ground height at the launch pad so y = 0 sits on the ground. */
  private async findGroundHeight() {
    const C = this.C
    for (let i = 0; i < SAMPLE_ATTEMPTS && !this.destroyed; i++) {
      try {
        const [p] = await this.widget.scene.sampleHeightMostDetailed([
          C.Cartographic.fromDegrees(this.location.pad.lon, this.location.pad.lat),
        ])
        if (p?.height !== undefined && Number.isFinite(p.height)) {
          this.setFrame(p.height)
          this.padReady = true
          return
        }
      } catch (err) {
        console.warn('Ground height sample failed:', err)
      }
    }
    if (!this.destroyed) {
      console.error('Could not measure ground height; falling back to satellite imagery.')
      this.useSatellite()
    }
  }

  private setMode(mode: EarthMode) {
    this.mode = mode
    this.cb.onMode(mode)
  }

  private buildFrame(height: number) {
    const C = this.C
    const origin = C.Cartesian3.fromDegrees(this.location.pad.lon, this.location.pad.lat, height)
    return C.Transforms.eastNorthUpToFixedFrame(origin)
  }

  groundHeight = 0

  private setFrame(height: number) {
    this.groundHeight = height
    this.enu = this.buildFrame(height)
  }

  /** Debug: read the 3D tiles' height at the pad right now (null if not loaded yet). */
  probeGround(): number | null {
    const p = this.widget.scene.sampleHeight(
      this.C.Cartographic.fromDegrees(this.location.pad.lon, this.location.pad.lat),
    )
    return p === undefined || !Number.isFinite(p) ? null : p
  }

  // --- Per frame -------------------------------------------------------------------------------

  /** Match the Cesium camera to the Three.js camera (same position, direction, up and field of view). */
  syncCamera(three: THREE.PerspectiveCamera) {
    if (this.destroyed) return
    const C = this.C
    const camera = this.widget.camera
    three.getWorldDirection(dir)
    up.set(0, 1, 0).applyQuaternion(three.quaternion)

    // Local (x east, y up, z south) -> east/north/up -> Earth-fixed.
    const p = three.position
    C.Matrix4.multiplyByPoint(
      this.enu,
      C.Cartesian3.fromElements(p.x, -p.z, p.y, this.tmp),
      this.pos,
    )
    C.Matrix4.multiplyByPointAsVector(
      this.enu,
      C.Cartesian3.fromElements(dir.x, -dir.z, dir.y, this.tmp),
      this.dirE,
    )
    C.Matrix4.multiplyByPointAsVector(
      this.enu,
      C.Cartesian3.fromElements(up.x, -up.z, up.y, this.tmp),
      this.upE,
    )
    camera.setView({
      destination: this.pos,
      orientation: { direction: this.dirE, up: this.upE },
    })

    // Three's fov is vertical. Cesium's is horizontal for landscape canvases.
    const fovY = (three.fov * Math.PI) / 180
    const frustum = camera.frustum as CesiumNS.PerspectiveFrustum
    frustum.fov = three.aspect > 1 ? 2 * Math.atan(Math.tan(fovY / 2) * three.aspect) : fovY
  }

  /** Draw the world, and report loading progress. */
  render() {
    if (this.destroyed) return
    this.widget.render()
    this.frames++

    const globe = this.widget.scene.globe
    const settled = this.tileset
      ? this.tileset.tilesLoaded && (!globe.show || globe.tilesLoaded)
      : globe.tilesLoaded
    const remaining = this.remaining + this.globeRemaining
    this.peak = Math.max(this.peak, remaining)
    // Once the world has been ready, it stays ready: tiles keep streaming as the drone moves.
    if (this.mode !== 'loading' && this.padReady && settled && this.frames > 8)
      this.everReady = true
    const done = this.everReady
    const total = Math.max(1, this.peak)
    const loaded = done ? total : Math.min(total - 1, Math.max(0, this.peak - remaining))
    if (done !== this.lastDone || (!done && this.frames % 6 === 0)) {
      this.lastDone = done
      this.cb.onProgress({ loaded, failed: 0, total })
    }
  }

  resize() {
    if (!this.destroyed) this.widget.resize()
  }

  dispose() {
    this.destroyed = true
    this.widget.destroy()
    this.host.remove()
    this.credits.remove()
  }
}
