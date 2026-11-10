import { Link } from 'react-router-dom'
import { SearchX, CloudOff, Film, RefreshCw } from 'lucide-react'
import { CardSkeleton } from './MovieCard.jsx'

export function Empty({ icon: Icon = SearchX, title, children, action, heading: Heading = 'h2' }) {
  return (
    <div className="empty">
      <span className="empty-icon"><Icon /></span>
      <Heading className="empty-title">{title}</Heading>
      {children && <p>{children}</p>}
      {action}
    </div>
  )
}

export function ErrorState({ error, onRetry }) {
  const notConfigured = error?.code === 'not_configured'
  return (
    <Empty
      icon={CloudOff}
      title={notConfigured ? 'දත්ත සමුදාය තවම සම්බන්ධ කර නැත' : 'දත්ත ලබාගැනීමට නොහැකි විය'}
      action={
        onRetry && !notConfigured ? (
          <button className="btn btn-ghost btn-sm" onClick={onRetry}><RefreshCw /> නැවත උත්සාහ කරන්න</button>
        ) : null
      }
    >
      {notConfigured ? 'VITE_SUPABASE_URL සහ VITE_SUPABASE_ANON_KEY සකසා නැවත build කරන්න (README බලන්න).' : error?.message || 'කරුණාකර මොහොතකින් නැවත උත්සාහ කරන්න.'}
    </Empty>
  )
}

export function NoMovies() {
  return (
    <Empty icon={Film} title="තවම චිත්‍රපට එක් කර නැත" action={<Link className="btn btn-ghost btn-sm" to="/about/">SubLanka ගැන දැනගන්න</Link>}>
      අපි මේ දිනවල පළමු උපසිරැසි සූදානම් කරමින් සිටිමු. ඉක්මනින්ම නැවත පැමිණෙන්න!
    </Empty>
  )
}

export const SkeletonCards = ({ count = 6 }) => Array.from({ length: count }, (_, i) => <CardSkeleton key={i} />)
