import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'
import { RivalPreview } from '../components/RivalPreview'
import { HeadToHead, TeamOverviewPanel, TeamPlayersTable, TeamTracksTable } from '../components/TeamAnalyticsView'
import { EmptyState, Flag, Plate, Tabs } from '../components/ui'
import { TeamLogo } from '../components/TeamLogo'
import { useI18n } from '../i18n'
import { useAuth } from '../lib/auth'
import { getAllTeams, type TeamWithMembers } from '../lib/compare'
import { computeTeamForm, type TeamForm } from '../lib/teamForm'
import { computeTeamOverview } from '../lib/teamAnalytics'
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
  const overview = useMemo(() => computeTeamOverview(wars), [wars])

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
          { id: 'rivals', label: t('an.h2h.tab') },
          { id: 'preview', label: t('preview.tab') },
          { id: 'wars', label: t('teamStats.wars') },
          { id: 'members', label: `${t('times.player')}s (${team.members.length})` },
        ]}
        value={tab}
        onChange={setTab}
      />

      {/* Contenido según pestaña */}
      {tab === 'overview' && (overview && stats ? <TeamOverviewPanel o={overview} form={form} stats={stats} /> : <EmptyState title={t('teamStats.noWars')} />)}

      {tab === 'tracks' && <TeamTracksTable tracks={stats?.tracks ?? []} />}

      {tab === 'players' && <TeamPlayersTable players={playerStats} />}

      {tab === 'rivals' && stats && <HeadToHead teamId={team.id} wars={wars} stats={stats} />}

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
