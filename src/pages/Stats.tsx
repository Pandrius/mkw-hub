import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import EventList from '../components/EventList'
import { EmptyState, Flag, PageHeader, Tabs } from '../components/ui'
import { getCup, getTrack } from '../data/tracks'
import { useI18n } from '../i18n'
import { useAuth, type Profile } from '../lib/auth'
import { entityKey, teamsOf, type Entity } from '../lib/compare'
import { getPlayerResults, type PlayerResult } from '../lib/events'
import { bestAndWorst, computeStats, MIN_RACES_RELIABLE, type StatsFilter, type TrackStats } from '../lib/stats'
import { supabase } from '../lib/supabase'

export default function Stats() {
  const { t } = useI18n()
  const { profile, loading, enabled, signIn } = useAuth()
  const { profileId } = useParams()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [notFound, setNotFound] = useState(false)

  const targetId = profileId ?? profile?.id

  const findPlayer = async (e: React.FormEvent) => {
    e.preventDefault()
    const name = search.trim()
    if (!name || !supabase) return
    const { data } = await supabase.from('profiles').select('id').ilike('username', name).limit(1).maybeSingle()
    setNotFound(!data)
    if (data) navigate(`/estadisticas/${data.id}`)
  }

  if (loading) return <p className="text-muted">{t('common.loading')}</p>

  return (
    <>
      <PageHeader title={t('nav.stats')} subtitle={t('stats.onlyFinished')}>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          <form onSubmit={findPlayer} className="flex-1 sm:w-64 sm:flex-none">
            <input
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setNotFound(false)
              }}
              placeholder={t('stats.searchPlayer')}
              className="field"
            />
            {notFound && <p className="mt-1 text-xs text-kart-red">{t('stats.userNotFound')}</p>}
          </form>
          {profile && (
            <Link to="/eventos/nuevo" className="btn-yellow text-base">
              + {t('stats.newEvent')}
            </Link>
          )}
        </div>
      </PageHeader>

      {!targetId ? (
        <EmptyState title={t('stats.signInTitle')}>
          <p>{t('stats.signInText')}</p>
          {enabled && (
            <button onClick={signIn} className="mt-4 rounded-lg bg-[#5865F2] px-4 py-2 text-sm font-semibold text-white">
              {t('auth.signIn')}
            </button>
          )}
        </EmptyState>
      ) : (
        <PlayerStats key={targetId} profileId={targetId} isMe={targetId === profile?.id} />
      )}
    </>
  )
}

function PlayerStats({ profileId, isMe }: { profileId: string; isMe: boolean }) {
  const { t, locale } = useI18n()
  const [filter, setFilter] = useState<StatsFilter>('all')
  const [results, setResults] = useState<PlayerResult[] | null>(null)
  const [owner, setOwner] = useState<Pick<Profile, 'username' | 'avatar_url' | 'country_code'> | null>(null)
  const [teams, setTeams] = useState<Entity[]>([])
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      getPlayerResults(profileId),
      supabase!.from('profiles').select('username, avatar_url, country_code').eq('id', profileId).maybeSingle(),
      teamsOf(profileId),
    ]).then(
      ([res, prof, tms]) => {
        if (cancelled) return
        setResults(res)
        setOwner(prof.data)
        setTeams(tms)
      },
      () => !cancelled && setError(true),
    )
    return () => {
      cancelled = true
    }
  }, [profileId])

  const stats = useMemo(() => (results ? computeStats(results, filter) : null), [results, filter])

  if (error) return <p className="text-kart-red">{t('common.loadError')}</p>
  if (!stats) return <p className="text-muted">{t('common.loading')}</p>

  const { best, worst } = bestAndWorst(stats)

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="flex items-center gap-2.5 font-display text-2xl font-bold">
            {owner?.avatar_url && <img src={owner.avatar_url} alt="" className="size-10 rounded-full" />}
            <Flag code={owner?.country_code ?? null} locale={locale} />
            {isMe ? t('stats.mine') : t('stats.of', { user: owner?.username ?? '…' })}
          </h2>
          {teams.map((tm) => (
            <Link
              key={entityKey(tm)}
              to={`/tiempos?con=team:${tm.kind === 'team' ? tm.id : ''}`}
              className="font-mono text-xs font-bold text-kart-yellow hover:underline"
              title={tm.name}
            >
              [{tm.kind === 'team' ? tm.tag : ''}]
            </Link>
          ))}
          <Link
            to={`/tiempos?con=player:${profileId}`}
            className="font-mono text-xs font-bold text-muted hover:text-kart-yellow"
          >
            → {t('nav.times')}
          </Link>
        </div>
        <Tabs
          tabs={[
            { id: 'all', label: t('stats.all') },
            { id: 'war', label: t('stats.war') },
            { id: 'lounge', label: t('stats.lounge') },
          ]}
          value={filter}
          onChange={setFilter}
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Metric label={t('stats.average')} value={stats.average?.toFixed(2) ?? '—'} highlight />
        <Metric label={t('stats.races')} value={stats.races} />
        <Metric label={t('stats.events')} value={stats.events} />
      </div>

      {stats.races === 0 ? (
        <EmptyState title={t('stats.noData')} />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <TrackPodium title={t('stats.bestTracks')} tracks={best} color="var(--color-kart-green)" />
            <TrackPodium title={t('stats.worstTracks')} tracks={worst} color="var(--color-kart-red)" />
          </div>
          <TrackTable tracks={stats.tracks} />
        </>
      )}

      <section>
        <h3 className="mb-3 font-display text-xl font-bold">{t('stats.eventsList')}</h3>
        <EventList profileId={profileId} />
      </section>
    </div>
  )
}

