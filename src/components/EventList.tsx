import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { useI18n } from '../i18n'
import { listEventsFor, type GameEvent } from '../lib/events'
import { formatDate } from '../lib/time'
import { EmptyState } from './ui'

/** Eventos de un jugador: primero los abiertos, luego los finalizados */
export default function EventList({ profileId }: { profileId: string }) {
  const { t, locale } = useI18n()
  const [events, setEvents] = useState<(GameEvent & { races: number })[] | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    listEventsFor(profileId).then(
      (data) => !cancelled && setEvents(data),
      () => !cancelled && setError(true),
    )
    return () => {
      cancelled = true
    }
  }, [profileId])

  if (error) return <p className="text-kart-red">{t('common.loadError')}</p>
  if (!events) return <p className="text-muted">{t('common.loading')}</p>
  if (events.length === 0) return <EmptyState title={t('stats.noEvents')} />

  const sorted = [...events].sort((a, b) => (a.status === b.status ? 0 : a.status === 'open' ? -1 : 1))

  return (
    <ul className="overflow-hidden panel">
      {sorted.map((e) => (
        <li key={e.id} className="border-b border-line last:border-b-0">
          <Link to={`/eventos/${e.id}`} className="flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-surface-2/50">
            <span
              className={`px-2 py-0.5 font-mono text-[11px] font-bold uppercase ${
                e.kind === 'war' ? 'bg-kart-yellow text-bg' : 'bg-ink text-bg'
              }`}
            >
              {t(e.kind === 'war' ? 'event.war' : 'event.lounge')}
            </span>
            <span className="flex-1 font-semibold">
              {e.kind === 'war' ? `${e.team_tag ?? '?'} ${t('event.vs')} ${e.opponent_tag ?? '?'}` : 'Lounge'}
            </span>
            <span className="text-sm text-muted">{t('event.racesCount', { n: e.races })}</span>
            <span className="text-sm text-muted">{formatDate(e.created_at, locale)}</span>
            <span className={`text-xs font-bold uppercase ${e.status === 'open' ? 'text-kart-yellow' : 'text-muted'}`}>
              {t(e.status === 'open' ? 'event.open' : 'event.finished')}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
