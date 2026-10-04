import { bestPerPlayer, type TimeTrial } from './timeTrials'

/** Lo mínimo de un tiempo de la comunidad para calcular el ranking */
export type RankTime = Pick<TimeTrial, 'id' | 'track_id' | 'time_ms' | 'player_name' | 'profile_id'>

/** Escalones del ranking de la comunidad que se proponen como objetivo */
export const GOAL_TOPS = [10, 3, 1] as const

export type TrackGoal = {
  trackId: string
  /** Mejor tiempo del jugador en la pista */
  timeMs: number
  /** Puesto en el ranking de la comunidad (1 = el más rápido) */
  position: number
  /** Jugadores en el ranking, contando al propio jugador */
  total: number
  /** El jugador inmediatamente más rápido y la diferencia con él */
  next: { position: number; playerName: string; gapMs: number } | null
  /** Siguiente escalón (top 10 / top 3 / 1.º) que no coincide con `next` */
  milestone: { top: number; gapMs: number } | null
  /** Ventaja sobre el 2.º si el jugador es el 1.º (null si no lo es o va solo) */
  leadMs: number | null
  /** Referencia para medir el margen: récord mundial o, si no hay, el 1.º de la comunidad */
  reference: 'wr' | 'community' | null
  /** Tiempo del jugador como % de la referencia (103.2 = un 3,2 % más lento) */
  pct: number | null
  /** Diferencia con la referencia en ms (positiva = más lento) */
  refGapMs: number | null
  /** Una de las pistas con más margen de mejora */
  mostMargin: boolean
}

/**
 * Objetivos de una pista a partir del ranking de la comunidad (ya con el mejor tiempo
 * de cada jugador). Si el jugador no aparece en el ranking se le coloca con su tiempo.
 */
export function trackGoal(
  trackId: string,
  profileId: string,
  timeMs: number,
  ranking: RankTime[],
  wrMs: number | null,
): TrackGoal {
  const others = ranking.filter((r) => r.profile_id !== profileId).sort((a, b) => a.time_ms - b.time_ms)
  const faster = others.filter((r) => r.time_ms < timeMs)
  const position = faster.length + 1
  const rankOf = (ms: number) => others.filter((r) => r.time_ms < ms).length + 1

  const ahead = faster[faster.length - 1]
  const next = ahead ? { position: rankOf(ahead.time_ms), playerName: ahead.player_name, gapMs: timeMs - ahead.time_ms } : null

  // El escalón más cercano por encima, sin repetir el objetivo de `next`
  const top = GOAL_TOPS.find((n) => n < position - 1)
  const milestone = top ? { top, gapMs: timeMs - others[top - 1].time_ms } : null

  const leadMs = position === 1 && others.length > 0 ? others[0].time_ms - timeMs : null

  let reference: TrackGoal['reference'] = null
  let refMs: number | null = null
  if (wrMs) {
    reference = 'wr'
    refMs = wrMs
  } else if (faster.length > 0) {
    reference = 'community'
    refMs = faster[0].time_ms
  }

  return {
    trackId,
    timeMs,
    position,
    total: others.length + 1,
    next,
    milestone,
    leadMs,
    reference,
    pct: refMs ? (timeMs / refMs) * 100 : null,
    refGapMs: refMs ? timeMs - refMs : null,
    mostMargin: false,
  }
}

/** Cuántas pistas se destacan como "más margen de mejora" */
export function marginCount(tracksWithPct: number): number {
  return tracksWithPct < 2 ? 0 : Math.min(3, Math.ceil(tracksWithPct / 3))
}

/**
 * Objetivos de todas las pistas donde el jugador tiene tiempo (de una misma categoría y modo).
 * Orden: primero las de más margen de mejora (mayor % respecto a la referencia);
 * las que no tienen referencia (el jugador es el 1.º y no hay WR) van al final.
 */
export function buildGoals(
  profileId: string,
  myTimes: { track_id: string; time_ms: number }[],
  communityTimes: RankTime[],
  wrs: Map<string, number> | null,
): TrackGoal[] {
  const byTrack = new Map<string, RankTime[]>()
  for (const t of communityTimes) {
    const list = byTrack.get(t.track_id) ?? []
    list.push(t)
    byTrack.set(t.track_id, list)
  }

  const goals = myTimes.map((mine) =>
    trackGoal(
      mine.track_id,
      profileId,
      mine.time_ms,
      bestPerPlayer(byTrack.get(mine.track_id) ?? []),
      wrs?.get(mine.track_id) ?? null,
    ),
  )

  goals.sort((a, b) => (b.pct ?? -1) - (a.pct ?? -1) || a.position - b.position)
  const k = marginCount(goals.filter((g) => g.pct !== null).length)
  // Solo se destaca si de verdad hay margen (más lento que la referencia)
  goals.slice(0, k).forEach((g) => (g.mostMargin = (g.pct ?? 0) > 100))
  return goals
}

/** 800 → "0,800" (es) / "0.800" (en): diferencia en segundos con milésimas */
export function formatGap(ms: number, locale: string): string {
  return (Math.abs(ms) / 1000).toLocaleString(locale, { minimumFractionDigits: 3, maximumFractionDigits: 3 })
}

/** 103.24 → "103,2" (es) / "103.2" (en) */
export function formatPct(pct: number, locale: string): string {
  return pct.toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}
