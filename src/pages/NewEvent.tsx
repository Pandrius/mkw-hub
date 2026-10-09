import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import PlayerInput from '../components/PlayerInput'
import { EmptyState, PageHeader, Plate, Tabs } from '../components/ui'
import { useI18n } from '../i18n'
import { useAuth } from '../lib/auth'
import { getAllTeams, teamsOf, type Entity, type TeamWithMembers } from '../lib/compare'
import { createEvent, type EventKind } from '../lib/events'

export default function NewEvent() {
  const { t } = useI18n()
  const { profile, loading, isAdmin } = useAuth()
  const navigate = useNavigate()
  const [kind, setKind] = useState<EventKind>('war')

  // Equipos
  const [myTeams, setMyTeams] = useState<Entity[]>([])
  const [allTeams, setAllTeams] = useState<TeamWithMembers[]>([])
  const [loadingTeams, setLoadingTeams] = useState(true)

  const [selectedMyTeam, setSelectedMyTeam] = useState<number | null>(null)
  const [teamTag, setTeamTag] = useState('')
  const [teamName, setTeamName] = useState('')

  const [opponentQuery, setOpponentQuery] = useState('')
  const [selectedOpponentTeam, setSelectedOpponentTeam] = useState<TeamWithMembers | null>(null)
  const [opponentTag, setOpponentTag] = useState('')
  const [opponentName, setOpponentName] = useState('')

  // Jugadores
  const [players, setPlayers] = useState<string[]>(() => Array(6).fill(''))
  const [opponentPlayers, setOpponentPlayers] = useState<string[]>(() => Array(6).fill(''))
  const [ingame, setIngame] = useState('')

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!profile) return
    Promise.all([teamsOf(profile.id), getAllTeams()])
      .then(([mine, all]) => {
        setMyTeams(mine)
        setAllTeams(all)
        // Auto-seleccionar primer equipo propio si existe
        if (mine.length > 0 && mine[0].kind === 'team') {
          setSelectedMyTeam(mine[0].id)
          setTeamTag(mine[0].tag)
          setTeamName(mine[0].name)
        }
        setLoadingTeams(false)
      })
      .catch(() => setLoadingTeams(false))
  }, [profile])

  // Miembros del equipo propio seleccionado
  const currentTeamMembers = useMemo(() => {
    if (!selectedMyTeam) return []
    const found = allTeams.find((t) => t.id === selectedMyTeam)
    return found?.members ?? []
  }, [selectedMyTeam, allTeams])

  // Nombres sugeridos al escribir cada jugador (miembros registrados de cada equipo)
  const homeSuggestions = useMemo(() => currentTeamMembers.map((m) => m.username), [currentTeamMembers])
  const opponentSuggestions = useMemo(() => selectedOpponentTeam?.members.map((m) => m.username) ?? [], [selectedOpponentTeam])

  // Filtrado de equipos rivales para autocompletado
  const filteredOpponents = useMemo(() => {
    const q = opponentQuery.trim().toLowerCase()
    if (q.length < 1) return []
    return allTeams
      .filter((tm) => tm.id !== selectedMyTeam && (tm.name.toLowerCase().includes(q) || tm.tag.toLowerCase().includes(q)))
      .slice(0, 6)
  }, [opponentQuery, allTeams, selectedMyTeam])

  if (loading) return <p className="text-muted">{t('common.loading')}</p>
  if (!profile) return <EmptyState title={t('stats.signInTitle')}>{t('stats.signInText')}</EmptyState>

  const selectHomeTeam = (id: number) => {
    setSelectedMyTeam(id)
    const tm = allTeams.find((t) => t.id === id) || (myTeams.find((t) => t.kind === 'team' && t.id === id) as Extract<Entity, { kind: 'team' }>)
    if (tm) {
      setTeamTag(tm.tag)
      setTeamName(tm.name)
    }
  }

  const pickOpponentTeam = (tm: TeamWithMembers) => {
    setSelectedOpponentTeam(tm)
    setOpponentTag(tm.tag)
    setOpponentName(tm.name)
    setOpponentQuery('')
  }

  const clearOpponentTeam = () => {
    setSelectedOpponentTeam(null)
    setOpponentTag('')
    setOpponentName('')
    setOpponentQuery('')
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const tagH = teamTag.trim() || 'Home'
      const tagA = opponentTag.trim() || 'Away'

      const homeEntries =
        kind === 'war'
          ? players.map((p, i) => {
              const val = p.trim()
              if (val) return val
              if (i === 0) return profile.username
              return `${tagH} ${i + 1}`
            })
          : [ingame.trim()]

      const cleanOpponentPlayers =
        kind === 'war' ? opponentPlayers.map((p, i) => p.trim() || `${tagA} ${i + 1}`) : null

      const id = await createEvent({
        kind,
        teamTag: teamTag.trim(),
        opponentTag: opponentTag.trim(),
        players: homeEntries,
        teamId: kind === 'war' ? selectedMyTeam : null,
        teamName: kind === 'war' ? teamName.trim() || null : null,
        opponentTeamId: kind === 'war' ? selectedOpponentTeam?.id ?? null : null,
        opponentName: kind === 'war' ? opponentName.trim() || null : null,
        opponentPlayers: cleanOpponentPlayers,
      })
      navigate(`/eventos/${id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.saveError'))
      setSaving(false)
    }
  }

  const canCreateWar = myTeams.length > 0 || isAdmin

  return (
    <>
      <PageHeader title={t('event.newTitle')} subtitle={t('event.newSubtitle')} />
      <form onSubmit={submit} className="max-w-2xl space-y-6 panel p-6">
        <div>
          <p className="mb-2 text-sm text-muted">{t('event.kind')}</p>
          <Tabs
            tabs={[
              { id: 'war', label: t('event.war') },
              { id: 'lounge', label: t('event.lounge') },
            ]}
            value={kind}
            onChange={setKind}
          />
        </div>

        {kind === 'war' ? (
          <>
            {!loadingTeams && !canCreateWar && (
              <div className="border-2 border-kart-red/60 bg-kart-red/10 p-4">
                <p className="font-semibold text-kart-red">{t('event.noTeamWarning')}</p>
                <Link to="/equipos" className="mt-2 inline-block font-mono text-xs font-bold text-kart-yellow hover:underline">
                  → {t('event.goToTeams')}
                </Link>
              </div>
            )}

            {/* Selector de equipo propio */}
            <div>
              <label className="mb-1 block text-sm font-semibold text-ink">{t('event.selectMyTeam')}</label>
              {myTeams.filter((tm) => tm.kind === 'team').length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {myTeams.filter((tm): tm is Extract<Entity, { kind: 'team' }> => tm.kind === 'team').map((tm) => (
                    <button
                      key={tm.id}
                      type="button"
                      onClick={() => selectHomeTeam(tm.id)}
                      className={`flex items-center gap-2 border-2 px-3 py-2 transition-colors ${
                        selectedMyTeam === tm.id ? 'border-kart-yellow bg-kart-yellow/10' : 'border-line hover:border-line/90'
                      }`}
                    >
                      <Plate color={selectedMyTeam === tm.id ? 'var(--color-kart-yellow)' : undefined}>
                        {tm.tag}
                      </Plate>
                      <span className="font-display text-lg font-bold">{tm.name}</span>
                    </button>
                  ))}
                </div>
              ) : isAdmin ? (
                <select
                  value={selectedMyTeam ?? ''}
                  onChange={(e) => selectHomeTeam(Number(e.target.value))}
                  className="field"
                >
                  <option value="">Selecciona equipo (modo admin)</option>
                  {allTeams.map((tm) => (
                    <option key={tm.id} value={tm.id}>
                      [{tm.tag}] {tm.name}
                    </option>
                  ))}
                </select>
              ) : null}
            </div>

            {/* Equipo Rival */}
            <div className="border-t border-line/60 pt-4">
              <p className="mb-2 text-sm font-semibold">{t('event.searchOpponent')}</p>
              {selectedOpponentTeam ? (
                <div className="flex items-center justify-between border-2 border-kart-yellow bg-surface p-3">
                  <div className="flex items-center gap-2">
                    <Plate>{selectedOpponentTeam.tag}</Plate>
                    <div>
                      <h4 className="font-display text-lg font-bold">{selectedOpponentTeam.name}</h4>
                      <p className="text-xs text-muted">ID MKC: {selectedOpponentTeam.id}</p>
                    </div>
                  </div>
                  <button type="button" onClick={clearOpponentTeam} className="text-sm text-muted hover:text-kart-red">
                    ✕
                  </button>
                </div>
              ) : (
                <div className="relative space-y-3">
                  <input
                    type="search"
                    value={opponentQuery}
                    onChange={(e) => setOpponentQuery(e.target.value)}
                    placeholder={t('event.searchOpponent')}
                    className="field"
                  />
                  {filteredOpponents.length > 0 && (
                    <ul className="absolute z-20 mt-1 w-full border-2 border-kart-yellow bg-bg shadow-lg">
                      {filteredOpponents.map((tm) => (
                        <li key={tm.id}>
                          <button
                            type="button"
                            onClick={() => pickOpponentTeam(tm)}
                            className="flex w-full items-center justify-between px-4 py-2.5 text-left hover:bg-surface-2"
                          >
                            <span className="flex items-center gap-2">
                              <Plate>{tm.tag}</Plate>
                              <span className="font-semibold">{tm.name}</span>
                            </span>
                            <span className="font-mono text-xs text-muted">MKC #{tm.id}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="grid gap-3 sm:grid-cols-2">
                    <label>
                      <span className="mb-1 block text-xs text-muted">{t('event.opponentTag')}</span>
                      <input
                        required
                        maxLength={12}
                        value={opponentTag}
                        onChange={(e) => setOpponentTag(e.target.value)}
                        placeholder="TAG"
                        className="field"
                      />
                    </label>
                    <label>
                      <span className="mb-1 block text-xs text-muted">{t('event.opponentName')}</span>
                      <input
                        maxLength={80}
                        value={opponentName}
                        onChange={(e) => setOpponentName(e.target.value)}
                        placeholder="Nombre completo del rival"
                        className="field"
                      />
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* Los 12 jugadores de la War (opcionales) */}
            <div className="border-t border-line/60 pt-4 space-y-4">
              <div>
                <p className="text-base font-bold text-ink">{t('event.playersOptional')}</p>
                <p className="text-xs text-muted">{t('event.playersOptionalHint')}</p>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                {/* Tu equipo (6 jugadores) */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between border-b border-line pb-1">
                    <span className="font-display text-sm font-bold text-kart-yellow">
                      {teamTag ? `[${teamTag}]` : ''} {t('event.players')}
                    </span>
                    {currentTeamMembers.length > 0 && (
                      <span className="font-mono text-xs text-muted">
                        {currentTeamMembers.length} miembros
                      </span>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    {players.map((p, i) => (
                      <PlayerInput
                        key={i}
                        value={p}
                        onChange={(v) => setPlayers((ps) => ps.map((x, j) => (j === i ? v : x)))}
                        suggestions={homeSuggestions}
                        taken={players.filter((_, j) => j !== i)}
                        placeholder={i === 0 ? profile.username : `${teamTag.trim() || 'Player'} ${i + 1}`}
                      />
                    ))}
                  </div>
                </div>

                {/* Equipo rival (6 jugadores) */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between border-b border-line pb-1">
                    <span className="font-display text-sm font-bold text-muted">
                      {opponentTag ? `[${opponentTag}]` : ''} {t('event.opponentTeam')}
                    </span>
                    <span className="text-xs text-muted">6 rivales</span>
                  </div>
                  <div className="space-y-1.5">
                    {opponentPlayers.map((p, i) => (
                      <PlayerInput
                        key={i}
                        maxLength={60}
                        value={p}
                        onChange={(v) => setOpponentPlayers((ps) => ps.map((x, j) => (j === i ? v : x)))}
                        suggestions={opponentSuggestions}
                        taken={opponentPlayers.filter((_, j) => j !== i)}
                        placeholder={`${opponentTag.trim() || 'Rival'} ${i + 1}`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <label className="block">
            <span className="mb-1 block text-sm text-muted">{t('event.ingameName')}</span>
            <input
              maxLength={40}
              value={ingame}
              onChange={(e) => setIngame(e.target.value)}
              placeholder={profile.username}
              className="field"
            />
          </label>
        )}

        {error && <p className="text-sm text-kart-red">{error}</p>}
        <button
          type="submit"
          disabled={saving || (kind === 'war' && !canCreateWar)}
          className="btn-yellow text-base disabled:opacity-50"
        >
          {saving ? t('event.starting') : t('event.start')}
        </button>
      </form>
    </>
  )
}
