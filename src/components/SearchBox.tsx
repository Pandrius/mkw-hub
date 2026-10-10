import { useEffect, useId, useRef, useState, type ReactNode } from 'react'

export type Suggestion = {
  key: string
  label: string
  /** Logo, placa o avatar a la izquierda */
  icon?: ReactNode
  /** Texto secundario a la derecha */
  detail?: ReactNode
}

/**
 * Buscador con autocompletado (combobox + listbox): al escribir se despliegan las sugerencias,
 * con flechas se marca una, Enter la elige (o la primera si no hay ninguna marcada) y Escape cierra.
 * Lo que pasa al elegir lo decide quien lo usa (ir a la página, rellenar el filtro…).
 * Si no hay sugerencias, Enter hace lo de siempre (p. ej. enviar el formulario que lo contiene).
 */
export function SearchBox({
  value,
  onChange,
  suggestions,
  onPick,
  placeholder,
  ariaLabel,
  className = 'field w-full',
  wrapperClassName = 'relative w-full',
  listClassName = 'w-full',
  loading = false,
  loadingText,
  autoFocus = false,
}: {
  value: string
  onChange: (value: string) => void
  suggestions: Suggestion[]
  onPick: (s: Suggestion) => void
  placeholder?: string
  ariaLabel?: string
  /** Clases del campo */
  className?: string
  /** Clases del contenedor (debe ser relative para que la lista flote bajo el campo) */
  wrapperClassName?: string
  /** Clases extra del desplegable (ancho) */
  listClassName?: string
  loading?: boolean
  loadingText?: string
  autoFocus?: boolean
}) {
  const id = useId()
  const listId = `${id}-list`
  const optionId = (i: number) => `${id}-opt-${i}`
  const inputRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)

  const activeIndex = active < suggestions.length ? active : -1
  const showLoading = loading && suggestions.length === 0 && Boolean(loadingText)
  const expanded = open && value.trim() !== '' && (suggestions.length > 0 || showLoading)

  // Mantiene visible la sugerencia marcada con las flechas
  useEffect(() => {
    if (activeIndex >= 0) document.getElementById(`${id}-opt-${activeIndex}`)?.scrollIntoView({ block: 'nearest' })
  }, [id, activeIndex])

  const pick = (s: Suggestion) => {
    onPick(s)
    setOpen(false)
    setActive(-1)
    inputRef.current?.blur()
  }

  return (
    <div
      className={wrapperClassName}
      onBlur={(e) => {
        // Se cierra al salir del campo y de la lista, no al tocar una sugerencia
        if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false)
      }}
    >
      <input
        ref={inputRef}
        type="search"
        role="combobox"
        aria-label={ariaLabel ?? placeholder}
        aria-expanded={expanded}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={expanded && activeIndex >= 0 ? optionId(activeIndex) : undefined}
        autoComplete="off"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        autoFocus={autoFocus}
        value={value}
        placeholder={placeholder}
        className={className}
        onChange={(e) => {
          onChange(e.target.value)
          setOpen(true)
          setActive(-1)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          const n = suggestions.length
          if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && n > 0) {
            e.preventDefault()
            setOpen(true)
            const delta = e.key === 'ArrowDown' ? 1 : -1
            setActive(activeIndex < 0 ? (delta > 0 ? 0 : n - 1) : (activeIndex + delta + n) % n)
          } else if (e.key === 'Enter' && expanded && n > 0) {
            // Elige la sugerencia en vez de enviar el formulario
            e.preventDefault()
            pick(suggestions[activeIndex >= 0 ? activeIndex : 0])
          } else if (e.key === 'Escape' && expanded) {
            e.preventDefault()
            setOpen(false)
            setActive(-1)
          }
        }}
      />

      <ul
        id={listId}
        role="listbox"
        hidden={!expanded}
        // Evita que tocar la lista le quite el foco al campo (y cierre el teclado en el móvil)
        onMouseDown={(e) => e.preventDefault()}
        className={`absolute left-0 z-30 mt-1 max-h-72 overflow-y-auto overscroll-contain border-2 border-kart-yellow bg-bg shadow-lg ${listClassName}`}
      >
        {suggestions.map((s, i) => (
          <li
            key={s.key}
            id={optionId(i)}
            role="option"
            aria-selected={i === activeIndex}
            onClick={() => pick(s)}
            onMouseMove={() => i !== activeIndex && setActive(i)}
            className={`flex min-h-11 cursor-pointer items-center gap-3 px-3 py-2 text-left text-sm ${
              i === activeIndex ? 'bg-surface-2' : 'hover:bg-surface-2'
            }`}
          >
            {s.icon}
            <span className="min-w-0 flex-1 truncate font-semibold">{s.label}</span>
            {s.detail != null && <span className="max-w-[40%] truncate font-mono text-xs text-muted">{s.detail}</span>}
          </li>
        ))}
        {showLoading && <li className="px-3 py-3 text-sm text-muted">{loadingText}</li>}
      </ul>
    </div>
  )
}
