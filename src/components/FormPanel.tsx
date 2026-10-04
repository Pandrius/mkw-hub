import { Link } from 'react-router'
import { getTrack } from '../data/tracks'
import { useI18n } from '../i18n'
import type { MessageKey } from '../i18n/es'
import { MIN_FORM_RACES, type Badge, type BadgeTone, type PlayerForm, type Streak } from '../lib/form'
import type { TeamForm } from '../lib/teamForm'
import { EmptyState } from './ui'

const TONE_COLOR: Record<BadgeTone, string> = {
  good: 'var(--color-kart-green)',
  bad: 'var(--color-kart-red)',
  weird: 'var(--color-kart-blue)',
}

const BADGE_ICON: Record<string, string> = {
  winStreak: '💣',
  winner: '🏆',
  blueShell: '💥',
  redLantern: '☁️',
  almostPodium: '👑',
  cursedTrack: '👻',
  hangover: '🍌',
  rollercoaster: '🌈',
  metronome: '🤖',
  roulette: '❓',
  diesel: '🐛',
  fadeOut: '🍄',
  clutch: '⚡',
  part_morning: '🌅',
  part_afternoon: '🐢',
  part_night: '🌙',
  teamPlayer: '👬',
  loneWolf: '💰',
  tourist: '🗺️',
  homebody: '🔁',
  comeback: '🔵',
  collapse: '🕳️',
  thrashing: '⛓️',
  beatdown: '🧱',
  ironNerves: '📸',
  heartAttack: '💔',
  nemesis: '🐲',
  favouriteVictim: '👟',
  strongFinish: '💨',
  fastStart: '🚀',
}

/** Color de una posición: podio amarillo, top 6 verde, mitad de abajo apagada, cola roja */
function positionColor(p: number): string {
  if (p <= 3) return 'var(--color-kart-yellow)'
  if (p <= 6) return 'var(--color-kart-green)'
  if (p <= 9) return 'var(--color-line)'
  return 'var(--color-kart-red)'
}

const signed = (n: number) => (n > 0 ? `+${n}` : String(n))

/** Forma reciente, rachas y curiosidades de un jugador */
export function PlayerFormPanel({ form }: { form: PlayerForm | null }) {
  const { t } = useI18n()

  return (
    <section className="space-y-4">
      <h3 className="font-display text-xl font-bold">{t('form.title')}</h3>
      {!form ? (
        <EmptyState title={t('form.notEnough', { n: MIN_FORM_RACES })} />
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
            <div className="panel p-5">
              <p className={`font-display text-3xl font-black sm:text-4xl ${trendClass(form.trend)}`}>{t(`form.trend.${form.trend}`)}</p>
              <p className="mt-2 text-sm">
                {t('form.recent', { n: form.lastPositions.length, recent: form.recentAverage.toFixed(2) })}{' '}
                <span className={`time font-bold ${form.delta < 0 ? 'text-kart-green' : form.delta > 0 ? 'text-kart-red' : 'text-muted'}`}>
                  ({signed(form.delta)})
                </span>
              </p>
              <p className="text-xs text-muted">{t('form.usual', { overall: form.overallAverage.toFixed(2) })}</p>

              <p className="mt-4 font-mono text-xs font-bold tracking-widest text-muted uppercase">{t('form.lastRaces')}</p>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {form.lastPositions.map((p, i) => (
                  <span
                    key={i}
                    className="time grid size-7 place-items-center text-sm font-bold"
                    style={{ background: positionColor(p), color: p <= 6 ? 'var(--color-bg)' : 'var(--color-ink)' }}
                  >
                    {p}
                  </span>
                ))}
              </div>
            </div>

            <div className="panel p-5">
              <p className="font-mono text-xs font-bold tracking-widest text-muted uppercase">{t('form.byEvent')}</p>
              <EventBars form={form} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StreakCard label={t('form.streak.top6')} streak={form.streaks.top6} color="var(--color-kart-green)" />
            <StreakCard label={t('form.streak.podium')} streak={form.streaks.podium} color="var(--color-kart-yellow)" />
            <StreakCard label={t('form.streak.win')} streak={form.streaks.win} color="var(--color-kart-yellow)" />
            <StreakCard label={t('form.streak.bottom')} streak={form.streaks.bottom} color="var(--color-kart-red)" bad />
          </div>

          <BadgeGrid badges={form.badges} />
        </>
      )}
    </section>
  )
}

/** Barras con la media de cada evento (más alta = mejor), los últimos 12 */
function EventBars({ form }: { form: PlayerForm }) {
  const events = form.events.slice(-12)
  const h = 96
  const w = 100 / events.length
  return (
    <svg viewBox={`0 0 100 ${h + 14}`} preserveAspectRatio="none" className="mt-3 h-36 w-full" role="img" aria-label="">
      {/* Línea de la media habitual */}
      <line
        x1="0"
        x2="100"
        y1={h - ((12 - form.overallAverage) / 11) * h}
        y2={h - ((12 - form.overallAverage) / 11) * h}
        stroke="var(--color-muted)"
        strokeDasharray="1.5 1.5"
        strokeWidth="0.4"
        vectorEffect="non-scaling-stroke"
      />
      {events.map((e, i) => {
        const bar = Math.max(3, ((12 - e.average) / 11) * h)
        return (
          <Link key={e.eventId} to={`/eventos/${e.eventId}`}>
            <rect x={i * w + w * 0.15} y={h - bar} width={w * 0.7} height={bar} fill={positionColor(Math.round(e.average))}>
              <title>{`${e.date.slice(0, 10)} · ${e.kind} · ${e.average.toFixed(2)}`}</title>
            </rect>
          </Link>
        )
      })}
    </svg>
  )
}

