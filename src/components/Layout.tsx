import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router'
import { useI18n, type Lang } from '../i18n'
import type { MessageKey } from '../i18n/es'
import { useAuth } from '../lib/auth'
import { ROLE_LABEL } from '../lib/roles'
import { isSearchShortcut } from '../lib/search'
import { GlobalSearch } from './GlobalSearch'

const NAV: { to: string; label: MessageKey }[] = [
  { to: '/pistas', label: 'nav.tracks' },
  { to: '/contrarreloj', label: 'nav.timeTrials' },
  { to: '/tiempos', label: 'nav.times' },
  { to: '/estadisticas', label: 'nav.stats' },
  { to: '/equipos', label: 'nav.teams' },
]

export default function Layout() {
  const [open, setOpen] = useState(false)
  const { isModerator } = useAuth()
  const { t } = useI18n()
  const nav = isModerator ? [...NAV, { to: '/admin', label: 'nav.admin' as const }] : NAV
  const searchRef = useRef<HTMLInputElement>(null)
  // En móvil el atajo abre el menú y enfoca el buscador que hay dentro
  const [focusMobileSearch, setFocusMobileSearch] = useState(false)
  // Entre md y lg no cabe el campo en la cabecera: se abre en una barra aparte
  const [tabletSearch, setTabletSearch] = useState(false)

  // Atajo global: "/" o Ctrl/Cmd + K
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!isSearchShortcut(e)) return
      e.preventDefault()
      const input = searchRef.current
      // offsetParent es null si el buscador de escritorio está oculto (pantalla estrecha)
      if (input && input.offsetParent !== null) {
        input.focus()
        input.select()
      } else if (window.matchMedia('(min-width: 48rem)').matches) {
        // Tableta: el buscador va en una barra bajo la cabecera
        setTabletSearch(true)
      } else {
        setOpen(true)
        setFocusMobileSearch(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const closeMenu = () => {
    setOpen(false)
    setFocusMobileSearch(false)
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <div className="hazard h-1.5" />
      <header className="sticky top-0 z-20 border-b-2 border-line bg-bg">
        <div className="mx-auto flex h-16 max-w-6xl items-stretch gap-6 px-4">
          <Logo onClick={closeMenu} />

          <nav className="hidden flex-1 items-stretch gap-1 md:flex">
            {nav.map((item) => (
              <NavItem key={item.to} to={item.to} label={t(item.label)} />
            ))}
          </nav>

          <div className="ml-auto hidden items-center gap-5 md:flex">
            <div className="hidden w-48 lg:block xl:w-60">
              <GlobalSearch inputRef={searchRef} showShortcut />
            </div>
            <button
              className="font-mono text-xs font-bold text-muted hover:text-kart-yellow lg:hidden"
              onClick={() => setTabletSearch((s) => !s)}
              aria-expanded={tabletSearch}
              aria-label={t('gsearch.label')}
              title={t('gsearch.shortcut')}
            >
              {tabletSearch ? '✕' : t('gsearch.placeholder')}
            </button>
            <LanguageSwitch />
            <AuthButton />
          </div>

          <button
            className="my-auto ml-auto font-display text-lg font-extrabold md:hidden"
            onClick={() => (open ? closeMenu() : setOpen(true))}
            aria-expanded={open}
          >
            {open ? `✕ ${t('nav.close')}` : `≡ ${t('nav.menu')}`}
          </button>
        </div>

        {tabletSearch && (
          <div className="hidden border-t-2 border-line px-4 py-3 md:block lg:hidden">
            <div className="mx-auto max-w-6xl">
              <GlobalSearch floating={false} autoFocus onNavigate={() => setTabletSearch(false)} />
            </div>
          </div>
        )}

        {open && (
          <nav className="flex flex-col border-t-2 border-line px-4 pb-4 md:hidden">
            <div className="pt-4 pb-2">
              <GlobalSearch floating={false} autoFocus={focusMobileSearch} onNavigate={closeMenu} />
            </div>
            {nav.map((item) => (
              <NavItem key={item.to} to={item.to} label={t(item.label)} onClick={closeMenu} />
            ))}
            <div className="mt-4 flex items-center justify-between gap-4">
              <AuthButton />
              <LanguageSwitch />
            </div>
          </nav>
        )}
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10">
        <Outlet />
      </main>

      <footer className="mt-10">
        <div className="checker h-4 opacity-90" />
        <div className="bg-kart-yellow text-bg">
          <div className="mx-auto flex max-w-6xl flex-wrap items-end justify-between gap-6 px-4 py-8">
            <p className="font-display text-6xl leading-[0.8] font-black sm:text-8xl">
              MKW
              <br />
              HUB
            </p>
            <div className="max-w-md space-y-1 text-sm font-medium">
              <p>{t('footer.line1')}</p>
              <p>{t('footer.line2')}</p>
              <p>{t('footer.wrSource')}</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

function Logo({ onClick }: { onClick: () => void }) {
  return (
    <Link to="/" onClick={onClick} className="flex items-center gap-1.5 font-display text-2xl font-black" aria-label="MKW Hub">
      <span className="slant bg-kart-yellow px-3 py-0.5 text-bg">MKW</span>
      <span>HUB</span>
    </Link>
  )
}

function NavItem({ to, label, onClick }: { to: string; label: string; onClick?: () => void }) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      className={({ isActive }) =>
        `relative flex items-center px-3 py-3 font-display text-lg font-extrabold transition-colors md:py-0 ${
          isActive ? 'text-kart-yellow' : 'text-muted hover:text-ink'
        }`
      }
    >
      {({ isActive }) => (
        <>
          {label}
          {isActive && <span className="absolute inset-x-3 bottom-0 h-1 bg-kart-yellow max-md:hidden" />}
        </>
      )}
    </NavLink>
  )
}

function LanguageSwitch() {
  const { lang, setLang, t } = useI18n()
  const langs: Lang[] = ['es', 'en']
  return (
    <div role="group" aria-label={t('nav.language')} className="flex font-mono text-xs font-bold">
      {langs.map((l, i) => (
        <span key={l} className="flex items-center">
          {i > 0 && <span className="px-1 text-line">/</span>}
          <button
            onClick={() => setLang(l)}
            aria-pressed={lang === l}
            className={`uppercase ${lang === l ? 'text-kart-yellow' : 'text-muted hover:text-ink'}`}
          >
            {l}
          </button>
        </span>
      ))}
    </div>
  )
}

function AuthButton() {
  const { user, profile, loading, enabled, signIn, signOut } = useAuth()
  const { t } = useI18n()

  if (!enabled) return <span className="text-xs text-muted">{t('auth.soon')}</span>
  if (loading) return <span className="font-mono text-sm text-muted">…</span>

  if (user) {
    const name = profile?.username ?? user.user_metadata.full_name ?? t('auth.player')
    const avatar = profile?.avatar_url ?? user.user_metadata.avatar_url
    const role = profile?.role === 'moderator' || profile?.role === 'admin' ? profile.role : null
    return (
      <div className="flex items-center gap-3">
        {avatar && <img src={avatar} alt="" className="size-8 border-2 border-kart-yellow" />}
        <span className="text-sm font-semibold">{name}</span>
        {role && (
          <span className="bg-kart-yellow px-1.5 py-0.5 font-mono text-[10px] font-bold text-bg uppercase">
            {t(ROLE_LABEL[role])}
          </span>
        )}
        <button onClick={signOut} className="text-sm text-muted underline-offset-4 hover:text-ink hover:underline">
          {t('auth.signOut')}
        </button>
      </div>
    )
  }

  return (
    <button onClick={signIn} className="btn-yellow text-base">
      {t('auth.signIn')}
    </button>
  )
}
