/**
 * Cálculo de la comunidad en el servidor (rankings de logros, récords y coronas) con su instantánea en la base de datos. Lo usan
 * api/community.ts, la comprobación de insignias y títulos (showcaseServer.ts) y el cron diario.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { TRACKS } from '../data/tracks.js'
import { turnovers, type Community, type CommunityPlayer, type Turnover } from './community.js'
import { buildBoard } from './communityBoard.js'
import { buildCrowns } from './crowns.js'
import type { TimedResult } from './form.js'
import { buildRecords } from './records.js'
import { fetchTimeline } from './timelineQuery.js'
import { buildTeamTrackBoards, type TeamWarInput } from './teamTrackBoard.js'
import { buildTrackBoards } from './trackBoard.js'

/** Jugadores cuyas carreras se piden a la vez */
const BATCH = 6
/** Cuánto vale una instantánea antes de recalcularla */
export const SNAPSHOT_MAX_AGE_MS = 10 * 60_000
const SNAPSHOT_ID = 'community'

/** Eventos por consulta al pedir las carreras de las wars (las ids van en la URL) */
const WAR_CHUNK = 60

/** Wars finalizadas de equipos registrados, con las posiciones de su equipo en cada carrera, y los datos de esos equipos */
async function loadTeamWars(admin: SupabaseClient): Promise<{ wars: TeamWarInput[]; teams: Map<number, { tag: string; name: string }> }> {
  const { data: events, error } = await admin
    .from('events')
    .select('id, team_id, opponent_team_id, mirror_of')
    .eq('kind', 'war')
    .eq('status', 'finished')
    .not('team_id', 'is', null)
    .limit(10000)
  if (error) throw new Error(error.message)
  type Ev = { id: string; team_id: number; opponent_team_id: number | null; mirror_of: string | null }
  const list = (events ?? []) as Ev[]

  const races = new Map<string, TeamWarInput['races']>()
  for (let i = 0; i < list.length; i += WAR_CHUNK) {
    const { data, error: raceError } = await admin
      .from('event_races')
      .select('event_id, track_id, is_section, missing_home, missing_away, race_results(position)')
      .in('event_id', list.slice(i, i + WAR_CHUNK).map((e) => e.id))
      .limit(10000)
    if (raceError) throw new Error(raceError.message)
    for (const r of (data ?? []) as unknown as { event_id: string; track_id: string; is_section: boolean; missing_home: number; missing_away: number; race_results: { position: number }[] }[]) {
      const mine = races.get(r.event_id) ?? []
      mine.push({ trackId: r.track_id, section: r.is_section, missingHome: r.missing_home, missingAway: r.missing_away, positions: r.race_results.map((x) => x.position) })
      races.set(r.event_id, mine)
    }
  }

  const { data: teamRows, error: teamError } = await admin.from('teams').select('id, tag, name')
  if (teamError) throw new Error(teamError.message)
  const teams = new Map(((teamRows ?? []) as { id: number; tag: string; name: string }[]).map((t) => [t.id, { tag: t.tag, name: t.name }]))
  const wars = list.map((e): TeamWarInput => ({ id: e.id, teamId: e.team_id, opponentTeamId: e.opponent_team_id, mirrorOf: e.mirror_of, races: races.get(e.id) ?? [] }))
  return { wars, teams }
}

