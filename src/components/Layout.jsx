import { useState, useEffect, useRef } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Menu, Dumbbell } from 'lucide-react'
import Sidebar from './Sidebar'
import Avatar from './Avatar'
import { useAuth } from '../context/AuthContext'

// Below this width the sidebar becomes an off-canvas menu (matches index.css)
const MOBILE_QUERY = '(max-width: 900px)'

/**
 * Layout Component - sidebar + content area
 * Phones get a sticky top bar and an off-canvas sidebar.
 */
export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(() => window.matchMedia(MOBILE_QUERY).matches)
  const { user } = useAuth()
  const location = useLocation()
  const mainRef = useRef(null)
  const menuButtonRef = useRef(null)

  // Close the sidebar and move focus to the new page on navigation
  useEffect(() => {
    setSidebarOpen(false)
    mainRef.current?.focus({ preventScroll: true })
    window.scrollTo(0, 0)
  }, [location.pathname])

  // Track phone vs desktop layout; leaving the phone layout closes the menu
  useEffect(() => {
    const query = window.matchMedia(MOBILE_QUERY)
    function handleChange(e) {
      setIsMobile(e.matches)
      if (!e.matches) setSidebarOpen(false)
    }
    query.addEventListener('change', handleChange)
    return () => query.removeEventListener('change', handleChange)
  }, [])

  // Closing the menu yourself returns focus to the menu button
  function closeSidebar() {
    setSidebarOpen(false)
    menuButtonRef.current?.focus()
  }

  // While the mobile menu is open: Escape closes it and the page behind doesn't scroll
  useEffect(() => {
    if (!sidebarOpen) return
    function handleKey(e) {
      if (e.key === 'Escape') closeSidebar()
    }
    document.addEventListener('keydown', handleKey)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = previousOverflow
    }
  }, [sidebarOpen])

  return (
    <div className="app-layout">
      {/* Top bar (phones and small tablets) */}
      <header className="topbar">
        <button
          type="button"
          className="icon-btn mobile-menu-btn"
          onClick={() => setSidebarOpen(true)}
          aria-label="Open menu"
          aria-expanded={sidebarOpen}
          aria-controls="app-sidebar"
          ref={menuButtonRef}
        >
          <Menu size={22} aria-hidden="true" />
        </button>
        <div className="topbar-brand">
          <span className="brand-mark">
            <Dumbbell size={18} aria-hidden="true" />
          </span>
          <span>Sheheryar Fitness</span>
        </div>
        <Avatar name={user?.username} size="sm" />
      </header>

      {/* Backdrop behind the open mobile menu */}
      <div
        className={`sidebar-overlay ${sidebarOpen ? 'show' : ''}`}
        onClick={closeSidebar}
        aria-hidden="true"
      />

      {/* On phones the closed menu is off screen, so it can't be tabbed into */}
      <Sidebar isOpen={sidebarOpen} hidden={isMobile && !sidebarOpen} onClose={closeSidebar} />

      <main className="main-content">
        {/* Keyed by route so each page plays its entrance animation */}
        <div className="main-inner page" key={location.pathname} ref={mainRef} tabIndex={-1}>
          <Outlet />
        </div>
      </main>
    </div>
  )
}
