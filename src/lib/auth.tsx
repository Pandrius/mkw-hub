import type { User } from '@supabase/supabase-js'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from './supabase'

/** 'editor' es un valor antiguo que ya no se asigna: ahora hay permisos separados. */
export type Role = 'user' | 'editor' | 'moderator' | 'admin'

export type Profile = {
  id: string
  discord_id: string | null
  username: string
  avatar_url: string | null
  role: Role
  tt_editor: boolean
  strat_editor: boolean
  country_code: string | null
  mkc_player_id: number | null
  mkc_synced_at: string | null
}

/** Cada cuánto se vuelve a consultar MKC (país y equipos) al iniciar sesión */
const MKC_SYNC_EVERY_MS = 12 * 60 * 60 * 1000

type AuthState = {
  user: User | null
  profile: Profile | null
  loading: boolean
  /** false mientras Supabase no esté configurado */
  enabled: boolean
  /** Puede añadir y borrar tiempos de contrarreloj */
  isTtEditor: boolean
  /** Puede escribir guías y consejos */
  isStratEditor: boolean
  /** Moderador o admin: gestiona permisos de editor */
  isModerator: boolean
  isAdmin: boolean
  signIn: () => Promise<void>
  signOut: () => Promise<void>
  /** Vuelve a sincronizar el perfil con Mario Kart Central a petición */
  syncMkc: () => Promise<boolean>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(supabase !== null)

  useEffect(() => {
    if (!supabase) return
    const client = supabase

    const loadProfile = async (u: User | null) => {
      setUser(u)
      if (!u) {
        setProfile(null)
        return
      }
      const { data } = await client.from('profiles').select('*').eq('id', u.id).maybeSingle()
      const prof = data as Profile | null
      setProfile(prof)

      // Vincula con Mario Kart Central (país y equipos) si hace tiempo que no se hace
      const stale = !prof?.mkc_synced_at || Date.now() - Date.parse(prof.mkc_synced_at) > MKC_SYNC_EVERY_MS
      if (prof && stale) {
        const { data: session } = await client.auth.getSession()
        const token = session.session?.access_token
        if (!token) return
        const res = await fetch('/api/mkc-link', { method: 'POST', headers: { Authorization: `Bearer ${token}` } }).catch(
          () => null,
        )
        if (res?.ok) {
          const { data: fresh } = await client.from('profiles').select('*').eq('id', u.id).maybeSingle()
          if (fresh) setProfile(fresh as Profile)
        }
      }
    }

    client.auth.getSession().then(async ({ data }) => {
      await loadProfile(data.session?.user ?? null)
      setLoading(false)
    })
    const { data } = client.auth.onAuthStateChange((_event, session) => {
      // Se difiere para no bloquear el callback de Supabase con otra consulta
      setTimeout(() => loadProfile(session?.user ?? null), 0)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  const signIn = async () => {
    if (!supabase) return
    await supabase.auth.signInWithOAuth({
      provider: 'discord',
      options: { redirectTo: window.location.href },
    })
  }

  const signOut = async () => {
    if (!supabase) return
    await supabase.auth.signOut()
  }

  const syncMkc = async (): Promise<boolean> => {
    if (!supabase || !user) return false
    try {
      const { data: session } = await supabase.auth.getSession()
      const token = session.session?.access_token
      if (!token) return false
      const res = await fetch('/api/mkc-link', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const { data: fresh } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle()
        if (fresh) setProfile(fresh as Profile)
        return true
      }
    } catch {
      // ignore
    }
    return false
  }

  const isModerator = profile?.role === 'moderator' || profile?.role === 'admin'
  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        enabled: supabase !== null,
        isTtEditor: isModerator || !!profile?.tt_editor,
        isStratEditor: isModerator || !!profile?.strat_editor,
        isModerator,
        isAdmin: profile?.role === 'admin',
        signIn,
        signOut,
        syncMkc,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

// oxlint-disable-next-line react/only-export-components
export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}
