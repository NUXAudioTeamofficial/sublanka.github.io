import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import PublicLayout from './layouts/PublicLayout.jsx'
import Home from './pages/Home.jsx'
import Browse from './pages/Browse.jsx'
import MovieDetail from './pages/MovieDetail.jsx'
import { About, Privacy, Terms, Copyright, NotFound } from './pages/StaticPages.jsx'

// The whole admin area (and the Supabase SDK it needs) is a separate chunk,
// so ordinary visitors never download it.
const AdminApp = lazy(() => import('./pages/admin/AdminApp.jsx'))

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
