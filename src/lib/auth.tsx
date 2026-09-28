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
}

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
      setProfile(data as Profile | null)
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
