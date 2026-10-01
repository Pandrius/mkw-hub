import { useState } from 'react'
import { CUPS, TRACKS } from '../data/tracks'
import { useI18n } from '../i18n'
import { formatTime, parseTime } from '../lib/time'
import { addMyTime, addTime, type TtCategory } from '../lib/timeTrials'
import { Tabs } from './ui'

type Props = {
  /** Si no se indica, el formulario deja elegir pista, categoría e items */
  trackId?: string
  category?: TtCategory
  nita?: boolean
  /** true: un editor añade el tiempo de otro jugador */
  forOther?: boolean
  onDone: () => Promise<void> | void
  onCancel: () => void
}

/** Formulario para añadir un tiempo: el tuyo o, si eres editor, el de otro jugador. */
export default function AddTimeForm({ trackId, category, nita, forOther = false, onDone, onCancel }: Props) {
  const { t } = useI18n()
  const [track, setTrack] = useState(trackId ?? '')
  const [cat, setCat] = useState<TtCategory>(category ?? 'race')
  const [items, setItems] = useState<'items' | 'nita'>(nita ? 'nita' : 'items')
  const [player, setPlayer] = useState('')
  const [country, setCountry] = useState('')
  const [time, setTime] = useState('')
  const [proof, setProof] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const parsed = parseTime(time)
  const fixed = trackId !== undefined

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const proofUrl = proof.trim() || null
    const cc = country.trim().toUpperCase() || null
    if (!track) return setError(t('event.errTrack'))
    if (parsed === null) return setError(t('tt.badTime'))
    if (cc && !/^[A-Z]{2}$/.test(cc)) return setError(t('tt.badCountry'))
    if (proofUrl && !proofUrl.startsWith('https://')) return setError(t('tt.proofHttps'))

    setSaving(true)
    setError(null)
    const base = { track_id: track, category: cat, nita: items === 'nita', time_ms: parsed, proof_url: proofUrl, achieved_on: date || null }
    try {
      if (forOther) await addTime({ ...base, player_name: player.trim(), country_code: cc })
      else await addMyTime(base)
      await onDone()
    } catch {
      setError(t('common.saveError'))
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="panel space-y-3 border-kart-yellow p-5">
      <p className="font-display text-xl font-extrabold">
        {forOther ? t('tt.addOther') : t('tt.addMine')}
        {fixed && (
          <span className="ml-2 font-mono text-xs font-bold text-muted normal-case">
            {cat === 'flap' ? t('tt.flap') : t('tt.race')} · {items === 'nita' ? t('tt.nita') : t('tt.items')}
          </span>
        )}
      </p>

      {!fixed && (
        <>
          <select value={track} onChange={(e) => setTrack(e.target.value)} className="field">
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
          <div className="flex flex-wrap gap-3">
            <Tabs
              tabs={[
                { id: 'race', label: t('tt.race') },
                { id: 'flap', label: t('tt.flap') },
              ]}
              value={cat}
              onChange={setCat}
            />
            <Tabs
              tabs={[
                { id: 'items', label: t('tt.items') },
                { id: 'nita', label: t('tt.nita') },
              ]}
              value={items}
              onChange={setItems}
            />
          </div>
        </>
      )}

      {forOther && (
        <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
          <input required maxLength={60} value={player} onChange={(e) => setPlayer(e.target.value)} placeholder={t('tt.player')} className="field" />
          <input maxLength={2} value={country} onChange={(e) => setCountry(e.target.value)} placeholder={t('tt.country')} className="field uppercase" />
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <input
            required
            autoFocus={fixed}
            value={time}
            onChange={(e) => setTime(e.target.value)}
            placeholder={t('tt.timePlaceholder')}
            className="field time text-lg"
          />
          {time && (
            <p className={`mt-1 text-xs ${parsed === null ? 'text-kart-red' : 'text-muted'}`}>
              {parsed === null ? t('tt.badFormat') : t('tt.willSave', { time: formatTime(parsed) })}
            </p>
          )}
        </div>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="field" />
      </div>
      <input type="url" value={proof} onChange={(e) => setProof(e.target.value)} placeholder={t('tt.proofPlaceholder')} className="field" />
      {error && <p className="text-sm text-kart-red">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={saving} className="btn-yellow text-base">
          {saving ? t('common.saving') : t('common.save')}
        </button>
        <button type="button" onClick={onCancel} className="btn-line text-base">
          {t('common.cancel')}
        </button>
      </div>
    </form>
  )
}