function trendClass(trend: PlayerForm['trend']): string {
  if (trend === 'fire' || trend === 'up') return 'text-kart-green'
  if (trend === 'down' || trend === 'ice') return 'text-kart-red'
  return 'text-ink'
}

function StreakCard({ label, streak, color, bad }: { label: string; streak: Streak; color: string; bad?: boolean }) {
  const { t } = useI18n()
  return (
    <div className="panel border-l-4 p-4" style={{ borderLeftColor: color }}>
      <p className="text-xs text-muted sm:text-sm">{label}</p>
      <div className="mt-1 flex items-baseline gap-3">
        <p className="time text-3xl font-bold" style={{ color: streak.current ? color : undefined }}>
          {streak.current}
        </p>
        <p className="font-mono text-xs text-muted">
          {bad ? t('form.worst') : t('form.best')}: <span className="font-bold text-ink">{streak.best}</span>
        </p>
      </div>
      <p className="font-mono text-[11px] text-muted uppercase">{t('form.current')}</p>
    </div>
  )
}

function BadgeGrid({ badges }: { badges: Badge[] }) {
  const { t } = useI18n()
  return (
    <div>
      <h4 className="mb-3 font-display text-lg font-bold">{t('form.badges')}</h4>
      {badges.length === 0 ? (
        <p className="text-sm text-muted">{t('form.noBadges')}</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {badges.map((b) => (
            <BadgeCard key={b.id} badge={b} />
          ))}
        </div>
      )}
    </div>
  )
}

function BadgeCard({ badge }: { badge: Badge }) {
  const { t } = useI18n()
  const vars = { ...badge.vars }
  // Las pistas llegan como id: se muestra su nombre
  if (typeof vars.track === 'string') vars.track = getTrack(vars.track)?.name ?? vars.track
  // En los de equipo, el arranque y el cierre son diferencias: con signo
  for (const k of ['start', 'end'] as const) {
    if (typeof vars[k] === 'number' && (badge.id === 'strongFinish' || badge.id === 'fastStart')) vars[k] = signed(vars[k] as number)
  }
  const color = TONE_COLOR[badge.tone]
  return (
    <div className="panel flex gap-3 p-4" style={{ borderTop: `3px solid ${color}` }}>
      <span className="text-3xl leading-none" aria-hidden>
        {BADGE_ICON[badge.id] ?? '★'}
      </span>
      <div className="min-w-0">
        <p className="font-mono text-[10px] font-bold tracking-widest uppercase" style={{ color }}>
          {t(`form.tone.${badge.tone}`)}
        </p>
        <p className="font-display text-lg leading-tight font-extrabold">{t(`form.badge.${badge.id}.title` as MessageKey, vars)}</p>
        <p className="mt-1 text-sm text-muted">{t(`form.badge.${badge.id}.desc` as MessageKey, vars)}</p>
      </div>
    </div>
  )
}

/** Forma, rachas y curiosidades de un equipo */
export function TeamFormPanel({ form }: { form: TeamForm | null }) {
  const { t } = useI18n()
  if (!form) return null
  const resultColor = (r: 'W' | 'L' | 'T') =>
    r === 'W' ? 'var(--color-kart-green)' : r === 'L' ? 'var(--color-kart-red)' : 'var(--color-kart-yellow)'

  return (
    <section className="space-y-4">
      <h3 className="font-display text-xl font-bold">{t('form.title')}</h3>
      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <div className="panel p-5">
          <p className="font-mono text-xs font-bold tracking-widest text-muted uppercase">{t('form.team.lastWars')}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {form.last.map((w) => (
              <Link
                key={w.eventId}
                to={`/eventos/${w.eventId}`}
                className="flex min-w-16 flex-col items-center border-2 px-2 py-1.5 hover:bg-surface-2"
                style={{ borderColor: resultColor(w.result) }}
                title={`${w.home} – ${w.away}`}
              >
                <span className="font-display text-2xl leading-none font-black" style={{ color: resultColor(w.result) }}>
                  {w.result}
                </span>
                <span className="font-mono text-[11px] font-bold">{signed(w.diff)}</span>
                <span className="max-w-16 truncate font-mono text-[10px] text-muted">{w.opponent}</span>
              </Link>
            ))}
          </div>
          {form.current && (
            <p className="mt-4 text-sm">
              {t('form.team.current')}:{' '}
              <span className="time text-xl font-bold" style={{ color: resultColor(form.current.result) }}>
                {form.current.length} {form.current.result}
              </span>
            </p>
          )}
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-1">
          <TeamStat label={t('form.team.winStreak')} value={t('form.team.wars', { n: form.winStreak.best })} color="var(--color-kart-green)" />
          <TeamStat label={t('form.team.lossStreak')} value={t('form.team.wars', { n: form.lossStreak.best })} color="var(--color-kart-red)" />
          <TeamStat label={t('form.team.raceWinStreak')} value={t('form.team.races', { n: form.raceWinStreak.best })} color="var(--color-kart-yellow)" />
        </div>
      </div>
      <BadgeGrid badges={form.badges} />
    </section>
  )
}

function TeamStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="panel flex items-baseline justify-between gap-3 border-l-4 px-4 py-3" style={{ borderLeftColor: color }}>
      <span className="text-sm text-muted">{label}</span>
      <span className="time text-xl font-bold">{value}</span>
    </div>
  )
}
