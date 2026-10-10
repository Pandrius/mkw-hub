import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type RefObject } from 'react'
import { useNavigate } from 'react-router'
import { getTrack, getTrackImage, TRACKS, getTrackColor } from '../data/tracks'
import { useI18n } from '../i18n'
import type { MessageKey } from '../i18n/es'
import {
  hitHref,
  moveIndex,
  rankHits,
  REMOTE_MIN_LENGTH,
  sanitizeTerm,
  searchRemote,
  searchTracks,
  type SearchHit,
  type SearchKind,
} from '../lib/search'
import { supabase } from '../lib/supabase'
import { TeamLogo } from './TeamLogo'
import { Flag, Plate } from './ui'

const GROUP_LABEL: Record<SearchKind, MessageKey> = {
  player: 'gsearch.players',
  team: 'gsearch.teams',
  track: 'gsearch.tracks',
}

/** Espera antes de consultar Supabase mientras se escribe */
const DEBOUNCE_MS = 250

/**
 * Buscador global (combobox + listbox) de jugadores, equipos y pistas.
 * - `floating`: en escritorio el desplegable flota bajo el campo; en el menú móvil va en línea.
 */
export function GlobalSearch({
  inputRef,
  floating = true,
  autoFocus = false,
  showShortcut = false,
  onNavigate,
}: {
  /** Ref al campo, para enfocarlo desde fuera con el atajo de teclado */
  inputRef?: RefObject<HTMLInputElement | null>
  floating?: boolean
  autoFocus?: boolean
  /** Muestra la pista "/" dentro del campo */
  showShortcut?: boolean
  /** Se llama al ir a un resultado (p. ej. para cerrar el menú móvil) */
  onNavigate?: () => void
}) {
  const { t, locale } = useI18n()
  const navigate = useNavigate()
  const id = useId()
  const listId = `${id}-list`
  const optionId = (i: number) => `${id}-opt-${i}`
  const rootRef = useRef<HTMLDivElement>(null)
  const fallbackInputRef = useRef<HTMLInputElement | null>(null)
  const ownInputRef = inputRef ?? fallbackInputRef

  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const [remote, setRemote] = useState<SearchHit[]>([])
  /** Consulta a la que corresponden los resultados remotos actuales */
  const [remoteFor, setRemoteFor] = useState('')

  const term = sanitizeTerm(query)
  const wantsRemote = supabase !== null && term.length >= REMOTE_MIN_LENGTH
  const loading = wantsRemote && remoteFor !== term

  // Jugadores y equipos: consulta con debounce; la anterior se cancela al seguir escribiendo
  useEffect(() => {
    if (!wantsRemote) return
    const ctrl = new AbortController()
    const timer = setTimeout(() => {
      searchRemote(term, ctrl.signal)
        .then((hits) => {
          if (ctrl.signal.aborted) return
          setRemote(hits)
          setRemoteFor(term)
        })
        .catch(() => {
          if (ctrl.signal.aborted) return
          setRemote([])
          setRemoteFor(term)
        })
    }, DEBOUNCE_MS)
    return () => {
      clearTimeout(timer)
      ctrl.abort()
    }
  }, [term, wantsRemote])

  // rankHits vuelve a puntuar los resultados remotos: los de una consulta anterior que ya no coinciden desaparecen
  const groups = useMemo(() => rankHits(query, [...remote, ...searchTracks(query, TRACKS)]), [query, remote])
  const flat = useMemo(() => groups.flatMap((g) => g.hits), [groups])
  // Posición de la primera opción de cada grupo dentro de la lista completa
  const starts = useMemo(() => groups.map((_, gi) => groups.slice(0, gi).reduce((n, g) => n + g.hits.length, 0)), [groups])
  const activeIndex = active < flat.length ? active : -1
  const hasQuery = query.trim().length > 0
  const expanded = open && hasQuery

  // Mantiene visible la opción activa al moverse con las flechas
  useEffect(() => {
    if (activeIndex >= 0) document.getElementById(`${id}-opt-${activeIndex}`)?.scrollIntoView({ block: 'nearest' })
  }, [id, activeIndex])

  function go(hit: SearchHit) {
    navigate(hitHref(hit))
    setQuery('')
    setOpen(false)
    setActive(-1)
    ownInputRef.current?.blur()
    onNavigate?.()
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    switch (e.key) {
      case 'ArrowDown':
      case 'ArrowUp':
        e.preventDefault()
        setOpen(true)
        setActive(moveIndex(activeIndex, e.key === 'ArrowDown' ? 1 : -1, flat.length))
        break
      case 'Enter': {
        const hit = flat[activeIndex >= 0 ? activeIndex : 0]
        if (hit && expanded) {
          e.preventDefault()
          go(hit)
        }
        break
      }
      case 'Escape':
        e.preventDefault()
        if (expanded) {
          setOpen(false)
          setActive(-1)
        } else {
          setQuery('')
          ownInputRef.current?.blur()
        }
        break
    }
  }

  return (
    <div
      ref={rootRef}
      className="relative w-full"
      onBlur={(e) => {
        if (!rootRef.current?.contains(e.relatedTarget as Node | null)) setOpen(false)
      }}
    >
      <div className="relative">
        <input
          ref={ownInputRef}
          type="search"
          role="combobox"
          aria-label={t('gsearch.label')}
          aria-expanded={expanded}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={expanded && activeIndex >= 0 ? optionId(activeIndex) : undefined}
          title={showShortcut ? t('gsearch.shortcut') : undefined}
          placeholder={t('gsearch.placeholder')}
          autoComplete="off"
          spellCheck={false}
          autoFocus={autoFocus}
          enterKeyHint="go"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
            setActive(-1)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          className={`field ${showShortcut ? 'pr-8' : ''}`}
        />
        {showShortcut && !query && (
          <kbd
            aria-hidden
            className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 border border-line px-1.5 font-mono text-[11px] font-bold text-muted"
          >
            /
          </kbd>
        )}
      </div>

      <div
        id={listId}
        role="listbox"
        aria-label={t('gsearch.label')}
        hidden={!expanded}
        // Evita que el campo pierda el foco al pulsar un resultado
        onMouseDown={(e) => e.preventDefault()}
        className={
          floating
            ? 'panel absolute top-full right-0 z-30 mt-1 max-h-[70vh] w-[min(26rem,calc(100vw-2rem))] overflow-y-auto'
            : 'mt-2 border-2 border-line bg-surface'
        }
      >
        {groups.map((group, gi) => (
          <div key={group.kind} role="group" aria-labelledby={`${id}-${group.kind}`}>
            <p
              id={`${id}-${group.kind}`}
              role="presentation"
              className="border-b-2 border-line bg-surface-2 px-3 py-1 font-display text-xs font-extrabold tracking-wider text-kart-yellow"
            >
              {t(GROUP_LABEL[group.kind])}
            </p>
            {group.hits.map((hit, hi) => {
              const i = starts[gi] + hi
              return (
                <div
                  key={`${hit.kind}:${hit.id}`}
                  id={optionId(i)}
                  role="option"
                  aria-selected={i === activeIndex}
                  onClick={() => go(hit)}
                  onMouseMove={() => i !== activeIndex && setActive(i)}
                  className={`flex cursor-pointer items-center gap-3 px-3 py-2 ${
                    i === activeIndex ? 'bg-kart-yellow text-bg' : 'hover:bg-surface-2'
                  }`}
                >
                  <HitIcon hit={hit} />
                  <span className="min-w-0 flex-1 truncate font-semibold">{hit.label}</span>
                  {hit.kind === 'player' && <Flag code={hit.country ?? null} locale={locale} />}
                  {hit.detail && hit.kind !== 'track' && (
                    <span className={`shrink-0 font-mono text-xs ${i === activeIndex ? 'text-bg' : 'text-muted'}`}>
                      {hit.detail}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        ))}
        {flat.length === 0 && (
          <p className="px-3 py-3 text-sm text-muted">
            {loading ? t('gsearch.loading') : t('gsearch.noResults', { query: query.trim() })}
          </p>
        )}
        {flat.length > 0 && loading && <p className="px-3 py-1.5 font-mono text-xs text-muted">{t('gsearch.loading')}</p>}
      </div>

      {/* Anuncia el número de resultados a los lectores de pantalla */}
      <p role="status" className="sr-only">
        {expanded && !loading ? t('gsearch.count', { count: flat.length }) : ''}
      </p>
    </div>
  )
}

/** Avatar, logo o placa de la pista */
function HitIcon({ hit }: { hit: SearchHit }) {
  if (hit.kind === 'team') return <TeamLogo logoUrl={hit.image} tag={hit.detail?.split(' · ')[0] ?? ''} name={hit.label} size="sm" />
  if (hit.kind === 'track') {
    const track = getTrack(hit.id)
    const image = track && getTrackImage(track)
    return (
      <span className="flex shrink-0 items-center gap-2">
        {image && <img src={image} alt="" loading="lazy" className="h-7 w-11 border border-line object-cover" />}
        {hit.detail && <Plate color={getTrackColor(track)}>{hit.detail}</Plate>}
      </span>
    )
  }
  return hit.image ? (
    <img src={hit.image} alt="" loading="lazy" className="size-7 shrink-0 border-2 border-line object-cover" />
  ) : (
    <span aria-hidden className="size-7 shrink-0 border-2 border-line bg-surface-2" />
  )
}
