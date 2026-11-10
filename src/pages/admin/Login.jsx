import { useState } from 'react'
import { Link } from 'react-router-dom'
import { LogIn, Loader2, ArrowLeft } from 'lucide-react'
import { useAuth } from '../../context/AuthContext.jsx'
import Logo from '../../components/Logo.jsx'

export default function Login() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await signIn(email, password)
    } catch (err) {
      const msg = err?.message || ''
      setError(/invalid login/i.test(msg) ? 'Wrong email or password.' : /fetch/i.test(msg) ? 'Could not reach the server. Check your connection.' : msg || 'Sign-in failed.')
      setBusy(false)
    }
  }

  return (
    <div className="admin-center">
      <form className="login-card" onSubmit={submit}>
        <Logo size={40} />
        <h1>Admin sign in</h1>
        <p className="muted">Only accounts created by the site owner can sign in. There is no public registration.</p>
        <label className="field">
          <span className="label">Email</span>
          <input className="input" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="field">
          <span className="label">Password</span>
          <input className="input" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {error && (
          <p className="notice notice-bad" role="alert">
            {error}
          </p>
        )}
        <button className="btn btn-block" disabled={busy}>
          {busy ? <Loader2 className="spin" /> : <LogIn />} Sign in
        </button>
        <Link to="/" className="login-back">
          <ArrowLeft size={15} /> Back to the site
        </Link>
      </form>
    </div>
  )
}
