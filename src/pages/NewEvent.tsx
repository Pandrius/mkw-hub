import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import PlayerInput from '../components/PlayerInput'
import { PlayedAtPicker } from '../components/PlayedAtPicker'
import { SearchBox } from '../components/SearchBox'
import { EmptyState, PageHeader, Plate, Tabs } from '../components/ui'
import { useI18n } from '../i18n'
import { useAuth } from '../lib/auth'
import { getAllTeams, teamsOf, type Entity, type TeamWithMembers } from '../lib/compare'
import { createEvent, type EventKind } from '../lib/events'
import { localDate } from '../lib/playedAt'
import { rankTeams } from '../lib/search'

export default function NewEvent() {
  const { t } = useI18n()
  const { profile, loading, isAdmin } = useAuth()
  const navigate = useNavigate()
  const [kind, setKind] = useState<EventKind>('war')

  // Equipos
  const [myTeams, setMyTeams] = useState<Entity[]>([])
  const [allTeams, setAllTeams] = useState<TeamWithMembers[]>([])

  const [selectedMyTeam, setSelectedMyTeam] = useState<number | null>(null)
  // Equipo predeterminado (Nebulosa si es de los tuyos): de él salen las sugerencias de nombres aunque juegues con otro equipo
  const [defaultTeam, setDefaultTeam] = useState<number | null>(null)
  // War con un equipo que no está registrado (sub-equipo, mixto, otra competición)
  const [freeHome, setFreeHome] = useState(false)
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
  const [playedOn, setPlayedOn] = useState(() => localDate(new Date()))

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!profile) return
    Promise.all([teamsOf(profile.id), getAllTeams()])
      .then(([mine, all]) => {
        setMyTeams(mine)
        setAllTeams(all)
        // Equipo predeterminado: Nebulosa si lo tienes, si no el primero. Sin equipo, se empieza con un equipo libre
        const own = mine.filter((m): m is Extract<Entity, { kind: 'team' }> => m.kind === 'team')
        const preferred = own.find((m) => /nebulosa/i.test(m.name)) ?? own[0]
        if (preferred) {
          setSelectedMyTeam(preferred.id)
          setDefaultTeam(preferred.id)
          setTeamTag(preferred.tag)
          setTeamName(preferred.name)
        } else {
          setFreeHome(true)
        }
      })
      .catch(() => setFreeHome(true))
  }, [profile])

  // Miembros del equipo propio seleccionado
  const currentTeamMembers = useMemo(() => {
    const id = selectedMyTeam ?? defaultTeam
    if (!id) return []
    const found = allTeams.find((t) => t.id === id)
    return found?.members ?? []
  }, [selectedMyTeam, defaultTeam, allTeams])

  // Nombres sugeridos al escribir cada jugador (miembros registrados de cada equipo)
  const homeSuggestions = useMemo(() => currentTeamMembers.map((m) => m.username), [currentTeamMembers])
  const opponentSuggestions = useMemo(() => selectedOpponentTeam?.members.map((m) => m.username) ?? [], [selectedOpponentTeam])

  // Filtrado de equipos rivales para autocompletado
  const filteredOpponents = useMemo(() => {
    if (!opponentQuery.trim()) return []
    return rankTeams(
      opponentQuery,
      allTeams.filter((tm) => tm.id !== selectedMyTeam),
    ).slice(0, 6)
  }, [opponentQuery, allTeams, selectedMyTeam])

  if (loading) return <p className="text-muted">{t('common.loading')}</p>
  if (!profile) return <EmptyState title={t('stats.signInTitle')}>{t('stats.signInText')}</EmptyState>

  const startFreeHome = () => {
    setFreeHome(true)
    setSelectedMyTeam(null)
    setTeamTag('')
    setTeamName('')
  }

  const selectHomeTeam = (id: number) => {
    setFreeHome(false)
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
        teamId: kind === 'war' && !freeHome ? selectedMyTeam : null,
        teamName: kind === 'war' ? teamName.trim() || null : null,
        opponentTeamId: kind === 'war' ? selectedOpponentTeam?.id ?? null : null,
        opponentName: kind === 'war' ? opponentName.trim() || null : null,
        opponentPlayers: cleanOpponentPlayers,
        playedOn,
      })
      navigate(`/eventos/${id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.saveError'))
      setSaving(false)
    }
  }

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
            {/* Selector de equipo propio: tus equipos registrados u otro equipo libre */}
            <div>
              <label className="mb-1 block text-sm font-semibold text-ink">{t('event.selectMyTeam')}</label>
              <div className="flex flex-wrap gap-2">
                {myTeams
                  .filter((tm): tm is Extract<Entity, { kind: 'team' }> => tm.kind === 'team')
                  .map((tm) => (
                    <button
                      key={tm.id}
                      type="button"
                      onClick={() => selectHomeTeam(tm.id)}
                      className={`flex items-center gap-2 border-2 px-3 py-2 transition-colors ${
                        !freeHome && selectedMyTeam === tm.id ? 'border-kart-yellow bg-kart-yellow/10' : 'border-line hover:border-line/90'
                      }`}
                    >
                      <Plate color={!freeHome && selectedMyTeam === tm.id ? 'var(--color-kart-yellow)' : undefined}>{tm.tag}</Plate>
                      <span className="font-display text-lg font-bold">{tm.name}</span>
                    </button>
                  ))}
                <button
                  type="button"
                  onClick={startFreeHome}
                  aria-pressed={freeHome}
                  className={`flex items-center gap-2 border-2 px-3 py-2 transition-colors ${
                    freeHome ? 'border-kart-yellow bg-kart-yellow/10' : 'border-line hover:border-line/90'
                  }`}
                >
                  <span className="font-display text-lg font-bold">{t('event.freeTeam')}</span>
                </button>
              </div>
              {myTeams.every((tm) => tm.kind !== 'team') && isAdmin && !freeHome && (
                <select value={selectedMyTeam ?? ''} onChange={(e) => selectHomeTeam(Number(e.target.value))} className="field mt-2">
                  <option value="">Selecciona equipo (modo admin)</option>
                  {allTeams.map((tm) => (
                    <option key={tm.id} value={tm.id}>
                      [{tm.tag}] {tm.name}
                    </option>
                  ))}
                </select>
              )}
              {freeHome && (
                <div className="mt-3 space-y-2">
                  <p className="text-xs text-muted">{t('event.freeTeamHint')}</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label>
                      <span className="mb-1 block text-xs text-muted">{t('event.ownTag')}</span>
                      <input required maxLength={12} value={teamTag} onChange={(e) => setTeamTag(e.target.value)} placeholder="TAG" className="field" />
                    </label>
                    <label>
                      <span className="mb-1 block text-xs text-muted">{t('event.ownName')}</span>
                      <input maxLength={80} value={teamName} onChange={(e) => setTeamName(e.target.value)} className="field" />
                    </label>
                  </div>
                </div>
              )}
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
                <div className="space-y-3">
                  <SearchBox
                    value={opponentQuery}
                    onChange={setOpponentQuery}
                    suggestions={filteredOpponents.map((tm) => ({
                      key: String(tm.id),
                      label: tm.name,
                      icon: <Plate>{tm.tag}</Plate>,
                      detail: `MKC #${tm.id}`,
                    }))}
                    onPick={(s) => {
                      const tm = filteredOpponents.find((o) => String(o.id) === s.key)
                      if (tm) pickOpponentTeam(tm)
                    }}
                    placeholder={t('event.searchOpponent')}
                  />

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
                <p className="mt-1 text-xs text-muted">{t('event.notifyHint')}</p>
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

        <PlayedAtPicker value={playedOn} onChange={setPlayedOn} />

        {error && <p className="text-sm text-kart-red">{error}</p>}
        <button
          type="submit"
          disabled={saving}
          className="btn-yellow text-base disabled:opacity-50"
        >
          {saving ? t('event.starting') : t('event.start')}
        </button>
      </form>
    </>
  )
}
