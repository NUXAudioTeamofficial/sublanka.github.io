import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase.js'

const Ctx = createContext(null)

/**
 * session: undefined = still loading, null = signed out.
 * isAdmin: undefined = still checking, then true / false (decided by the database, never by the browser).
 */
export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined)
  const [isAdmin, setIsAdmin] = useState(undefined)

  useEffect(() => {
    let alive = true
    supabase.auth.getSession().then(({ data }) => alive && setSession(data.session ?? null))
    // Keep this callback synchronous: calling other Supabase methods inside it can deadlock the SDK.
    const { data } = supabase.auth.onAuthStateChange((_event, next) => alive && setSession(next ?? null))
    return () => {
      alive = false
      data.subscription.unsubscribe()
    }
  }, [])

  const userId = session?.user?.id
  useEffect(() => {
    if (session === undefined) return
    if (!userId) {
      setIsAdmin(false)
      return
    }
    let alive = true
    setIsAdmin(undefined)
    supabase.rpc('is_admin').then(({ data, error }) => alive && setIsAdmin(!error && data === true))
    return () => {
      alive = false
    }
  }, [userId, session === undefined])

  const signIn = useCallback(async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (error) throw error
  }, [])
  const signOut = useCallback(() => supabase.auth.signOut(), [])

  const value = useMemo(() => ({ session, user: session?.user ?? null, isAdmin, signIn, signOut }), [session, isAdmin, signIn, signOut])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export const useAuth = () => useContext(Ctx)
