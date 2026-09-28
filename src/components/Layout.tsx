import { useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router'
import { useI18n, type Lang } from '../i18n'
import type { MessageKey } from '../i18n/es'
import { useAuth } from '../lib/auth'
import { ROLE_LABEL } from '../lib/roles'

const NAV: { to: string; label: MessageKey }[] = [
  { to: '/pistas', label: 'nav.tracks' },
  { to: '/contrarreloj', label: 'nav.timeTrials' },
  { to: '/estadisticas', label: 'nav.stats' },
  { to: '/equipos', label: 'nav.teams' },
]

export default function Layout() {
  const [open, setOpen] = useState(false)
  const { isModerator } = useAuth()
  const { t } = useI18n()
  const nav = isModerator ? [...NAV, { to: '/admin', label: 'nav.admin' as const }] : NAV

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-20 border-b border-line bg-bg/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4">
          <Link to="/" className="flex items-center gap-2" onClick={() => setOpen(false)}>
            <img src="/favicon.svg" alt="" className="size-8" />
            <span className="font-display text-xl font-black italic tracking-tight">
              MKW <span className="text-kart-yellow">Hub</span>
            </span>
          </Link>

          <nav className="hidden flex-1 items-center gap-1 md:flex">
            {nav.map((item) => (
              <NavItem key={item.to} to={item.to} label={t(item.label)} />
            ))}
          </nav>

          <div className="ml-auto hidden items-center gap-4 md:flex">
            <LanguageSwitch />
            <AuthButton />
          </div>

          <button
            className="ml-auto rounded-lg border border-line px-3 py-1.5 text-sm md:hidden"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
          >
            {open ? t('nav.close') : t('nav.menu')}
          </button>
        </div>

        {open && (
          <nav className="flex flex-col gap-1 border-t border-line px-4 py-3 md:hidden">
            {nav.map((item) => (
              <NavItem key={item.to} to={item.to} label={t(item.label)} onClick={() => setOpen(false)} />
            ))}
            <div className="flex items-center justify-between gap-4 pt-2">
              <AuthButton />
              <LanguageSwitch />
            </div>
          </nav>
        )}
        <div className="checker h-1.5 opacity-20" />
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <Outlet />
      </main>

      <footer className="border-t border-line py-6 text-center text-xs text-muted">
        <p>{t('footer.line1')}</p>
        <p className="mt-1">{t('footer.line2')}</p>
        <p className="mt-1">{t('footer.wrSource')}</p>
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

function LanguageSwitch() {
  const { lang, setLang, t } = useI18n()
  const langs: Lang[] = ['es', 'en']
  return (
    <div role="group" aria-label={t('nav.language')} className="flex rounded-lg border border-line p-0.5 text-xs font-bold">
      {langs.map((l) => (
        <button
          key={l}
          onClick={() => setLang(l)}
          aria-pressed={lang === l}
          className={`rounded-md px-2 py-1 uppercase ${lang === l ? 'bg-surface-2 text-kart-yellow' : 'text-muted hover:text-ink'}`}
        >
          {l}
        </button>
      ))}
    </div>
  )
}

function AuthButton() {
  const { user, profile, loading, enabled, signIn, signOut } = useAuth()
  const { t } = useI18n()

  if (!enabled) return <span className="text-xs text-muted">{t('auth.soon')}</span>
  if (loading) return <span className="text-sm text-muted">…</span>

  if (user) {
    const name = profile?.username ?? user.user_metadata.full_name ?? t('auth.player')
    const avatar = profile?.avatar_url ?? user.user_metadata.avatar_url
    const role = profile?.role === 'moderator' || profile?.role === 'admin' ? profile.role : null
    return (
      <div className="flex items-center gap-3">
        {avatar && <img src={avatar} alt="" className="size-8 rounded-full" />}
        <span className="text-sm font-semibold">{name}</span>
        {role && (
          <span className="rounded-md bg-kart-yellow/15 px-1.5 py-0.5 text-[11px] font-bold uppercase text-kart-yellow">
            {t(ROLE_LABEL[role])}
          </span>
        )}
        <button onClick={signOut} className="text-sm text-muted hover:text-ink">
          {t('auth.signOut')}
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={signIn}
      className="rounded-lg bg-[#5865F2] px-4 py-2 text-sm font-semibold text-white hover:brightness-110"
    >
      {t('auth.signIn')}
    </button>
  )
}
