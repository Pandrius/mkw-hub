import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import EventList from '../components/EventList'
import { PlayerAnalyticsView } from '../components/PlayerAnalyticsView'
import { SearchBox, type Suggestion } from '../components/SearchBox'
import { EmptyState, Flag, PageHeader, Tabs } from '../components/ui'
import { useI18n } from '../i18n'
import { useAuth, type Profile } from '../lib/auth'
import { entityKey, teamsOf, type Entity } from '../lib/compare'
import { getPlayerTimeline, type TimedResult } from '../lib/form'
import { computePlayerAnalytics } from '../lib/playerAnalytics'
import type { StatsFilter } from '../lib/stats'
import { rankHits, REMOTE_MIN_LENGTH, sanitizeTerm, searchRemote, type SearchHit } from '../lib/search'
import { supabase } from '../lib/supabase'

export default function Stats() {
  const { t, locale } = useI18n()
  const { profile, loading, enabled, signIn } = useAuth()
  const { profileId } = useParams()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [notFound, setNotFound] = useState(false)
  const [playerHits, setPlayerHits] = useState<SearchHit[]>([])

  const targetId = profileId ?? profile?.id

  // Sugerencias de jugadores mientras se escribe (con espera, cancelando la consulta anterior)
  const term = sanitizeTerm(search)
  useEffect(() => {
    if (term.length < REMOTE_MIN_LENGTH) return
    const ctrl = new AbortController()
    const timer = setTimeout(() => {
      searchRemote(term, ctrl.signal).then(
        (hits) => !ctrl.signal.aborted && setPlayerHits(hits.filter((h) => h.kind === 'player')),
        () => {},
      )
    }, 250)
    return () => {
      clearTimeout(timer)
      ctrl.abort()
    }
  }, [term])
  // rankHits descarta los resultados de una consulta anterior que ya no coinciden
  const playerSuggestions = useMemo(
    () =>
      term.length < REMOTE_MIN_LENGTH
        ? []
        : (rankHits(search, playerHits, 8)[0]?.hits ?? []).map(
            (h): Suggestion => ({ key: h.id, label: h.label, icon: <Flag code={h.country ?? null} locale={locale} /> }),
          ),
    [term, search, playerHits, locale],
  )

  const findPlayer = async (e: React.FormEvent) => {
    e.preventDefault()
    const name = search.trim()
    if (!name || !supabase) return
    const { data } = await supabase.from('profiles').select('id').ilike('username', name.replace(/[\\%_]/g, (c) => `\\${c}`)).limit(1).maybeSingle()
    setNotFound(!data)
    if (data) navigate(`/estadisticas/${data.id}`)
  }

  if (loading) return <p className="text-muted">{t('common.loading')}</p>

  return (
    <>
      <PageHeader title={t('nav.stats')} subtitle={t('stats.onlyFinished')}>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          <form onSubmit={findPlayer} className="flex-1 sm:w-64 sm:flex-none">
            <SearchBox
              value={search}
              onChange={(v) => {
                setSearch(v)
                setNotFound(false)
              }}
              suggestions={playerSuggestions}
              onPick={(s) => {
                setSearch('')
                navigate(`/estadisticas/${s.key}`)
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
  const [owner, setOwner] = useState<Pick<Profile, 'username' | 'avatar_url' | 'country_code'> | null>(null)
  const [teams, setTeams] = useState<Entity[]>([])
  const [timeline, setTimeline] = useState<TimedResult[] | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      supabase!.from('profiles').select('username, avatar_url, country_code').eq('id', profileId).maybeSingle(),
      teamsOf(profileId),
      getPlayerTimeline(profileId),
    ]).then(
      ([prof, tms, tl]) => {
        if (cancelled) return
        setOwner(prof.data)
        setTeams(tms)
        setTimeline(tl)
      },
      () => !cancelled && setError(true),
    )
    return () => {
      cancelled = true
    }
  }, [profileId])

  const analytics = useMemo(() => (timeline ? computePlayerAnalytics(timeline, filter) : null), [timeline, filter])

  if (error) return <p className="text-kart-red">{t('common.loadError')}</p>
  if (!timeline) return <p className="text-muted">{t('common.loading')}</p>

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

      {!analytics ? <EmptyState title={t('stats.noData')} /> : <PlayerAnalyticsView a={analytics} showSplit={filter === 'all'} />}

      <section>
        <h3 className="mb-3 font-display text-xl font-bold">{t('stats.eventsList')}</h3>
        <EventList profileId={profileId} />
      </section>
    </div>
  )
}
