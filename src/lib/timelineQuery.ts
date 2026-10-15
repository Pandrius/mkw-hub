import type { SupabaseClient } from '@supabase/supabase-js'
import type { TimedResult } from './form.js'
import { eventDate } from './playedAt.js'
import { parsePenalties, type Penalty } from './penalties.js'
import { isVerified, type Verifiable } from './verify.js'
import { wonWar, type WarRaceLine } from './warWins.js'

/**
 * Consulta de las carreras de un jugador. Va aparte de form.ts porque la usa también el servidor (api/), donde no existe el
 * cliente del navegador de supabase.ts.
 */
/** Resultados de un jugador en eventos finalizados con fecha y número de carrera */
export async function fetchTimeline(client: SupabaseClient, profileId: string): Promise<TimedResult[]> {
  const { data, error } = await client
    .from('race_results')
    .select(
      'position, event_players!inner(profile_id), event_races!inner(race_no, track_id, missing_home, missing_away, events!inner(id, kind, status, created_at, played_on, lounge_change_id, lounge_table_id, lounge_tier, trusted, vouched_by, proof_status, penalties))',
    )
    .eq('event_players.profile_id', profileId)
    .eq('event_races.events.status', 'finished')
    .limit(10000)
  if (error) throw error
  type Row = {
    position: number
    event_races: {
      race_no: number
      track_id: string
      missing_home: number
      missing_away: number
      events: Verifiable & { id: string; created_at: string; played_on: string | null; lounge_tier: string | null; penalties: unknown }
    }
  }
  const rows = (data ?? []) as unknown as Row[]
  const won = await wonWarIds(client, rows)
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
    warWon: won.has(r.event_races.events.id),
  }))
}

/** Eventos por consulta al pedir las carreras de las wars (las ids van en la URL) */
const WAR_CHUNK = 60

/** Wars que ganó el equipo del jugador: se piden todas las carreras de cada war (con las posiciones de todo su equipo) */
async function wonWarIds(client: SupabaseClient, rows: { event_races: { events: { id: string; kind: string; penalties: unknown } } }[]): Promise<Set<string>> {
  const wars = new Map<string, Penalty[]>()
  for (const r of rows) {
    const e = r.event_races.events
    if (e.kind === 'war') wars.set(e.id, parsePenalties(e.penalties))
  }
  const ids = [...wars.keys()]
  const races = new Map<string, WarRaceLine[]>()
  for (let i = 0; i < ids.length; i += WAR_CHUNK) {
    const { data, error } = await client
      .from('event_races')
      .select('event_id, missing_home, missing_away, race_results(position)')
      .in('event_id', ids.slice(i, i + WAR_CHUNK))
      .limit(10000)
    if (error) throw error
    for (const r of (data ?? []) as unknown as { event_id: string; missing_home: number; missing_away: number; race_results: { position: number }[] }[]) {
      const list = races.get(r.event_id) ?? []
      list.push({ positions: r.race_results.map((x) => x.position), missingHome: r.missing_home, missingAway: r.missing_away })
      races.set(r.event_id, list)
    }
  }
  return new Set(ids.filter((id) => wonWar(races.get(id) ?? [], wars.get(id))))
}
