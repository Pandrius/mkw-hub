import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../lib/auth'
import { formatTime, parseTime } from '../lib/time'
import { addTime, bestPerPlayer, deleteTime, listTimes, type TimeTrial, type TtCategory } from '../lib/timeTrials'
import { EmptyState } from './ui'

const MEDALS = ['#ffcc1f', '#c9d3e6', '#d98b4a']

export default function Leaderboard({ trackId, category, nita }: { trackId: string; category: TtCategory; nita: boolean }) {
  const { enabled, isEditor } = useAuth()
  const [times, setTimes] = useState<TimeTrial[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  const reload = useCallback(
    () =>
      listTimes(trackId, category, nita).then(
        (data) => setTimes(bestPerPlayer(data)),
        () => setError('No se han podido cargar los tiempos.'),
      ),
    [trackId, category, nita],
  )

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    listTimes(trackId, category, nita).then(
      (data) => !cancelled && setTimes(bestPerPlayer(data)),
      () => !cancelled && setError('No se han podido cargar los tiempos.'),
    )
    return () => {
      cancelled = true
    }
  }, [enabled, trackId, category, nita])

  if (!enabled) return <EmptyState title="Sin tiempos registrados" />
  if (error) return <p className="text-kart-red">{error}</p>
  if (!times) return <p className="text-muted">Cargando…</p>

  const remove = async (t: TimeTrial) => {
    if (!confirm(`¿Borrar el tiempo de ${t.player_name} (${formatTime(t.time_ms)})?`)) return
    await deleteTime(t.id)
    await reload()
  }

  return (
    <div className="space-y-4">
      {isEditor &&
        (adding ? (
          <TimeForm
            trackId={trackId}
            category={category}
            nita={nita}
            onDone={async () => {
              setAdding(false)
              await reload()
            }}
            onCancel={() => setAdding(false)}
          />
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="rounded-xl bg-kart-yellow px-4 py-2 text-sm font-bold text-bg hover:brightness-105"
          >
            + Añadir tiempo
          </button>
        ))}

      {times.length === 0 ? (
        <EmptyState title="Sin tiempos en esta categoría">
          {category === 'flap' || nita
            ? 'Los tiempos de FLAP y NITA los añaden los editores.'
            : 'Todavía no hay tiempos para esta pista.'}
        </EmptyState>
      ) : (
        <ol className="overflow-hidden rounded-2xl border border-line bg-surface">
          {times.map((t, i) => (
            <li
              key={t.id}
              className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-b-0 sm:gap-4"
            >
              <span
                className="w-7 text-center font-display text-lg font-black italic"
                style={{ color: MEDALS[i] ?? 'var(--color-muted)' }}
              >
                {i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 font-semibold">
                  {t.country_code && (
                    <img
                      src={`https://flagcdn.com/20x15/${t.country_code.toLowerCase()}.png`}
                      alt={t.country_code}
                      title={t.country_code}
                      width={20}
                      height={15}
                      className="rounded-[2px]"
                    />
                  )}
                  <span className="truncate">{t.player_name}</span>
                </span>
                <span className="text-xs text-muted">
                  {t.achieved_on && new Date(t.achieved_on).toLocaleDateString('es-ES')}
                  {t.source === 'mkc' && ' · MKCentral'}
                </span>
              </span>
              <span className="font-display text-lg font-bold tabular-nums">{formatTime(t.time_ms)}</span>
              {t.proof_url ? (
                <a
                  href={t.proof_url}
                  target="_blank"
                  rel="noreferrer"
                  className="w-12 text-right text-sm text-kart-blue hover:underline"
                >
                  Prueba
                </a>
              ) : (
                <span className="w-12" />
              )}
              {isEditor && (
                <button
                  onClick={() => remove(t)}
                  disabled={t.source !== 'manual'}
                  title={t.source === 'manual' ? 'Borrar' : 'Los tiempos de MKC se sincronizan solos'}
                  className="text-sm text-muted hover:text-kart-red disabled:invisible"
                >
                  ✕
                </button>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

function TimeForm({
  trackId,
  category,
  nita,
  onDone,
  onCancel,
}: {
  trackId: string
  category: TtCategory
  nita: boolean
  onDone: () => Promise<void>
  onCancel: () => void
}) {
  const [player, setPlayer] = useState('')
  const [country, setCountry] = useState('')
  const [time, setTime] = useState('')
  const [proof, setProof] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const parsed = parseTime(time)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const proofUrl = proof.trim() || null
    const cc = country.trim().toUpperCase() || null
    if (parsed === null) return setError(`No entiendo el tiempo. Escríbelo como 2:19.361`)
    if (cc && !/^[A-Z]{2}$/.test(cc)) return setError('El país debe ser un código de 2 letras (ES, FR, US…)')
    if (proofUrl && !proofUrl.startsWith('https://')) return setError('El enlace de la prueba debe empezar por https://')

    setSaving(true)
    setError(null)
    try {
      await addTime({
        track_id: trackId,
        category,
        nita,
        time_ms: parsed,
        player_name: player.trim(),
        country_code: cc,
        proof_url: proofUrl,
        achieved_on: date || null,
      })
      await onDone()
    } catch {
      setError('No se ha podido guardar. ¿Sigues teniendo permisos de editor?')
      setSaving(false)
    }
  }

  const input =
    'w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm outline-none placeholder:text-muted focus:border-kart-yellow'

  return (
    <form onSubmit={submit} className="space-y-3 rounded-2xl border border-kart-yellow/60 bg-surface p-5">
      <p className="text-sm text-muted">
        Nuevo tiempo · {category === 'flap' ? 'FLAP' : 'Carrera completa'} · {nita ? 'NITA' : 'Con items'}
      </p>
      <div className="grid gap-3 sm:grid-cols-[1fr_7rem]">
        <input required maxLength={60} value={player} onChange={(e) => setPlayer(e.target.value)} placeholder="Jugador" className={input} />
        <input maxLength={2} value={country} onChange={(e) => setCountry(e.target.value)} placeholder="País (ES)" className={`${input} uppercase`} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <input required value={time} onChange={(e) => setTime(e.target.value)} placeholder="Tiempo (2:19.361)" className={input} />
          {time && (
            <p className={`mt-1 text-xs ${parsed === null ? 'text-kart-red' : 'text-muted'}`}>
              {parsed === null ? 'Formato no válido' : `Se guardará como ${formatTime(parsed)}`}
            </p>
          )}
        </div>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={input} />
      </div>
      <input type="url" value={proof} onChange={(e) => setProof(e.target.value)} placeholder="Enlace al vídeo o captura (opcional)" className={input} />
      {error && <p className="text-sm text-kart-red">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-kart-yellow px-4 py-2 text-sm font-bold text-bg hover:brightness-105 disabled:opacity-60"
        >
          {saving ? 'Guardando…' : 'Guardar'}
        </button>
        <button type="button" onClick={onCancel} className="rounded-xl border border-line px-4 py-2 text-sm font-semibold">
          Cancelar
        </button>
      </div>
    </form>
  )
}
