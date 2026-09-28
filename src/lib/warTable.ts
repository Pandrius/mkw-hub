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

/** Formato de texto de tabla (compatible con el generador de tablas de Lorenzi) */
export function tableText(teamTag: string, opponentTag: string, table: WarTable): string {
  const lines = [`#title ${teamTag} vs ${opponentTag}`, `${teamTag}`]
  for (const p of table.players) lines.push(`${p.player.name} ${p.points}`)
  if (table.missingPoints) lines.push(`Ausentes ${table.missingPoints}`)
  lines.push('', `${opponentTag}`, `${opponentTag} ${table.away}`)
  return lines.join('\n')
}
