import { useState } from 'react'
import { useI18n } from '../i18n'
import { dayOptions } from '../lib/playedAt'

/** Día en que se jugó el evento. `value` = AAAA-MM-DD */
export function PlayedAtPicker({ value, onChange }: { value: string; onChange: (day: string) => void }) {
  const { t, locale } = useI18n()
  const [now] = useState(() => new Date())
  const days = dayOptions(now)

  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold text-ink">{t('play.label')}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="field">
        {days.map((d, i) => (
          <option key={d.value} value={d.value}>
            {i === 0 ? t('play.today') : d.date.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'short' })}
          </option>
        ))}
      </select>
      <span className="mt-1.5 block max-w-xl text-xs text-muted">{t('play.hint')}</span>
    </label>
  )
}
