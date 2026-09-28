/** Puntos por posición en una war 6v6 (1.º a 12.º). */
export const POINTS = [15, 12, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1] as const

/** Puntos que recibe cada jugador ausente: cuenta como si hubiera quedado 12.º. */
export const MISSING_PLAYER_POINTS = 1

export const PLAYERS_PER_TEAM = 6

export type TeamSide = 'red' | 'blue'

export type RaceResult = {
  /** Posición (1..N) de cada jugador que ha corrido */
  placements: { side: TeamSide; position: number }[]
  /** Un elemento por cada jugador ausente, indicando su equipo */
  missing?: TeamSide[]
}

export type RaceScore = Record<TeamSide, number>

export function pointsForPosition(position: number): number {
  const points = POINTS[position - 1]
  if (points === undefined) throw new Error(`Posición no válida: ${position}`)
  return points
}

/**
 * Devuelve el motivo por el que una carrera no es válida, o null si lo es.
 * Se admiten carreras de 12, 11 o 10 jugadores.
 */
export function validateRace(race: RaceResult): string | null {
  const missing = race.missing ?? []
  const racers = race.placements.length

  if (missing.length > 2) return 'Como máximo puede haber 2 jugadores ausentes (carrera de 10).'
  if (racers + missing.length !== PLAYERS_PER_TEAM * 2) {
    return `Faltan o sobran jugadores: hay ${racers} en carrera y ${missing.length} ausentes (deben sumar 12).`
  }

  const seen = new Set<number>()
  for (const { position } of race.placements) {
    if (!Number.isInteger(position) || position < 1 || position > racers) {
      return `La posición ${position} no es válida en una carrera de ${racers} jugadores.`
    }
    if (seen.has(position)) return `La posición ${position} está repetida.`
    seen.add(position)
  }

  for (const side of ['red', 'blue'] as const) {
    const count =
      race.placements.filter((p) => p.side === side).length + missing.filter((m) => m === side).length
    if (count !== PLAYERS_PER_TEAM) {
      return `El equipo ${side === 'red' ? 'rojo' : 'azul'} tiene ${count} jugadores (deben ser 6).`
    }
  }

  return null
}

/**
 * Calcula los puntos de cada equipo en una carrera.
 *
 * - 12 jugadores: tabla normal (82 puntos en total).
 * - 11 jugadores: el ausente recibe 1 punto, como si quedase 12.º (82 en total).
 * - 10 jugadores: los dos ausentes reciben 1 punto cada uno y los 2 puntos
 *   del 11.º se pierden (81 en total).
 */
export function scoreRace(race: RaceResult): RaceScore {
  const error = validateRace(race)
  if (error) throw new Error(error)

  const score: RaceScore = { red: 0, blue: 0 }
  for (const { side, position } of race.placements) score[side] += pointsForPosition(position)
  for (const side of race.missing ?? []) score[side] += MISSING_PLAYER_POINTS
  return score
}

/**
 * Puntos de una carrera de war conociendo solo las posiciones del equipo propio
 * (las del rival son las restantes). Es como se guardan las carreras en la base de datos.
 */
export function scoreTeamRace(
  teamPositions: number[],
  missingHome = 0,
  missingAway = 0,
): { home: number; away: number } {
  const racers = PLAYERS_PER_TEAM * 2 - missingHome - missingAway
  const taken = new Set(teamPositions)
  const awayPositions = Array.from({ length: racers }, (_, i) => i + 1).filter((p) => !taken.has(p))
  const score = scoreRace({
    placements: [
      ...teamPositions.map((position) => ({ side: 'red' as const, position })),
      ...awayPositions.map((position) => ({ side: 'blue' as const, position })),
    ],
    missing: [...Array<TeamSide>(missingHome).fill('red'), ...Array<TeamSide>(missingAway).fill('blue')],
  })
  return { home: score.red, away: score.blue }
}
