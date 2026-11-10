/**
 * Brand ornament: half of a "sandakada pahana" (the carved moonstone at the
 * entrance of old Sri Lankan buildings) drawn as plain concentric bands.
 * Decorative only — colours come from CSS (.moonstone, .moonstone-accent, .moonstone-core).
 */
export default function Moonstone({ className = '' }) {
  return (
    <svg className={`moonstone ${className}`} viewBox="0 0 640 320" fill="none" aria-hidden="true" focusable="false">
      <g stroke="currentColor" strokeWidth="1.2">
        <path d="M12 320a308 308 0 0 1 616 0" />
        <path d="M58 320a262 262 0 0 1 524 0" strokeWidth="4" strokeLinecap="round" strokeDasharray="1 13" />
        <path d="M104 320a216 216 0 0 1 432 0" />
        <path className="moonstone-accent" d="M150 320a170 170 0 0 1 340 0" strokeWidth="1.6" />
        <path d="M196 320a124 124 0 0 1 248 0" strokeDasharray="16 9" />
        <path d="M242 320a78 78 0 0 1 156 0" />
      </g>
      <path className="moonstone-core" d="M282 320a38 38 0 0 1 76 0Z" />
    </svg>
  )
}
