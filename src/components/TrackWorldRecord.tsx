import { useEffect, useState } from 'react'
import { useI18n } from '../i18n'
import { youtubeId } from '../lib/tips'
import { formatDate, formatTime } from '../lib/time'
import { currentRecord, daysSince, listTrackWorldRecords, type WorldRecord } from '../lib/worldRecords'
import { useAuth } from '../lib/auth'
import { Flag } from './ui'

/** Récord mundial vigente de una pista (con vídeo) y su historial. */
export default function TrackWorldRecord({ trackId }: { trackId: string }) {
  const { t, locale } = useI18n()
  const { enabled } = useAuth()
  const [history, setHistory] = useState<WorldRecord[] | null>(null)
  const [error, setError] = useState(false)
  const [showHistory, setShowHistory] = useState(false)

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    listTrackWorldRecords(trackId).then(
      (data) => !cancelled && setHistory(data),
      () => !cancelled && setError(true),
    )
    return () => {
      cancelled = true
    }
  }, [enabled, trackId])

  if (!enabled) return null
  if (error) return <p className="text-kart-red">{t('common.loadError')}</p>
  if (!history) return <div className="h-40 animate-pulse panel" />

  const wr = currentRecord(history)
  if (!wr) return <p className="panel p-5 text-muted">{t('wr.none')}</p>

  const days = daysSince(wr.achieved_on)
  const videoId = wr.video_url ? youtubeId(wr.video_url) : null
  const date = (d: string) => formatDate(d, locale)

  return (
    <section className="overflow-hidden rounded-2xl border border-kart-yellow/50 bg-surface">
      <div className="grid gap-0 md:grid-cols-[1fr_1.2fr]">
        <div className="p-5">
          <p className="font-mono text-xs font-bold tracking-widest text-kart-yellow">{t('wr.current')}</p>
          <p className="time mt-2 text-5xl">{formatTime(wr.time_ms)}</p>
          <p className="mt-2 flex items-center gap-2 text-lg font-semibold">
            <Flag code={wr.country_code} locale={locale} />
            {wr.player_name}
          </p>
          <p className="mt-1 text-sm text-muted">
            {date(wr.achieved_on)} · {days === 0 ? t('wr.today') : days === 1 ? t('wr.heldFor1') : t('wr.heldFor', { days })}
          </p>
          {(wr.character || wr.vehicle) && (
            <p className="mt-3 text-sm">
              <span className="text-muted">{t('wr.colCombo')}: </span>
              {[wr.character, wr.vehicle].filter(Boolean).join(' · ')}
            </p>
          )}
          {wr.splits.length > 0 && (
            <div className="mt-3">
              <p className="text-xs text-muted">{t('wr.splits')}</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {wr.splits.map((s, i) => (
                  <span key={i} className="rounded-md bg-surface-2 px-2 py-0.5 font-mono text-xs tabular-nums">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}
          {wr.video_url && !videoId && (
            <a href={wr.video_url} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm text-kart-blue hover:underline">
              {t('common.watchVideo')}
            </a>
          )}
        </div>
        {videoId && (
          <div className="aspect-video bg-bg md:aspect-auto">
            <iframe
              className="size-full min-h-48"
              src={`https://www.youtube-nocookie.com/embed/${videoId}`}
              title={`${t('wr.current')} · ${wr.player_name}`}
              allow="encrypted-media; picture-in-picture"
              allowFullScreen
              loading="lazy"
            />
          </div>
        )}
      </div>

      <div className="border-t border-line">
        <button
          onClick={() => setShowHistory((s) => !s)}
          className="w-full px-5 py-3 text-left text-sm font-semibold text-muted hover:bg-surface-2 hover:text-ink"
          aria-expanded={showHistory}
        >
          {showHistory ? t('wr.hideHistory') : t('wr.showHistory')} ({history.length}) {showHistory ? '▴' : '▾'}
        </button>
        {showHistory && (
          <div className="max-h-96 overflow-auto border-t border-line">
            <table className="w-full text-sm">
              <thead className="bg-bg text-left font-display text-sm tracking-wider text-kart-yellow">
                <tr>
                  <th className="px-4 py-2 font-extrabold">{t('wr.colDate')}</th>
                  <th className="px-4 py-2 font-extrabold">{t('wr.colTime')}</th>
                  <th className="px-4 py-2 font-extrabold">{t('wr.colPlayer')}</th>
                  <th className="hidden px-4 py-2 text-right font-extrabold sm:table-cell">{t('wr.colDays')}</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {history.map((r) => (
                  <tr key={r.id} className="border-t border-line/60">
                    <td className="whitespace-nowrap px-4 py-2 text-muted">{date(r.achieved_on)}</td>
                    <td className="time px-4 py-2">{formatTime(r.time_ms)}</td>
                    <td className="px-4 py-2">
                      <span className="flex items-center gap-2">
                        <Flag code={r.country_code} locale={locale} />
                        {r.player_name}
                      </span>
                    </td>
                    <td className="hidden px-4 py-2 text-right tabular-nums text-muted sm:table-cell">
                      {r.id === wr.id ? days : r.days_held ?? ''}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {r.video_url && (
                        <a href={r.video_url} target="_blank" rel="noreferrer" className="text-kart-blue hover:underline">
                          {t('common.video')}
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}
