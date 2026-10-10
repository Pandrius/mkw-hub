import { useSyncExternalStore } from 'react'
import { getCompetition, getDesign, setCompetition, setDesign, subscribeDesign } from '../lib/warDesignStore'
import type { WarDesign } from '../lib/warDesign'

/** Nombre de la competición de una war y cómo cambiarlo */
export function useCompetition(eventId: string): [string, (name: string) => void] {
  const name = useSyncExternalStore(subscribeDesign, () => getCompetition(eventId))
  return [name, (next) => setCompetition(eventId, next)]
}

/** Diseño actual de las tablas y cómo cambiarlo (se comparte entre todos los componentes que lo usan) */
export function useWarDesign(): [WarDesign, (next: WarDesign) => void] {
  const design = useSyncExternalStore(subscribeDesign, getDesign)
  return [design, setDesign]
}
