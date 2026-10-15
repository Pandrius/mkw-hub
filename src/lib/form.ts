import type { EventKind } from './events.js'

/** Resultado de una carrera con su orden en el tiempo (para forma y rachas) */
export type TimedResult = {
  eventId: string
  kind: EventKind
  trackId: string
  position: number
  raceNo: number
  /** Inicio del evento (ISO) */
  date: string
  /** Jugadores en la carrera (null en lounge: se asume 12) */
  racers: number | null
  /** Evento verificado (Lounge o rival): los logros solo cuentan estos */
  verified: boolean
  /** Tier de la mesa del Lounge una vez verificado ('SQ', 'C'...) */
  tier?: string | null
  /** La war a la que pertenece la carrera la ganó el equipo del jugador (solo wars; penalties incluidas) */
  warWon?: boolean
}

export type Streak = { current: number; best: number }

export function sortTimeline(results: TimedResult[]): TimedResult[] {
  return [...results].sort((a, b) => a.date.localeCompare(b.date) || a.eventId.localeCompare(b.eventId) || a.raceNo - b.raceNo)
}

/** Racha actual (al final de la lista) y mejor racha de elementos que cumplen la condición */
export function streakOf<T>(items: T[], test: (item: T) => boolean): Streak {
  let current = 0
  let best = 0
  for (const item of items) {
    current = test(item) ? current + 1 : 0
    best = Math.max(best, current)
  }
  return { current, best }
}
