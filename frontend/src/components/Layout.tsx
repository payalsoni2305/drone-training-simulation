import { Link, NavLink, Outlet } from 'react-router-dom'
import { useLearner } from '../learner/context'

export function Layout() {
  const { learner, signOut } = useLearner()
  return (
    <div className="shell">
      <header className="topbar">
        <Link to="/" className="brand">
          <span className="brand-mark" aria-hidden>
            ✦
          </span>
          Drone Training Simulator
        </Link>
        {learner && (
          <>
            <nav>
              <NavLink to="/map">Map</NavLink>
              <NavLink to="/lessons">Lessons</NavLink>
              <NavLink to="/gallery">Gallery</NavLink>
            </nav>
            <div className="who">
              <span>Pilot: {learner.name}</span>
              <button className="btn ghost small" onClick={signOut}>
                Switch pilot
              </button>
            </div>
          </>
        )}
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  )
}
