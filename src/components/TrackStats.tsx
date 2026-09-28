import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { useI18n } from '../i18n'
import { useAuth } from '../lib/auth'
import { getPlayerResults, type PlayerResult } from '../lib/events'
import { computeStats, type StatsFilter } from '../lib/stats'
import { EmptyState } from './ui'

/** Rendimiento del usuario en una pista: media en War, Lounge y en total */
export default function TrackStats({ trackId }: { trackId: string }) {
  const { t } = useI18n()
  const { profile, loading } = useAuth()
  const [results, setResults] = useState<PlayerResult[] | null>(null)

  useEffect(() => {
    if (!profile) return
    let cancelled = false
    getPlayerResults(profile.id).then(
      (data) => !cancelled && setResults(data.filter((r) => r.track_id === trackId)),
      () => !cancelled && setResults([]),
    )
    return () => {
      cancelled = true
    }
  }, [profile, trackId])

  if (loading) return null
  if (!profile) return <EmptyState title={t('tracks.statsTitle')}>{t('tracks.statsSignIn')}</EmptyState>
  if (!results) return <p className="text-muted">{t('common.loading')}</p>
  if (results.length === 0) return <EmptyState title={t('tracks.statsTitle')}>{t('tracks.statsNone')}</EmptyState>

  const filters: { id: StatsFilter; label: string }[] = [
    { id: 'all', label: t('stats.all') },
    { id: 'war', label: t('stats.war') },
    { id: 'lounge', label: t('stats.lounge') },
  ]

  return (
    <section className="space-y-4">
      <h3 className="font-display text-xl font-bold">{t('tracks.statsTitle')}</h3>
      <div className="grid gap-3 sm:grid-cols-3">
        {filters.map((f) => {
          const s = computeStats(results, f.id)
          return (
            <div key={f.id} className="rounded-2xl border border-line bg-surface p-4">
              <p className="text-sm font-semibold text-muted">{f.label}</p>
              <p className="mt-1 font-display text-3xl font-black tabular-nums text-kart-yellow">
                {s.average?.toFixed(2) ?? '—'}
              </p>
              <p className="text-xs text-muted">
                {t('stats.races')}: {s.races}
                {s.tracks[0] && ` · ${t('stats.colBest')}: ${s.tracks[0].best}`}
              </p>
            </div>
          )
        })}
      </div>
      <Link to="/estadisticas" className="inline-block text-sm text-kart-blue hover:underline">
        {t('stats.mine')} →
      </Link>
    </section>
  )
}
