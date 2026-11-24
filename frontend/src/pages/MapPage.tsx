import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { INDIA_OUTLINE, INDIA_VIEWBOX, projectIndia } from '../data/indiaOutline'
import { useLearner } from '../learner/context'
import { setSelectedLocationId, useSelectedLocation } from '../learner/selectedLocation'
import { mercatorPixel, TILE_SIZE } from '../sim/geo'
import { IMAGERY_ATTRIBUTION, LOCATIONS } from '../sim/locations'
import type { LocationDef } from '../sim/locations'

/** Which side of its pin each label sits on, so nearby cities do not overlap. */
const LABEL_SIDE: Record<string, 'left' | 'right'> = {
  delhi: 'right',
  agra: 'right',
  jaipur: 'left',
  mumbai: 'left',
  bengaluru: 'right',
}

function previewTileUrl(l: LocationDef): string {
  const p = mercatorPixel(l, l.zoom)
  return `/api/tiles/${l.zoom}/${Math.floor(p.x / TILE_SIZE)}/${Math.floor(p.y / TILE_SIZE)}`
}

export default function MapPage() {
  const { learner, loading } = useLearner()
  const navigate = useNavigate()
  const saved = useSelectedLocation()
  const [focusId, setFocusId] = useState<string | null>(null)

  if (loading) return <p className="center-note">Loading…</p>
  if (!learner) return <Navigate to="/" replace />

  const focus = LOCATIONS.find((l) => l.id === (focusId ?? saved?.id)) ?? null

  const start = (l: LocationDef) => {
    setSelectedLocationId(l.id)
    navigate('/lessons')
  }

  return (
    <div className="page map-page">
      <div className="page-head">
        <div>
          <p className="eyebrow">Choose your training ground</p>
          <h1>Fly over real India</h1>
        </div>
      </div>

      <div className="map-layout">
        <div className="india-map">
          <svg
            viewBox={`0 0 ${INDIA_VIEWBOX.width} ${INDIA_VIEWBOX.height}`}
            role="img"
            aria-label="Map of India with flying locations"
          >
            <g className="india-land">
              {INDIA_OUTLINE.map((d, i) => (
                <path key={i} d={d} />
              ))}
            </g>
            {LOCATIONS.map((l) => {
              const { x, y } = projectIndia(l.lat, l.lon)
              const right = (LABEL_SIDE[l.id] ?? 'right') === 'right'
              const active = focus?.id === l.id
              return (
                <g
                  key={l.id}
                  className={`pin ${active ? 'active' : ''}`}
                  transform={`translate(${x} ${y})`}
                  role="button"
                  tabIndex={0}
                  aria-label={`${l.name}, ${l.city}`}
                  onClick={() => setFocusId(l.id)}
                  onDoubleClick={() => start(l)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      setFocusId(l.id)
                    }
                  }}
                >
                  <circle className="pin-pulse" r="16" />
                  <circle className="pin-dot" r="9" />
                  <text x={right ? 18 : -18} y="8" textAnchor={right ? 'start' : 'end'}>
                    {l.city}
                  </text>
                </g>
              )
            })}
          </svg>
        </div>

        <aside className="panel map-panel" aria-live="polite">
          {focus ? (
            <>
              <img className="map-preview" src={previewTileUrl(focus)} alt="" />
              <div>
                <p className="eyebrow">
                  {focus.city}, {focus.state}
                </p>
                <h2>{focus.name}</h2>
              </div>
              <p className="muted">{focus.blurb}</p>
              <p className="tiny muted">
                Real satellite imagery of this exact place. The landmark is a simplified 3D model
                placed at its real coordinates.
              </p>
              <button className="btn primary" onClick={() => start(focus)} autoFocus>
                Train at {focus.name}
              </button>
            </>
          ) : (
            <>
              <h2>Pick a location</h2>
              <p className="muted">
                Select a pin on the map. Every lesson can be flown over any of these real places.
              </p>
            </>
          )}
          <ul className="place-list">
            {LOCATIONS.map((l) => (
              <li key={l.id}>
                <button
                  className={`place ${focus?.id === l.id ? 'on' : ''}`}
                  onClick={() => setFocusId(l.id)}
                >
                  <b>{l.name}</b>
                  <span>{l.city}</span>
                </button>
              </li>
            ))}
          </ul>
          <p className="tiny muted">
            {IMAGERY_ATTRIBUTION}. India boundary: datameet (CC0), aligned to the official Survey of
            India boundary.
          </p>
        </aside>
      </div>
    </div>
  )
}
