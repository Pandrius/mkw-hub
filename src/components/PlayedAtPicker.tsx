import { useMemo, useState } from 'react'
import { useI18n } from '../i18n'
import { at, currentHour, dayOptions, hoursFor } from '../lib/playedAt'

/** Día y hora (en punto) a la que se jugó el evento. `value` = instante ISO de esa hora */
export function PlayedAtPicker({ value, onChange }: { value: string; onChange: (iso: string) => void }) {
  const { t, locale } = useI18n()
  const [now] = useState(() => new Date())
  const days = useMemo(() => dayOptions(now), [now])
  const picked = new Date(value)
  const dayIndex = Math.max(0, days.findIndex((d) => d.toDateString() === picked.toDateString()))
  const hours = hoursFor(days[dayIndex], now)

  const choose = (day: Date, hour: number) => {
    const valid = hoursFor(day, now)
    const h = valid.includes(hour) ? hour : (valid.at(-1) ?? currentHour(now).getHours())
    onChange(at(day, h).toISOString())
  }

  return (
    <fieldset>
      <legend className="mb-1 block text-sm font-semibold text-ink">{t('play.label')}</legend>
      <div className="flex flex-wrap gap-3">
        <label className="block">
          <span className="mb-1 block text-xs text-muted">{t('play.day')}</span>
          <select value={dayIndex} onChange={(e) => choose(days[Number(e.target.value)], picked.getHours())} className="field">
            {days.map((d, i) => (
              <option key={i} value={i}>
                {i === 0 ? t('play.today') : d.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' })}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-muted">{t('play.hour')}</span>
          <select value={picked.getHours()} onChange={(e) => choose(days[dayIndex], Number(e.target.value))} className="field">
            {hours.map((h) => (
              <option key={h} value={h}>
                {String(h).padStart(2, '0')}:00
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="mt-1.5 max-w-xl text-xs text-muted">{t('play.hint')}</p>
    </fieldset>
  )
}
