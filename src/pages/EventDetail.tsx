import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import EditableName from '../components/EditableName'
import RaceForm from '../components/RaceForm'
import SubstituteForm from '../components/SubstituteForm'
import WarImageButtons from '../components/WarImageButtons'
import PerspectiveToggle from '../components/PerspectiveToggle'
import WarDesignPanel from '../components/WarDesignPanel'
import WarImagePreview from '../components/WarImagePreview'
import { EmptyState } from '../components/ui'
import { getTrack, getTrackColor } from '../data/tracks'
import { useI18n } from '../i18n'
import { useAuth } from '../lib/auth'
import {
  substitutePlayer,
  deleteEvent,
  deleteRace,
  finishEvent,
  getEvent,
  RACES_PER_EVENT,
  renameEventPlayer,
  renameOpponentPlayer,
  setEventPenalties,
  type EventDetail as Detail,
  type EventRace,
  type GameEvent,
} from '../lib/events'
import { MAX_PENALTIES, type Penalty } from '../lib/penalties'
import { formatDate } from '../lib/time'
import { buildWarTable, lorenziEditorUrl, lorenziText, type WarTable } from '../lib/warTable'

export default function EventDetail() {
  const { t, locale } = useI18n()
  const { eventId = '' } = useParams()
  const { profile, enabled, isAdmin } = useAuth()
  const navigate = useNavigate()
  const [detail, setDetail] = useState<Detail | null | undefined>(undefined)
  const [editing, setEditing] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setDetail(await getEvent(eventId))
  }, [eventId])

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    getEvent(eventId).then(
      (d) => !cancelled && setDetail(d),
      () => !cancelled && setError(t('common.loadError')),
    )
    return () => {
      cancelled = true
    }
  }, [enabled, eventId, t])

  if (error) return <p className="text-kart-red">{error}</p>
  if (detail === undefined) return <p className="text-muted">{t('common.loading')}</p>
  if (detail === null) return <EmptyState title={t('event.notFound')} />

  const { event, players, races } = detail
  const isWar = event.kind === 'war'
  const isOpen = event.status === 'open'
  const canEdit =
    isOpen && !!profile && (event.created_by === profile.id || players.some((p) => p.profile_id === profile.id))
  const nextRaceNo = races.length ? Math.max(...races.map((r) => r.race_no)) + 1 : 1
  const opponentNames =
    event.opponent_players && event.opponent_players.length > 0
      ? event.opponent_players
      : [1, 2, 3, 4, 5, 6].map((i) => `${event.opponent_tag || 'Rival'} ${i}`)
  const table = isWar ? buildWarTable(players, races, opponentNames, event.penalties, event.substitutions) : null

  const act = async (fn: () => Promise<unknown>) => {
    setError(null)
    try {
      await fn()
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.saveError'))
    }
  }

  const finish = () => {
    const msg =
      races.length < RACES_PER_EVENT ? t('event.confirmFinishIncomplete', { n: races.length }) : t('event.confirmFinish')
    if (confirm(msg)) act(() => finishEvent(event.id))
  }

  const remove = async () => {
    if (!confirm(t('event.confirmDelete'))) return
    try {
      await deleteEvent(event.id)
      navigate('/estadisticas')
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.saveError'))
    }
  }

  return (
    <div className="space-y-6">
      <Link to="/estadisticas" className="text-sm text-muted hover:text-ink">
        ← {t('nav.stats')}
      </Link>

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-sm">
            <span
              className={`px-2 py-0.5 font-mono text-[11px] font-bold uppercase ${
                isWar ? 'bg-kart-yellow text-bg' : 'bg-ink text-bg'
              }`}
            >
              {t(isWar ? 'event.war' : 'event.lounge')}
            </span>
            <span className={`text-xs font-bold uppercase ${isOpen ? 'text-kart-yellow' : 'text-muted'}`}>
              {t(isOpen ? 'event.open' : 'event.finished')}
            </span>
            <span className="text-muted">{formatDate(event.created_at, locale)}</span>
          </p>
          <h1 className="mt-1 font-display text-3xl font-black sm:text-4xl">
            {isWar ? (
              <span className="flex flex-wrap items-baseline gap-2">
                {event.team_id ? (
                  <Link to={`/equipos/${event.team_id}`} className="hover:text-kart-yellow">
                    {event.team_tag} {event.team_name && <span className="text-xl text-muted">({event.team_name})</span>}
                  </Link>
                ) : (
                  <span>{event.team_tag ?? '?'}</span>
                )}
                <span className="text-muted text-2xl font-normal">{t('event.vs')}</span>
                {event.opponent_team_id ? (
                  <Link to={`/equipos/${event.opponent_team_id}`} className="hover:text-kart-yellow">
                    {event.opponent_tag} {event.opponent_name && <span className="text-xl text-muted">({event.opponent_name})</span>}
                  </Link>
                ) : (
                  <span>{event.opponent_tag ?? '?'} {event.opponent_name && <span className="text-xl text-muted">({event.opponent_name})</span>}</span>
                )}
              </span>
            ) : (
              players[0]?.name
            )}
          </h1>
          {isWar && event.opponent_players && event.opponent_players.length > 0 && (
            <p className="mt-1 text-xs text-muted">
              <span className="font-semibold text-ink">Rivales:</span> {event.opponent_players.join(', ')}
            </p>
          )}
        </div>
        {table && <Scoreboard table={table} teamTag={event.team_tag} opponentTag={event.opponent_tag} racesDone={races.length} />}
      </header>

      {!isOpen && <p className="border-l-4 border-kart-yellow bg-surface px-4 py-2 text-sm">{t('event.locked')}</p>}
      {isWar && !isOpen && event.opponent_team_id !== null && !event.mirror_of && (
        <p
          className={`border-l-4 bg-surface px-4 py-2 text-sm ${
            event.opponent_confirmed ? 'border-kart-green' : event.opponent_confirmed === false ? 'border-kart-red' : 'border-line'
          }`}
        >
          {t(event.opponent_confirmed ? 'event.validation.validated' : event.opponent_confirmed === false ? 'event.validation.rejected' : 'event.validation.pending', { tag: event.opponent_tag ?? '?' })}
        </p>
      )}
      {isWar && event.mirror_of && (
        <p className="border-l-4 border-kart-green bg-surface px-4 py-2 text-sm">
          {t('event.validation.copy')}{' '}
          <Link to={`/eventos/${event.mirror_of}`} className="font-semibold text-kart-blue hover:underline">
            {t('event.validation.original')} →
          </Link>
        </p>
      )}
      {isOpen && !canEdit && <p className="border-l-4 border-line bg-surface px-4 py-2 text-sm text-muted">{t('event.readOnly')}</p>}

      {canEdit && editing === null && nextRaceNo <= RACES_PER_EVENT && (
        <RaceForm
          key={`new-${nextRaceNo}`}
          eventId={event.id}
          kind={event.kind}
          raceNo={nextRaceNo}
          players={players}
          opponentPlayers={opponentNames}
          substitutions={event.substitutions}
          teamTag={event.team_tag}
          opponentTag={event.opponent_tag}
          onSaved={reload}
        />
      )}
      {canEdit && races.length >= RACES_PER_EVENT && editing === null && (
        <p className="border-l-4 border-kart-green bg-surface px-4 py-2 text-sm">{t('event.done')}</p>
      )}

      <RacesTable
        detail={detail}
        table={table}
        opponentNames={opponentNames}
        canEdit={canEdit}
        editing={editing}
        onEdit={setEditing}
        onSaved={async () => {
          setEditing(null)
          await reload()
        }}
        onDelete={(race) => {
          if (confirm(t('event.confirmDeleteRace', { n: race.race_no }))) act(() => deleteRace(event.id, race.race_no))
        }}
      />

      {table && table.players.length > 0 && (
        <WarTableCard
          table={table}
          teamTag={event.team_tag ?? '?'}
          opponentTag={event.opponent_tag ?? '?'}
          event={event}
          races={races}
          canEdit={canEdit}
          onRenameHome={(id, entry) => act(() => renameEventPlayer(event.id, id, entry))}
          onRenameAway={(from, to) => act(() => renameOpponentPlayer(event.id, from, to))}
        />
      )}

      {isWar && (event.penalties.length > 0 || canEdit) && (
        <PenaltiesCard
          penalties={event.penalties}
          teamTag={event.team_tag ?? 'Home'}
          opponentTag={event.opponent_tag ?? 'Away'}
          canEdit={canEdit}
          onChange={(next) => act(() => setEventPenalties(event.id, next))}
        />
      )}

      {isWar && event.substitutions.length > 0 && (
        <section className="panel space-y-2 p-4">
          <h2 className="font-display text-xl font-bold">{t('event.sub.list')}</h2>
          <ul className="space-y-1 text-sm">
            {[...event.substitutions]
              .sort((a, b) => a.race_no - b.race_no)
              .map((s, i) => (
                <li key={i} className="flex gap-3">
                  <span className="w-12 font-display font-black text-muted">{s.side === 'home' ? event.team_tag : event.opponent_tag}</span>
                  <span>{t('event.sub.item', { n: s.race_no, in: s.in, out: s.out })}</span>
                </li>
              ))}
          </ul>
        </section>
      )}

      {error && <p className="text-sm text-kart-red">{error}</p>}

      {canEdit && (
        <div className="flex flex-wrap items-start gap-3 border-t border-line pt-6">
          {isWar && (
            <SubstituteForm
              teamTag={event.team_tag ?? 'Home'}
              opponentTag={event.opponent_tag ?? 'Away'}
              teamId={event.team_id}
              opponentTeamId={event.opponent_team_id}
              players={players}
              opponentNames={opponentNames}
              substitutions={event.substitutions}
              nextRaceNo={nextRaceNo}
              onSubstitute={(side, out, inEntry, fromRace) => act(() => substitutePlayer(event.id, side, out, inEntry, fromRace))}
            />
          )}
          <div className="ml-auto flex gap-2">
            <button onClick={remove} className="btn-line text-base">
              {t('event.delete')}
            </button>
            <button
              onClick={finish}
              disabled={races.length === 0}
              className="btn-yellow text-base"
            >
              {t('event.finish')}
            </button>
          </div>
        </div>
      )}

      {/* Un admin puede borrar cualquier evento, también los finalizados o de otros */}
      {!canEdit && isAdmin && (
        <div className="flex justify-end border-t border-line pt-6">
          <button onClick={remove} className="btn-line text-base">
            {t('event.delete')}
          </button>
        </div>
      )}
    </div>
  )
}

