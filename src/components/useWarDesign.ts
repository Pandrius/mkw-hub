import { useSyncExternalStore } from 'react'
import { getDesign, setDesign, subscribeDesign } from '../lib/warDesignStore'
import type { WarDesign } from '../lib/warDesign'

/** Diseño actual de las tablas y cómo cambiarlo (se comparte entre todos los componentes que lo usan) */
export function useWarDesign(): [WarDesign, (next: WarDesign) => void] {
  const design = useSyncExternalStore(subscribeDesign, getDesign)
  return [design, setDesign]
}
