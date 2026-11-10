import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import PublicLayout from './layouts/PublicLayout.jsx'
import Home from './pages/Home.jsx'
import Browse from './pages/Browse.jsx'
import MovieDetail from './pages/MovieDetail.jsx'

// The whole admin area (and the Supabase SDK it needs) is a separate chunk,
// so ordinary visitors never download it.
const AdminApp = lazy(() => import('./pages/admin/AdminApp.jsx'))
// The long text pages are rarely the first page a visitor opens, so they load on demand too.
const staticPage = (name) => lazy(() => import('./pages/StaticPages.jsx').then((m) => ({ default: m[name] })))
const About = staticPage('About')
const Privacy = staticPage('Privacy')
const Terms = staticPage('Terms')
const Copyright = staticPage('Copyright')
const NotFound = staticPage('NotFound')
// Full-height placeholder, so the footer does not jump when the page text arrives.
const later = (el) => <Suspense fallback={<div className="page-wait" />}>{el}</Suspense>

export default function App() {
  return (
    <Routes>
      <Route
        path="/admin/*"
        element={
          <Suspense fallback={<div className="boot">Loading admin…</div>}>
            <AdminApp />
          </Suspense>
        }
      />
      <Route element={<PublicLayout />}>
        <Route index element={<Home />} />
        <Route path="browse" element={<Browse />} />
        <Route path="movie/:slug" element={<MovieDetail />} />
        <Route path="about" element={later(<About />)} />
        <Route path="privacy" element={later(<Privacy />)} />
        <Route path="terms" element={later(<Terms />)} />
        <Route path="copyright" element={later(<Copyright />)} />
        <Route path="*" element={later(<NotFound />)} />
      </Route>
    </Routes>
  )
}
