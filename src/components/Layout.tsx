import { useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router'
import { useAuth } from '../lib/auth'
import { ROLE_LABELS } from '../lib/roles'

const NAV = [
  { to: '/pistas', label: 'Pistas' },
  { to: '/contrarreloj', label: 'Contrarreloj' },
  { to: '/estadisticas', label: 'Estadísticas' },
  { to: '/equipos', label: 'Equipos' },
]

export default function Layout() {
  const [open, setOpen] = useState(false)
  const { isModerator } = useAuth()
  const nav = isModerator ? [...NAV, { to: '/admin', label: 'Admin' }] : NAV

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-20 border-b border-line bg-bg/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4">
          <Link to="/" className="flex items-center gap-2" onClick={() => setOpen(false)}>
            <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" className="size-8" />
            <span className="font-display text-xl font-black italic tracking-tight">
              MKW <span className="text-kart-yellow">Hub</span>
            </span>
          </Link>

          <nav className="hidden flex-1 items-center gap-1 md:flex">
            {nav.map((item) => (
              <NavItem key={item.to} {...item} />
            ))}
          </nav>

          <div className="ml-auto hidden md:block">
            <AuthButton />
          </div>

          <button
            className="ml-auto rounded-lg border border-line px-3 py-1.5 text-sm md:hidden"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-label="Menú"
          >
            {open ? 'Cerrar' : 'Menú'}
          </button>
        </div>

        {open && (
          <nav className="flex flex-col gap-1 border-t border-line px-4 py-3 md:hidden">
            {nav.map((item) => (
              <NavItem key={item.to} {...item} onClick={() => setOpen(false)} />
            ))}
            <div className="pt-2">
              <AuthButton />
            </div>
          </nav>
        )}
        <div className="checker h-1.5 opacity-20" />
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <Outlet />
      </main>

      <footer className="border-t border-line py-6 text-center text-xs text-muted">
        <p>MKW Hub · Fan site no oficial hecho por y para la comunidad.</p>
        <p className="mt-1">
          Mario Kart World es una marca de Nintendo. Esta web no está afiliada ni respaldada por Nintendo.
        </p>
      </footer>
    </div>
  )
}

function NavItem({ to, label, onClick }: { to: string; label: string; onClick?: () => void }) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      className={({ isActive }) =>
        `rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
          isActive ? 'bg-surface-2 text-kart-yellow' : 'text-muted hover:bg-surface hover:text-ink'
        }`
      }
    >
      {label}
    </NavLink>
  )
}

function AuthButton() {
  const { user, profile, loading, enabled, signIn, signOut } = useAuth()

  if (!enabled) {
    return (
      <span className="text-xs text-muted" title="El login se activará al conectar Supabase">
        Login próximamente
      </span>
    )
  }
  if (loading) return <span className="text-sm text-muted">…</span>

  if (user) {
    const name = profile?.username ?? user.user_metadata.full_name ?? 'Jugador'
    const avatar = profile?.avatar_url ?? user.user_metadata.avatar_url
    return (
      <div className="flex items-center gap-3">
        {avatar && <img src={avatar} alt="" className="size-8 rounded-full" />}
        <span className="text-sm font-semibold">{name}</span>
        {profile && profile.role !== 'user' && (
          <span className="rounded-md bg-kart-yellow/15 px-1.5 py-0.5 text-[11px] font-bold uppercase text-kart-yellow">
            {ROLE_LABELS[profile.role]}
          </span>
        )}
        <button onClick={signOut} className="text-sm text-muted hover:text-ink">
          Salir
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={signIn}
      className="rounded-lg bg-[#5865F2] px-4 py-2 text-sm font-semibold text-white hover:brightness-110"
    >
      Entrar con Discord
    </button>
  )
}