/** Recalcula todo a partir de las carreras verificadas de todos los jugadores */
export async function computeCommunity(admin: SupabaseClient, now = new Date()): Promise<Community> {
  const { data, error } = await admin.rpc('verified_player_ids')
  if (error) throw new Error(error.message)
  const ids = ((data ?? []) as { profile_id: string }[]).map((r) => r.profile_id)

  const players: { id: string; timeline: TimedResult[] }[] = []
  for (let i = 0; i < ids.length; i += BATCH) {
    const chunk = await Promise.all(ids.slice(i, i + BATCH).map(async (id) => ({ id, timeline: (await fetchTimeline(admin, id)).filter((r) => r.verified) })))
    players.push(...chunk.filter((p) => p.timeline.length > 0))
  }

  const board = buildBoard(players, TRACKS.length, now)
  const { records, history } = buildRecords(players)
  const crowns = buildCrowns(players, TRACKS.length)
  const trackBoards = buildTrackBoards(players, now)
  const teamWars = await loadTeamWars(admin)
  const teamTrackBoards = buildTeamTrackBoards(teamWars.wars, teamWars.teams)

  // Solo los datos públicos de quienes salen en alguna lista
  const shown = new Set<string>()
  for (const list of Object.values(board)) for (const entries of Object.values(list)) for (const e of entries ?? []) shown.add(e.profileId)
  for (const entries of [...Object.values(records), ...Object.values(history)]) for (const e of entries) shown.add(e.profileId)
  for (const boards of [trackBoards.all, trackBoards.week]) for (const entries of Object.values(boards)) for (const e of entries) shown.add(e.profileId)
  for (const c of Object.values(crowns)) {
    if (c.holder) shown.add(c.holder)
    for (const id of Object.keys(c.counts)) shown.add(id)
  }
  const { data: profiles, error: profilesError } = shown.size
    ? await admin.from('profiles').select('id, username, avatar_url, country_code').in('id', [...shown])
    : { data: [], error: null }
  if (profilesError) throw new Error(profilesError.message)
  const byId: Record<string, CommunityPlayer> = {}
  for (const p of (profiles ?? []) as (CommunityPlayer & { id: string })[]) byId[p.id] = { username: p.username, avatar_url: p.avatar_url, country_code: p.country_code }

  return { ok: true, generatedAt: now.toISOString(), players: byId, board, records, history, crowns, trackBoards, teamTrackBoards }
}

/** Una instantánea guardada con lo que hace falta para detectar relevos (puede ser de una versión anterior sin todos los campos) */
const isSnapshot = (v: unknown): v is Pick<Community, 'records' | 'crowns' | 'generatedAt'> => !!v && typeof v === 'object' && 'records' in v && 'crowns' in v
/** Y la que tiene todos los campos de la versión actual, para servirla tal cual */
const isCurrent = (v: unknown): v is Community => isSnapshot(v) && 'history' in v && 'board' in v && 'trackBoards' in v && 'teamTrackBoards' in v

/** Qué se guarda en el aviso de cada relevo: quién se lo ha quitado y los detalles */
function noticeRow(t: Turnover) {
  const base = { profile_id: t.profileId, kind: t.kind, dedupe: t.dedupe }
  switch (t.kind) {
    case 'record_lost':
      return { ...base, actor_id: t.to, data: { record: t.record, value: t.value } }
    case 'throne_lost':
      return { ...base, actor_id: t.to, data: null }
    case 'crown_won':
      return { ...base, actor_id: null, data: { period: t.period } }
    case 'track_won':
      return { ...base, actor_id: null, data: { track: t.track, period: t.period } }
    case 'track_lost':
      return { ...base, actor_id: t.to, data: { track: t.track, period: t.period } }
  }
}

/** Avisa a los jugadores de los relevos (un aviso por relevo: si dos servidores a la vez lo intentan, solo entra uno) */
async function notifyTurnovers(admin: SupabaseClient, list: Turnover[]): Promise<void> {
  if (list.length === 0) return
  const rows = list.map(noticeRow)
  const { error } = await admin.from('notifications').upsert(rows, { onConflict: 'profile_id,kind,dedupe', ignoreDuplicates: true })
  if (error) console.error('community notices', error.message)
}

/**
 * La comunidad, de la instantánea guardada si es reciente y, si no, recalculada y guardada. Al guardar una nueva se avisa de los
 * relevos respecto a la anterior. Con `force` se recalcula siempre (el cron diario).
 */
export async function loadCommunity(admin: SupabaseClient, options: { force?: boolean; maxAgeMs?: number } = {}): Promise<Community> {
  const { force = false, maxAgeMs = SNAPSHOT_MAX_AGE_MS } = options
  const saved = await admin.from('community_snapshots').select('payload, updated_at').eq('id', SNAPSHOT_ID).maybeSingle()
  const payload = saved.data?.payload
  const prev = isSnapshot(payload) ? payload : null
  if (isCurrent(payload) && !force && Date.now() - Date.parse(saved.data!.updated_at as string) < maxAgeMs) return payload

  const next = await computeCommunity(admin)
  const { error } = await admin.from('community_snapshots').upsert({ id: SNAPSHOT_ID, payload: next, updated_at: new Date().toISOString() })
  if (error) console.error('community snapshot', error.message)
  else await notifyTurnovers(admin, turnovers(prev, next))
  return next
}