function Scoreboard({
  table,
  teamTag,
  opponentTag,
  racesDone,
}: {
  table: WarTable
  teamTag: string | null
  opponentTag: string | null
  racesDone: number
}) {
  const { t } = useI18n()
  const diffColor = table.diff > 0 ? 'text-kart-green' : table.diff < 0 ? 'text-kart-red' : 'text-muted'
  return (
    <div className="panel px-5 py-3 text-center">
      <div className="flex items-baseline gap-4 font-display font-black">
        <span className="text-sm text-muted">{teamTag}</span>
        <span className="text-3xl tabular-nums">{table.home}</span>
        <span className="text-muted">–</span>
        <span className="text-3xl tabular-nums">{table.away}</span>
        <span className="text-sm text-muted">{opponentTag}</span>
      </div>
      <p className={`font-display text-lg font-bold tabular-nums ${diffColor}`}>
        {table.diff > 0 ? '+' : ''}
        {table.diff}
        <span className="ml-2 text-xs font-normal text-muted">{t('event.racesCount', { n: racesDone })}</span>
      </p>
    </div>
  )
}

function RacesTable({
  detail,
  table,
  opponentNames,
  canEdit,
  editing,
  onEdit,
  onSaved,
  onDelete,
}: {
  detail: Detail
  table: WarTable | null
  opponentNames?: string[] | null
  canEdit: boolean
  editing: number | null
  onEdit: (raceNo: number | null) => void
  onSaved: () => Promise<void>
  onDelete: (race: EventRace) => void
}) {
  const { t } = useI18n()
  const { event, players, races } = detail
  if (races.length === 0) return null
  const nameOf = (id: number) => players.find((p) => p.id === id)?.name ?? '?'
  const rowFor = (raceNo: number) => table?.races.find((r) => r.race.race_no === raceNo)

  return (
    <div className="space-y-3">
      {races.map((race) => {
        if (editing === race.race_no) {
          return (
            <RaceForm
              key={race.id}
              eventId={event.id}
              kind={event.kind}
              raceNo={race.race_no}
              players={players}
              opponentPlayers={opponentNames}
              substitutions={event.substitutions}
              teamTag={event.team_tag}
              opponentTag={event.opponent_tag}
              initial={race}
              onSaved={onSaved}
              onCancel={() => onEdit(null)}
            />
          )
        }
        const track = getTrack(race.track_id)
        const row = rowFor(race.race_no)
        const results = [...race.race_results].sort((a, b) => a.position - b.position)
        return (
          <div key={race.id} className="flex flex-wrap items-center gap-3 panel px-4 py-3">
            <span className="w-8 font-display text-xl font-black text-muted">{race.race_no}</span>
            <span className="w-14 font-display font-black normal-case" style={{ color: getTrackColor(track) }}>
              {track?.abbr}
            </span>
            <span className="min-w-32 flex-1 truncate text-sm">{track?.name ?? race.track_id}</span>
            {/* max-w-full: en móvil las posiciones bajan de línea en vez de desbordar */}
            <span className="flex max-w-full flex-wrap gap-1.5">
              {results.map((r) => (
                <span key={r.player_id} className="rounded-md bg-surface-2 px-2 py-0.5 text-xs">
                  <b className="tabular-nums text-kart-yellow">{r.position}</b> {nameOf(r.player_id)}
                </span>
              ))}
              {race.opponent_results && race.opponent_results.map((r) => (
                <span key={r.name} className="rounded-md bg-surface-2/60 px-2 py-0.5 text-xs text-muted">
                  <b className="tabular-nums text-muted">{r.position}</b> {r.name}
                </span>
              ))}
              {race.missing_home + race.missing_away > 0 && (
                <span className="rounded-md bg-kart-red/15 px-2 py-0.5 text-xs text-kart-red">
                  {12 - race.missing_home - race.missing_away}P
                </span>
              )}
            </span>
            {row && (
              <span className="ml-auto w-28 text-right font-display font-bold tabular-nums">
                {row.home}–{row.away}{' '}
                <span className={row.diff > 0 ? 'text-kart-green' : row.diff < 0 ? 'text-kart-red' : 'text-muted'}>
                  ({row.diff > 0 ? '+' : ''}
                  {row.diff})
                </span>
              </span>
            )}
            {canEdit && (
              <span className="flex gap-2 text-sm">
                <button onClick={() => onEdit(race.race_no)} className="text-muted hover:text-ink">
                  {t('common.edit')}
                </button>
                <button onClick={() => onDelete(race)} className="text-muted hover:text-kart-red">
                  {t('event.deleteRace')}
                </button>
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

function WarTableCard({
  table,
  teamTag,
  opponentTag,
  event,
  races,
  canEdit,
  onRenameHome,
  onRenameAway,
}: {
  table: WarTable
  teamTag: string
  opponentTag: string
  event: GameEvent
  races: EventRace[]
  canEdit: boolean
  onRenameHome: (playerId: number, entry: string) => Promise<void>
  onRenameAway: (from: string, to: string) => Promise<void>
}) {
  const { t } = useI18n()
  const [copied, setCopied] = useState(false)
  const [designOpen, setDesignOpen] = useState(false)
  const text = lorenziText(teamTag, opponentTag, table)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // portapapeles no disponible
    }
  }

  const hasOpponentRows = table.opponentPlayers && table.opponentPlayers.length > 0

  return (
    <section className="overflow-hidden panel">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3">
        <h2 className="font-display text-xl font-bold">{t('event.table')}</h2>
        <span className="flex flex-wrap gap-4 text-sm font-semibold">
          {/* Tabla propia en PNG para compartir en Discord */}
          <WarImageButtons event={event} races={races} table={table} />
          <PerspectiveToggle />
          <button onClick={() => setDesignOpen((o) => !o)} aria-expanded={designOpen} className="text-kart-blue hover:underline">
            🎨 {t('design.title')}
          </button>
          <a href={lorenziEditorUrl(text)} target="_blank" rel="noreferrer" className="text-kart-blue hover:underline">
            {t('event.openLorenzi')} ↗
          </a>
          <button onClick={copy} className="text-kart-blue hover:underline">
            {copied ? t('event.copied') : t('event.copyTable')}
          </button>
        </span>
      </header>

      {designOpen && <WarDesignPanel eventId={event.id} />}

      {/* La misma imagen que se descarga o se copia: marcador, escudos, diferencia por pista y posiciones medias */}
      <WarImagePreview event={event} races={races} table={table} />

      {hasOpponentRows ? (
        <div className="border-t border-line">
          <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-line">
            {/* Tabla Equipo Propio */}
            <div className="p-3 sm:p-5">
              <div className="mb-2 flex items-center justify-between px-2">
                <span className="font-display text-base font-black text-kart-yellow">{teamTag}</span>
                <span className="font-display text-lg font-bold tabular-nums text-kart-yellow">{table.home} pts</span>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-bg text-left font-display text-xs tracking-wider text-muted">
                  <tr>
                    <th className="px-3 py-1.5 font-bold">{t('event.player')}</th>
                    <th className="px-2 py-1.5 text-right font-bold">{t('event.avgPos')}</th>
                    <th className="px-3 py-1.5 text-right font-bold">{t('event.points')}</th>
                  </tr>
                </thead>
                <tbody>
                  {table.players.map((p) => {
                    const positions = Object.values(p.positions)
                    const avg = positions.reduce((a, b) => a + b, 0) / positions.length
                    return (
                      <tr key={p.player.id} className="border-t border-line/60">
                        <td className="px-3 py-2 font-semibold">
                          <EditableName name={p.player.name} canEdit={canEdit} onSave={(v) => onRenameHome(p.player.id, v)} />
                          {p.races < table.races.length && <span className="ml-1 text-xs text-muted">({p.races})</span>}
                        </td>
                        <td className="time px-2 py-2 text-right font-medium text-muted">{avg.toFixed(1)}</td>
                        <td className="px-3 py-2 text-right font-display text-base font-bold tabular-nums">{p.points}</td>
                      </tr>
                    )
                  })}
                  {table.missingPoints > 0 && (
                    <tr className="border-t border-line/60 text-muted">
                      <td className="px-3 py-2">{t('event.missingPts')}</td>
                      <td />
                      <td className="px-3 py-2 text-right tabular-nums">{table.missingPoints}</td>
                    </tr>
                  )}
                  <PenaltyRows penalties={table.penalties} side="home" cellClass="px-3 py-2" />
                </tbody>
              </table>
            </div>

            {/* Tabla Equipo Rival */}
            <div className="p-3 sm:p-5">
              <div className="mb-2 flex items-center justify-between px-2">
                <span className="font-display text-base font-black text-muted">{opponentTag}</span>
                <span className="font-display text-lg font-bold tabular-nums text-muted">{table.away} pts</span>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-bg text-left font-display text-xs tracking-wider text-muted">
                  <tr>
                    <th className="px-3 py-1.5 font-bold">{t('event.player')}</th>
                    <th className="px-2 py-1.5 text-right font-bold">{t('event.avgPos')}</th>
                    <th className="px-3 py-1.5 text-right font-bold">{t('event.points')}</th>
                  </tr>
                </thead>
                <tbody>
                  {table.opponentPlayers.map((p) => {
                    const positions = Object.values(p.positions)
                    const avg = positions.length ? positions.reduce((a, b) => a + b, 0) / positions.length : 0
                    return (
                      <tr key={p.name} className="border-t border-line/60">
                        <td className="px-3 py-2 font-medium text-muted">
                          <EditableName name={p.name} canEdit={canEdit} maxLength={40} onSave={(v) => onRenameAway(p.name, v)} />
                          {p.races < table.races.length && <span className="ml-1 text-xs text-muted">({p.races})</span>}
                        </td>
                        <td className="time px-2 py-2 text-right font-medium text-muted">{avg.toFixed(1)}</td>
                        <td className="px-3 py-2 text-right font-display text-base font-bold tabular-nums">{p.points}</td>
                      </tr>
                    )
                  })}
                  <PenaltyRows penalties={table.penalties} side="away" cellClass="px-3 py-2" />
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid border-t border-line md:grid-cols-2">
          <table className="w-full text-sm">
            <thead className="bg-bg text-left font-display text-sm tracking-wider text-kart-yellow">
              <tr>
                <th className="px-5 py-2 font-extrabold">{t('event.player')}</th>
                <th className="px-3 py-2 text-right font-extrabold">{t('event.avgPos')}</th>
                <th className="px-5 py-2 text-right font-extrabold">{t('event.points')}</th>
              </tr>
            </thead>
            <tbody>
              {table.players.map((p) => {
                const positions = Object.values(p.positions)
                const avg = positions.reduce((a, b) => a + b, 0) / positions.length
                return (
                  <tr key={p.player.id} className="border-t border-line/60">
                    <td className="px-5 py-2 font-semibold">
                      <EditableName name={p.player.name} canEdit={canEdit} onSave={(v) => onRenameHome(p.player.id, v)} />
                      {p.races < table.races.length && <span className="ml-2 text-xs text-muted">({p.races})</span>}
                    </td>
                    <td className="time px-3 py-2 text-right font-medium text-muted">{avg.toFixed(1)}</td>
                    <td className="px-5 py-2 text-right font-display text-base font-bold tabular-nums">{p.points}</td>
                  </tr>
                )
              })}
              {table.missingPoints > 0 && (
                <tr className="border-t border-line/60 text-muted">
                  <td className="px-5 py-2">{t('event.missingPts')}</td>
                  <td />
                  <td className="px-5 py-2 text-right tabular-nums">{table.missingPoints}</td>
                </tr>
              )}
              <PenaltyRows penalties={table.penalties} side="home" cellClass="px-5 py-2" />
            </tbody>
          </table>
          <div className="flex flex-col items-center justify-center gap-1 border-t border-line p-6 md:border-l md:border-t-0">
            <div className="flex items-baseline gap-4 font-display font-black">
              <span className="text-lg text-kart-yellow">{teamTag}</span>
              <span className="text-5xl tabular-nums">{table.home}</span>
            </div>
            <div className="flex items-baseline gap-4 font-display font-black text-muted">
              <span className="text-lg">{opponentTag}</span>
              <span className="text-5xl tabular-nums">{table.away}</span>
            </div>
            <p
              className={`mt-2 font-display text-2xl font-black ${
                table.diff > 0 ? 'text-kart-green' : table.diff < 0 ? 'text-kart-red' : 'text-muted'
              }`}
            >
              {table.diff > 0 ? '+' : ''}
              {table.diff}
            </p>
          </div>
        </div>
      )}
    </section>
  )
}

/** Filas de penalties de un equipo dentro de una tabla de jugadores */
function PenaltyRows({ penalties, side, cellClass }: { penalties: Penalty[]; side: Penalty['side']; cellClass: string }) {
  const { t } = useI18n()
  return (
    <>
      {penalties
        .filter((p) => p.side === side)
        .map((p, i) => (
          <tr key={i} className="border-t border-line/60 text-muted">
            <td className={cellClass}>{p.label || t('event.penaltyDefault')}</td>
            <td />
            <td className={`${cellClass} text-right font-semibold tabular-nums text-kart-red`}>{p.points}</td>
          </tr>
        ))}
    </>
  )
}

/** Penalties de la war: lista, y formulario para añadir o quitar mientras el evento está abierto */
function PenaltiesCard({
  penalties,
  teamTag,
  opponentTag,
  canEdit,
  onChange,
}: {
  penalties: Penalty[]
  teamTag: string
  opponentTag: string
  canEdit: boolean
  onChange: (next: Penalty[]) => void
}) {
  const { t } = useI18n()
  const [side, setSide] = useState<Penalty['side']>('home')
  const [label, setLabel] = useState('')
  const [points, setPoints] = useState('')
  const tagOf = (s: Penalty['side']) => (s === 'home' ? teamTag : opponentTag)
  // Se escribe en positivo ("5") y se guarda en negativo (-5)
  const amount = Math.abs(Math.trunc(Number(points)))
  const valid = Number.isFinite(amount) && amount >= 1 && amount <= 500 && penalties.length < MAX_PENALTIES

  const add = () => {
    if (!valid) return
    onChange([...penalties, { side, label: label.trim() || t('event.penaltyDefault'), points: -amount }])
    setLabel('')
    setPoints('')
  }

  return (
    <section className="panel space-y-3 p-4">
      <div>
        <h2 className="font-display text-xl font-bold">{t('event.penalties')}</h2>
        {canEdit && <p className="text-xs text-muted">{t('event.penaltiesHint')}</p>}
      </div>

      {penalties.length > 0 && (
        <ul className="divide-y divide-line/60">
          {penalties.map((p, i) => (
            <li key={i} className="flex items-center gap-3 py-2 text-sm">
              <span className="w-16 font-display font-black text-muted">{tagOf(p.side)}</span>
              <span className="flex-1 font-semibold">{p.label}</span>
              <span className="font-display text-lg font-bold tabular-nums text-kart-red">{p.points}</span>
              {canEdit && (
                <button
                  onClick={() => onChange(penalties.filter((_, j) => j !== i))}
                  className="text-muted hover:text-kart-red"
                  aria-label={t('event.penaltyRemove')}
                  title={t('event.penaltyRemove')}
                >
                  ✕
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canEdit && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            add()
          }}
          className="flex flex-wrap items-end gap-2"
        >
          <label>
            <span className="mb-1 block text-xs text-muted">{t('event.penaltyTeam')}</span>
            <select value={side} onChange={(e) => setSide(e.target.value as Penalty['side'])} className="field">
              <option value="home">{teamTag}</option>
              <option value="away">{opponentTag}</option>
            </select>
          </label>
          <label className="min-w-40 flex-1">
            <span className="mb-1 block text-xs text-muted">{t('event.penaltyName')}</span>
            <input maxLength={40} value={label} onChange={(e) => setLabel(e.target.value)} placeholder={t('event.penaltyDefault')} className="field w-full" />
          </label>
          <label className="w-28">
            <span className="mb-1 block text-xs text-muted">{t('event.penaltyPoints')}</span>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={500}
              value={points}
              onChange={(e) => setPoints(e.target.value)}
              placeholder="5"
              className="field w-full"
            />
          </label>
          <button type="submit" disabled={!valid} className="btn-yellow text-sm disabled:opacity-50">
            + {t('event.penaltyAdd')}
          </button>
        </form>
      )}
    </section>
  )
}
