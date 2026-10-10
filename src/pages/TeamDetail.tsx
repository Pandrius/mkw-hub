import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'
import { TeamFormPanel } from '../components/FormPanel'
import { RivalPreview } from '../components/RivalPreview'
import { SearchBox } from '../components/SearchBox'
import { trackSuggestion } from '../components/trackSuggestion'
import { EmptyState, Flag, Plate, Tabs } from '../components/ui'
import { TeamLogo } from '../components/TeamLogo'
import { getTrack, getTrackColor, getTrackTextColor } from '../data/tracks'
import { useI18n } from '../i18n'
import { useAuth } from '../lib/auth'
import { getAllTeams, type TeamWithMembers } from '../lib/compare'
import { computeTeamForm, type TeamForm } from '../lib/teamForm'
import { filterRowsByTrack } from '../lib/trackSearch'
import {
  computeTeamPlayerStats,
  computeTeamStats,
  getTeamWarsWithPending,
  type MirroredWar,
  type TeamStats,
  type TeamWar,
} from '../lib/teamStats'
import { PendingWars } from '../components/PendingWars'

type TabId = 'overview' | 'tracks' | 'players' | 'rivals' | 'preview' | 'wars' | 'members'

export default function TeamDetail() {
  const { t, locale } = useI18n()
  const { teamId } = useParams()
  const { profile } = useAuth()

  const id = Number(teamId)
  const isValidId = Boolean(id && !Number.isNaN(id))
  const [team, setTeam] = useState<TeamWithMembers | null>(null)
  const [allTeams, setAllTeams] = useState<TeamWithMembers[]>([])
  const [stats, setStats] = useState<TeamStats | null>(null)
  const [form, setForm] = useState<TeamForm | null>(null)
  const [wars, setWars] = useState<TeamWar[]>([])
  const [pending, setPending] = useState<MirroredWar[]>([])
  const [loading, setLoading] = useState(isValidId)
  const [tab, setTab] = useState<TabId>('overview')
  const [trackSearch, setTrackSearch] = useState('')

  const { rows: filteredTeamTracks, suggestions: trackSuggestions } = useMemo(
    () => filterRowsByTrack(stats?.tracks ?? [], (tr) => tr.trackId, trackSearch),
    [stats, trackSearch],
  )

  useEffect(() => {
    if (!isValidId) return

    let cancelled = false
    const show = (teamId: number, data: { wars: TeamWar[]; pending: MirroredWar[] }) => {
      if (cancelled) return
      setStats(computeTeamStats(teamId, data.wars))
      setForm(computeTeamForm(data.wars))
      setWars(data.wars)
      setPending(data.pending)
    }
    Promise.all([getAllTeams(), getTeamWarsWithPending(id)])
      .then(([teams, data]) => {
        if (cancelled) return
        setAllTeams(teams)
        // Busca por ID de roster directo, o fallback por parent_team_id si se usó el ID de club de MKC
        const found = teams.find((tm) => tm.id === id) || teams.find((tm) => tm.parent_team_id === id) || null
        setTeam(found)
        if (found && found.id !== id) {
          getTeamWarsWithPending(found.id).then((actual) => show(found.id, actual))
        } else if (found) {
          show(found.id, data)
        }
        setLoading(false)
      })
      .catch(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [id, isValidId])

  const playerStats = useMemo(() => computeTeamPlayerStats(wars), [wars])

  // Todas las wars juntas, la más reciente primero (antes iban agrupadas por rival)
  const warList = useMemo(
    () =>
      (stats?.rivals ?? [])
        .flatMap((rv) => rv.matches.map((m) => ({ m, rv })))
        .sort((a, b) => (b.m.date ?? '').localeCompare(a.m.date ?? '')),
    [stats],
  )

  const siblingRosters = useMemo(() => {
    if (!team) return []
    const parentId = team.parent_team_id || team.id
    // Filtra solo los rosters/escuadras pertenecientes a este club
    const list = allTeams.filter((tm) => tm.parent_team_id === parentId)
    if (list.length > 0) return list
    return allTeams.filter((tm) => tm.id === parentId)
  }, [team, allTeams])

  if (loading) return <p className="text-muted">{t('common.loading')}</p>
  if (!team) {
    return (
      <EmptyState title={t('teams.noTeams')}>
        <Link to="/equipos" className="btn-yellow mt-4 inline-block text-sm">
          ← {t('teams.all', { n: '' })}
        </Link>
      </EmptyState>
    )
  }

  const isMember = team.members.some((m) => m.id === profile?.id)

  return (
    <div className="space-y-8">
      <div>
        <Link to="/equipos" className="font-mono text-xs font-bold text-muted hover:text-kart-yellow">
          ← {t('nav.teams')}
        </Link>

        <header className="mt-4 border-b-2 border-line pb-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <TeamLogo logoUrl={team.logo_url} tag={team.tag} name={team.name} size="xl" />
              <Plate color="var(--color-kart-yellow)">{team.tag}</Plate>
              <div>
                <h1 className="font-display text-4xl font-black sm:text-5xl">{team.name}</h1>
                {team.parent_name && team.parent_name !== team.name && (
                  <p className="font-mono text-sm font-semibold text-kart-yellow">{team.parent_name}</p>
                )}
                <p className="font-mono text-xs text-muted">
                  MKC #{team.id} · {t('teams.membersRegistered', { n: team.members.length })}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Link to={`/tiempos?con=team:${team.id}`} className="btn-line text-sm">
                ⏱ {t('teams.compare')}
              </Link>
              {isMember && (
                <Link to="/eventos/nuevo" className="btn-yellow text-sm">
                  + {t('stats.newEvent')}
                </Link>
              )}
            </div>
          </div>

          {/* Rosters / Sub-equipos del club */}
          {siblingRosters.length > 1 && (
            <div className="mt-5 rounded-lg border border-line bg-surface p-3">
              <p className="font-mono text-xs font-bold text-muted mb-2 uppercase">
                {locale === 'es' ? 'Rosters / Sub-equipos del club:' : 'Club rosters / Sub-teams:'}
              </p>
              <div className="flex flex-wrap gap-2">
                {siblingRosters.map((sib) => {
                  const isCurrent = sib.id === team.id
                  return (
                    <Link
                      key={sib.id}
                      to={`/equipos/${sib.id}`}
                      className={`flex items-center gap-2 rounded border px-3 py-1.5 text-xs font-semibold transition-colors ${
                        isCurrent
                          ? 'border-kart-yellow bg-kart-yellow text-bg font-bold shadow-sm'
                          : 'border-line bg-bg text-ink hover:border-kart-yellow hover:text-kart-yellow'
                      }`}
                    >
                      <Plate>{sib.tag}</Plate>
                      <span>{sib.name}</span>
                      {sib.members.length > 0 && (
                        <span className={`text-[10px] ${isCurrent ? 'text-bg/80' : 'text-muted'}`}>
                          ({sib.members.length})
                        </span>
                      )}
                    </Link>
                  )
                })}
              </div>
            </div>
          )}
        </header>
      </div>

      {isMember && pending.length > 0 && <PendingWars wars={pending} />}

      {/* Pestañas de detalle */}
      <Tabs
        tabs={[
          { id: 'overview', label: t('teamStats.overview') },
          { id: 'tracks', label: t('teamStats.trackPerformance') },
          { id: 'players', label: t('teamStats.players') },
          { id: 'rivals', label: t('teamStats.rivals') },
          { id: 'preview', label: t('preview.tab') },
          { id: 'wars', label: t('teamStats.wars') },
          { id: 'members', label: `${t('times.player')}s (${team.members.length})` },
        ]}
        value={tab}
        onChange={setTab}
      />

      {/* Contenido según pestaña */}
      {tab === 'overview' && (
        <div className="space-y-8">
          {/* Métricas Globales de Wars */}
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="border border-line bg-surface p-4">
              <p className="font-mono text-xs text-muted">{t('teamStats.wars')}</p>
              <p className="font-display text-3xl font-extrabold">{stats?.wars ?? 0}</p>
              <p className="font-mono text-xs text-muted">
                {stats?.wins ?? 0}V - {stats?.losses ?? 0}D - {stats?.ties ?? 0}E
              </p>
            </div>

            <div className="border border-line bg-surface p-4">
              <p className="font-mono text-xs text-muted">{t('teamStats.winRate')}</p>
              <p className="font-display text-3xl font-extrabold text-kart-yellow">{stats?.winRate ?? 0}%</p>
              <p className="font-mono text-xs text-muted">en {stats?.wars ?? 0} wars</p>
            </div>

            <div className="border border-line bg-surface p-4">
              <p className="font-mono text-xs text-muted">{t('teamStats.avgDiff')}</p>
              <p
                className={`font-display text-3xl font-extrabold ${
                  (stats?.avgDiff ?? 0) > 0 ? 'text-kart-green' : (stats?.avgDiff ?? 0) < 0 ? 'text-kart-red' : 'text-ink'
                }`}
              >
                {(stats?.avgDiff ?? 0) > 0 ? `+${stats?.avgDiff}` : stats?.avgDiff ?? 0}
              </p>
              <p className="font-mono text-xs text-muted">pts/carrera</p>
            </div>

            <div className="border border-line bg-surface p-4">
              <p className="font-mono text-xs text-muted">{t('teamStats.pointsHome')} / {t('teamStats.pointsAway')}</p>
              <p className="font-display text-3xl font-extrabold">
                {stats?.totalPointsHome ?? 0} <span className="text-base text-muted font-sans font-normal">/ {stats?.totalPointsAway ?? 0}</span>
              </p>
              <p className="font-mono text-xs text-muted">{stats?.totalRaces ?? 0} carreras</p>
            </div>
          </section>

          {/* Pistas favorables y desfavorables para War Picks */}
          {stats && stats.tracks.length > 0 && (
            <section className="grid gap-4 sm:grid-cols-2">
              {stats.bestTracks.length > 0 && (
                <div className="border-2 border-kart-green/50 bg-surface p-4">
                  <p className="font-mono text-xs font-bold text-kart-green uppercase">
                    ★ {t('teamStats.bestTracks')}
                  </p>
                  <div className="mt-3 space-y-2">
                    {stats.bestTracks.map((tr) => {
                      const trackObj = getTrack(tr.trackId)
                      return (
                        <div key={tr.trackId} className="flex items-center justify-between">
                          <span className="flex items-center gap-2">
                            <Plate color={getTrackColor(trackObj)} textColor={getTrackTextColor(trackObj)}>{trackObj?.abbr ?? tr.trackId}</Plate>
                            <span className="font-semibold text-sm">{trackObj?.name ?? tr.trackId}</span>
                          </span>
                          <span className="font-mono font-bold text-kart-green text-sm">
                            +{tr.diff} pts ({tr.races}c)
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {stats.worstTracks.length > 0 && (
                <div className="border-2 border-kart-red/50 bg-surface p-4">
                  <p className="font-mono text-xs font-bold text-kart-red uppercase">
                    ⚠ {t('teamStats.worstTracks')}
                  </p>
                  <div className="mt-3 space-y-2">
                    {stats.worstTracks.map((tr) => {
                      const trackObj = getTrack(tr.trackId)
                      return (
                        <div key={tr.trackId} className="flex items-center justify-between">
                          <span className="flex items-center gap-2">
                            <Plate color={getTrackColor(trackObj)} textColor={getTrackTextColor(trackObj)}>{trackObj?.abbr ?? tr.trackId}</Plate>
                            <span className="font-semibold text-sm">{trackObj?.name ?? tr.trackId}</span>
                          </span>
                          <span className="font-mono font-bold text-kart-red text-sm">
                            {tr.diff} pts ({tr.races}c)
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </section>
          )}

          <TeamFormPanel form={form} />
        </div>
      )}

      {tab === 'tracks' && (
        <section className="space-y-3">
          {stats?.tracks.length === 0 ? (
            <EmptyState title={t('teamStats.noWars')} />
          ) : (
            <>
              <div className="flex justify-end">
                <SearchBox
                  value={trackSearch}
                  onChange={setTrackSearch}
                  suggestions={trackSuggestions.slice(0, 8).map(trackSuggestion)}
                  onPick={(s) => setTrackSearch(s.label)}
                  placeholder={t('stats.searchTrack')}
                  className="field w-full text-sm"
                  wrapperClassName="relative w-full sm:w-72"
                />
              </div>
              <div className="panel overflow-x-auto">
                <table className="w-full min-w-max text-sm">
                  <thead className="bg-bg text-left font-display text-sm text-kart-yellow">
                    <tr>
                      <th className="px-4 py-2 font-extrabold">{t('wr.colTrack')}</th>
                      <th className="px-4 py-2 font-extrabold">{t('teamStats.races')}</th>
                      <th className="px-4 py-2 font-extrabold">{t('teamStats.avgScore')}</th>
                      <th className="px-4 py-2 font-extrabold">{t('teamStats.diff')}</th>
                      <th className="px-4 py-2 font-extrabold">{t('event.avgPos')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTeamTracks.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-sm text-muted">
                          {t('stats.noTracksFound')}
                        </td>
                      </tr>
                    ) : (
                      filteredTeamTracks.map((tr) => {
                        const trackObj = getTrack(tr.trackId)
                        const isPositive = tr.diff > 0
                        const isNegative = tr.diff < 0
                        return (
                          <tr key={tr.trackId} className="border-t border-line/60">
                            <td className="px-4 py-2">
                              <Link to={`/pistas/${tr.trackId}`} className="flex items-center gap-2 hover:text-kart-yellow">
                                <Plate color={getTrackColor(trackObj)} textColor={getTrackTextColor(trackObj)}>
                                  {trackObj?.abbr ?? tr.trackId}
                                </Plate>
                                <span className="font-semibold">{trackObj?.name ?? tr.trackId}</span>
                              </Link>
                            </td>
                            <td className="px-4 py-2 font-mono">{tr.races}</td>
                            <td className="px-4 py-2 font-mono">
                              {tr.avgHome} <span className="text-muted">vs</span> {tr.avgAway}
                            </td>
                            <td
                              className={`px-4 py-2 font-mono font-bold ${
                                isPositive ? 'text-kart-green' : isNegative ? 'text-kart-red' : 'text-muted'
                              }`}
                            >
                              {isPositive ? `+${tr.diff}` : tr.diff}
                            </td>
                            <td className="px-4 py-2 font-mono text-xs text-muted">
                              {tr.avgPosHome} (equipo) vs {tr.avgPosAway} (rival)
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      )}

      {tab === 'players' && (
        <section>
          {playerStats.length === 0 ? (
            <EmptyState title={t('teamStats.noWars')} />
          ) : (
            <div className="panel overflow-x-auto">
              <table className="w-full min-w-max text-sm">
                <thead className="bg-bg text-left font-display text-sm text-kart-yellow">
                  <tr>
                    <th className="px-4 py-2 font-extrabold">{t('event.player')}</th>
                    <th className="px-4 py-2 text-right font-extrabold">{t('teamStats.wars')}</th>
                    <th className="px-4 py-2 text-right font-extrabold">{t('teamStats.races')}</th>
                    <th className="px-4 py-2 text-right font-extrabold">{t('teamStats.ptsPerRace')}</th>
                    <th className="px-4 py-2 text-right font-extrabold">{t('event.avgPos')}</th>
                    <th className="px-4 py-2 text-right font-extrabold">{t('teamStats.top3')}</th>
                    <th className="px-4 py-2 font-extrabold">{t('teamStats.bestTrack')}</th>
                    <th className="px-4 py-2 font-extrabold">{t('teamStats.worstTrack')}</th>
                  </tr>
                </thead>
                <tbody>
                  {playerStats.map((p) => {
                    const best = p.bestTrack && getTrack(p.bestTrack.trackId)
                    const worst = p.worstTrack && getTrack(p.worstTrack.trackId)
                    return (
                      <tr key={p.key} className="border-t border-line/60">
                        <td className="px-4 py-2 font-semibold">
                          {p.profileId ? (
                            <Link to={`/estadisticas/${p.profileId}`} className="hover:text-kart-yellow">
                              {p.name}
                            </Link>
                          ) : (
                            p.name
                          )}
                        </td>
                        <td className="px-4 py-2 text-right font-mono">{p.wars}</td>
                        <td className="px-4 py-2 text-right font-mono">{p.races}</td>
                        <td className="px-4 py-2 text-right font-display text-base font-bold tabular-nums">{p.avgPoints}</td>
                        <td className="px-4 py-2 text-right font-mono text-muted">{p.avgPos}</td>
                        <td className="px-4 py-2 text-right font-mono text-muted">{p.top3Rate}%</td>
                        <td className="px-4 py-2">
                          {p.bestTrack && (
                            <span className="flex items-center gap-2">
                              <Plate color={getTrackColor(best)} textColor={getTrackTextColor(best)}>{best?.abbr ?? p.bestTrack.trackId}</Plate>
                              <span className="font-mono text-xs text-muted">
                                {p.bestTrack.avgPoints} ({p.bestTrack.races}c)
                              </span>
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2">
                          {p.worstTrack && (
                            <span className="flex items-center gap-2">
                              <Plate color={getTrackColor(worst)} textColor={getTrackTextColor(worst)}>{worst?.abbr ?? p.worstTrack.trackId}</Plate>
                              <span className="font-mono text-xs text-muted">
                                {p.worstTrack.avgPoints} ({p.worstTrack.races}c)
                              </span>
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {tab === 'rivals' && (
        <section className="space-y-4">
          {stats?.rivals.length === 0 ? (
            <EmptyState title={t('teamStats.noWars')} />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {stats?.rivals.map((rv) => (
                <div key={rv.opponentKey} className="border-2 border-line bg-surface p-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Plate>{rv.opponentTag}</Plate>
                      <h3 className="font-display text-xl font-bold">{rv.opponentName}</h3>
                    </div>
                    <span
                      className={`font-mono text-sm font-bold ${
                        rv.diff > 0 ? 'text-kart-green' : rv.diff < 0 ? 'text-kart-red' : 'text-muted'
                      }`}
                    >
                      {rv.diff > 0 ? `+${rv.diff}` : rv.diff} pts
                    </span>
                  </div>

                  <div className="mt-3 flex items-center justify-between text-xs text-muted">
                    <span>
                      {rv.wars} {t('teamStats.wars')} ({rv.wins}V - {rv.losses}D - {rv.ties}E)
                    </span>
                    <span>
                      {rv.pointsHome} - {rv.pointsAway}
                    </span>
                  </div>

                  <div className="mt-4 border-t border-line/60 pt-3">
                    <p className="font-mono text-[11px] text-muted uppercase">{t('teamStats.lastMatch')}:</p>
                    <div className="mt-1 space-y-1">
                      {rv.matches.slice(0, 3).map((m) => (
                        <Link
                          key={m.eventId}
                          to={`/eventos/${m.eventId}`}
                          className="flex items-center justify-between text-xs hover:text-kart-yellow"
                        >
                          <span className="font-mono text-muted">{m.date ? m.date.slice(0, 10) : '—'}</span>
                          <span
                            className={`font-mono font-bold ${
                              m.result === 'W'
                                ? 'text-kart-green'
                                : m.result === 'L'
                                  ? 'text-kart-red'
                                  : 'text-kart-yellow'
                            }`}
                          >
                            {m.homeScore} - {m.awayScore} ({m.result})
                          </span>
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {tab === 'preview' && stats && (
        <RivalPreview teamId={team.id} wars={wars} stats={stats} allTeams={allTeams} />
      )}

      {tab === 'wars' && (
        <section className="space-y-3">
          {stats?.wars === 0 ? (
            <EmptyState title={t('teamStats.noWars')} />
          ) : (
            <div className="panel divide-y divide-line/60">
              {warList.map(({ m, rv }) => (
                  <Link
                    key={m.eventId}
                    to={`/eventos/${m.eventId}`}
                    className="flex items-center justify-between p-4 hover:bg-surface-2 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`font-display text-xl font-black w-6 text-center ${
                          m.result === 'W'
                            ? 'text-kart-green'
                            : m.result === 'L'
                              ? 'text-kart-red'
                              : 'text-kart-yellow'
                        }`}
                      >
                        {m.result}
                      </span>
                      <div>
                        <span className="font-semibold text-base">vs {rv.opponentTag} ({rv.opponentName})</span>
                        <p className="font-mono text-xs text-muted">{m.date ? m.date.slice(0, 10) : '—'}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="font-display text-xl font-bold">
                        {m.homeScore} – {m.awayScore}
                      </span>
                      <p
                        className={`font-mono text-xs ${
                          m.diff > 0 ? 'text-kart-green' : m.diff < 0 ? 'text-kart-red' : 'text-muted'
                        }`}
                      >
                        {m.diff > 0 ? `+${m.diff}` : m.diff}
                      </p>
                    </div>
                  </Link>
              ))}
            </div>
          )}
        </section>
      )}

      {tab === 'members' && (
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {team.members.map((m) => (
            <Link
              key={m.id}
              to={`/estadisticas/${m.id}`}
              className="flex items-center gap-3 border border-line bg-surface p-4 hover:border-kart-yellow transition-colors"
            >
              {m.avatar_url ? (
                <img src={m.avatar_url} alt="" className="size-10 rounded-full" />
              ) : (
                <div className="size-10 rounded-full bg-surface-2" />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <Flag code={m.country_code} locale={locale} />
                  <span className="truncate font-semibold">{m.username}</span>
                </div>
                <span className="font-mono text-xs text-kart-yellow">→ Ver perfil y tiempos</span>
              </div>
            </Link>
          ))}
        </section>
      )}
    </div>
  )
}
