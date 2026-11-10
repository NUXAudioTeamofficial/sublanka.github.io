import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import PublicLayout from './layouts/PublicLayout.jsx'
import Home from './pages/Home.jsx'
import Browse from './pages/Browse.jsx'

// The whole admin area (and the Supabase SDK it needs) is a separate chunk,
// so ordinary visitors never download it.
const AdminApp = lazy(() => import('./pages/admin/AdminApp.jsx'))
// Same idea for the other routes: someone landing on the homepage used to
// download the movie page and every static page up front. Browse stays in the
// entry chunk on purpose — it is only ~2 kB gzipped, and splitting it out cost
// the page an extra render stage (boot -> skeleton -> data) worth 0.3 CLS.
const MovieDetail = lazy(() => import('./pages/MovieDetail.jsx'))
const About = lazy(() => import('./pages/StaticPages.jsx').then((m) => ({ default: m.About })))
const Privacy = lazy(() => import('./pages/StaticPages.jsx').then((m) => ({ default: m.Privacy })))
const Terms = lazy(() => import('./pages/StaticPages.jsx').then((m) => ({ default: m.Terms })))
const Copyright = lazy(() => import('./pages/StaticPages.jsx').then((m) => ({ default: m.Copyright })))
const NotFound = lazy(() => import('./pages/StaticPages.jsx').then((m) => ({ default: m.NotFound })))

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
        <Route path="about" element={<About />} />
        <Route path="privacy" element={<Privacy />} />
        <Route path="terms" element={<Terms />} />
        <Route path="copyright" element={<Copyright />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
