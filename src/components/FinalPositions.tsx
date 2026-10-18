import { useState } from 'react'
import { useI18n } from '../i18n'
import { setFinalPositions, type EventPlayer } from '../lib/events'

/**
 * Puesto en el que quedó cada jugador en el evento (en general, no por carrera). Solo lo ponen los perfiles de confianza que
 * jugaron en el evento y los admins; si está puesto, manda sobre el que se calcula para el logro «Ganador sigiloso».
 */
export default function FinalPositions({ eventId, players, onSaved }: { eventId: string; players: EventPlayer[]; onSaved: () => Promise<void> }) {
  const { t } = useI18n()
  const [values, setValues] = useState<Record<number, string>>(() => Object.fromEntries(players.map((p) => [p.id, p.final_position ? String(p.final_position) : ''])))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const parsed = players.map((p) => ({ id: p.id, raw: (values[p.id] ?? '').trim() }))
  const invalid = parsed.some((p) => p.raw !== '' && !(Number.isInteger(Number(p.raw)) && Number(p.raw) >= 1 && Number(p.raw) <= 12))

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      await setFinalPositions(eventId, Object.fromEntries(parsed.map((p) => [p.id, p.raw === '' ? null : Number(p.raw)])))
      await onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.saveError'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="panel space-y-3 p-4">
      <h2 className="font-display text-xl font-black uppercase">{t('event.final.title')}</h2>
      <p className="text-sm text-muted">{t('event.final.hint')}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {players.map((p) => (
          <label key={p.id} className="flex items-center gap-3 border-2 border-line bg-bg px-3 py-1.5">
            <span className="flex-1 truncate text-sm font-semibold">{p.name}</span>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={12}
              value={values[p.id] ?? ''}
              onChange={(e) => setValues((v) => ({ ...v, [p.id]: e.target.value }))}
              placeholder="—"
              aria-label={`${t('event.final.title')}: ${p.name}`}
              className="w-16 border border-line bg-surface px-2 py-1 text-center font-display text-base font-bold tabular-nums outline-none focus:border-kart-yellow"
            />
          </label>
        ))}
      </div>
      {error && <p className="text-sm text-kart-red">{error}</p>}
      <button type="button" className="btn-yellow text-base" disabled={saving || invalid} onClick={save}>
        {saving ? t('common.saving') : t('event.final.save')}
      </button>
    </section>
  )
}
