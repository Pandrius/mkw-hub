import { useState } from 'react'
import { CUPS, TRACKS } from '../data/tracks'
import { useI18n } from '../i18n'
import { saveRace, type EventKind, type EventPlayer, type EventRace, type OpponentResult } from '../lib/events'
import { scoreTeamRace } from '../lib/scoring'
import OcrReader, { type OcrFill } from './OcrReader'

type Props = {
  eventId: string
  kind: EventKind
  raceNo: number
  players: EventPlayer[]
  opponentPlayers?: string[] | null
  teamTag?: string | null
  opponentTag?: string | null
  /** Carrera existente si se está corrigiendo */
  initial?: EventRace
  onSaved: () => Promise<void>
  onCancel?: () => void
}

const input = 'field'

/** Formulario de una carrera: pista y posición de cada jugador propio y rival. */
export default function RaceForm({
  eventId,
  kind,
  raceNo,
  players,
  opponentPlayers,
  teamTag,
  opponentTag,
  initial,
  onSaved,
  onCancel,
}: Props) {
  const { t } = useI18n()
  const [trackId, setTrackId] = useState(initial?.track_id ?? '')
  const [positions, setPositions] = useState<Record<number, string>>(() =>
    Object.fromEntries((initial?.race_results ?? []).map((r) => [r.player_id, String(r.position)])),
  )
  const [opponentPositions, setOpponentPositions] = useState<Record<string, string>>(() =>
    Object.fromEntries((initial?.opponent_results ?? []).map((r) => [r.name, String(r.position)])),
  )
  const [missingHome, setMissingHome] = useState(initial?.missing_home ?? 0)
  const [missingAway, setMissingAway] = useState(initial?.missing_away ?? 0)
  const [saving, setSaving] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  /** Campos rellenados por el lector de capturas (se resaltan para revisarlos) */
  const [ocrKeys, setOcrKeys] = useState<Set<string>>(new Set())

  const applyOcr = (fill: OcrFill) => {
    setPositions(fill.home)
    if (kind === 'war') setOpponentPositions(fill.away)
    setOcrKeys(new Set([...Object.keys(fill.home).map((id) => `h:${id}`), ...Object.keys(fill.away).map((n) => `a:${n}`)]))
  }
  const ocrClass = (key: string) => (ocrKeys.has(key) ? ' ring-2 ring-kart-yellow/70' : '')

  const filled = players
    .map((p) => ({ player_id: p.id, position: Number(positions[p.id]) }))
    .filter((r) => positions[r.player_id]?.trim() && Number.isInteger(r.position))

  const racers = 12 - missingHome - missingAway
  const nums = filled.map((r) => r.position)

  const rawOpponents = (opponentPlayers ?? []).filter(Boolean)
  const hasOpponents = kind === 'war' && rawOpponents.length > 0

  const remainingPositions = Array.from({ length: racers }, (_, i) => i + 1).filter((n) => !nums.includes(n))

  const filledOpp = rawOpponents
    .map((name) => ({ name, position: Number(opponentPositions[name]) }))
    .filter((r) => opponentPositions[r.name]?.trim() && Number.isInteger(r.position))

  const autoFillOpponents = () => {
    const oppMap: Record<string, string> = {}
    rawOpponents.slice(0, remainingPositions.length).forEach((name, i) => {
      oppMap[name] = String(remainingPositions[i])
    })
    setOpponentPositions(oppMap)
  }

  // Mismas reglas que save_race() en la base de datos
  let error: string | null = null
  if (!trackId) error = t('event.errTrack')
  else if (kind === 'lounge') {
    if (filled.length !== 1 || nums[0] < 1 || nums[0] > 24) error = t('event.errLounge')
  } else if (missingHome + missingAway > 2) error = t('event.errMissing')
  else if (new Set(nums).size !== nums.length) error = t('event.errDup')
  else if (nums.some((n) => n < 1 || n > racers)) error = t('event.errRange', { n: racers })
  else if (filled.length + missingHome !== 6) error = t('event.errCount', { n: filled.length, m: missingHome })
  else if (filledOpp.length > 0) {
    const oppNums = filledOpp.map((o) => o.position)
    if (new Set(oppNums).size !== oppNums.length) error = t('event.errDup')
    else if (oppNums.some((n) => n < 1 || n > racers)) error = t('event.errRange', { n: racers })
    else if (oppNums.some((n) => nums.includes(n))) error = t('event.errDupOpponent')
  }

  const preview = kind === 'war' && !error ? scoreTeamRace(nums, missingHome, missingAway) : null

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (error) return
    setSaving(true)
    setServerError(null)
    try {
      let finalOpponentResults: OpponentResult[] | undefined = undefined
      if (hasOpponents) {
        if (filledOpp.length > 0) {
          finalOpponentResults = filledOpp
        } else if (remainingPositions.length > 0) {
          // Auto-asignación de las posiciones restantes entre los 6 rivales
          finalOpponentResults = rawOpponents.slice(0, remainingPositions.length).map((name, i) => ({
            name,
            position: remainingPositions[i],
          }))
        }
      }
      await saveRace(
        eventId,
        raceNo,
        trackId,
        filled,
        kind === 'war' ? missingHome : 0,
        kind === 'war' ? missingAway : 0,
        finalOpponentResults,
      )
      await onSaved()
    } catch (err) {
      setServerError(err instanceof Error ? err.message : t('common.saveError'))
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-2xl border border-kart-yellow/60 bg-surface p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-display text-lg font-bold">
          {initial ? t('event.editRace', { n: raceNo }) : t('event.addRace', { n: raceNo })}
        </p>
        {hasOpponents && (
          <span className="text-xs text-muted">
            12 jugadores · {filled.length + (filledOpp.length || (filled.length + missingHome === 6 ? remainingPositions.length : 0))}/12 con posición
          </span>
        )}
      </div>

      <label className="block">
        <span className="mb-1 block text-sm text-muted">{t('event.track')}</span>
        <select value={trackId} onChange={(e) => setTrackId(e.target.value)} className={input} autoFocus={!initial}>
          <option value="">{t('event.chooseTrack')}</option>
          {CUPS.map((cup) => (
            <optgroup key={cup.id} label={t(`cup.${cup.id}`)}>
              {TRACKS.filter((tr) => tr.cupId === cup.id).map((tr) => (
                <option key={tr.id} value={tr.id}>
                  {tr.abbr} · {tr.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>

      {kind === 'war' && (
        <OcrReader players={players} opponents={hasOpponents ? rawOpponents : []} onFill={applyOcr} />
      )}

      {hasOpponents ? (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Tu equipo */}
          <div className="space-y-2">
            <div className="flex items-center justify-between border-b border-line pb-1">
              <span className="font-display text-sm font-bold text-kart-yellow">
                {teamTag || t('event.yourTeam')} ({players.length})
              </span>
              <span className="text-xs text-muted">
                {filled.length}/{6 - missingHome}
              </span>
            </div>
            <div className="space-y-1.5">
              {players.map((p) => (
                <label key={p.id} className="flex items-center gap-3 border-2 border-line bg-bg px-3 py-1.5">
                  <span className="flex-1 truncate text-sm font-semibold">{p.name}</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={racers}
                    value={positions[p.id] ?? ''}
                    onChange={(e) => setPositions((ps) => ({ ...ps, [p.id]: e.target.value }))}
                    placeholder="—"
                    title={t('event.didNotRace')}
                    className={`w-16 rounded-lg border border-line bg-surface px-2 py-1 text-center font-display text-base font-bold tabular-nums outline-none focus:border-kart-yellow${ocrClass(`h:${p.id}`)}`}
                  />
                </label>
              ))}
            </div>
          </div>

          {/* Equipo rival */}
          <div className="space-y-2">
            <div className="flex items-center justify-between border-b border-line pb-1">
              <span className="font-display text-sm font-bold text-muted">
                {opponentTag || t('event.opponentTeam')} ({rawOpponents.length})
              </span>
              {remainingPositions.length > 0 && remainingPositions.length <= rawOpponents.length && (
                <button
                  type="button"
                  onClick={autoFillOpponents}
                  className="text-xs font-semibold text-kart-blue hover:underline"
                >
                  ⚡ {t('event.autoFillOpponents')}
                </button>
              )}
            </div>
            <div className="space-y-1.5">
              {rawOpponents.map((name) => (
                <label key={name} className="flex items-center gap-3 border-2 border-line/60 bg-bg/60 px-3 py-1.5">
                  <span className="flex-1 truncate text-sm text-muted">{name}</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={racers}
                    value={opponentPositions[name] ?? ''}
                    onChange={(e) => setOpponentPositions((ps) => ({ ...ps, [name]: e.target.value }))}
                    placeholder="auto"
                    title="Si se deja vacío, se auto-asignan las posiciones restantes"
                    className={`w-16 rounded-lg border border-line bg-surface px-2 py-1 text-center font-display text-base font-bold tabular-nums outline-none focus:border-kart-yellow${ocrClass(`a:${name}`)}`}
                  />
                </label>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {players.map((p) => (
            <label key={p.id} className="flex items-center gap-3 border-2 border-line bg-bg px-3 py-1.5">
              <span className="flex-1 truncate text-sm font-semibold">{p.name}</span>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={kind === 'war' ? racers : 24}
                value={positions[p.id] ?? ''}
                onChange={(e) => setPositions((ps) => ({ ...ps, [p.id]: e.target.value }))}
                placeholder={kind === 'war' ? '—' : t('event.position')}
                title={kind === 'war' ? t('event.didNotRace') : undefined}
                className={`w-20 rounded-lg border border-line bg-surface px-2 py-1 text-center font-display text-lg font-bold tabular-nums outline-none focus:border-kart-yellow${ocrClass(`h:${p.id}`)}`}
              />
            </label>
          ))}
        </div>
      )}

      {remainingPositions.length > 0 && remainingPositions.length < racers && (
        <p className="text-xs text-muted">
          {t('event.remainingPositions')}: <b className="text-ink">{remainingPositions.join(', ')}</b>
        </p>
      )}

      {kind === 'war' && (
        <div className="grid gap-3 sm:grid-cols-2">
          <MissingSelect label={t('event.missingHome')} value={missingHome} onChange={setMissingHome} />
          <MissingSelect label={t('event.missingAway')} value={missingAway} onChange={setMissingAway} />
        </div>
      )}

      {preview && (
        <p className="text-sm font-semibold">
          {t('event.racePreview', {
            home: preview.home,
            away: preview.away,
            diff: (preview.home - preview.away > 0 ? '+' : '') + (preview.home - preview.away),
          })}
        </p>
      )}
      {(serverError || (error && Object.keys(positions).length > 0)) && (
        <p className="text-sm text-kart-red">{serverError ?? error}</p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving || !!error}
          className="btn-yellow text-base"
        >
          {saving ? t('common.saving') : t('event.saveRace')}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="btn-line text-base">
            {t('common.cancel')}
          </button>
        )}
      </div>
    </form>
  )
}

function MissingSelect({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="border-2 border-line bg-bg px-3 py-1.5"
      >
        {[0, 1, 2].map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
    </label>
  )
}
