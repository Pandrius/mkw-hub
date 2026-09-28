import type { EventPlayer, EventRace } from './events'
import { pointsForPosition, scoreTeamRace, MISSING_PLAYER_POINTS } from './scoring'

export type RaceRow = {
  race: EventRace
  home: number
  away: number
  /** Diferencia de esa carrera (home - away) */
  diff: number
  /** Diferencia acumulada hasta esa carrera */
  runningDiff: number
}

export type PlayerRow = {
  player: EventPlayer
  points: number
  races: number
  /** Posición en cada carrera (por race_no); undefined si no corrió */
  positions: Record<number, number>
}

export type WarTable = {
  races: RaceRow[]
  players: PlayerRow[]
  home: number
  away: number
  diff: number
  /** Puntos que se lleva el equipo propio por jugadores ausentes */
  missingPoints: number
}

/** Tabla completa de una war: puntos por carrera, por jugador y totales. */
export function buildWarTable(players: EventPlayer[], races: EventRace[]): WarTable {
  let home = 0
  let away = 0
  let missingPoints = 0
  const byPlayer = new Map<number, PlayerRow>(players.map((p) => [p.id, { player: p, points: 0, races: 0, positions: {} }]))

  const rows = [...races]
    .sort((a, b) => a.race_no - b.race_no)
    .map((race) => {
      const score = scoreTeamRace(
        race.race_results.map((r) => r.position),
        race.missing_home,
        race.missing_away,
      )
      home += score.home
      away += score.away
      missingPoints += race.missing_home * MISSING_PLAYER_POINTS
      for (const r of race.race_results) {
        const row = byPlayer.get(r.player_id)
        if (!row) continue
        row.points += pointsForPosition(r.position)
        row.races += 1
        row.positions[race.race_no] = r.position
      }
      return { race, home: score.home, away: score.away, diff: score.home - score.away, runningDiff: home - away }
    })

  return {
    races: rows,
    // Solo jugadores que han corrido alguna carrera, de más a menos puntos
    players: [...byPlayer.values()].filter((p) => p.races > 0).sort((a, b) => b.points - a.points),
    home,
    away,
    diff: home - away,
    missingPoints,
  }
}

const LORENZI = 'https://gb2.hlorenzi.com'

/** Nombre apto para una línea de Lorenzi: sin saltos de línea ni [ ] (se usan para la bandera) */
const cleanName = (s: string) => s.replace(/[\r\n[\]]/g, ' ').replace(/\s+/g, ' ').trim()

/**
 * Tabla en el formato de texto del Table Maker de Lorenzi (gb2.hlorenzi.com/table):
 *
 *   #title MKH vs ABC
 *   MKH
 *   tortelini 15+12+10+…      ← puntos de cada carrera, Lorenzi los suma
 *   DC 1                      ← puntos de jugadores ausentes (carreras de 11/10)
 *
 *   ABC
 *   ABC 334                   ← del rival solo se conoce el total
 */
export function lorenziText(teamTag: string, opponentTag: string, table: WarTable): string {
  const home = cleanName(teamTag) || 'Home'
  const away = cleanName(opponentTag) || 'Away'
  const lines = [`#title ${home} vs ${away}`, home]
  for (const p of table.players) {
    const perRace = Object.keys(p.positions)
      .map(Number)
      .sort((a, b) => a - b)
      .map((raceNo) => pointsForPosition(p.positions[raceNo]))
    lines.push(`${cleanName(p.player.name)} ${perRace.join('+')}`)
  }
  if (table.missingPoints) lines.push(`DC ${table.missingPoints}`)
  lines.push('', away, `${away} ${table.away}`)
  return lines.join('\n')
}

/** Imagen PNG de la tabla generada por Lorenzi */
export const lorenziImageUrl = (text: string) => `${LORENZI}/table.png?data=${encodeURIComponent(text)}`

/** La misma tabla abierta en el editor de Lorenzi */
export const lorenziEditorUrl = (text: string) => `${LORENZI}/table?data=${encodeURIComponent(text)}`