function Metric({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div className="panel p-4">
      <p className={`time text-4xl ${highlight ? 'text-kart-yellow' : ''}`}>{value}</p>
      <p className="text-sm text-muted">{label}</p>
    </div>
  )
}

function TrackPodium({ title, tracks, color }: { title: string; tracks: TrackStats[]; color: string }) {
  const { t } = useI18n()
  return (
    <div className="panel p-5">
      <h3 className="font-display text-lg font-bold" style={{ color }}>
        {title}
      </h3>
      {tracks.length === 0 ? (
        <p className="mt-2 text-sm text-muted">{t('stats.notEnough', { n: MIN_RACES_RELIABLE })}</p>
      ) : (
        <ol className="mt-3 space-y-2">
          {tracks.map((ts) => {
            const track = getTrack(ts.trackId)
            return (
              <li key={ts.trackId} className="flex items-baseline gap-3">
                <span className="w-12 font-display font-black normal-case" style={{ color: track && getCup(track.cupId)?.color }}>
                  {track?.abbr}
                </span>
                <Link to={`/pistas/${ts.trackId}`} className="flex-1 truncate hover:underline">
                  {track?.name ?? ts.trackId}
                </Link>
                <span className="time text-lg">{ts.average.toFixed(2)}</span>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}

function TrackTable({ tracks }: { tracks: TrackStats[] }) {
  const { t } = useI18n()
  return (
    <section>
      <h3 className="mb-3 font-display text-xl font-bold">{t('stats.byTrack')}</h3>
      <div className="overflow-hidden panel">
        <table className="w-full text-sm">
          <thead className="bg-bg text-left font-display text-sm tracking-wider text-kart-yellow">
            <tr>
              <th className="px-4 py-2.5 font-extrabold">{t('stats.colTrack')}</th>
              <th className="px-4 py-2.5 text-right font-extrabold">{t('stats.colAvg')}</th>
              <th className="hidden w-1/3 px-4 py-2.5 sm:table-cell" />
              <th className="px-4 py-2.5 text-right font-extrabold">{t('stats.colRaces')}</th>
              <th className="px-4 py-2.5 text-right font-extrabold">{t('stats.colBest')}</th>
            </tr>
          </thead>
          <tbody>
            {tracks.map((ts) => {
              const track = getTrack(ts.trackId)
              const color = track ? getCup(track.cupId)?.color : undefined
              const low = ts.races < MIN_RACES_RELIABLE
              return (
                <tr key={ts.trackId} className="border-t border-line/60">
                  <td className="px-4 py-2">
                    <Link to={`/pistas/${ts.trackId}`} className="flex items-baseline gap-2 hover:underline">
                      <span className="w-12 shrink-0 font-display font-black normal-case" style={{ color }}>
                        {track?.abbr}
                      </span>
                      <span className="truncate">{track?.name ?? ts.trackId}</span>
                    </Link>
                  </td>
                  <td className="time px-4 py-2 text-right text-base">
                    {ts.average.toFixed(2)}
                    {low && (
                      <span title={t('stats.lowSample')} className="ml-1 text-xs text-muted">
                        *
                      </span>
                    )}
                  </td>
                  <td className="hidden px-4 py-2 sm:table-cell">
                    {/* Barra: más larga cuanto mejor (1.º = llena, 12.º = casi vacía) */}
                    <div className="h-2 rounded-full bg-surface-2">
                      <div
                        className="h-2 rounded-full"
                        style={{ width: `${Math.max(4, ((12 - ts.average + 1) / 12) * 100)}%`, background: color, opacity: low ? 0.4 : 1 }}
                      />
                    </div>
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-muted">{ts.races}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{ts.best}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <p className="border-t border-line px-4 py-2 text-xs text-muted">
          * {t('stats.lowSample')} ({'<'} {MIN_RACES_RELIABLE})
        </p>
      </div>
    </section>
  )
}
