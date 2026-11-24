// Real places in India that lessons can be flown over. Pure data and maths (no Three.js), so
// that it can be imported from Node.

import { toLocal } from './geo.ts'
import type { LatLon } from './geo.ts'

/** Shown wherever the map is visible. Required by the imagery provider's terms. */
export const IMAGERY_ATTRIBUTION =
  'Imagery © Esri, Maxar, Earthstar Geographics and the GIS User Community'

export type ModelId = 'indiaGate' | 'gateway' | 'tajMahal' | 'hawaMahal' | 'vidhanaSoudha'

export interface Vec3Like {
  x: number
  y: number
  z: number
}

/** Something the learner can photograph: a part of the landmark. */
export interface SubjectDef {
  id: string
  name: string
  /** Aim point relative to the landmark centre, in metres. */
  offset: Vec3Like
  /** Characteristic size in metres, used to judge how big it looks in frame. */
  size: number
}

export interface LandmarkDef {
  name: string
  lat: number
  lon: number
  model: ModelId
  /** Collision cylinder of the main structure. */
  radius: number
  height: number
  /** Extra collision cylinders relative to the landmark centre (minarets, turrets...). */
  parts?: { dx: number; dz: number; radius: number; height: number }[]
}

export interface LocationDef {
  id: string
  /** Short place name shown on the map. */
  name: string
  city: string
  state: string
  blurb: string
  /** The launch pad. */
  lat: number
  lon: number
  /** Imagery zoom level (18 is about 0.5 m per pixel). */
  zoom: number
  landmark: LandmarkDef
  subjects: [SubjectDef, SubjectDef, SubjectDef]
}

export const LOCATIONS: LocationDef[] = [
  {
    id: 'delhi',
    name: 'India Gate',
    city: 'New Delhi',
    state: 'Delhi',
    blurb: 'The 42 m war memorial arch on Kartavya Path, with wide open lawns for flying.',
    lat: 28.61291,
    lon: 77.22869,
    zoom: 18,
    landmark: {
      name: 'India Gate',
      lat: 28.612912,
      lon: 77.22951,
      model: 'indiaGate',
      radius: 14,
      height: 42,
    },
    subjects: [
      { id: 'arch-top', name: 'Top of the Arch', offset: { x: 0, y: 36, z: 0 }, size: 26 },
      { id: 'north-pillar', name: 'North Pillar', offset: { x: 0, y: 16, z: -8.5 }, size: 30 },
      { id: 'south-pillar', name: 'South Pillar', offset: { x: 0, y: 16, z: 8.5 }, size: 30 },
    ],
  },
  {
    id: 'agra',
    name: 'Taj Mahal',
    city: 'Agra',
    state: 'Uttar Pradesh',
    blurb:
      'The white marble mausoleum with its four minarets, approached from the southern gardens.',
    lat: 27.1741,
    lon: 78.04215,
    zoom: 18,
    landmark: {
      name: 'Taj Mahal',
      lat: 27.175,
      lon: 78.04215,
      model: 'tajMahal',
      radius: 24,
      height: 66,
      parts: [
        { dx: 36, dz: 36, radius: 3, height: 42 },
        { dx: -36, dz: 36, radius: 3, height: 42 },
        { dx: 36, dz: -36, radius: 3, height: 42 },
        { dx: -36, dz: -36, radius: 3, height: 42 },
      ],
    },
    subjects: [
      { id: 'main-dome', name: 'Main Dome', offset: { x: 0, y: 52, z: 0 }, size: 34 },
      { id: 'se-minaret', name: 'South-East Minaret', offset: { x: 36, y: 22, z: 36 }, size: 40 },
      { id: 'sw-minaret', name: 'South-West Minaret', offset: { x: -36, y: 22, z: 36 }, size: 40 },
    ],
  },
  {
    id: 'mumbai',
    name: 'Gateway of India',
    city: 'Mumbai',
    state: 'Maharashtra',
    blurb: 'The basalt arch monument on the Arabian Sea waterfront at Apollo Bunder.',
    lat: 18.9226,
    lon: 72.83401,
    zoom: 18,
    landmark: {
      name: 'Gateway of India',
      lat: 18.92198,
      lon: 72.83466,
      model: 'gateway',
      radius: 14,
      height: 26,
    },
    subjects: [
      { id: 'central-dome', name: 'Central Dome', offset: { x: 0, y: 25, z: 0 }, size: 15 },
      { id: 'north-turret', name: 'North Turret', offset: { x: 0, y: 20, z: -12.5 }, size: 24 },
      { id: 'south-turret', name: 'South Turret', offset: { x: 0, y: 20, z: 12.5 }, size: 24 },
    ],
  },
  {
    id: 'jaipur',
    name: 'Hawa Mahal',
    city: 'Jaipur',
    state: 'Rajasthan',
    blurb: 'The five-storey "Palace of Winds" in the Pink City, with its honeycomb facade.',
    lat: 26.92393,
    lon: 75.8274,
    zoom: 18,
    landmark: {
      name: 'Hawa Mahal',
      lat: 26.92393,
      lon: 75.8268,
      model: 'hawaMahal',
      radius: 17,
      height: 16,
    },
    subjects: [
      { id: 'top-tier', name: 'Top Tier', offset: { x: 4, y: 13.5, z: 0 }, size: 12 },
      { id: 'middle-tier', name: 'Middle Tiers', offset: { x: 4, y: 8, z: 0 }, size: 22 },
      { id: 'lower-facade', name: 'Lower Facade', offset: { x: 4, y: 3.5, z: 0 }, size: 36 },
    ],
  },
  {
    id: 'bengaluru',
    name: 'Vidhana Soudha',
    city: 'Bengaluru',
    state: 'Karnataka',
    blurb: "The granite legislature building beside Cubbon Park, one of India's grandest.",
    lat: 12.9788,
    lon: 77.5909,
    zoom: 18,
    landmark: {
      name: 'Vidhana Soudha',
      lat: 12.9797,
      lon: 77.5909,
      model: 'vidhanaSoudha',
      radius: 40,
      height: 46,
    },
    subjects: [
      { id: 'central-dome', name: 'Central Dome', offset: { x: 0, y: 40, z: 0 }, size: 18 },
      { id: 'west-wing', name: 'West Wing', offset: { x: -32, y: 10, z: 18 }, size: 34 },
      { id: 'east-wing', name: 'East Wing', offset: { x: 32, y: 10, z: 18 }, size: 34 },
    ],
  },
]

