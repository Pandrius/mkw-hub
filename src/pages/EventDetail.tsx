import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import RaceForm from '../components/RaceForm'
import { EmptyState } from '../components/ui'
import { getCup, getTrack } from '../data/tracks'
import { useI18n } from '../i18n'
import { useAuth } from '../lib/auth'
import {
  addEventPlayer,
  deleteEvent,
  deleteRace,
  finishEvent,
  getEvent,
  RACES_PER_EVENT,
  type EventDetail as Detail,
  type EventRace,
} from '../lib/events'
import { formatDate } from '../lib/time'
import { buildWarTable, lorenziEditorUrl, lorenziImageUrl, lorenziText, type WarTable } from '../lib/warTable'

export default function EventDetail() {
  const { t, locale } = useI18n()
  const { eventId = '' } = useParams()
  const { profile, enabled } = useAuth()
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
  const table = isWar ? buildWarTable(players, races) : null

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
              className={`rounded-md px-2 py-0.5 text-xs font-bold uppercase ${
                isWar ? 'bg-kart-blue/15 text-kart-blue' : 'bg-kart-green/15 text-kart-green'
              }`}
            >
              {t(isWar ? 'event.war' : 'event.lounge')}
            </span>
            <span className={`text-xs font-bold uppercase ${isOpen ? 'text-kart-yellow' : 'text-muted'}`}>
              {t(isOpen ? 'event.open' : 'event.finished')}
            </span>
            <span className="text-muted">{formatDate(event.created_at, locale)}</span>
          </p>
          <h1 className="mt-1 font-display text-3xl font-black italic sm:text-4xl">
            {isWar ? `${event.team_tag ?? '?'} ${t('event.vs')} ${event.opponent_tag ?? '?'}` : players[0]?.name}
          </h1>
        </div>
        {table && <Scoreboard table={table} teamTag={event.team_tag} opponentTag={event.opponent_tag} racesDone={races.length} />}
      </header>

      {!isOpen && <p className="rounded-xl bg-surface-2 px-4 py-2 text-sm text-muted">🔒 {t('event.locked')}</p>}
      {isOpen && !canEdit && <p className="rounded-xl bg-surface-2 px-4 py-2 text-sm text-muted">{t('event.readOnly')}</p>}

      {canEdit && editing === null && nextRaceNo <= RACES_PER_EVENT && (
        <RaceForm
          key={`new-${nextRaceNo}`}
          eventId={event.id}
          kind={event.kind}
          raceNo={nextRaceNo}
          players={players}
          onSaved={reload}
        />
      )}
      {canEdit && races.length >= RACES_PER_EVENT && editing === null && (
        <p className="rounded-xl bg-kart-green/15 px-4 py-2 text-sm text-kart-green">{t('event.done')}</p>
      )}

      <RacesTable
        detail={detail}
        table={table}
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
        <WarTableCard table={table} teamTag={event.team_tag ?? '?'} opponentTag={event.opponent_tag ?? '?'} />
      )}

      {error && <p className="text-sm text-kart-red">{error}</p>}

      {canEdit && (
        <div className="flex flex-wrap items-start gap-3 border-t border-line pt-6">
          {isWar && <AddSub onAdd={(entry) => act(() => addEventPlayer(event.id, entry))} />}
          <div className="ml-auto flex gap-2">
            <button onClick={remove} className="rounded-xl border border-line px-4 py-2 text-sm font-semibold text-muted hover:text-kart-red">
              {t('event.delete')}
            </button>
            <button
              onClick={finish}
              disabled={races.length === 0}
              className="rounded-xl bg-kart-green px-4 py-2 text-sm font-bold text-bg hover:brightness-105 disabled:opacity-50"
            >
              {t('event.finish')}
            </button>
          </div>
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
    <div className="rounded-2xl border border-line bg-surface px-5 py-3 text-center">
      <div className="flex items-baseline gap-4 font-display font-black italic">
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
  canEdit,
  editing,
  onEdit,
  onSaved,
  onDelete,
}: {
  detail: Detail
  table: WarTable | null
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
          <div key={race.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3">
            <span className="w-8 font-display text-xl font-black italic text-muted">{race.race_no}</span>
            <span className="w-14 font-display font-black italic" style={{ color: track && getCup(track.cupId)?.color }}>
              {track?.abbr}
            </span>
            <span className="min-w-32 flex-1 truncate text-sm">{track?.name ?? race.track_id}</span>
            {/* max-w-full: en móvil las posiciones bajan de línea en vez de desbordar */}
            <span className="flex max-w-full flex-wrap gap-1.5">
              {results.map((r) => (
                <span key={r.player_id} className="rounded-md bg-surface-2 px-2 py-0.5 text-xs">
                  <b className="tabular-nums">{r.position}</b> {nameOf(r.player_id)}
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

function WarTableCard({ table, teamTag, opponentTag }: { table: WarTable; teamTag: string; opponentTag: string }) {
  const { t } = useI18n()
  const [copied, setCopied] = useState(false)
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

  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-surface">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3">
        <h2 className="font-display text-xl font-bold">{t('event.table')}</h2>
        <span className="flex gap-4 text-sm font-semibold">
          <a href={lorenziEditorUrl(text)} target="_blank" rel="noreferrer" className="text-kart-blue hover:underline">
            {t('event.openLorenzi')} ↗
          </a>
          <button onClick={copy} className="text-kart-blue hover:underline">
            {copied ? t('event.copied') : t('event.copyTable')}
          </button>
        </span>
      </header>
      {/* Imagen generada por el Table Maker de Lorenzi con nuestros datos */}
      <a href={lorenziEditorUrl(text)} target="_blank" rel="noreferrer" className="block bg-bg">
        <img src={lorenziImageUrl(text)} alt={`${teamTag} ${table.home} – ${opponentTag} ${table.away}`} className="w-full" loading="lazy" />
      </a>
      <div className="grid border-t border-line md:grid-cols-2">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted">
            <tr>
              <th className="px-5 py-2 font-semibold">{t('event.player')}</th>
              <th className="px-3 py-2 text-right font-semibold">{t('event.avgPos')}</th>
              <th className="px-5 py-2 text-right font-semibold">{t('event.points')}</th>
            </tr>
          </thead>
          <tbody>
            {table.players.map((p) => {
              const positions = Object.values(p.positions)
              const avg = positions.reduce((a, b) => a + b, 0) / positions.length
              return (
                <tr key={p.player.id} className="border-t border-line/60">
                  <td className="px-5 py-2 font-semibold">
                    {p.player.name}
                    {p.races < table.races.length && <span className="ml-2 text-xs text-muted">({p.races})</span>}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted">{avg.toFixed(1)}</td>
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
          </tbody>
        </table>
        <div className="flex flex-col items-center justify-center gap-1 border-t border-line p-6 md:border-l md:border-t-0">
          <div className="flex items-baseline gap-4 font-display font-black italic">
            <span className="text-lg text-kart-yellow">{teamTag}</span>
            <span className="text-5xl tabular-nums">{table.home}</span>
          </div>
          <div className="flex items-baseline gap-4 font-display font-black italic text-muted">
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
    </section>
  )
}

function AddSub({ onAdd }: { onAdd: (entry: string) => Promise<void> }) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('')

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="rounded-xl border border-line px-4 py-2 text-sm font-semibold hover:bg-surface-2">
        + {t('event.addSub')}
      </button>
    )
  }
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault()
        if (!value.trim()) return
        await onAdd(value.trim())
        setValue('')
        setOpen(false)
      }}
      className="flex gap-2"
    >
      <input
        autoFocus
        maxLength={80}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={t('event.subPlaceholder')}
        className="w-72 rounded-xl border border-line bg-bg px-3 py-2 text-sm outline-none focus:border-kart-yellow"
      />
      <button type="submit" className="rounded-xl bg-kart-yellow px-4 py-2 text-sm font-bold text-bg">
        {t('common.save')}
      </button>
    </form>
  )
}
