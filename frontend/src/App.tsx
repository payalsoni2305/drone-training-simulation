import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import GalleryPage from './pages/GalleryPage'
import LessonsPage from './pages/LessonsPage'
import MapPage from './pages/MapPage'
import WelcomePage from './pages/WelcomePage'

// The 3D engine is the heavy part, so it loads only when someone starts flying.
const FlightPage = lazy(() => import('./pages/FlightPage'))

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<WelcomePage />} />
        <Route path="map" element={<MapPage />} />
        <Route path="lessons" element={<LessonsPage />} />
        <Route path="gallery" element={<GalleryPage />} />
        <Route
          path="fly/:locationId/:lessonId"
          element={
            <Suspense fallback={<p className="center-note">Loading simulator…</p>}>
              <FlightPage />
            </Suspense>
          }
        />
        <Route path="*" element={<WelcomePage />} />
      </Route>
    </Routes>
  )
}