export function getLocation(id: string | null | undefined): LocationDef | undefined {
  return LOCATIONS.find((l) => l.id === id)
}

export interface ResolvedSubject {
  id: string
  name: string
  /** World position of the aim point. */
  aim: Vec3Like
  size: number
}

export interface ObstacleLike {
  x: number
  z: number
  radius: number
  height: number
}

export interface ResolvedLocation {
  def: LocationDef
  pad: LatLon
  /** Landmark centre in local metres. */
  landmark: { x: number; z: number }
  subjects: ResolvedSubject[]
  obstacles: ObstacleLike[]
  /** The ring course, rotated so it heads away from the landmark. */
  course: Vec3Like[]
}

/** Default ring course heading north from the pad (x east, z south, y up, metres). */
export const BASE_COURSE: Vec3Like[] = [
  { x: 0, y: 3, z: -12 },
  { x: 14, y: 4, z: -26 },
  { x: 14, y: 3, z: -42 },
  { x: -8, y: 4, z: -40 },
]

function rotateCourse(course: Vec3Like[], awayX: number, awayZ: number): Vec3Like[] {
  const theta = Math.atan2(awayZ, awayX) - Math.atan2(-1, 0) // "north" -> "away"
  const c = Math.cos(theta)
  const s = Math.sin(theta)
  return course.map((p) => ({ x: p.x * c - p.z * s, y: p.y, z: p.x * s + p.z * c }))
}

export function resolveLocation(def: LocationDef): ResolvedLocation {
  const pad: LatLon = { lat: def.lat, lon: def.lon }
  const lm = toLocal(pad, def.landmark)
  const lmd = def.landmark
  const obstacles: ObstacleLike[] = [
    { x: lm.x, z: lm.z, radius: lmd.radius, height: lmd.height },
    ...(lmd.parts ?? []).map((p) => ({
      x: lm.x + p.dx,
      z: lm.z + p.dz,
      radius: p.radius,
      height: p.height,
    })),
  ]
  const dist = Math.hypot(lm.x, lm.z) || 1
  return {
    def,
    pad,
    landmark: lm,
    subjects: def.subjects.map((s) => ({
      id: s.id,
      name: s.name,
      aim: { x: lm.x + s.offset.x, y: s.offset.y, z: lm.z + s.offset.z },
      size: s.size,
    })),
    obstacles,
    course: rotateCourse(BASE_COURSE, -lm.x / dist, -lm.z / dist),
  }
}
