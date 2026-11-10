import { useEffect, useState } from 'react'
import { Routes, Route, NavLink, Link, useLocation } from 'react-router-dom'
import { LayoutDashboard, Film, Captions, Sparkles, Inbox, Settings as SettingsIcon, LogOut, Menu, X, ExternalLink, ShieldAlert } from 'lucide-react'
import '../../styles/admin.css'
import { AuthProvider, useAuth } from '../../context/AuthContext.jsx'
import { ToastProvider, ConfirmProvider, Busy } from '../../components/admin/ui.jsx'
import { useSeo } from '../../lib/seo.js'
import { IS_CONFIGURED } from '../../lib/config.js'
import Logo from '../../components/Logo.jsx'
import Login from './Login.jsx'
import Dashboard from './Dashboard.jsx'
import Movies from './Movies.jsx'
import MovieEdit from './MovieEdit.jsx'
import Subtitles from './Subtitles.jsx'
import AiStudio from './AiStudio.jsx'
import Requests from './Requests.jsx'
import Settings from './Settings.jsx'

const NAV = [
  { to: '/admin/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/movies/', label: 'Movies', icon: Film },
  { to: '/admin/subtitles/', label: 'Subtitles', icon: Captions },
  { to: '/admin/ai/', label: 'AI Studio', icon: Sparkles },
  { to: '/admin/requests/', label: 'Requests', icon: Inbox },
  { to: '/admin/settings/', label: 'Settings', icon: SettingsIcon },
]

function Shell() {
  const { user, signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const location = useLocation()
  useEffect(() => setOpen(false), [location.pathname])

  return (
    <div className="admin">
      <aside className={`admin-side ${open ? 'is-open' : ''}`}>
        <div className="admin-brand">
          <Logo size={30} />
          <span className="badge badge-accent">Admin</span>
        </div>
        <nav aria-label="Admin">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => `admin-link ${isActive ? 'is-active' : ''}`}>
              <Icon size={18} aria-hidden="true" /> {label}
            </NavLink>
          ))}
        </nav>
        <div className="admin-side-foot">
          <Link to="/" className="admin-link">
            <ExternalLink size={18} aria-hidden="true" /> View site
          </Link>
          <button type="button" className="admin-link" onClick={signOut}>
            <LogOut size={18} aria-hidden="true" /> Sign out
          </button>
          <p className="admin-user" title={user?.email}>
            {user?.email}
          </p>
        </div>
      </aside>
      {open && <div className="admin-scrim" onClick={() => setOpen(false)} />}
      <div className="admin-main">
        <header className="admin-top">
          <button type="button" className="icon-btn" aria-label={open ? 'Close menu' : 'Open menu'} onClick={() => setOpen((v) => !v)}>
            {open ? <X /> : <Menu />}
          </button>
          <Logo size={28} />
        </header>
        <main className="admin-content">
          <Routes>
            <Route index element={<Dashboard />} />
            <Route path="movies" element={<Movies />} />
            <Route path="movies/new" element={<MovieEdit />} />
            <Route path="movies/:id" element={<MovieEdit />} />
            <Route path="subtitles" element={<Subtitles />} />
            <Route path="ai" element={<AiStudio />} />
            <Route path="ai/:id" element={<AiStudio />} />
            <Route path="requests" element={<Requests />} />
            <Route path="settings" element={<Settings />} />
            <Route path="*" element={<p className="muted">That admin page does not exist.</p>} />
          </Routes>
        </main>
      </div>
    </div>
  )
}

function Gate() {
  const { session, isAdmin, user, signOut } = useAuth()
  if (!IS_CONFIGURED)
    return (
      <div className="admin-center">
        <div className="notice notice-warn">
          <ShieldAlert />
          <div>
            <strong>Supabase is not configured.</strong>
            <p>Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (see README) and rebuild.</p>
          </div>
        </div>
      </div>
    )
  if (session === undefined || (session && isAdmin === undefined))
    return (
      <div className="admin-center">
        <Busy label="Checking your session…" />
      </div>
    )
  if (!session) return <Login />
  if (!isAdmin)
    return (
      <div className="admin-center">
        <div className="login-card">
          <ShieldAlert size={34} className="login-icon" aria-hidden="true" />
          <h1>No admin access</h1>
          <p className="muted">
            <strong>{user?.email}</strong> is signed in, but this account has not been granted the admin role. Roles are assigned only from the Supabase SQL editor — see “First admin” in the README.
          </p>
          <button type="button" className="btn btn-block" onClick={signOut}>
            <LogOut /> Sign out
          </button>
        </div>
      </div>
    )
  return <Shell />
}

export default function AdminApp() {
  useSeo({ title: 'Admin', description: 'SubLanka administration.', path: '/admin/', noindex: true })
  return (
    <AuthProvider>
      <ToastProvider>
        <ConfirmProvider>
          <Gate />
        </ConfirmProvider>
      </ToastProvider>
    </AuthProvider>
  )
}
