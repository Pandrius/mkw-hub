import { supabase } from './supabase'
import type { TtCategory } from './timeTrials'

/** Algo que se puede comparar: un jugador o un equipo (el mejor tiempo de sus miembros) */
export type Entity =
  | { kind: 'player'; id: string; name: string; country: string | null; avatar: string | null }
  | {
      kind: 'team'
      id: number
      name: string
      tag: string
      memberIds: string[]
      parent_team_id?: number | null
      parent_name?: string | null
      logo_url?: string | null
    }

export const entityKey = (e: Entity) => `${e.kind}:${e.id}`

export type BestTime = { profile_id: string; track_id: string; time_ms: number; achieved_on: string | null; proof_url: string | null }

export type Cell = {
  time_ms: number
  profileId: string
  proof_url?: string | null
  achieved_on?: string | null
} | null

export type CompareRow = {
  trackId: string
  cells: Cell[]
  /** Índice de la entidad más rápida en esta pista (null si nadie tiene tiempo) */
  fastest: number | null
}

/** Paleta para distinguir cada columna de la comparación */
export const ENTITY_COLORS = ['#ffd500', '#28d7f5', '#ff4fa3', '#19c15a', '#ff8a1f', '#a98bff', '#f4f2ec', '#ff5a4f', '#f97316', '#06b6d4', '#84cc16', '#ec4899']

function client() {
  if (!supabase) throw new Error('Supabase no está configurado')
  return supabase
}

/** Tabla de comparación: una fila por pista, una columna por entidad. Función pura. */
export function buildComparison(trackIds: string[], entities: Entity[], times: BestTime[]): CompareRow[] {
  const byProfileTrack = new Map<string, BestTime>()
  for (const t of times) byProfileTrack.set(`${t.profile_id}|${t.track_id}`, t)

  const membersOf = (e: Entity) => (e.kind === 'player' ? [e.id] : e.memberIds)

  return trackIds.map((trackId) => {
    const cells: Cell[] = entities.map((e) => {
      let best: Cell = null
      for (const pid of membersOf(e)) {
        const t = byProfileTrack.get(`${pid}|${trackId}`)
        if (t && (!best || t.time_ms < best.time_ms)) {
          best = { time_ms: t.time_ms, profileId: pid, proof_url: t.proof_url, achieved_on: t.achieved_on }
        }
      }
      return best
    })
    let fastest: number | null = null
    cells.forEach((c, i) => {
      if (c && (fastest === null || c.time_ms < cells[fastest]!.time_ms)) fastest = i
    })
    return { trackId, cells, fastest }
  })
}

/** Resumen por entidad: pistas con tiempo y "victorias" (pistas donde es la más rápida) */
export function summarize(rows: CompareRow[], entityCount: number): { tracks: number; wins: number }[] {
  return Array.from({ length: entityCount }, (_, i) => ({
    tracks: rows.filter((r) => r.cells[i]).length,
    wins: entityCount > 1 ? rows.filter((r) => r.fastest === i).length : 0,
  }))
}

export async function searchEntities(query: string): Promise<Entity[]> {
  const q = query.trim()
  if (q.length < 2) return []
  const db = client()
  const pattern = `%${q.replace(/[%_]/g, '')}%`
  const [players, teams] = await Promise.all([
    db.from('profiles').select('id, username, country_code, avatar_url').ilike('username', pattern).limit(8),
    db
      .from('teams')
      .select('id, name, tag, parent_team_id, parent_name, logo_url, team_members(profile_id)')
      .or(`name.ilike.${pattern},tag.ilike.${pattern},parent_name.ilike.${pattern}`)
      .limit(8),
  ])
  return [
    ...(players.data ?? []).map(
      (p): Entity => ({ kind: 'player', id: p.id, name: p.username, country: p.country_code, avatar: p.avatar_url }),
    ),
    ...(teams.data ?? []).map(
      (t): Entity => ({
        kind: 'team',
        id: t.id,
        name: t.name,
        tag: t.tag,
        parent_team_id: (t as any).parent_team_id,
        parent_name: (t as any).parent_name,
        logo_url: (t as any).logo_url,
        memberIds: ((t.team_members as { profile_id: string }[] | null) ?? []).map((m) => m.profile_id),
      }),
    ),
  ]
}

