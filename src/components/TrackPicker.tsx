import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { CUPS, getCup, getTrack, type Track } from '../data/tracks'
import { useI18n } from '../i18n'
import { searchTracks } from '../lib/trackSearch'
import { Plate } from './ui'

/**
 * Selector de pista con buscador: al escribir ("rain", "rr", "ghost 2") se filtra por nombre o
 * abreviatura y las sugerencias van cambiando; sin escribir se ve la lista completa por copas.
 * Pensado también para móvil: filas altas, el teclado no se cierra al tocar una sugerencia y
 * hacer scroll por la lista no elige nada por error.
 */
export default function TrackPicker({
  value,
  onChange,
  autoFocus = false,
}: {
  value: string
  onChange: (trackId: string) => void
  autoFocus?: boolean
}) {
  const { t } = useI18n()
  const listId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)

  const selected = getTrack(value)
  const selectedLabel = selected ? `${selected.abbr ? `${selected.abbr} · ` : ''}${selected.name}` : ''
  const typing = query.trim() !== ''

  // Con el campo vacío, la lista va agrupada por copas; al escribir, por relevancia
  const options = useMemo(() => {
    const found = searchTracks(query)
    return typing ? found : CUPS.flatMap((cup) => found.filter((tr) => tr.cupId === cup.id))
  }, [query, typing])

  // Mantiene visible la sugerencia marcada con las flechas
  useEffect(() => {
    if (!open) return
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [active, open])

  const pick = (track: Track) => {
    onChange(track.id)
    setOpen(false)
    setQuery('')
    inputRef.current?.blur()
  }

  const row = (track: Track, i: number) => (
    <li key={track.id} role="option" aria-selected={i === active}>
      <button
        type="button"
        onClick={() => pick(track)}
        className={`flex min-h-11 w-full items-center gap-3 px-3 py-2 text-left hover:bg-surface-2 ${i === active ? 'bg-surface-2' : ''}`}
      >
        <Plate color={getCup(track.cupId)?.color}>{track.abbr ?? track.id}</Plate>
        <span className="text-sm font-semibold">{track.name}</span>
      </button>
    </li>
  )

  return (
    <div
      className="relative"
      onBlur={(e) => {
        // Se cierra al salir del campo y de la lista, no al tocar una sugerencia
        if (!e.currentTarget.contains(e.relatedTarget)) {
          setOpen(false)
          setQuery('')
        }
      }}
    >
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="go"
        autoFocus={autoFocus}
        value={open ? query : selectedLabel}
        placeholder={open && selectedLabel ? selectedLabel : t('event.searchTrack')}
        className="field"
        onFocus={() => {
          setOpen(true)
          setActive(0)
        }}
        onChange={(e) => {
          setQuery(e.target.value)
          setActive(0)
          setOpen(true)
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setOpen(true)
            setActive((a) => Math.min(a + 1, options.length - 1))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setActive((a) => Math.max(a - 1, 0))
          } else if (e.key === 'Enter' && open) {
            // Enter elige la sugerencia marcada en vez de enviar el formulario
            e.preventDefault()
            const track = options[Math.min(active, options.length - 1)]
            if (track) pick(track)
          } else if (e.key === 'Escape') {
            setOpen(false)
            setQuery('')
          }
        }}
      />

      {open && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          // Evita que tocar la lista le quite el foco al campo (y cierre el teclado en el móvil)
          onMouseDown={(e) => e.preventDefault()}
          className="absolute z-30 mt-1 max-h-72 w-full overflow-y-auto overscroll-contain border-2 border-kart-yellow bg-bg shadow-lg"
        >
          {options.length === 0 && <li className="px-3 py-3 text-sm text-muted">{t('stats.noTracksFound')}</li>}
          {typing
            ? options.map((track, i) => row(track, i))
            : CUPS.map((cup) => {
                const inCup = options.filter((tr) => tr.cupId === cup.id)
                if (inCup.length === 0) return null
                return (
                  <li key={cup.id} role="presentation">
                    <p className="sticky top-0 bg-surface px-3 py-1 font-mono text-[11px] font-bold uppercase text-muted">
                      {t(`cup.${cup.id}`)}
                    </p>
                    <ul role="presentation">{inCup.map((track) => row(track, options.indexOf(track)))}</ul>
                  </li>
                )
              })}
        </ul>
      )}
    </div>
  )
}
