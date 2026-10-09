import { useId, useMemo, useState } from 'react'
import { useI18n } from '../i18n'

/** Quita mayúsculas y tildes para comparar lo escrito con los nombres */
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/**
 * Campo de nombre de jugador con sugerencias: al escribir ("p") se listan los jugadores del equipo
 * que lo contienen (empezando por los que empiezan igual) y al pinchar uno se rellena solo.
 * Si no coincide con nadie vale lo escrito (sustitutos, rivales sin cuenta…).
 */
export default function PlayerInput({
  value,
  onChange,
  suggestions,
  taken = [],
  placeholder,
  maxLength = 80,
}: {
  value: string
  onChange: (value: string) => void
  /** Nombres que se pueden sugerir (miembros del equipo) */
  suggestions: string[]
  /** Nombres ya elegidos en otros huecos, para no sugerirlos otra vez */
  taken?: string[]
  placeholder?: string
  maxLength?: number
}) {
  const { t } = useI18n()
  const listId = useId()
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)

  const matches = useMemo(() => {
    const q = norm(value.trim())
    const used = new Set(taken.map(norm))
    return suggestions
      .filter((n) => !used.has(norm(n)) && norm(n) !== q && norm(n).includes(q))
      .sort((a, b) => Number(norm(b).startsWith(q)) - Number(norm(a).startsWith(q)) || a.localeCompare(b))
      .slice(0, 6)
  }, [value, suggestions, taken])

  const pick = (name: string) => {
    onChange(name)
    setOpen(false)
  }

  const typed = value.trim()
  const exact = suggestions.some((n) => norm(n) === norm(typed))
  const showList = open && suggestions.length > 0
  return (
    <div className="relative flex-1">
      <input
        role="combobox"
        aria-expanded={showList && matches.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
        maxLength={maxLength}
        value={value}
        placeholder={placeholder}
        className="field w-full"
        onChange={(e) => {
          onChange(e.target.value)
          setActive(0)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        // Con retraso para que el clic en una sugerencia llegue antes de cerrar la lista
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => {
          if (!showList || matches.length === 0) return
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setActive((a) => (a + 1) % matches.length)
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setActive((a) => (a - 1 + matches.length) % matches.length)
          } else if (e.key === 'Enter') {
            e.preventDefault()
            pick(matches[Math.min(active, matches.length - 1)])
          } else if (e.key === 'Escape') {
            setOpen(false)
          }
        }}
      />
      {showList && (matches.length > 0 || (typed !== '' && !exact)) && (
        <ul id={listId} role="listbox" className="absolute z-20 mt-1 w-full border-2 border-kart-yellow bg-bg shadow-lg">
          {matches.length > 0 ? (
            matches.map((name, i) => (
              <li key={name} role="option" aria-selected={i === active}>
                <button
                  type="button"
                  // mouseDown en vez de click: se ejecuta antes del blur del campo
                  onMouseDown={(e) => {
                    e.preventDefault()
                    pick(name)
                  }}
                  className={`block w-full px-3 py-2 text-left text-sm hover:bg-surface-2 ${i === active ? 'bg-surface-2' : ''}`}
                >
                  {name}
                </button>
              </li>
            ))
          ) : (
            <li className="px-3 py-2 text-xs text-muted">{t('event.noMatches')}</li>
          )}
        </ul>
      )}
    </div>
  )
}
