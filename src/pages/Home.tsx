import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { Flag, Plate } from '../components/ui'
import { getCup, getTrack, TRACKS } from '../data/tracks'
import { useI18n } from '../i18n'
import type { MessageKey } from '../i18n/es'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { formatDate, formatTime } from '../lib/time'
import { daysSince, listCurrentWorldRecords, type WorldRecord } from '../lib/worldRecords'

const SECTIONS: { to: string; label: MessageKey; hint: MessageKey }[] = [
  { to: '/pistas', label: 'nav.tracks', hint: 'home.hintTracks' },
  { to: '/contrarreloj', label: 'nav.timeTrials', hint: 'home.hintTT' },
  { to: '/estadisticas', label: 'nav.stats', hint: 'home.hintStats' },
  { to: '/equipos', label: 'nav.teams', hint: 'home.hintTeams' },
]

export default function Home() {
  const { t } = useI18n()
  const { enabled } = useAuth()
  const [records, setRecords] = useState<WorldRecord[]>([])
  const [historyCount, setHistoryCount] = useState<number | null>(null)

  useEffect(() => {
    if (!enabled || !supabase) return
    let cancelled = false
    listCurrentWorldRecords().then((data) => !cancelled && setRecords(data), () => {})
    supabase
      .from('world_records')
      .select('id', { count: 'exact', head: true })
      .then(({ count }) => !cancelled && setHistoryCount(count))
    return () => {
      cancelled = true
    }
  }, [enabled])

  const latest = [...records].sort((a, b) => b.achieved_on.localeCompare(a.achieved_on) || a.time_ms - b.time_ms)[0]

  return (
    <div className="space-y-16">
      <section className="grid gap-10 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:items-start">
        <div>
          <p className="font-mono text-xs font-bold tracking-widest text-kart-yellow">{t('home.kicker')}</p>
          <ol className="mt-4">
            {SECTIONS.map((s, i) => (
              <li key={s.to} className="border-b-2 border-line first:border-t-2">
                <Link to={s.to} className="group flex items-baseline gap-4 py-2">
                  <span className="w-8 font-mono text-sm font-bold text-muted group-hover:text-kart-yellow">
                    0{i + 1}
                  </span>
                  <span className="font-display text-6xl leading-none font-black transition-colors group-hover:text-kart-yellow sm:text-7xl xl:text-8xl">
                    {t(s.label)}
                  </span>
                  <span className="ml-auto hidden w-44 shrink-0 text-right text-sm leading-snug text-muted xl:block">{t(s.hint)}</span>
                </Link>
              </li>
            ))}
          </ol>
        </div>

        <div className="min-w-0 lg:mt-9">{latest ? <LatestRecord record={latest} /> : <div className="hazard hidden h-64 lg:block" />}</div>
      </section>

      {records.length > 0 && <RecordTicker records={records} />}

      <section className="grid gap-8 border-y-2 border-line py-8 sm:grid-cols-3">
        <BigNumber value={TRACKS.length} label={t('home.statTracks')} />
        <BigNumber value={historyCount ?? '—'} label={t('home.statRecords')} />
        <BigNumber value="6v6" label={t('home.statWars')} />
      </section>

      <section className="max-w-2xl">
        <p className="font-display text-3xl leading-tight font-extrabold sm:text-4xl">{t('home.manifesto')}</p>
        <p className="mt-4 text-muted">{t('home.manifestoText')}</p>
      </section>
    </div>
  )
}

function LatestRecord({ record }: { record: WorldRecord }) {
  const { t, locale } = useI18n()
  const track = getTrack(record.track_id)
  const days = daysSince(record.achieved_on)

  return (
    <Link to={`/pistas/${record.track_id}`} className="group block bg-kart-yellow p-6 text-bg">
      <p className="font-mono text-xs font-bold tracking-widest">{t('home.latestWr')}</p>
      <p className="mt-4 flex items-center gap-2">
        <span className="bg-bg px-2 py-0.5 font-display text-lg font-black text-kart-yellow normal-case">{track?.abbr}</span>
        <span className="font-display text-2xl font-extrabold">{track?.name}</span>
      </p>
      <p className="time mt-2 text-5xl leading-none sm:text-6xl lg:text-5xl xl:text-6xl">{formatTime(record.time_ms)}</p>
      <p className="mt-3 flex items-center gap-2 text-lg font-bold">
        <Flag code={record.country_code} locale={locale} />
        {record.player_name}
      </p>
      <p className="mt-1 text-sm font-medium">
        {formatDate(record.achieved_on, locale)} ·{' '}
        {days === 0 ? t('wr.today') : days === 1 ? t('wr.heldFor1') : t('wr.heldFor', { days })}
      </p>
      <p className="mt-6 font-display text-lg font-black underline-offset-4 group-hover:underline">{t('home.seeTrack')} →</p>
    </Link>
  )
}

function RecordTicker({ records }: { records: WorldRecord[] }) {
  const { t } = useI18n()
  const byTrack = new Map(records.map((r) => [r.track_id, r]))
  const items = TRACKS.map((tr) => ({ track: tr, record: byTrack.get(tr.id) })).filter((x) => x.record)

  // Se duplica la lista para que la animación sea continua
  const row = (hidden: boolean) => (
    <div className="flex shrink-0 items-center" aria-hidden={hidden || undefined}>
      {items.map(({ track, record }) => (
        <span key={track.id} className="flex items-center gap-2 px-5 whitespace-nowrap">
          <Plate color={getCup(track.cupId)?.color}>{track.abbr}</Plate>
          <span className="time text-kart-yellow">{formatTime(record!.time_ms)}</span>
          <span className="font-semibold">{record!.player_name}</span>
        </span>
      ))}
    </div>
  )

  return (
    <section aria-label={t('home.tickerLabel')} className="ticker -mx-4 overflow-hidden border-y-2 border-kart-yellow bg-surface py-3">
      <div className="ticker-track flex w-max">
        {row(false)}
        {row(true)}
      </div>
    </section>
  )
}

function BigNumber({ value, label }: { value: number | string; label: string }) {
  return (
    <div>
      <p className="time text-5xl text-kart-yellow">{value}</p>
      <p className="mt-1 font-display text-lg font-extrabold">{label}</p>
    </div>
  )
}