/** Reconstruye las entidades a partir de claves "player:<uuid>" / "team:<id>" (p. ej. de la URL) */
export async function resolveEntities(keys: string[]): Promise<Entity[]> {
  const playerIds = keys.filter((k) => k.startsWith('player:')).map((k) => k.slice(7))
  const teamIds = keys.filter((k) => k.startsWith('team:')).map((k) => Number(k.slice(5))).filter(Number.isInteger)
  const db = client()
  const [players, teams] = await Promise.all([
    playerIds.length
      ? db.from('profiles').select('id, username, country_code, avatar_url').in('id', playerIds)
      : Promise.resolve({ data: [] as { id: string; username: string; country_code: string | null; avatar_url: string | null }[] }),
    teamIds.length
      ? db.from('teams').select('id, name, tag, team_members(profile_id)').in('id', teamIds)
      : Promise.resolve({ data: [] as { id: number; name: string; tag: string; team_members: { profile_id: string }[] }[] }),
  ])
  const found = new Map<string, Entity>()
  for (const p of players.data ?? [])
    found.set(`player:${p.id}`, { kind: 'player', id: p.id, name: p.username, country: p.country_code, avatar: p.avatar_url })
  for (const t of teams.data ?? [])
    found.set(`team:${t.id}`, {
      kind: 'team',
      id: t.id,
      name: t.name,
      tag: t.tag,
      memberIds: ((t.team_members as { profile_id: string }[] | null) ?? []).map((m) => m.profile_id),
    })
  // Mantiene el orden de las claves
  return keys.flatMap((k) => (found.has(k) ? [found.get(k)!] : []))
}

/** Equipos de un jugador (para sugerirlos en el comparador) */
export async function teamsOf(profileId: string): Promise<Entity[]> {
  const { data } = await client()
    .from('team_members')
    .select('teams(id, name, tag, team_members(profile_id))')
    .eq('profile_id', profileId)
  return (data ?? []).flatMap((row) => {
    const t = row.teams as unknown as { id: number; name: string; tag: string; team_members: { profile_id: string }[] } | null
    return t
      ? [{ kind: 'team' as const, id: t.id, name: t.name, tag: t.tag, memberIds: (t.team_members ?? []).map((m) => m.profile_id) }]
      : []
  })
}

/** Obtiene los equipos a los que pertenecen los perfiles dados (para mostrar tags de equipo) */
export async function getProfileTeams(
  profileIds: string[],
): Promise<Map<string, { id: number; tag: string; name: string }[]>> {
  if (profileIds.length === 0) return new Map()
  const { data } = await client()
    .from('team_members')
    .select('profile_id, teams(id, tag, name)')
    .in('profile_id', profileIds)
  const map = new Map<string, { id: number; tag: string; name: string }[]>()
  for (const row of data ?? []) {
    const pid = row.profile_id as string
    const team = row.teams as unknown as { id: number; tag: string; name: string } | null
    if (!team) continue
    const list = map.get(pid) ?? []
    list.push(team)
    map.set(pid, list)
  }
  return map
}

export type TeamWithMembers = {
  id: number
  name: string
  tag: string
  color: number | null
  parent_team_id?: number | null
  parent_name?: string | null
  logo_url?: string | null
  members: { id: string; username: string; avatar_url: string | null; country_code: string | null }[]
}

/** Lista todos los equipos y sus miembros registrados en la web */
export async function getAllTeams(): Promise<TeamWithMembers[]> {
  const { data, error } = await client()
    .from('teams')
    .select('id, name, tag, color, parent_team_id, parent_name, logo_url, team_members(profile_id, profiles(id, username, avatar_url, country_code))')
    .order('name', { ascending: true })
  if (error) throw error
  const list = (data ?? []).map((t) => {
    const rawMembers =
      (t.team_members as unknown as {
        profile_id: string
        profiles: { id: string; username: string; avatar_url: string | null; country_code: string | null } | null
      }[]) ?? []
    const members = rawMembers.map((m) => m.profiles).filter(Boolean) as {
      id: string
      username: string
      avatar_url: string | null
      country_code: string | null
    }[]
    return {
      id: t.id as number,
      name: t.name as string,
      tag: t.tag as string,
      color: t.color as number | null,
      parent_team_id: (t as any).parent_team_id ?? null,
      parent_name: (t as any).parent_name ?? null,
      logo_url: (t as any).logo_url ?? null,
      members,
    }
  })
  return list.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
}

export async function getBestTimes(profileIds: string[], category: TtCategory, nita: boolean): Promise<BestTime[]> {
  if (profileIds.length === 0) return []
  const { data, error } = await client()
    .from('player_best_times')
    .select('profile_id, track_id, time_ms, achieved_on, proof_url')
    .in('profile_id', profileIds)
    .eq('category', category)
    .eq('nita', nita)
  if (error) throw error
  return data as BestTime[]
}

/** Nombres de los jugadores (para mostrar quién hizo el tiempo de un equipo) */
export async function getProfileNames(ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map()
  const { data } = await client().from('profiles').select('id, username').in('id', ids)
  return new Map((data ?? []).map((p) => [p.id as string, p.username as string]))
}
