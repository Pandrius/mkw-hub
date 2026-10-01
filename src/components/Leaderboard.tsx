import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'
import { useI18n } from '../i18n'
import { useAuth } from '../lib/auth'
import { formatDate, formatTime } from '../lib/time'
import { bestPerPlayer, deleteTime, listTimes, type TimeTrial, type TtCategory } from '../lib/timeTrials'
import { getProfileTeams } from '../lib/compare'
import AddTimeForm from './AddTimeForm'
import { EmptyState, Flag } from './ui'

const MEDALS = ['#ffd500', '#d6d3cc', '#e0914a']

export default function Leaderboard({ trackId, category, nita }: { trackId: string; category: TtCategory; nita: boolean }) {
  const { t, locale } = useI18n()
  const { enabled, profile, isTtEditor } = useAuth()
  const [times, setTimes] = useState<TimeTrial[] | null>(null)
  const [teamTags, setTeamTags] = useState<Map<string, { id: number; tag: string; name: string }[]>>(new Map())
  const [error, setError] = useState(false)
  const [adding, setAdding] = useState<'mine' | 'other' | null>(null)

  const reload = useCallback(
    () =>
      listTimes(trackId, category, nita).then(
        (data) => setTimes(bestPerPlayer(data)),
        () => setError(true),
      ),
    [trackId, category, nita],
  )

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    listTimes(trackId, category, nita).then(
      (data) => !cancelled && setTimes(bestPerPlayer(data)),
      () => !cancelled && setError(true),
    )
    return () => {
      cancelled = true
    }
  }, [enabled, trackId, category, nita])

  useEffect(() => {
    if (!times) return
    const pids = [...new Set(times.map((t) => t.profile_id).filter(Boolean) as string[])]
    if (pids.length === 0) return
    getProfileTeams(pids).then(setTeamTags).catch(() => {})
  }, [times])

  if (!enabled) return <EmptyState title={t('tt.empty')} />
  if (error) return <p className="text-kart-red">{t('common.loadError')}</p>
  if (!times) return <p className="text-muted">{t('common.loading')}</p>

  const remove = async (tt: TimeTrial) => {
    if (!confirm(t('tt.confirmDelete', { player: tt.player_name, time: formatTime(tt.time_ms) }))) return
    await deleteTime(tt.id)
    await reload()
  }

  return (
    <div className="space-y-4">
      {adding ? (
        <AddTimeForm
          trackId={trackId}
          category={category}
          nita={nita}
          forOther={adding === 'other'}
          onDone={async () => {
            setAdding(null)
            await reload()
          }}
          onCancel={() => setAdding(null)}
        />
      ) : (
        profile && (
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setAdding('mine')} className="btn-yellow text-base">
              + {t('tt.addMine')}
            </button>
            {isTtEditor && (
              <button onClick={() => setAdding('other')} className="btn-line text-base">
                + {t('tt.addOther')}
              </button>
            )}
          </div>
        )
      )}

      {times.length === 0 ? (
        <EmptyState title={t('tt.empty')}>{t('tt.emptyText')}</EmptyState>
      ) : (
        <ol className="panel">
          {times.map((tt, i) => {
            const mine = !!profile && tt.profile_id === profile.id
            const canDelete = tt.source === 'manual' && (mine || isTtEditor)
            return (
              <li
                key={tt.id}
                className={`flex items-center gap-3 border-b border-line px-4 py-3 last:border-b-0 sm:gap-4 ${
                  mine ? 'bg-kart-yellow/10' : ''
                }`}
              >
                <span className="w-7 text-center font-display text-xl font-black" style={{ color: MEDALS[i] ?? 'var(--color-muted)' }}>
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 font-semibold">
                    <Flag code={tt.country_code} locale={locale} />
                    {tt.profile_id && teamTags.get(tt.profile_id)?.[0] && (
                      <Link
                        to={`/tiempos?con=team:${teamTags.get(tt.profile_id)![0].id}`}
                        className="font-mono text-xs font-bold text-kart-yellow hover:underline"
                        title={teamTags.get(tt.profile_id)![0].name}
                      >
                        [{teamTags.get(tt.profile_id)![0].tag}]
                      </Link>
                    )}
                    {tt.profile_id ? (
                      <Link to={`/tiempos?con=player:${tt.profile_id}`} className="truncate hover:text-kart-yellow">
                        {tt.player_name}
                      </Link>
                    ) : (
                      <span className="truncate">{tt.player_name}</span>
                    )}
                  </span>
                  {tt.achieved_on && <span className="text-xs text-muted">{formatDate(tt.achieved_on, locale)}</span>}
                </span>
                <span className="time text-lg">{formatTime(tt.time_ms)}</span>
                {tt.proof_url ? (
                  <a href={tt.proof_url} target="_blank" rel="noreferrer" className="w-14 text-right text-sm text-kart-blue hover:underline">
                    {t('common.proof')}
                  </a>
                ) : (
                  <span className="w-14" />
                )}
                {canDelete ? (
                  <button onClick={() => remove(tt)} title={t('common.delete')} className="w-4 text-sm text-muted hover:text-kart-red">
                    ✕
                  </button>
                ) : (
                  <span className="w-4" />
                )}
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
