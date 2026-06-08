import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import Dashboard from './screens/Dashboard'
import ReadingTracker from './screens/ReadingTracker'
import VerseBank from './screens/VerseBank'
import MemorizationMode from './screens/MemorizationMode'
import './App.css'

function Nav() {
  return (
    <nav className="bottom-nav">
      <NavLink to="/" end className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
        <span className="nav-icon">⌂</span>
        <span>Home</span>
      </NavLink>
      <NavLink to="/tracker" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
        <span className="nav-icon">✓</span>
        <span>Reading</span>
      </NavLink>
      <NavLink to="/verses" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
        <span className="nav-icon">❝</span>
        <span>Verses</span>
      </NavLink>
      <NavLink to="/memorize" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
        <span className="nav-icon">◎</span>
        <span>Memorize</span>
      </NavLink>
    </nav>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="app-shell">
        <div className="scroll-area">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/tracker" element={<ReadingTracker />} />
            <Route path="/verses" element={<VerseBank />} />
            <Route path="/memorize" element={<MemorizationMode />} />
          </Routes>
        </div>
        <Nav />
      </div>
    </BrowserRouter>
  )
}
