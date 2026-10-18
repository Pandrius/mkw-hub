import type { SupabaseClient } from '@supabase/supabase-js'
import type { TimedResult } from './form.js'
import { eventDate } from './playedAt.js'
import { parsePenalties, type Penalty } from './penalties.js'
import { isVerified, type Verifiable } from './verify.js'
import { warMvps, wonWar, type WarMvpRace, type WarRaceLine } from './warWins.js'

/**
 * Consulta de las carreras de un jugador. Va aparte de form.ts porque la usa también el servidor (api/), donde no existe el
 * cliente del navegador de supabase.ts.
 */
/** Resultados de un jugador en eventos finalizados con fecha y número de carrera */
export async function fetchTimeline(client: SupabaseClient, profileId: string): Promise<TimedResult[]> {
  const { data, error } = await client
    .from('race_results')
    .select(
      'position, player_id, event_players!inner(profile_id, final_position), event_races!inner(race_no, track_id, is_section, missing_home, missing_away, events!inner(id, kind, status, created_at, played_on, lounge_change_id, lounge_table_id, lounge_tier, trusted, vouched_by, proof_status, penalties))',
    )
    .eq('event_players.profile_id', profileId)
    .eq('event_races.events.status', 'finished')
    .limit(10000)
  if (error) throw error
  type Row = {
    position: number
    player_id: number
    event_players: { final_position: number | null }
    event_races: {
      race_no: number
      track_id: string
      is_section: boolean
      missing_home: number
      missing_away: number
      events: Verifiable & { id: string; created_at: string; played_on: string | null; lounge_tier: string | null; lounge_change_id: number | null; penalties: unknown }
    }
  }
  const rows = (data ?? []) as unknown as Row[]
  const [won, loungeFirst] = await Promise.all([wonWarIds(client, rows), loungeFirstIds(client, profileId, rows)])
  return rows.map((r) => ({
    eventId: r.event_races.events.id,
    kind: r.event_races.events.kind,
    trackId: r.event_races.track_id,
    position: r.position,
    raceNo: r.event_races.race_no,
    date: eventDate(r.event_races.events.created_at, r.event_races.events.played_on),
    racers: r.event_races.events.kind === 'war' ? 12 - r.event_races.missing_home - r.event_races.missing_away : null,
    verified: isVerified(r.event_races.events),
    tier: r.event_races.events.lounge_tier,
    warWon: won.wars.has(r.event_races.events.id),
    // El puesto final que pone un perfil de confianza manda; si no, la mesa del Lounge o el MVP calculado de la war
    eventFirst:
      r.event_players.final_position != null
        ? r.event_players.final_position === 1
        : r.event_races.events.kind === 'war'
          ? won.firsts.has(`${r.event_races.events.id}|${r.player_id}`)
          : loungeFirst.has(r.event_races.events.id),
    section: r.event_races.is_section,
  }))
}

/** Eventos por consulta al pedir las carreras de las wars (las ids van en la URL) */
const WAR_CHUNK = 60

/** Eventos Lounge del jugador en los que su mesa acabó primera (rank 1 en su historial del Lounge) */
async function loungeFirstIds(
  client: SupabaseClient,
  profileId: string,
  rows: { event_races: { events: { id: string; kind: string; lounge_change_id: number | null } } }[],
): Promise<Set<string>> {
  const changes = new Map<number, string>()
  for (const r of rows) {
    const e = r.event_races.events
    if (e.kind === 'lounge' && e.lounge_change_id !== null) changes.set(e.lounge_change_id, e.id)
  }
  if (changes.size === 0) return new Set()
  const { data, error } = await client.from('lounge_changes').select('change_id').eq('profile_id', profileId).eq('reason', 'Table').eq('rank', 1).limit(10000)
  if (error) throw error
  return new Set(((data ?? []) as { change_id: number }[]).flatMap((c) => (changes.has(c.change_id) ? [changes.get(c.change_id) as string] : [])))
}

/**
 * Wars que ganó el equipo del jugador y, de todas, quién fue el MVP (`firsts`: "eventoId|jugadorId"; ver `warMvps`). Se piden
 * todas las carreras de cada war, con las posiciones de todo su equipo y las de los rivales si se apuntaron.
 */
async function wonWarIds(
  client: SupabaseClient,
  rows: { event_races: { events: { id: string; kind: string; penalties: unknown } } }[],
): Promise<{ wars: Set<string>; firsts: Set<string> }> {
  const wars = new Map<string, Penalty[]>()
  for (const r of rows) {
    const e = r.event_races.events
    if (e.kind === 'war') wars.set(e.id, parsePenalties(e.penalties))
  }
  const ids = [...wars.keys()]
  const races = new Map<string, WarRaceLine[]>()
  const mvpRaces = new Map<string, WarMvpRace[]>()
  type Raw = {
    event_id: string
    missing_home: number
    missing_away: number
    opponent_results: unknown
    race_results: { position: number; player_id: number }[]
  }
  for (let i = 0; i < ids.length; i += WAR_CHUNK) {
    const { data, error } = await client
      .from('event_races')
      .select('event_id, missing_home, missing_away, opponent_results, race_results(position, player_id)')
      .in('event_id', ids.slice(i, i + WAR_CHUNK))
      .limit(10000)
    if (error) throw error
    for (const r of (data ?? []) as unknown as Raw[]) {
      const list = races.get(r.event_id) ?? []
      list.push({ positions: r.race_results.map((x) => x.position), missingHome: r.missing_home, missingAway: r.missing_away })
      races.set(r.event_id, list)
      const opp = Array.isArray(r.opponent_results)
        ? (r.opponent_results as { name?: unknown; position?: unknown }[]).filter((x): x is { name: string; position: number } => !!x && typeof x.name === 'string' && Number.isInteger(x.position))
        : null
      const mvp = mvpRaces.get(r.event_id) ?? []
      mvp.push({
        own: r.race_results.map((x) => ({ playerId: x.player_id, position: x.position })),
        opponents: opp && opp.length > 0 ? opp : null,
        racers: 12 - r.missing_home - r.missing_away,
      })
      mvpRaces.set(r.event_id, mvp)
    }
  }
  const won = ids.filter((id) => wonWar(races.get(id) ?? [], wars.get(id)))
  const firsts = new Set<string>()
  for (const id of ids) for (const player of warMvps(mvpRaces.get(id) ?? []) ?? []) firsts.add(`${id}|${player}`)
  return { wars: new Set(won), firsts }
}
