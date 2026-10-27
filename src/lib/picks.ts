import { pointsForPosition } from './scoring'
import type { TeamTrackStats, TeamWar } from './teamStats'

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
  /** Ventaja (+/- por carrera) de la alineación elegida en esta pista, según el historial de cada jugador; null sin alineación */
  lineup: number | null
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
 * - Si se indica la alineación, se suma su ventaja en la pista (ver `lineupEdges`).
 */
export function buildPickPlan(
  ours: TeamTrackStats[],
  theirs: TeamTrackStats[] | null,
  h2h: TeamTrackStats[] | null,
  size = 5,
  lineup: Map<string, number> | null = null,
): PickPlan {
  const ids = new Set([...ours.map((t) => t.trackId), ...(theirs ?? []).map((t) => t.trackId), ...(h2h ?? []).map((t) => t.trackId)])
  const byId = (list: TeamTrackStats[] | null, id: string) => list?.find((t) => t.trackId === id)

  const rows: PickRow[] = [...ids].map((trackId) => {
    const o = toSource(byId(ours, trackId))
    const r = toSource(byId(theirs, trackId))
    const h = toSource(byId(h2h, trackId))
    const l = lineup?.get(trackId) ?? null
    return { trackId, ours: o, theirs: r, h2h: h, lineup: l, score: round2(shrunk(o) - shrunk(r) + 2 * shrunk(h) + (l ?? 0)) }
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

/** Separador de la clave jugador + pista (un carácter que no puede estar en un nombre) */
const SEP = '\u0001'

/** Clave de un jugador en las wars (la misma que `TeamPlayerStats.key`): su perfil si lo tiene y, si no, su nombre en el juego */
export const playerKeyOf = (r: { profileId: string | null; name: string }) => (r.profileId ? `id:${r.profileId}` : `name:${r.name.trim().toLowerCase()}`)

/**
 * Ventaja de una alineación en cada pista (función pura): por cada jugador, sus puntos por carrera en la pista menos los que
 * hace de media (acercando a su media con pocas carreras, como `shrunk`), sumados. Se multiplica por 2 porque, al repartirse
 * los puntos entre dos equipos, ganar x puntos es un +/- de 2x. Los tramos no cuentan como pista.
 */
export function lineupEdges(wars: TeamWar[], playerKeys: string[]): Map<string, number> {
  const wanted = new Set(playerKeys)
  const total = new Map<string, { pts: number; races: number }>()
  const onTrack = new Map<string, { pts: number; races: number }>()
  const add = (map: Map<string, { pts: number; races: number }>, key: string, pts: number) => {
    const cur = map.get(key) ?? { pts: 0, races: 0 }
    map.set(key, { pts: cur.pts + pts, races: cur.races + 1 })
  }
  for (const war of wars) {
    for (const race of war.races) {
      if (race.section) continue
      for (const res of race.results ?? []) {
        const key = playerKeyOf(res)
        if (!wanted.has(key)) continue
        const pts = pointsForPosition(res.position)
        add(total, key, pts)
        add(onTrack, `${key}${SEP}${race.track_id}`, pts)
      }
    }
  }
  const edges = new Map<string, number>()
  for (const [k, v] of onTrack) {
    const [player, trackId] = k.split(SEP)
    const all = total.get(player)!
    const avg = all.pts / all.races
    const adjusted = (v.pts + SHRINK * avg) / (v.races + SHRINK) - avg
    edges.set(trackId, (edges.get(trackId) ?? 0) + 2 * adjusted)
  }
  for (const [trackId, v] of edges) edges.set(trackId, round2(v))
  return edges
}
