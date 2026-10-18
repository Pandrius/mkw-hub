import { penaltyTotals, type Penalty } from './penalties.js'
import { POINTS, scoreTeamRace } from './scoring.js'

/** Una carrera de war con las posiciones de nuestro equipo (las del rival son las que quedan) */
export type WarRaceLine = { positions: number[]; missingHome: number; missingAway: number }

/**
 * ¿Ha ganado nuestro equipo la war? Suma los puntos de todas las carreras y aplica las penalties al final.
 * Un empate no es victoria. Si alguna carrera no es válida (datos rotos) no se cuenta como victoria.
 */
export function wonWar(races: WarRaceLine[], penalties: Penalty[] | null | undefined): boolean {
  let home = 0
  let away = 0
  try {
    for (const r of races) {
      const s = scoreTeamRace(r.positions, r.missingHome, r.missingAway)
      home += s.home
      away += s.away
    }
  } catch {
    return false
  }
  const pen = penaltyTotals(penalties)
  return home + pen.home > away + pen.away
}

/** Una carrera de war con quién quedó en cada posición, de los dos equipos */
export type WarMvpRace = {
  own: { playerId: number; position: number }[]
  /** Posiciones de los rivales por nombre (null si no se apuntaron) */
  opponents: { name: string; position: number }[] | null
  /** Jugadores que corrieron en total (12 menos los ausentes) */
  racers: number
}

/**
 * MVP de la war: el jugador con más puntos de los 12 del evento, aliados y rivales. Devuelve los ids de los jugadores propios
 * que lo son (varios si empatan con la máxima puntuación), o null si no se puede saber porque a alguna carrera le faltan las
 * posiciones de los rivales.
 */
export function warMvps(races: WarMvpRace[]): number[] | null {
  const own = new Map<number, number>()
  const opp = new Map<string, number>()
  for (const r of races) {
    if (!r.opponents || r.own.length + r.opponents.length !== r.racers) return null
    for (const x of r.own) own.set(x.playerId, (own.get(x.playerId) ?? 0) + (POINTS[x.position - 1] ?? 0))
    for (const x of r.opponents) opp.set(x.name, (opp.get(x.name) ?? 0) + (POINTS[x.position - 1] ?? 0))
  }
  if (own.size === 0) return null
  const top = Math.max(...own.values(), ...opp.values())
  return [...own].filter(([, pts]) => pts === top).map(([id]) => id)
}
