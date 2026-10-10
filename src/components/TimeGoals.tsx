import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { TRACKS, getTrackColor, getTrackTextColor } from '../data/tracks'
import { useI18n } from '../i18n'
import type { BestTime } from '../lib/compare'
import { formatTime } from '../lib/time'
import { listTimesForTracks, type TtCategory } from '../lib/timeTrials'
import { buildGoals, formatGap, formatPct, type RankTime, type TrackGoal } from '../lib/ttGoals'
import { Plate } from './ui'

/** Tarjetas que se ven sin desplegar */
const COLLAPSED = 6

/**
 * Objetivos de contrarreloj de un jugador: en cada pista donde tiene tiempo, lo que le
 * falta para el siguiente puesto y el siguiente escalón de la comunidad, y su % del récord.
 */
export default function TimeGoals({
  profileId,
  category,
  nita,
  times,
  wrs,
}: {
  profileId: string
  category: TtCategory
  nita: boolean
  /** Mejores tiempos del jugador en esta categoría y modo */
  times: BestTime[]
  /** Récord de cada pista (solo en carrera con items, que es lo que publica mkwrs) */
  wrs: Map<string, number> | null
}) {
  const { t } = useI18n()
  const [community, setCommunity] = useState<{ key: string; times: RankTime[] } | null>(null)
  const [expanded, setExpanded] = useState(false)

  const mine = useMemo(() => times.filter((x) => x.profile_id === profileId), [times, profileId])
  const trackKey = mine.map((x) => x.track_id).join(',')
  // Cambia si cambian las pistas o los propios tiempos (p. ej. al añadir uno)
  const key = `${category}|${nita}|${mine.map((x) => `${x.track_id}:${x.time_ms}`).join(',')}`

  useEffect(() => {
    if (!trackKey) return
    let cancelled = false
    listTimesForTracks(trackKey.split(','), category, nita).then(
      (data) => !cancelled && setCommunity({ key, times: data }),
      () => !cancelled && setCommunity({ key, times: [] }),
    )
    return () => {
      cancelled = true
    }
  }, [trackKey, key, category, nita])

  if (mine.length === 0 || !community || community.key !== key) return null

  const goals = buildGoals(profileId, mine, community.times, wrs)
  const visible = expanded ? goals : goals.slice(0, COLLAPSED)

  return (
    <section className="mb-6">
      <div className="mb-3">
        <h2 className="font-display text-2xl font-black">{t('ttGoals.title')}</h2>
        <p className="text-sm text-muted">{t('ttGoals.hint')}</p>
      </div>
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((g) => (
          <GoalCard key={g.trackId} goal={g} />
        ))}
      </ul>
      {goals.length > COLLAPSED && (
        <button onClick={() => setExpanded((v) => !v)} className="mt-2 text-sm font-semibold text-muted underline-offset-4 hover:text-kart-yellow hover:underline">
          {expanded ? t('ttGoals.showLess') : t('ttGoals.showAll', { n: goals.length })}
        </button>
      )}
    </section>
  )
}

function GoalCard({ goal: g }: { goal: TrackGoal }) {
  const { t, locale } = useI18n()
  const track = TRACKS.find((tr) => tr.id === g.trackId)
  const gap = (ms: number) => formatGap(ms, locale)
  const signed = (ms: number) => `${ms >= 0 ? '+' : '−'}${gap(ms)}`

  return (
    <li
      className={`panel px-3 py-2.5 ${g.mostMargin ? 'border-kart-red' : ''}`}
      style={g.mostMargin ? { boxShadow: 'inset 4px 0 0 var(--color-kart-red)' } : undefined}
    >
      <div className="flex items-center gap-2">
        <Link to={`/pistas/${g.trackId}`} className="flex min-w-0 flex-1 items-center gap-2 hover:text-kart-yellow">
          <Plate color={getTrackColor(track)} textColor={getTrackTextColor(track)}>{track?.abbr ?? g.trackId}</Plate>
          <span className="truncate text-sm font-semibold">{track?.name ?? g.trackId}</span>
        </Link>
        <span className="time text-base">{formatTime(g.timeMs)}</span>
      </div>

      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-xs font-bold">
        <span className={g.position === 1 ? 'text-kart-yellow' : 'text-ink'}>{t('ttGoals.position', { pos: g.position, total: g.total })}</span>
        {g.mostMargin && <span className="bg-kart-red px-1.5 py-0.5 text-[10px] tracking-wide text-ink uppercase">{t('ttGoals.mostMargin')}</span>}
      </div>

      <ul className="mt-1.5 space-y-0.5 text-xs text-muted">
        {g.next && (
          <li>
            <span className="text-ink">▸</span> {t('ttGoals.next', { gap: gap(g.next.gapMs), pos: g.next.position, player: g.next.playerName })}
          </li>
        )}
        {g.milestone && (
          <li>
            <span className="text-ink">▸</span>{' '}
            {g.milestone.top === 1
              ? t('ttGoals.first', { gap: gap(g.milestone.gapMs) })
              : t('ttGoals.top', { gap: gap(g.milestone.gapMs), n: g.milestone.top })}
          </li>
        )}
        {g.leadMs !== null && <li className="text-kart-yellow">★ {t('ttGoals.leader', { gap: gap(g.leadMs) })}</li>}
        {g.total === 1 && <li>{t('ttGoals.alone')}</li>}
        {g.pct !== null && g.refGapMs !== null && (
          <li className={g.mostMargin ? 'font-semibold text-ink' : undefined}>
            {t(g.reference === 'wr' ? 'ttGoals.wrPct' : 'ttGoals.communityPct', { pct: formatPct(g.pct, locale), gap: signed(g.refGapMs) })}
          </li>
        )}
      </ul>
    </li>
  )
}
