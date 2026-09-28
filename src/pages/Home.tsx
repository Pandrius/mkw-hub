import { Link } from 'react-router'
import { TRACKS } from '../data/tracks'
import { useI18n } from '../i18n'
import type { MessageKey } from '../i18n/es'

const SECTIONS: { to: string; title: MessageKey; text: MessageKey; color: string }[] = [
  { to: '/pistas', title: 'nav.tracks', text: 'home.sectionTracks', color: 'var(--color-kart-red)' },
  { to: '/contrarreloj', title: 'nav.timeTrials', text: 'home.sectionTT', color: 'var(--color-kart-yellow)' },
  { to: '/estadisticas', title: 'nav.stats', text: 'home.sectionStats', color: 'var(--color-kart-green)' },
  { to: '/equipos', title: 'home.sectionTeamsTitle', text: 'home.sectionTeams', color: 'var(--color-kart-blue)' },
]

export default function Home() {
  const { t } = useI18n()
  const mainTracks = TRACKS.filter((tr) => !tr.parentId).length
  const snesTracks = TRACKS.length - mainTracks

  return (
    <div className="space-y-12">
      <section className="relative overflow-hidden rounded-3xl border border-line bg-surface px-6 py-12 sm:px-10 sm:py-16">
        <div
          className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full opacity-30 blur-3xl"
          style={{ background: 'radial-gradient(circle, var(--color-kart-red), transparent 70%)' }}
        />
        <div
          className="pointer-events-none absolute -bottom-24 right-24 size-72 rounded-full opacity-25 blur-3xl"
          style={{ background: 'radial-gradient(circle, var(--color-kart-blue), transparent 70%)' }}
        />
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-kart-yellow">{t('home.kicker')}</p>
        <h1 className="mt-3 max-w-3xl font-display text-4xl font-black italic leading-[1.05] tracking-tight sm:text-6xl">
          {t('home.title')}
        </h1>
        <p className="mt-4 max-w-xl text-lg text-muted">{t('home.subtitle')}</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link to="/pistas" className="rounded-xl bg-kart-yellow px-5 py-3 font-bold text-bg hover:brightness-105">
            {t('home.ctaTracks')}
          </Link>
          <Link to="/estadisticas" className="rounded-xl border border-line px-5 py-3 font-bold hover:bg-surface-2">
            {t('home.ctaStats')}
          </Link>
        </div>
        <dl className="mt-10 flex flex-wrap gap-8 text-sm">
          <Stat value={mainTracks} label={t('home.statTracks')} />
          <Stat value={snesTracks} label={t('home.statSnes')} />
          <Stat value="6v6" label={t('home.statWars')} />
        </dl>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        {SECTIONS.map((s) => (
          <Link
            key={s.to}
            to={s.to}
            className="group rounded-2xl border border-line bg-surface p-6 transition-colors hover:border-[color:var(--c)]"
            style={{ '--c': s.color } as React.CSSProperties}
          >
            <div className="mb-3 h-1 w-10 rounded-full" style={{ background: s.color }} />
            <h2 className="font-display text-xl font-bold">{t(s.title)}</h2>
            <p className="mt-1 text-sm text-muted">{t(s.text)}</p>
          </Link>
        ))}
      </section>
    </div>
  )
}

function Stat({ value, label }: { value: number | string; label: string }) {
  return (
    <div>
      <dt className="sr-only">{label}</dt>
      <dd>
        <span className="font-display text-3xl font-black">{value}</span> <span className="text-muted">{label}</span>
      </dd>
    </div>
  )
}
