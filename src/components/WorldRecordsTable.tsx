import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { getCup, TRACKS } from '../data/tracks'
import { useI18n } from '../i18n'
import { useAuth } from '../lib/auth'
import { formatDate, formatTime } from '../lib/time'
import { daysSince, listCurrentWorldRecords, type WorldRecord } from '../lib/worldRecords'
import { Flag } from './ui'

/** Récord mundial vigente de las 40 pistas. */
export default function WorldRecordsTable() {
  const { t, locale } = useI18n()
  const { enabled } = useAuth()
  const [records, setRecords] = useState<Map<string, WorldRecord> | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    listCurrentWorldRecords().then(
      (data) => !cancelled && setRecords(new Map(data.map((r) => [r.track_id, r]))),
      () => !cancelled && setError(true),
    )
    return () => {
      cancelled = true
    }
  }, [enabled])

  if (error) return <p className="text-kart-red">{t('common.loadError')}</p>
  if (!records) return <p className="text-muted">{t('common.loading')}</p>

  return (
    <div className="overflow-hidden panel">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-bg text-left font-display text-sm tracking-wider text-kart-yellow">
            <tr>
              <th className="px-4 py-2.5 font-extrabold">{t('wr.colTrack')}</th>
              <th className="px-4 py-2.5 font-extrabold">{t('wr.colTime')}</th>
              <th className="px-4 py-2.5 font-extrabold">{t('wr.colPlayer')}</th>
              <th className="hidden px-4 py-2.5 font-extrabold md:table-cell">{t('wr.colDate')}</th>
              <th className="hidden px-4 py-2.5 text-right font-extrabold md:table-cell">{t('wr.colDays')}</th>
              <th className="hidden px-4 py-2.5 font-extrabold lg:table-cell">{t('wr.colCombo')}</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {TRACKS.map((track) => {
              const r = records.get(track.id)
              const color = getCup(track.cupId)?.color
              return (
                <tr key={track.id} className="border-t border-line/60 hover:bg-surface-2/40">
                  <td className="px-4 py-2.5">
                    <Link to={`/pistas/${track.id}`} className="flex items-baseline gap-2 hover:underline">
                      <span className="w-12 shrink-0 font-display font-black normal-case" style={{ color }}>
                        {track.abbr}
                      </span>
                      <span className="whitespace-nowrap">{track.name}</span>
                    </Link>
                  </td>
                  {r ? (
                    <>
                      <td className="time px-4 py-2.5 text-base">{formatTime(r.time_ms)}</td>
                      <td className="px-4 py-2.5">
                        <span className="flex items-center gap-2 whitespace-nowrap">
                          <Flag code={r.country_code} locale={locale} />
                          {r.player_name}
                        </span>
                      </td>
                      <td className="hidden whitespace-nowrap px-4 py-2.5 text-muted md:table-cell">
                        {formatDate(r.achieved_on, locale)}
                      </td>
                      <td className="hidden px-4 py-2.5 text-right tabular-nums text-muted md:table-cell">
                        {daysSince(r.achieved_on)}
                      </td>
                      <td className="hidden whitespace-nowrap px-4 py-2.5 text-muted lg:table-cell">
                        {[r.character, r.vehicle].filter(Boolean).join(' · ')}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {r.video_url && (
                          <a href={r.video_url} target="_blank" rel="noreferrer" className="text-kart-blue hover:underline">
                            {t('common.video')}
                          </a>
                        )}
                      </td>
                    </>
                  ) : (
                    <td colSpan={6} className="px-4 py-2.5 text-muted">
                      —
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="border-t border-line px-4 py-2 text-xs text-muted">{t('wr.source')}</p>
    </div>
  )
}
