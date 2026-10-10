import type { EventDetail, EventPlayer, EventRace, GameEvent, OpponentResult, RaceResult } from './events'
import type { Penalty } from './penalties'
import { activeNames, type Substitution } from './substitutions'

/**
 * La war de otro equipo vista desde el rival (el que la valida): su equipo a la izquierda, los resultados
 * al revés. Es la vista previa de lo que hace accept_opponent_war en la base de datos, y debe coincidir con ella.
 *
 * Solo se pueden corregir nombres de jugadores y de penalties: las puntuaciones y las pistas no se tocan.
 */

export type WarCorrections = {
  /** Jugadores del equipo que valida (como los escribió quien subió la war) → nombre corregido */
  teamNames: Record<string, string>
  /** Jugadores del equipo que subió la war → nombre corregido */
  opponentNames: Record<string, string>
  /** Posición de la penalty (0, 1…) → nombre corregido */
  penaltyLabels: Record<string, string>
}

export const NO_CORRECTIONS: WarCorrections = { teamNames: {}, opponentNames: {}, penaltyLabels: {} }

/** Nombre que queda guardado: "Usuario = nombre en el juego" guarda el nombre en el juego */
const ingame = (entry: string) => {
  const i = entry.indexOf('=')
  return (i >= 0 ? entry.slice(i + 1) : entry).trim()
}

/** Un valor corregido vacío cuenta como "sin corregir" */
const corrected = (map: Record<string, string>, name: string) => map[name]?.trim() || name

/** Jugadores de cada equipo en la war tal como la subió el otro equipo */
export function warPlayerNames(detail: EventDetail): { team: string[]; opponent: string[] } {
  const { event, players, races } = detail
  const team = [...(event.opponent_players ?? [1, 2, 3, 4, 5, 6].map((n) => `${event.opponent_tag || 'Rival'} ${n}`))]
  const add = (name: string | undefined) => {
    if (name && !team.includes(name)) team.push(name)
  }
  for (const r of races) for (const o of r.opponent_results ?? []) add(o.name)
  for (const s of event.substitutions ?? []) if (s.side === 'away') add(s.in)
  return { team, opponent: players.map((p) => p.name) }
}

/** Vista de la war desde el equipo rival, con las correcciones aplicadas */
export function mirrorEventDetail(detail: EventDetail, corrections: WarCorrections = NO_CORRECTIONS): EventDetail {
  const { event, players, races } = detail
  const names = warPlayerNames(detail)

  const opponentMap = new Map(names.opponent.map((n) => [n, corrected(corrections.opponentNames, n)]))
  const teamMap = new Map(names.team.map((n) => [n, ingame(corrected(corrections.teamNames, n))]))

  // Jugadores del equipo que valida, con ids propios (los de la vista previa no existen en la base de datos)
  const mirrorPlayers: EventPlayer[] = names.team.map((n, i) => ({
    id: i + 1,
    event_id: event.id,
    name: teamMap.get(n) ?? n,
    profile_id: null,
  }))
  const idOf = new Map(names.team.map((n, i) => [n, i + 1]))

  const subs: Substitution[] = (event.substitutions ?? []).map((s) => {
    const map = s.side === 'home' ? opponentMap : teamMap
    return { side: s.side === 'home' ? 'away' : 'home', out: map.get(s.out) ?? s.out, in: map.get(s.in) ?? s.in, race_no: s.race_no }
  })
  const penalties: Penalty[] = (event.penalties ?? []).map((p, i) => {
    const label = corrections.penaltyLabels[String(i)]?.trim()
    return { side: p.side === 'home' ? 'away' : 'home', label: label && label.length <= 40 ? label : p.label, points: p.points }
  })

  const mirrorRaces: EventRace[] = [...races]
    .sort((a, b) => a.race_no - b.race_no)
    .map((r) => {
      const ownerName = new Map(players.map((p) => [p.id, p.name]))
      const opponentResults: OpponentResult[] = r.race_results
        .map((x) => ({ name: opponentMap.get(ownerName.get(x.player_id) ?? '') ?? '?', position: x.position }))
        .sort((a, b) => a.position - b.position)

      let results: RaceResult[]
      if (r.opponent_results && r.opponent_results.length > 0) {
        results = r.opponent_results
          .filter((o) => idOf.has(o.name))
          .map((o) => ({ player_id: idOf.get(o.name)!, position: o.position }))
      } else {
        // Sin posiciones por jugador: las que quedan se reparten entre los rivales que corrían, en orden (como en la tabla original)
        const taken = new Set(r.race_results.map((x) => x.position))
        const racers = 12 - r.missing_home - r.missing_away
        const remaining = Array.from({ length: racers }, (_, i) => i + 1).filter((p) => !taken.has(p))
        const active = activeNames(names.team, 'away', event.substitutions ?? [], r.race_no)
        results = remaining.slice(0, active.length).map((position, i) => ({ player_id: idOf.get(active[i])!, position }))
      }

      return {
        ...r,
        // Los ausentes de cada equipo se intercambian
        missing_home: r.missing_away,
        missing_away: r.missing_home,
        race_results: results,
        opponent_results: opponentResults,
      }
    })

  const mirrorEvent: GameEvent = {
    ...event,
    team_id: event.opponent_team_id,
    team_tag: event.opponent_tag,
    team_name: event.opponent_name,
    opponent_team_id: event.team_id,
    opponent_tag: event.team_tag,
    opponent_name: event.team_name,
    opponent_players: names.opponent.map((n) => opponentMap.get(n) ?? n),
    penalties,
    substitutions: subs,
    status: 'finished',
    opponent_confirmed: true,
    mirror_of: event.id,
  }
  return { event: mirrorEvent, players: mirrorPlayers, races: mirrorRaces }
}
