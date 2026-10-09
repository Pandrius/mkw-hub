/** Penalización de una war: puntos negativos para uno de los dos equipos */
export type Penalty = {
  /** Equipo penalizado: el propio (home) o el rival (away) */
  side: 'home' | 'away'
  /** Nombre libre: "Penalty", "Late"… */
  label: string
  /** Siempre negativo y entero (-1 a -500) */
  points: number
}

export const MAX_PENALTIES = 20

/** Los jsonb se descartan si no tienen la forma esperada, para no romper la página */
export function parsePenalties(raw: unknown): Penalty[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter(
      (x): x is Penalty =>
        !!x &&
        (x.side === 'home' || x.side === 'away') &&
        typeof x.label === 'string' &&
        Number.isInteger(x.points) &&
        x.points < 0,
    )
    .slice(0, MAX_PENALTIES)
}

/** Suma (negativa) de las penalties de cada equipo */
export function penaltyTotals(penalties: Penalty[] | null | undefined): { home: number; away: number } {
  const total = { home: 0, away: 0 }
  for (const p of penalties ?? []) total[p.side] += p.points
  return total
}

/** La war vista desde el otro equipo: lo que penalizó al propio penaliza al rival y al revés */
export function mirrorPenalties(penalties: Penalty[]): Penalty[] {
  return penalties.map((p) => ({ ...p, side: p.side === 'home' ? 'away' : 'home' }))
}
