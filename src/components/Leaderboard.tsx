import { useCallback, useEffect, useState } from 'react'
import { useI18n } from '../i18n'
import { useAuth } from '../lib/auth'
import { formatDate, formatTime, parseTime } from '../lib/time'
import { addTime, bestPerPlayer, deleteTime, listTimes, type TimeTrial, type TtCategory } from '../lib/timeTrials'
import { EmptyState, Flag } from './ui'

const MEDALS = ['#ffcc1f', '#c9d3e6', '#d98b4a']

export default function Leaderboard({ trackId, category, nita }: { trackId: string; category: TtCategory; nita: boolean }) {
  const { t, locale } = useI18n()
  const { enabled, isTtEditor } = useAuth()
  const [times, setTimes] = useState<TimeTrial[] | null>(null)
  const [error, setError] = useState(false)
  const [adding, setAdding] = useState(false)

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
      {isTtEditor &&
        (adding ? (
          <TimeForm
            trackId={trackId}
            category={category}
            nita={nita}
            onDone={async () => {
              setAdding(false)
              await reload()
            }}
            onCancel={() => setAdding(false)}
          />
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="btn-yellow text-base"
          >
            + {t('tt.add')}
          </button>
        ))}

      {times.length === 0 ? (
        <EmptyState title={t('tt.empty')}>{t('tt.emptyText')}</EmptyState>
      ) : (
        <ol className="overflow-hidden panel">
          {times.map((tt, i) => (
            <li key={tt.id} className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-b-0 sm:gap-4">
              <span
                className="w-7 text-center font-display text-lg font-black"
                style={{ color: MEDALS[i] ?? 'var(--color-muted)' }}
              >
                {i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 font-semibold">
                  <Flag code={tt.country_code} locale={locale} />
                  <span className="truncate">{tt.player_name}</span>
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
              {isTtEditor && (
                <button
                  onClick={() => remove(tt)}
                  title={t('common.delete')}
                  className="text-sm text-muted hover:text-kart-red"
                >
                  ✕
                </button>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

function TimeForm({
  trackId,
  category,
  nita,
  onDone,
  onCancel,
}: {
  trackId: string
  category: TtCategory
  nita: boolean
  onDone: () => Promise<void>
  onCancel: () => void
}) {
  const { t } = useI18n()
  const [player, setPlayer] = useState('')
  const [country, setCountry] = useState('')
  const [time, setTime] = useState('')
  const [proof, setProof] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const parsed = parseTime(time)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const proofUrl = proof.trim() || null
    const cc = country.trim().toUpperCase() || null
    if (parsed === null) return setError(t('tt.badTime'))
    if (cc && !/^[A-Z]{2}$/.test(cc)) return setError(t('tt.badCountry'))
    if (proofUrl && !proofUrl.startsWith('https://')) return setError(t('tt.proofHttps'))

    setSaving(true)
    setError(null)
    try {
      await addTime({
        track_id: trackId,
        category,
        nita,
        time_ms: parsed,
        player_name: player.trim(),
        country_code: cc,
        proof_url: proofUrl,
        achieved_on: date || null,
      })
      await onDone()
    } catch {
      setError(t('common.saveError'))
      setSaving(false)
    }
  }

  const input =
    'field'

  return (
    <form onSubmit={submit} className="space-y-3 rounded-2xl border border-kart-yellow/60 bg-surface p-5">
      <p className="text-sm text-muted">
        {t('tt.newTime')} · {category === 'flap' ? t('tt.flap') : t('tt.race')} · {nita ? t('tt.nita') : t('tt.items')}
      </p>
      <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
        <input required maxLength={60} value={player} onChange={(e) => setPlayer(e.target.value)} placeholder={t('tt.player')} className={input} />
        <input maxLength={2} value={country} onChange={(e) => setCountry(e.target.value)} placeholder={t('tt.country')} className={`${input} uppercase`} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <input required value={time} onChange={(e) => setTime(e.target.value)} placeholder={t('tt.timePlaceholder')} className={input} />
          {time && (
            <p className={`mt-1 text-xs ${parsed === null ? 'text-kart-red' : 'text-muted'}`}>
              {parsed === null ? t('tt.badFormat') : t('tt.willSave', { time: formatTime(parsed) })}
            </p>
          )}
        </div>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={input} />
      </div>
      <input type="url" value={proof} onChange={(e) => setProof(e.target.value)} placeholder={t('tt.proofPlaceholder')} className={input} />
      {error && <p className="text-sm text-kart-red">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="btn-yellow text-base"
        >
          {saving ? t('common.saving') : t('common.save')}
        </button>
        <button type="button" onClick={onCancel} className="btn-line text-base">
          {t('common.cancel')}
        </button>
      </div>
    </form>
  )
}
