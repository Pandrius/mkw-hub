import type { EventPlayer, EventRace } from './events'
import { penaltyTotals, type Penalty } from './penalties.js'
import { pointsForPosition, scoreTeamRace, MISSING_PLAYER_POINTS } from './scoring.js'

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

export type OpponentPlayerRow = {
  name: string
  points: number
  races: number
  /** Posición en cada carrera (por race_no); undefined si no corrió */
  positions: Record<number, number>
}

export type WarTable = {
  races: RaceRow[]
  players: PlayerRow[]
  opponentPlayers: OpponentPlayerRow[]
  home: number
  away: number
  diff: number
  /** Puntos que se lleva el equipo propio por jugadores ausentes */
  missingPoints: number
  /** Penalties de la war; los totales home / away ya las incluyen */
  penalties: Penalty[]
}

/** Tabla completa de una war: puntos por carrera, por jugador propio y rival, y totales. */
export function buildWarTable(
  players: EventPlayer[],
  races: EventRace[],
  opponentPlayerNames?: string[] | null,
  penalties: Penalty[] = [],
): WarTable {
  let home = 0
  let away = 0
  let missingPoints = 0
  const byPlayer = new Map<number, PlayerRow>(players.map((p) => [p.id, { player: p, points: 0, races: 0, positions: {} }]))

  const rawOpponents = (opponentPlayerNames ?? []).map((s) => s.trim()).filter(Boolean)
  const byOpponent = new Map<string, OpponentPlayerRow>(
    rawOpponents.map((name) => [name, { name, points: 0, races: 0, positions: {} }]),
  )

  const rows = [...races]
    .sort((a, b) => a.race_no - b.race_no)
    .map((race) => {
      const homePositions = race.race_results.map((r) => r.position)
      const score = scoreTeamRace(
        homePositions,
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

      // Si hay rivales registrados, calculamos sus posiciones individuales
      if (rawOpponents.length > 0) {
        const racers = 12 - race.missing_home - race.missing_away
        const awayPositions = Array.from({ length: racers }, (_, i) => i + 1)
          .filter((pos) => !homePositions.includes(pos))
          .sort((a, b) => a - b)

        if (race.opponent_results && race.opponent_results.length > 0) {
          for (const res of race.opponent_results) {
            let row = byOpponent.get(res.name)
            if (!row) {
              row = { name: res.name, points: 0, races: 0, positions: {} }
              byOpponent.set(res.name, row)
            }
            row.points += pointsForPosition(res.position)
            row.races += 1
            row.positions[race.race_no] = res.position
          }
        } else {
          // Auto-asignación de las posiciones restantes entre los 6 rivales
          rawOpponents.slice(0, awayPositions.length).forEach((name, idx) => {
            const pos = awayPositions[idx]
            const row = byOpponent.get(name)
            if (row && pos !== undefined) {
              row.points += pointsForPosition(pos)
              row.races += 1
              row.positions[race.race_no] = pos
            }
          })
        }
      }

      return { race, home: score.home, away: score.away, diff: score.home - score.away, runningDiff: home - away }
    })

  // Las penalties son puntos negativos: no cuentan en ninguna carrera, solo en el total
  const pen = penaltyTotals(penalties)
  home += pen.home
  away += pen.away

  return {
    races: rows,
    // Solo jugadores que han corrido alguna carrera, de más a menos puntos
    players: [...byPlayer.values()].filter((p) => p.races > 0).sort((a, b) => b.points - a.points),
    opponentPlayers: [...byOpponent.values()].filter((p) => p.races > 0).sort((a, b) => b.points - a.points),
    home,
    away,
    diff: home - away,
    missingPoints,
    penalties,
  }
}

const LORENZI = 'https://gb2.hlorenzi.com'

/** Nombre apto para una línea de Lorenzi: sin saltos de línea ni [ ] (se usan para la bandera) */
const cleanName = (s: string) => s.replace(/[\r\n[\]]/g, ' ').replace(/\s+/g, ' ').trim()

/** Tag tal como aparece en el texto de Lorenzi (los escudos se asocian a él) */
export const lorenziTag = (tag: string, fallback: string) => cleanName(tag) || fallback

/**
 * Tabla en el formato de texto del Table Maker de Lorenzi (gb2.hlorenzi.com/table):
 *
 *   #title MKH vs ABC
 *   MKH
 *   tortelini 15+12+10+…      ← puntos de cada carrera, Lorenzi los suma
 *   DC 1                      ← puntos de jugadores ausentes (carreras de 11/10)
 *
 *   ABC
 *   rival1 12+10+…            ← si hay 12 jugadores, se muestran todos automáticamente
 *   ABC 334                   ← o solo el total si no se especificaron rivales individuales
 */
export function lorenziText(teamTag: string, opponentTag: string, table: WarTable): string {
  const home = lorenziTag(teamTag, 'Home')
  const away = lorenziTag(opponentTag, 'Away')
  const lines = [`#title ${home} vs ${away}`, home]
  for (const p of table.players) {
    const perRace = Object.keys(p.positions)
      .map(Number)
      .sort((a, b) => a - b)
      .map((raceNo) => pointsForPosition(p.positions[raceNo]))
    lines.push(`${cleanName(p.player.name)} ${perRace.join('+')}`)
  }
  if (table.missingPoints) lines.push(`DC ${table.missingPoints}`)
  for (const p of table.penalties.filter((x) => x.side === 'home')) lines.push(`${cleanName(p.label) || 'Penalty'} ${p.points}`)

  lines.push('', away)
  if (table.opponentPlayers && table.opponentPlayers.length > 0) {
    for (const p of table.opponentPlayers) {
      const perRace = Object.keys(p.positions)
        .map(Number)
        .sort((a, b) => a - b)
        .map((raceNo) => pointsForPosition(p.positions[raceNo]))
      lines.push(`${cleanName(p.name)} ${perRace.join('+')}`)
    }
  } else {
    // Solo el total de las carreras: las penalties van en sus propias líneas
    lines.push(`${away} ${table.away - penaltyTotals(table.penalties).away}`)
  }
  for (const p of table.penalties.filter((x) => x.side === 'away')) lines.push(`${cleanName(p.label) || 'Penalty'} ${p.points}`)
  return lines.join('\n')
}

/** Imagen PNG de la tabla generada por Lorenzi */
export const lorenziImageUrl = (text: string) => `${LORENZI}/table.png?data=${encodeURIComponent(text)}`

/** La misma tabla abierta en el editor de Lorenzi */
export const lorenziEditorUrl = (text: string) => `${LORENZI}/table?data=${encodeURIComponent(text)}`
