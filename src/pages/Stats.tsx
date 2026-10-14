import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import EventList from '../components/EventList'
import { PlayerAnalyticsView } from '../components/PlayerAnalyticsView'
import { PlayerCompareView } from '../components/PlayerCompareView'
import { SearchBox, type Suggestion } from '../components/SearchBox'
import { EmptyState, Flag, PageHeader, Tabs } from '../components/ui'
import { WelcomeGuide } from '../components/WelcomeGuide'
import { useI18n } from '../i18n'
import { useAuth, type Profile } from '../lib/auth'
import { entityKey, teamsOf, type Entity } from '../lib/compare'
import { listEventsFor } from '../lib/events'
import { getPlayerTimeline, type TimedResult } from '../lib/form'
import { isGuideHidden } from '../lib/guideStore'
import { computePlayerAnalytics } from '../lib/playerAnalytics'
import type { StatsFilter } from '../lib/stats'
import { rankHits, REMOTE_MIN_LENGTH, sanitizeTerm, searchRemote, type SearchHit } from '../lib/search'
import { supabase } from '../lib/supabase'

/** Sugerencias de jugadores mientras se escribe (con espera, cancelando la consulta anterior) */
function usePlayerSuggestions(search: string): Suggestion[] {
  const { locale } = useI18n()
  const [playerHits, setPlayerHits] = useState<SearchHit[]>([])
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
  return useMemo(
    () =>
      term.length < REMOTE_MIN_LENGTH
        ? []
        : (rankHits(search, playerHits, 8)[0]?.hits ?? []).map(
            (h): Suggestion => ({ key: h.id, label: h.label, icon: <Flag code={h.country ?? null} locale={locale} /> }),
          ),
    [term, search, playerHits, locale],
  )
}

export default function Stats() {
  const { t } = useI18n()
  const { profile, loading, enabled, signIn } = useAuth()
  const { profileId } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [notFound, setNotFound] = useState(false)
  const playerSuggestions = usePlayerSuggestions(search)

  const targetId = profileId ?? profile?.id
  const vsParam = params.get('vs')
  const vsId = vsParam && vsParam !== targetId ? vsParam : null

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
        <PlayerStats key={`${targetId}|${vsId ?? ''}`} profileId={targetId} isMe={targetId === profile?.id} meId={profile?.id ?? null} vsId={vsId} />
      )}
    </>
  )
}

type Owner = Pick<Profile, 'username' | 'avatar_url' | 'country_code'>

function PlayerStats({ profileId, isMe, meId, vsId }: { profileId: string; isMe: boolean; meId: string | null; vsId: string | null }) {
  const { t, locale } = useI18n()
  const navigate = useNavigate()
  const [filter, setFilter] = useState<StatsFilter>('all')
  const [owner, setOwner] = useState<Owner | null>(null)
  const [teams, setTeams] = useState<Entity[]>([])
  const [timeline, setTimeline] = useState<TimedResult[] | null>(null)
  const [vs, setVs] = useState<{ owner: Owner | null; timeline: TimedResult[] } | null>(null)
  const [hasEvents, setHasEvents] = useState(true)
  const [guideOpen, setGuideOpen] = useState(false)
  const [error, setError] = useState(false)
  const [vsSearch, setVsSearch] = useState('')
  const vsSuggestions = usePlayerSuggestions(vsSearch)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      supabase!.from('profiles').select('username, avatar_url, country_code').eq('id', profileId).maybeSingle(),
      teamsOf(profileId),
      getPlayerTimeline(profileId),
      isMe ? listEventsFor(profileId) : Promise.resolve(null),
      vsId ? supabase!.from('profiles').select('username, avatar_url, country_code').eq('id', vsId).maybeSingle() : Promise.resolve(null),
      vsId ? getPlayerTimeline(vsId) : Promise.resolve(null),
    ]).then(
      ([prof, tms, tl, events, vsProf, vsTl]) => {
        if (cancelled) return
        setOwner(prof.data)
        setTeams(tms)
        setTimeline(tl)
        setVs(vsTl ? { owner: vsProf?.data ?? null, timeline: vsTl } : null)
        // La guía de bienvenida es solo para quien aún no ha registrado ningún evento
        if (events && events.length === 0) {
          setHasEvents(false)
          setGuideOpen(!isGuideHidden())
        }
      },
      () => !cancelled && setError(true),
    )
    return () => {
      cancelled = true
    }
  }, [profileId, isMe, vsId])

  const analytics = useMemo(() => (timeline ? computePlayerAnalytics(timeline, filter) : null), [timeline, filter])
  const vsAnalytics = useMemo(() => (vs ? computePlayerAnalytics(vs.timeline, filter) : null), [vs, filter])

  if (error) return <p className="text-kart-red">{t('common.loadError')}</p>
  if (!timeline) return <p className="text-muted">{t('common.loading')}</p>

  const ownerName = isMe ? t('stats.you') : (owner?.username ?? '…')
  const vsName = vs?.owner?.username ?? '…'

  return (
    <div className="space-y-8">
      {guideOpen && <WelcomeGuide onClose={() => setGuideOpen(false)} />}

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

      <div className="flex flex-wrap items-center gap-3">
        {vsId ? (
          <>
            <p className="font-display text-lg font-bold">{t('cmp.vs', { a: ownerName, b: vsName })}</p>
            <Link to={`/estadisticas/${profileId}`} className="btn-line text-sm">
              {t('cmp.clear')}
            </Link>
          </>
        ) : (
          <>
            <div className="w-full sm:w-72">
              <SearchBox
                value={vsSearch}
                onChange={setVsSearch}
                suggestions={vsSuggestions}
                onPick={(s) => {
                  setVsSearch('')
                  navigate(`/estadisticas/${profileId}?vs=${s.key}`)
                }}
                placeholder={isMe ? t('cmp.searchMe') : t('cmp.searchOther', { user: owner?.username ?? '…' })}
                className="field text-sm"
              />
            </div>
            {!isMe && meId && (
              <Link to={`/estadisticas/${meId}?vs=${profileId}`} className="btn-line text-sm">
                {t('cmp.meVs', { user: owner?.username ?? '…' })}
              </Link>
            )}
          </>
        )}
      </div>

      {vsId ? (
        !analytics || !vsAnalytics ? (
          <EmptyState title={t('cmp.noData')}>{t('cmp.noDataOf', { user: !analytics ? ownerName : vsName })}</EmptyState>
        ) : (
          <PlayerCompareView a={analytics} b={vsAnalytics} nameA={ownerName} nameB={vsName} />
        )
      ) : (
        <>
          {!analytics ? (
            <EmptyState title={t('stats.noData')}>
              {isMe && !hasEvents && (
                <button type="button" onClick={() => setGuideOpen(true)} className="btn-line mt-1 text-sm">
                  {t('guide.reopen')}
                </button>
              )}
            </EmptyState>
          ) : (
            <PlayerAnalyticsView a={analytics} showSplit={filter === 'all'} />
          )}

          <section>
            <h3 className="mb-3 font-display text-xl font-bold">{t('stats.eventsList')}</h3>
            <EventList profileId={profileId} />
          </section>
        </>
      )}
    </div>
  )
}
