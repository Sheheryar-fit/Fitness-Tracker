import { useEffect, useRef } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  UserPlus,
  Target,
  CalendarCheck,
  House,
  User,
  Ruler,
  NotebookPen,
  KeyRound,
  LogOut,
  Dumbbell,
  X
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import Avatar from './Avatar'
import InstallApp from './InstallApp'

const ADMIN_LINKS = [
  { to: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/admin/clients', label: 'Clients', icon: Users, matchChildren: true },
  { to: '/admin/clients/add', label: 'Add Client', icon: UserPlus },
  { to: '/admin/goals', label: 'Goal Progress', icon: Target },
  { to: '/admin/checkins', label: 'Check-ins', icon: CalendarCheck }
]

const CLIENT_LINKS = [
  { to: '/client/dashboard', label: 'Dashboard', icon: House },
  { to: '/client/profile', label: 'My Profile', icon: User },
  { to: '/client/goals', label: 'My Goals', icon: Target },
  { to: '/client/measurements', label: 'My Progress', icon: Ruler },
  { to: '/client/notes', label: 'Coach Notes', icon: NotebookPen },
  { to: '/client/checkins', label: 'Check-ins', icon: CalendarCheck }
]

/**
 * Sidebar Component - Persistent left navigation
 * Shows different nav items based on user role (admin/client)
 */
export default function Sidebar({ isOpen, hidden, onClose }) {
  const { user, logout } = useAuth()
  const location = useLocation()
  const closeButtonRef = useRef(null)

  // Opening the mobile menu moves focus into it
  useEffect(() => {
    if (isOpen) closeButtonRef.current?.focus()
  }, [isOpen])

  const isAdmin = user?.role === 'admin'
  const links = isAdmin ? ADMIN_LINKS : CLIENT_LINKS

  // "Clients" stays highlighted on a client's detail/edit pages, but not on Add Client
  function isLinkActive(link, isActive) {
    if (!link.matchChildren) return isActive
    return isActive || (
      location.pathname.startsWith(`${link.to}/`) && location.pathname !== '/admin/clients/add'
    )
  }

  return (
    <aside
      id="app-sidebar"
      className={`sidebar ${isOpen ? 'open' : ''}`}
      aria-label="Main navigation"
      inert={hidden}
    >
      {/* Logo / Brand */}
      <div className="sidebar-header">
        <div className="brand">
          <span className="brand-mark">
            <Dumbbell size={22} aria-hidden="true" />
          </span>
          <div className="brand-text">
            <span className="brand-name">Sheheryar Fitness</span>
            <span className="brand-tagline">FitTracker</span>
          </div>
        </div>
        <button type="button" className="icon-btn sidebar-close" onClick={onClose} aria-label="Close menu" ref={closeButtonRef}>
          <X size={20} aria-hidden="true" />
        </button>
      </div>

      {/* Navigation Links */}
      <nav className="sidebar-nav">
        <span className="sidebar-section-label">Menu</span>
        {links.map((link) => {
          const Icon = link.icon
          return (
            <NavLink
              key={link.to}
              to={link.to}
              end={!link.matchChildren}
              className={({ isActive }) => `nav-link ${isLinkActive(link, isActive) ? 'active' : ''}`}
            >
              <Icon size={20} aria-hidden="true" />
              <span>{link.label}</span>
            </NavLink>
          )
        })}

        <span className="sidebar-section-label">Account</span>
        <InstallApp variant="nav" />
        <NavLink
          to={isAdmin ? '/admin/password' : '/client/password'}
          className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          id="change-password-link"
        >
          <KeyRound size={20} aria-hidden="true" />
          <span>Change Password</span>
        </NavLink>
      </nav>

      {/* Footer - User Info & Logout */}
      <div className="sidebar-footer">
        <div className="sidebar-user">
          <Avatar name={user?.username} />
          <div className="sidebar-user-info">
            <div className="sidebar-user-name">{user?.username}</div>
            <div className="sidebar-user-role">{isAdmin ? 'Trainer' : 'Client'}</div>
          </div>
        </div>
        <button className="logout-btn" onClick={logout} id="logout-button">
          <LogOut size={20} aria-hidden="true" />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  )
}
