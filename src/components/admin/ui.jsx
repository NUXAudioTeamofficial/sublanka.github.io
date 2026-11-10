import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { X, CheckCircle2, AlertTriangle, Info, Loader2 } from 'lucide-react'

// ---- toasts ----------------------------------------------------------------
const ToastCtx = createContext(() => {})
export const useToast = () => useContext(ToastCtx)

export function ToastProvider({ children }) {
  const [items, setItems] = useState([])
  const push = useCallback((message, kind = 'ok') => {
    const id = Date.now() + Math.random()
    setItems((list) => [...list.slice(-3), { id, message: String(message), kind }])
    setTimeout(() => setItems((list) => list.filter((t) => t.id !== id)), kind === 'bad' ? 9000 : 4500)
  }, [])
  const Icon = { ok: CheckCircle2, bad: AlertTriangle, info: Info }
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {items.map((t) => {
          const I = Icon[t.kind] || Info
          return (
            <div key={t.id} className={`toast toast-${t.kind}`}>
              <I size={18} aria-hidden="true" />
              <span>{t.message}</span>
              <button type="button" aria-label="Dismiss" onClick={() => setItems((list) => list.filter((x) => x.id !== t.id))}>
                <X size={15} />
              </button>
            </div>
          )
        })}
      </div>
    </ToastCtx.Provider>
  )
}

// ---- modal -----------------------------------------------------------------
export function Modal({ title, onClose, children, footer, wide = false }) {
  const ref = useRef(null)
  useEffect(() => {
    const previous = document.activeElement
    document.body.classList.add('no-scroll')
    ref.current?.focus()
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.classList.remove('no-scroll')
      window.removeEventListener('keydown', onKey)
      previous?.focus?.()
    }
  }, [onClose])
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref}>
        <header className="modal-head">
          <h2>{title}</h2>
          <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
            <X />
          </button>
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-foot">{footer}</footer>}
      </div>
    </div>
  )
}

// ---- confirm ---------------------------------------------------------------
const ConfirmCtx = createContext(async () => false)
export const useConfirm = () => useContext(ConfirmCtx)

export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null)
  const ask = useCallback((options) => new Promise((resolve) => setState({ ...options, resolve })), [])
  const close = (answer) => {
    state?.resolve(answer)
    setState(null)
  }
  return (
    <ConfirmCtx.Provider value={ask}>
      {children}
      {state && (
        <Modal
          title={state.title || 'Are you sure?'}
          onClose={() => close(false)}
          footer={
            <>
              <button type="button" className="btn btn-ghost" onClick={() => close(false)}>
                Cancel
              </button>
              <button type="button" className={`btn ${state.danger ? 'btn-danger' : ''}`} onClick={() => close(true)}>
                {state.confirmLabel || 'Confirm'}
              </button>
            </>
          }
        >
          <p className="muted">{state.message}</p>
        </Modal>
      )}
    </ConfirmCtx.Provider>
  )
}

// ---- small pieces ----------------------------------------------------------
export function Field({ label, hint, children, error, className = '' }) {
  return (
    <label className={`field ${className}`}>
      <span className="label">{label}</span>
      {children}
      {error ? <span className="hint hint-bad">{error}</span> : hint ? <span className="hint">{hint}</span> : null}
    </label>
  )
}

export function Toggle({ checked, onChange, label, disabled = false }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} className={`toggle ${checked ? 'is-on' : ''}`} onClick={() => onChange(!checked)}>
      <span />
    </button>
  )
}

export const Busy = ({ label = 'Loading…' }) => (
  <div className="busy">
    <Loader2 className="spin" size={20} aria-hidden="true" /> {label}
  </div>
)

export function PageHead({ title, sub, children }) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {sub && <p className="muted">{sub}</p>}
      </div>
      {children && <div className="page-actions">{children}</div>}
    </div>
  )
}

export function Pager({ page, pageSize, total, onPage }) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  if (pages <= 1) return null
  return (
    <div className="pager">
      <button type="button" className="btn btn-ghost btn-sm" disabled={page === 0} onClick={() => onPage(page - 1)}>
        Previous
      </button>
      <span className="muted">
        Page {page + 1} of {pages} · {total} total
      </span>
      <button type="button" className="btn btn-ghost btn-sm" disabled={page >= pages - 1} onClick={() => onPage(page + 1)}>
        Next
      </button>
    </div>
  )
}

/** Runs an async loader and exposes { data, error, loading, reload, setData }. */
export function useLoader(loader, deps) {
  const [state, setState] = useState({ data: null, error: null, loading: true })
  const [tick, setTick] = useState(0)
  useEffect(() => {
    let alive = true
    setState((s) => ({ ...s, loading: true, error: null }))
    Promise.resolve()
      .then(loader)
      .then((data) => alive && setState({ data, error: null, loading: false }))
      .catch((error) => alive && setState({ data: null, error, loading: false }))
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick])
  return { ...state, reload: () => setTick((t) => t + 1), setData: (fn) => setState((s) => ({ ...s, data: typeof fn === 'function' ? fn(s.data) : fn })) }
}
