import { penaltyTotals, type Penalty } from './penalties.js'
import { scoreTeamRace } from './scoring.js'

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
