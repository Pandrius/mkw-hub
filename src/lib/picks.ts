import type { TeamTrackStats } from './teamStats'

/** De dónde sale la recomendación de una pista */
export type PickSource = {
  diff: number
  races: number
}

export type PickRow = {
  trackId: string
  /** Puntuación: positiva = pickear, negativa = evitar */
  score: number
  /** Nuestro +/- medio por carrera en todas nuestras wars */
  ours: PickSource | null
  /** +/- medio del rival en sus wars registradas (si las tiene) */
  theirs: PickSource | null
  /** Nuestro +/- medio en esta pista jugando contra este rival */
  h2h: PickSource | null
}

export type PickPlan = {
  pick: PickRow[]
  avoid: PickRow[]
  /** Pistas con datos que no destacan ni para bien ni para mal */
  rest: PickRow[]
}

/**
 * Cuántas carreras "ficticias" a 0 se añaden al encogimiento: con pocas carreras la media
 * se acerca a 0 para que una sola carrera buena no ponga una pista arriba del todo.
 */
export const SHRINK = 3
/** Por debajo de este valor (en valor absoluto) la pista no se recomienda ni se desaconseja */
export const NEUTRAL = 3

const round2 = (n: number) => Math.round(n * 100) / 100

/** Media encogida hacia 0 según el número de carreras */
export function shrunk(src: PickSource | null): number {
  if (!src || src.races === 0) return 0
  return (src.diff * src.races) / (src.races + SHRINK)
}

const toSource = (t: TeamTrackStats | undefined): PickSource | null => (t ? { diff: t.diff, races: t.races } : null)

/**
 * Recomendador de picks para una war contra un rival (función pura).
 *
 * - Nuestro rendimiento general en la pista suma.
 * - El rendimiento del rival en la pista (en sus propias wars) resta: si allí es fuerte, mejor no ir.
 * - Lo que pasó en esa pista contra este mismo rival pesa el doble.
 */
export function buildPickPlan(
  ours: TeamTrackStats[],
  theirs: TeamTrackStats[] | null,
  h2h: TeamTrackStats[] | null,
  size = 5,
): PickPlan {
  const ids = new Set([...ours.map((t) => t.trackId), ...(theirs ?? []).map((t) => t.trackId), ...(h2h ?? []).map((t) => t.trackId)])
  const byId = (list: TeamTrackStats[] | null, id: string) => list?.find((t) => t.trackId === id)

  const rows: PickRow[] = [...ids].map((trackId) => {
    const o = toSource(byId(ours, trackId))
    const r = toSource(byId(theirs, trackId))
    const h = toSource(byId(h2h, trackId))
    return { trackId, ours: o, theirs: r, h2h: h, score: round2(shrunk(o) - shrunk(r) + 2 * shrunk(h)) }
  })

  const sorted = rows.sort((a, b) => b.score - a.score || a.trackId.localeCompare(b.trackId))
  const pick = sorted.filter((r) => r.score >= NEUTRAL).slice(0, size)
  const avoid = sorted
    .filter((r) => r.score <= -NEUTRAL)
    .reverse()
    .slice(0, size)
  const rest = sorted.filter((r) => !pick.includes(r) && !avoid.includes(r))
  return { pick, avoid, rest }
}
