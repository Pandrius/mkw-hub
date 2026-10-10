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
