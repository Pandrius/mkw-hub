import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import EventList from '../components/EventList'
import { BadgesPanel } from '../components/BadgesPanel'
import { LoungePanel } from '../components/LoungePanel'
import { ProfileShowcase, ShowcaseEditor } from '../components/Showcase'
import { PlayerAnalyticsView } from '../components/PlayerAnalyticsView'
import { PlayerCompareView } from '../components/PlayerCompareView'
import { SearchBox, type Suggestion } from '../components/SearchBox'
import { EmptyState, Flag, PageHeader, Tabs } from '../components/ui'
import { WelcomeGuide } from '../components/WelcomeGuide'
import { TRACKS } from '../data/tracks'
import { useI18n } from '../i18n'
import { useAuth, type Profile } from '../lib/auth'
import { entityKey, teamsOf, type Entity } from '../lib/compare'
import { computeAchievements, ownedTracks } from '../lib/achievements'
import { computeBadges } from '../lib/badges'
import { listEventsFor } from '../lib/events'
import type { TimedResult } from '../lib/form'
import { getPlayerTimeline } from '../lib/timeline'
import { isGuideHidden } from '../lib/guideStore'
import { getLoungeData, requestLoungeSync, type LoungeData } from '../lib/loungeApi'
import { featurable, loungeFactsOf } from '../lib/titles'
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

type Owner = Pick<Profile, 'username' | 'avatar_url' | 'country_code' | 'featured_badges' | 'title_id'>

type VerifyFilter = 'all' | 'verified'

/** Cada cuánto como mucho se vuelve a pedir el Lounge al abrir las estadísticas propias */
const LOUNGE_SYNC_KEY = 'mkwhub.loungeSync'
const LOUNGE_SYNC_EVERY_MS = 5 * 60 * 1000

