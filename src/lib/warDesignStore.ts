import { DEFAULT_DESIGN, parseDesign, type WarDesign } from './warDesign'

/*
 * Diseño elegido para las tablas, guardado en este navegador. Es un almacén mínimo (React lo lee con
 * useSyncExternalStore) para que la vista previa y los botones de descargar/copiar usen siempre el
 * mismo diseño sin pasárselo de uno a otro.
 */

const KEY = 'mkwhub.warDesign'

function load(): WarDesign {
  try {
    return parseDesign(JSON.parse(localStorage.getItem(KEY) ?? 'null'))
  } catch {
    // sin almacenamiento o contenido roto: diseño por defecto
    return DEFAULT_DESIGN
  }
}

let current: WarDesign = load()
const listeners = new Set<() => void>()

export const getDesign = () => current

export function subscribeDesign(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Cambia el diseño y lo guarda; si no cabe en el almacenamiento, vale para esta sesión */
export function setDesign(next: WarDesign): void {
  current = next
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // almacenamiento lleno o no disponible
  }
  for (const l of listeners) l()
}

export const resetDesign = () => setDesign(DEFAULT_DESIGN)

/*
 * Nombre de la competición de cada war (lo muestra el diseño Oficial). Va por war, no con el diseño:
 * cada war tiene su torneo. Se guarda también en este navegador, solo las últimas.
 */
const COMPETITIONS_KEY = 'mkwhub.warCompetitions'
const MAX_COMPETITIONS = 60
export const MAX_COMPETITION_CHARS = 60

function loadCompetitions(): Record<string, string> {
  try {
    const raw = JSON.parse(localStorage.getItem(COMPETITIONS_KEY) ?? '{}') as unknown
    if (!raw || typeof raw !== 'object') return {}
    return Object.fromEntries(
      Object.entries(raw as Record<string, unknown>).filter(([, v]) => typeof v === 'string').map(([k, v]) => [k, (v as string).slice(0, MAX_COMPETITION_CHARS)]),
    )
  } catch {
    return {}
  }
}

let competitions = loadCompetitions()

export const getCompetition = (eventId: string): string => competitions[eventId] ?? ''

export function setCompetition(eventId: string, name: string): void {
  const clean = name.slice(0, MAX_COMPETITION_CHARS)
  const next = { ...competitions }
  delete next[eventId] // al reescribirla pasa a ser la más reciente
  if (clean.trim()) next[eventId] = clean
  competitions = Object.fromEntries(Object.entries(next).slice(-MAX_COMPETITIONS))
  try {
    localStorage.setItem(COMPETITIONS_KEY, JSON.stringify(competitions))
  } catch {
    // almacenamiento lleno o no disponible
  }
  for (const l of listeners) l()
}
