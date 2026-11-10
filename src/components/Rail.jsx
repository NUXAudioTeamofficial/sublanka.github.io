import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react'

export function SectionHead({ kicker, title, to, icon: Icon, children }) {
  return (
    <div className="section-head">
      <div>
        {kicker && (
          <p className="kicker">
            {Icon && <Icon />} {kicker}
          </p>
        )}
        <h2>{title}</h2>
      </div>
      {children}
      {to && (
        <Link to={to} className="see-all">
          සියල්ල බලන්න <ArrowRight />
        </Link>
      )}
    </div>
  )
}

/** Horizontal, swipeable row of cards with arrow buttons on desktop. */
export default function Rail({ children, label }) {
  const ref = useRef(null)
  const scroll = (dir) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.85, behavior: 'smooth' })
  return (
    <div className="rail-wrap">
      <button className="rail-btn rail-prev" onClick={() => scroll(-1)} aria-label="පෙර">
        <ChevronLeft />
      </button>
      <div className="rail" ref={ref} role="list" aria-label={label} tabIndex={0}>
        {children}
      </div>
      <button className="rail-btn rail-next" onClick={() => scroll(1)} aria-label="ඊළඟ">
        <ChevronRight />
      </button>
    </div>
  )
}
