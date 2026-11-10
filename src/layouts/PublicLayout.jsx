import { Suspense, useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Header from '../components/Header.jsx'
import Footer from '../components/Footer.jsx'
import { SkeletonCards } from '../components/States.jsx'

function ScrollManager() {
  const { pathname, hash } = useLocation()
  useEffect(() => {
    if (hash) {
      const el = document.getElementById(hash.slice(1))
      if (el) {
        el.scrollIntoView()
        return
      }
    }
    window.scrollTo(0, 0)
  }, [pathname, hash])
  return null
}

export default function PublicLayout() {
  const { pathname } = useLocation()
  return (
    <div className="site">
      <a className="skip-link" href="#main">අන්තර්ගතයට යන්න</a>
      <ScrollManager />
      <Header />
      <main id="main">
        {/* Re-keyed per page (not per filter change) so each page fades in. */}
        <div className="route" key={pathname}>
          {/* Route chunks load on demand; the skeleton keeps the layout in place. */}
          <Suspense
            fallback={
              // Deliberately small: a tall skeleton here would itself push the
              // footer down and hand the page a layout shift before the route
              // even arrives.
              <div className="boot" aria-busy="true">පූරණය වෙමින්…</div>
            }
          >
            <Outlet />
          </Suspense>
        </div>
      </main>
      <Footer />
    </div>
  )
}