function PlayerStats({ profileId, isMe, meId, vsId }: { profileId: string; isMe: boolean; meId: string | null; vsId: string | null }) {
  const { t, locale } = useI18n()
  const navigate = useNavigate()
  const [filter, setFilter] = useState<StatsFilter>('all')
  const [verifyFilter, setVerifyFilter] = useState<VerifyFilter>('all')
  const [lounge, setLounge] = useState<LoungeData | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [checking, setChecking] = useState(false)
  const [editing, setEditing] = useState(false)
  const [showcase, setShowcase] = useState<{ badges: string[]; title: string | null } | null>(null)
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
      supabase!.from('profiles').select('username, avatar_url, country_code, featured_badges, title_id').eq('id', profileId).maybeSingle(),
      getLoungeData(profileId),
      teamsOf(profileId),
      getPlayerTimeline(profileId),
      isMe ? listEventsFor(profileId) : Promise.resolve(null),
      vsId ? supabase!.from('profiles').select('username, avatar_url, country_code').eq('id', vsId).maybeSingle() : Promise.resolve(null),
      vsId ? getPlayerTimeline(vsId) : Promise.resolve(null),
    ]).then(
      ([prof, loungeData, tms, tl, events, vsProf, vsTl]) => {
        if (cancelled) return
        setOwner(prof.data)
        setLounge(loungeData)
        setShowcase({ badges: prof.data?.featured_badges ?? [], title: prof.data?.title_id ?? null })
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
  }, [profileId, isMe, vsId, reloadKey])

  // Al abrir las estadísticas propias se pide al servidor que descargue el Lounge y verifique los eventos pendientes
  useEffect(() => {
    if (!isMe) return
    try {
      if (Date.now() - Number(sessionStorage.getItem(LOUNGE_SYNC_KEY)) < LOUNGE_SYNC_EVERY_MS) return
    } catch {
      // almacenamiento no disponible: se pide igualmente
    }
    let cancelled = false
    requestLoungeSync().then((r) => {
      try {
        sessionStorage.setItem(LOUNGE_SYNC_KEY, String(Date.now()))
      } catch {
        // almacenamiento no disponible
      }
      if (!cancelled && r && !r.skipped) setReloadKey((k) => k + 1)
    })
    return () => {
      cancelled = true
    }
  }, [isMe])

  const recheck = async () => {
    setChecking(true)
    await requestLoungeSync()
    setReloadKey((k) => k + 1)
    setChecking(false)
  }

  // Los logros, las insignias y los títulos solo cuentan eventos verificados; las estadísticas, a elegir
  const verifiedTimeline = useMemo(() => (timeline ?? []).filter((r) => r.verified), [timeline])
  const shown = useMemo(() => (timeline ? (verifyFilter === 'verified' ? verifiedTimeline : timeline) : null), [timeline, verifiedTimeline, verifyFilter])
  const vsShown = useMemo(() => (vs ? (verifyFilter === 'verified' ? vs.timeline.filter((r) => r.verified) : vs.timeline) : null), [vs, verifyFilter])
  const analytics = useMemo(() => (shown ? computePlayerAnalytics(shown, filter) : null), [shown, filter])
  const badges = useMemo(() => computeBadges(verifiedTimeline, TRACKS.length), [verifiedTimeline])
  const achievements = useMemo(() => computeAchievements(verifiedTimeline, TRACKS.length), [verifiedTimeline])
  const vsAnalytics = useMemo(() => (vsShown ? computePlayerAnalytics(vsShown, filter) : null), [vsShown, filter])
  const eventCounts = useMemo(() => {
    const all = new Set((timeline ?? []).map((r) => r.eventId))
    return { total: all.size, verified: new Set(verifiedTimeline.map((r) => r.eventId)).size }
  }, [timeline, verifiedTimeline])
  const titleCtx = useMemo(
    () => ({ achievements, badges, ownedTracks: ownedTracks(verifiedTimeline), lounge: loungeFactsOf(lounge?.account ?? null, lounge?.changes ?? []) }),
    [achievements, badges, verifiedTimeline, lounge],
  )
  const ownedFeatures = useMemo(() => featurable(achievements, badges), [achievements, badges])

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
        <div className="flex flex-wrap gap-2">
          <Tabs
            tabs={[
              { id: 'all', label: t('stats.all') },
              { id: 'war', label: t('stats.war') },
              { id: 'lounge', label: t('stats.lounge') },
              { id: 'sq', label: t('stats.sq') },
            ]}
            value={filter}
            onChange={setFilter}
          />
          <Tabs
            tabs={[
              { id: 'all' as VerifyFilter, label: t('ver.filterAll') },
              { id: 'verified' as VerifyFilter, label: t('ver.filterOnly') },
            ]}
            value={verifyFilter}
            onChange={setVerifyFilter}
          />
        </div>
      </div>

      {showcase && (
        <div className="flex flex-wrap items-center gap-4">
          <ProfileShowcase featuredIds={showcase.badges} titleId={showcase.title} owned={ownedFeatures} ctx={titleCtx} />
          {isMe && !editing && (
            <button type="button" onClick={() => setEditing(true)} className="btn-line text-sm">
              {t('showcase.edit')}
            </button>
          )}
        </div>
      )}
      {isMe && editing && showcase && (
        <ShowcaseEditor
          featuredIds={showcase.badges}
          titleId={showcase.title}
          owned={ownedFeatures}
          ctx={titleCtx}
          onSaved={(b, ti) => setShowcase({ badges: b, title: ti })}
          onClose={() => setEditing(false)}
        />
      )}

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

          <LoungePanel data={lounge} isMe={isMe} />

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-l-4 border-kart-yellow bg-surface px-4 py-3 text-sm" title={t('ver.noticeHelp')}>
            <span>{t('ver.notice', { done: eventCounts.verified, total: eventCounts.total })}</span>
            {isMe && eventCounts.verified < eventCounts.total && (
              <button type="button" onClick={recheck} disabled={checking} className="font-mono text-xs font-bold text-kart-yellow hover:underline disabled:opacity-60">
                {checking ? t('ver.checking') : t('ver.recheck')}
              </button>
            )}
          </div>

          <BadgesPanel badges={badges} achievements={achievements} totalTracks={TRACKS.length} />

          <section>
            <h3 className="mb-3 font-display text-xl font-bold">{t('stats.eventsList')}</h3>
            <EventList profileId={profileId} />
          </section>
        </>
      )}
    </div>
  )
}
