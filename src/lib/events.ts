import { sanitizeEventDetail } from './eventSanitize'
import { supabase } from './supabase'

export type EventKind = 'war' | 'lounge'
export type EventStatus = 'open' | 'finished'

export type GameEvent = {
  id: string
  kind: EventKind
  status: EventStatus
  team_tag: string | null
  team_name: string | null
  team_id: number | null
  opponent_tag: string | null
  opponent_name: string | null
  opponent_team_id: number | null
  opponent_players: string[] | null
  created_by: string
  created_at: string
  finished_at: string | null
}

export type EventPlayer = { id: number; event_id: string; name: string; profile_id: string | null }

export type RaceResult = { player_id: number; position: number }
export type OpponentResult = { name: string; position: number }

export type EventRace = {
  id: number
  race_no: number
  track_id: string
  missing_home: number
  missing_away: number
  race_results: RaceResult[]
  opponent_results?: OpponentResult[] | null
}

export type EventDetail = { event: GameEvent; players: EventPlayer[]; races: EventRace[] }

export const RACES_PER_EVENT = 12

function client() {
  if (!supabase) throw new Error('Supabase no está configurado')
  return supabase
}

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await client().rpc(fn, args)
  if (error) throw new Error(error.message)
  return data as T
}

export type CreateEventInput = {
  kind: EventKind
  teamTag: string
  opponentTag: string
  players: string[]
  teamId?: number | null
  teamName?: string | null
  opponentTeamId?: number | null
  opponentName?: string | null
  opponentPlayers?: string[] | null
}

export function createEvent(input: CreateEventInput): Promise<string> {
  return rpc<string>('create_event', {
    kind: input.kind,
    team_tag: input.teamTag,
    opponent_tag: input.opponentTag,
    players: input.players,
    team_id: input.teamId ?? null,
    team_name: input.teamName ?? null,
    opponent_team_id: input.opponentTeamId ?? null,
    opponent_name: input.opponentName ?? null,
    opponent_players: input.opponentPlayers ?? null,
  })
}

export function addEventPlayer(eventId: string, entry: string): Promise<number> {
  return rpc<number>('add_event_player', { target: eventId, entry })
}

export function saveRace(
  eventId: string,
  raceNo: number,
  trackId: string,
  results: RaceResult[],
  missingHome = 0,
  missingAway = 0,
  opponentResults?: OpponentResult[] | null,
): Promise<void> {
  return rpc<void>('save_race', {
    target: eventId,
    race_no: raceNo,
    track_id: trackId,
    results,
    missing_home: missingHome,
    missing_away: missingAway,
    opponent_results: opponentResults ?? null,
  })
}

export const deleteRace = (eventId: string, raceNo: number) => rpc<void>('delete_race', { target: eventId, race_no: raceNo })
export const finishEvent = (eventId: string) => rpc<void>('finish_event', { target: eventId })
export const deleteEvent = (eventId: string) => rpc<void>('delete_event', { target: eventId })

export async function getEvent(eventId: string): Promise<EventDetail | null> {
  const db = client()
  const [ev, players, races] = await Promise.all([
    db.from('events').select('*').eq('id', eventId).maybeSingle(),
    db.from('event_players').select('id, event_id, name, profile_id').eq('event_id', eventId).order('id'),
    db
      .from('event_races')
      .select('id, race_no, track_id, missing_home, missing_away, opponent_results, race_results(player_id, position)')
      .eq('event_id', eventId)
      .order('race_no'),
  ])
  for (const r of [ev, players, races]) if (r.error) throw r.error
  if (!ev.data) return null
  return sanitizeEventDetail({ event: ev.data as GameEvent, players: players.data as EventPlayer[], races: races.data as EventRace[] })
}


/** Eventos en los que participa (o que ha creado) un usuario, del más reciente al más antiguo */
export async function listEventsFor(profileId: string): Promise<(GameEvent & { races: number })[]> {
  const db = client()
  const { data: mine, error: e1 } = await db.from('event_players').select('event_id').eq('profile_id', profileId)
  if (e1) throw e1
  const ids = [...new Set((mine ?? []).map((p) => p.event_id as string))]
  let query = db.from('events').select('*, event_races(count)').order('created_at', { ascending: false }).limit(100)
  query = ids.length ? query.or(`created_by.eq.${profileId},id.in.(${ids.join(',')})`) : query.eq('created_by', profileId)
  const { data, error } = await query
  if (error) throw error
  return (data ?? []).map((e) => {
    const { event_races, ...rest } = e as GameEvent & { event_races: { count: number }[] }
    return { ...rest, races: event_races?.[0]?.count ?? 0 }
  })
}

export type PlayerResult = { kind: EventKind; event_id: string; track_id: string; position: number; racers: number | null }

/** Resultados de eventos finalizados de un jugador (para estadísticas) */
export async function getPlayerResults(profileId: string): Promise<PlayerResult[]> {
  const { data, error } = await client()
    .from('player_results')
    .select('kind, event_id, track_id, position, racers')
    .eq('profile_id', profileId)
    .limit(10000)
  if (error) throw error
  return data as PlayerResult[]
}

/** Wars de un equipo ordenadas de la más reciente a la más antigua */
export async function listTeamEvents(teamId: number): Promise<(GameEvent & { races: number })[]> {
  const db = client()
  const { data, error } = await db
    .from('events')
    .select('*, event_races(count)')
    .eq('team_id', teamId)
    .eq('kind', 'war')
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) throw error
  return (data ?? []).map((e) => {
    const { event_races, ...rest } = e as GameEvent & { event_races: { count: number }[] }
    return { ...rest, races: event_races?.[0]?.count ?? 0 }
  })
}
