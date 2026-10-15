import type { Achievement, AchievementId } from './achievements'

/** Contadores de cada logro de todos los jugadores con eventos verificados (de mayor a menor) */
export type AchievementStats = { players: number; counts: Partial<Record<AchievementId, number[]>> }

/** Con menos jugadores que esto un porcentaje no dice nada y no se enseña */
export const MIN_PLAYERS_FOR_PERCENT = 3

/** Reúne los contadores de cada logro de varios jugadores (una lista de logros por jugador) */
export function buildAchievementStats(perPlayer: Achievement[][]): AchievementStats {
  const counts: Partial<Record<AchievementId, number[]>> = {}
  for (const list of perPlayer) for (const a of list) (counts[a.id] ??= []).push(a.count)
  for (const id of Object.keys(counts) as AchievementId[]) counts[id]!.sort((a, b) => b - a)
  return { players: perPlayer.length, counts }
}

/**
 * «Estás en el top X %» de los jugadores en un logro: tu puesto (1 + los que tienen más que tú) entre el total.
 * null si aún no tienes nada o hay muy pocos jugadores para que tenga sentido.
 */
export function topPercentIn(stats: AchievementStats | null, id: AchievementId, count: number): number | null {
  if (!stats || stats.players < MIN_PLAYERS_FOR_PERCENT || count <= 0) return null
  const all = stats.counts[id] ?? []
  const rank = 1 + all.filter((c) => c > count).length
  return Math.max(1, Math.ceil((rank / stats.players) * 100))
}

/** Estadísticas de todos los jugadores (las calcula el servidor y las deja en caché unos minutos) */
export async function getAchievementStats(): Promise<AchievementStats | null> {
  try {
    const res = await fetch('/api/achievement-stats')
    if (!res.ok) return null
    return (await res.json()) as AchievementStats
  } catch {
    return null
  }
}
