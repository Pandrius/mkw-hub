/**
 * Sincronización con el Lounge de MKCentral (servidor): descarga la cuenta y el historial de MMR de un usuario a partir de su
 * Discord ID y verifica sus eventos. Lo usan las funciones de Vercel (api/lounge.ts); el navegador no puede llamar al Lounge
 * directamente. Los imports llevan .js porque Vercel compila cada archivo por separado como ESM.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  eventScore,
  findTableForChange,
  LOUNGE_API,
  LOUNGE_GAME,
  LOUNGE_RACES,
  matchLoungeEvents,
  matchWars,
  parseChanges,
  TABLE_LAG_MS,
  ZONE_SLACK_MS,
  type LoungeChange,
  type LoungeTable,
  type RawChange,
} from './lounge.js'
import { POINTS } from './scoring.js'

const HEADERS = { 'User-Agent': 'MKW Hub (https://mkw-hub.vercel.app)', Accept: 'application/json' }
const TIMEOUT_MS = 15_000
/** Más allá de esta temporada la API responde 400 */
const MAX_SEASON = 12
const CHUNK = 500
const BOARD_PAGE = 100
const WAR_LOOKBACK_MS = 8 * 24 * 3_600_000

type Json = Record<string, unknown>

/** GET a la API del Lounge. null si no existe (404) o la temporada no es válida (400); lanza en otros fallos */
async function loungeGet<T = Json>(path: string): Promise<T | null> {
  const res = await fetch(LOUNGE_API + path, { headers: HEADERS, signal: AbortSignal.timeout(TIMEOUT_MS) })
  if (res.status === 404 || res.status === 400) return null
  if (!res.ok) throw new Error(`Lounge respondió ${res.status}`)
  return (await res.json()) as T
}

type PlayerDetails = {
  playerId: number
  name: string
  mkcId?: number
  countryCode?: string
  season: number
  mmr?: number
  maxMmr?: number
  overallRank?: number
  eventsPlayed?: number
  winRate?: number
  averageScore?: number
  noSQAverageScore?: number
  partnerAverage?: number
  largestGain?: number
  rank?: string
  mmrChanges?: RawChange[]
}

export type LoungeSyncResult =
  | { ok: true; linked: false; verified: { lounge: number; wars: number } }
  | { ok: true; linked: true; name: string; changes: number; verified: { lounge: number; wars: number } }

/** Cuenta del Lounge ligada a un Discord ID (null si ese Discord no está registrado) */
async function findPlayer(discordId: string): Promise<{ playerId: number; name: string } | null> {
  const p = await loungeGet<{ playerId?: number; id?: number; name: string }>(
    `player?discordId=${encodeURIComponent(discordId)}&game=${LOUNGE_GAME}`,
  )
  const id = p?.playerId ?? p?.id
  return p && id ? { playerId: id, name: p.name } : null
}

type BoardPage = { totalPlayers?: number; data?: { overallRank: number }[] }

/**
 * Puesto de un jugador entre los de su país. La API ordena por puesto global y filtra por país, pero solo da páginas de 100
 * (parámetro skip): se busca por bisección la página donde cae su puesto global.
 */
async function countryPosition(country: string, season: number, overallRank: number): Promise<{ rank: number; total: number } | null> {
  const page = (n: number) =>
    loungeGet<BoardPage>(`player/leaderboard?game=${LOUNGE_GAME}&season=${season}&pageSize=${BOARD_PAGE}&skip=${n * BOARD_PAGE}&country=${country}`)
  const first = await page(0)
  const total = first?.totalPlayers ?? 0
  if (!first?.data?.length || total === 0) return null
  let lo = 0
  let hi = Math.ceil(total / BOARD_PAGE) - 1
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2)
    const p = await page(mid)
    const firstRank = p?.data?.[0]?.overallRank
    if (firstRank === undefined) hi = mid - 1
    else if (firstRank <= overallRank) lo = mid
    else hi = mid - 1
  }
  const p = lo === 0 ? first : await page(lo)
  const idx = p?.data?.findIndex((x) => x.overallRank === overallRank) ?? -1
  return idx < 0 ? null : { rank: lo * BOARD_PAGE + idx + 1, total }
}

/** Descarga la cuenta y el historial de MMR de todas las temporadas, y los guarda */
async function syncAccount(admin: SupabaseClient, profileId: string, found: { playerId: number; name: string }): Promise<LoungeChange[]> {
  const seasons: PlayerDetails[] = []
  for (let season = 1; season <= MAX_SEASON; season++) {
    const d = await loungeGet<PlayerDetails>(`player/details?name=${encodeURIComponent(found.name)}&game=${LOUNGE_GAME}&season=${season}`)
    if (!d) {
      if (season > 1) break
      continue
    }
    seasons.push({ ...d, season })
  }
  const current = seasons.at(-1)
  if (!current) throw new Error('El Lounge no devolvió ninguna temporada')

  const board = await loungeGet<{ totalPlayers?: number }>(`player/leaderboard?game=${LOUNGE_GAME}&season=${current.season}&pageSize=1`)
  // Una misma mesa no puede salir dos veces, pero el upsert falla si lo hace: se deduplica por (motivo, id)
  const national = current.countryCode && current.overallRank ? await countryPosition(current.countryCode, current.season, current.overallRank).catch(() => null) : null
  const changes = [...new Map(seasons.flatMap((s) => parseChanges(s.mmrChanges, s.season)).map((c) => [`${c.reason}|${c.changeId}`, c])).values()].sort(
    (a, b) => a.time.localeCompare(b.time) || a.changeId - b.changeId,
  )

  const { error } = await admin.from('lounge_players').upsert({
    profile_id: profileId,
    lounge_id: current.playerId,
    mkc_id: current.mkcId ?? null,
    name: current.name,
    country_code: current.countryCode ?? null,
    season: current.season,
    mmr: current.mmr ?? null,
    max_mmr: current.maxMmr ?? null,
    overall_rank: current.overallRank ?? null,
    total_players: board?.totalPlayers ?? null,
    country_rank: national?.rank ?? null,
    country_total: national?.total ?? null,
    events_played: current.eventsPlayed ?? null,
    win_rate: current.winRate ?? null,
    average_score: current.averageScore ?? null,
    no_sq_average_score: current.noSQAverageScore ?? null,
    partner_average: current.partnerAverage ?? null,
    largest_gain: current.largestGain ?? null,
    rank_name: current.rank ?? null,
    seasons: seasons
      .filter((s) => (s.eventsPlayed ?? 0) > 0)
      .map((s) => ({
        season: s.season,
        mmr: s.mmr ?? null,
        maxMmr: s.maxMmr ?? null,
        overallRank: s.overallRank ?? null,
        eventsPlayed: s.eventsPlayed ?? null,
        winRate: s.winRate ?? null,
        averageScore: s.averageScore ?? null,
      })),
    synced_at: new Date().toISOString(),
  })
  if (error) throw new Error(error.message)

  for (let i = 0; i < changes.length; i += CHUNK) {
    const rows = changes.slice(i, i + CHUNK).map((c) => ({
      profile_id: profileId,
      change_id: c.changeId,
      season: c.season,
      time: c.time,
      new_mmr: c.newMmr,
      delta: c.delta,
      reason: c.reason,
      score: c.score,
      partner_scores: c.partnerScores,
      rank: c.rank,
      tier: c.tier,
      num_teams: c.numTeams,
      num_players: c.numPlayers,
    }))
    const { error: e } = await admin.from('lounge_changes').upsert(rows, { onConflict: 'profile_id,reason,change_id' })
    if (e) throw new Error(e.message)
  }
  return changes
}

type EventRow = {
  id: string
  kind: 'war' | 'lounge'
  created_at: string
  played_on: string | null
  lounge_change_id: number | null
  lounge_table_id: number | null
  opponent_confirmed: boolean | null
}

type RaceRow = { race_no: number; missing_home: number; missing_away: number; race_results: { player_id: number; position: number }[] }
type PlayerRow = { id: number; event_id: string; profile_id: string | null }

const chunks = <T>(xs: T[], n: number) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n))

/**
 * Verifica los eventos finalizados del usuario que aún no lo están:
 *  - Lounge: una mesa suya con la misma puntuación a la hora jugada.
 *  - War: una mesa SQ 6v6 donde uno de los equipos tiene las puntuaciones de sus 6 jugadores.
 * Devuelve cuántos eventos nuevos se han verificado.
 */
export async function verifyEvents(
  admin: SupabaseClient,
  profileId: string,
  changes: LoungeChange[],
  hasLounge: boolean,
): Promise<{ lounge: number; wars: number }> {
  const result = { lounge: 0, wars: 0 }
  const { data: mine, error: e1 } = await admin.from('event_players').select('event_id').eq('profile_id', profileId)
  if (e1) throw new Error(e1.message)
  const ids = [...new Set((mine ?? []).map((p) => p.event_id as string))]
  if (ids.length === 0) return result

  const events: EventRow[] = []
  for (const part of chunks(ids, 100)) {
    const { data, error } = await admin
      .from('events')
      .select('id, kind, created_at, played_on, lounge_change_id, lounge_table_id, opponent_confirmed')
      .in('id', part)
      .eq('status', 'finished')
    if (error) throw new Error(error.message)
    events.push(...((data ?? []) as EventRow[]))
  }
  const pending = events.filter((e) => (e.kind === 'lounge' ? hasLounge && !e.lounge_change_id : !e.lounge_table_id && !e.opponent_confirmed))
  if (pending.length === 0) return result

  const pendingIds = pending.map((e) => e.id)
  const races = new Map<string, RaceRow[]>()
  const players = new Map<string, PlayerRow[]>()
  for (const part of chunks(pendingIds, 50)) {
    const [r, p] = await Promise.all([
      admin.from('event_races').select('event_id, race_no, missing_home, missing_away, race_results(player_id, position)').in('event_id', part),
      admin.from('event_players').select('id, event_id, profile_id').in('event_id', part),
    ])
    if (r.error) throw new Error(r.error.message)
    if (p.error) throw new Error(p.error.message)
    for (const row of (r.data ?? []) as (RaceRow & { event_id: string })[]) races.set(row.event_id, [...(races.get(row.event_id) ?? []), row])
    for (const row of (p.data ?? []) as PlayerRow[]) players.set(row.event_id, [...(players.get(row.event_id) ?? []), row])
  }

  const now = new Date().toISOString()

  // Eventos Lounge: puntuación total del propio jugador
  const loungeCands = pending
    .filter((e) => e.kind === 'lounge')
    .flatMap((e) => {
      const me = players.get(e.id)?.find((p) => p.profile_id === profileId)
      const rs = [...(races.get(e.id) ?? [])].sort((a, b) => a.race_no - b.race_no)
      if (!me) return []
      const positions = rs.map((r) => r.race_results.find((x) => x.player_id === me.id)?.position)
      if (positions.length !== LOUNGE_RACES || positions.some((p) => p === undefined)) return []
      const score = eventScore(positions as number[])
      return score === null ? [] : [{ id: e.id, score, playedOn: e.played_on, createdAt: e.created_at }]
    })
  if (loungeCands.length) {
    const { data: taken } = await admin.from('events').select('lounge_change_id').not('lounge_change_id', 'is', null)
    const matches = matchLoungeEvents(
      loungeCands,
      changes,
      (taken ?? []).map((t) => t.lounge_change_id as number),
    )
    for (const [eventId, change] of matches) {
      const { error } = await admin.from('events').update({ lounge_change_id: change.changeId, lounge_tier: change.tier, verified_at: now }).eq('id', eventId).is('lounge_change_id', null)
      if (!error) result.lounge++
    }
  }

  // Wars: mesas SQ 6v6 del Lounge a esas horas
  const warCands = pending
    .filter((e) => e.kind === 'war')
    .flatMap((e) => {
      const rs = races.get(e.id) ?? []
      const roster = players.get(e.id) ?? []
      if (rs.length !== LOUNGE_RACES || roster.length !== 6) return []
      if (rs.some((r) => r.missing_home || r.missing_away || r.race_results.length !== 6)) return []
      const playerScores = roster.map((p) => rs.reduce((a, r) => a + (POINTS[(r.race_results.find((x) => x.player_id === p.id)?.position ?? 13) - 1] ?? 0), 0))
      return [{ id: e.id, playerScores, playedOn: e.played_on, createdAt: e.created_at }]
    })
  if (warCands.length) {
    const earliest = Math.min(...warCands.map((c) => Date.parse(c.playedOn ? `${c.playedOn}T00:00:00Z` : c.createdAt)))
    const from = new Date(Math.max(earliest - WAR_LOOKBACK_MS, Date.now() - 31 * 24 * 3_600_000) - ZONE_SLACK_MS - TABLE_LAG_MS).toISOString()
    const season = changes.at(-1)?.season
    const tables = await loungeGet<LoungeTable[]>(`table/list?game=${LOUNGE_GAME}${season ? `&season=${season}` : ''}&from=${encodeURIComponent(from)}`)
    const matches = matchWars(warCands, tables ?? [])
    for (const [eventId, table] of matches) {
      const { error } = await admin.from('events').update({ lounge_table_id: table.id, lounge_tier: table.tier, verified_at: now }).eq('id', eventId).is('lounge_table_id', null)
      if (!error) result.wars++
    }
  }
  return result
}

/** Solo se buscan las mesas de los últimos días: la lista del Lounge pesa mucho y no admite filtrar por jugador */
const TABLE_LINK_DAYS = 14

/**
 * Guarda la mesa del Lounge (para enseñar su imagen) de los eventos Lounge ya verificados que aún no la tienen: se busca la
 * mesa del jugador con la misma puntuación verificada a la hora del cambio de MMR.
 */
export async function linkTables(admin: SupabaseClient, profileId: string, playerId: number, changes: LoungeChange[]): Promise<number> {
  const { data: mine, error: e1 } = await admin.from('event_players').select('event_id').eq('profile_id', profileId)
  if (e1) throw new Error(e1.message)
  const ids = [...new Set((mine ?? []).map((p) => p.event_id as string))]
  const byChange = new Map(changes.filter((c) => c.reason === 'Table').map((c) => [c.changeId, c]))
  const limit = Date.now() - TABLE_LINK_DAYS * 24 * 3_600_000

  const todo: { id: string; change: LoungeChange }[] = []
  for (const part of chunks(ids, 100)) {
    const { data, error } = await admin
      .from('events')
      .select('id, lounge_change_id')
      .in('id', part)
      .eq('kind', 'lounge')
      .eq('status', 'finished')
      .is('lounge_table_id', null)
      .not('lounge_change_id', 'is', null)
    if (error) throw new Error(error.message)
    for (const e of data ?? []) {
      const change = byChange.get(e.lounge_change_id as number)
      if (change && Date.parse(change.time) >= limit) todo.push({ id: e.id as string, change })
    }
  }
  if (todo.length === 0) return 0

  const from = new Date(Math.min(...todo.map((x) => Date.parse(x.change.time))) - 2 * 3_600_000).toISOString()
  const season = changes.at(-1)?.season
  const tables = await loungeGet<LoungeTable[]>(`table/list?game=${LOUNGE_GAME}${season ? `&season=${season}` : ''}&from=${encodeURIComponent(from)}`)
  let linked = 0
  for (const { id, change } of todo) {
    const table = findTableForChange(change, playerId, tables ?? [])
    if (!table) continue
    const { error } = await admin.from('events').update({ lounge_table_id: table.id }).eq('id', id).is('lounge_table_id', null)
    if (!error) linked++
  }
  return linked
}

/** Minutos mínimos entre dos descargas del Lounge del mismo usuario */
export const LOUNGE_RESYNC_MS = 60_000

/** Sincroniza la cuenta del Lounge de un usuario (por su Discord ID verificado) y verifica sus eventos */
export async function syncLounge(admin: SupabaseClient, profileId: string, discordId: string): Promise<LoungeSyncResult> {
  const found = await findPlayer(discordId)
  if (!found) {
    // Sin cuenta en el Lounge solo se pueden verificar wars; las mesas guardadas de una cuenta anterior se quitan
    await admin.from('lounge_players').delete().eq('profile_id', profileId)
    await admin.from('lounge_changes').delete().eq('profile_id', profileId)
    return { ok: true, linked: false, verified: await verifyEvents(admin, profileId, [], false) }
  }
  const changes = await syncAccount(admin, profileId, found)
  const verified = await verifyEvents(admin, profileId, changes, true)
  // La imagen de la mesa es un extra: si falla, la verificación ya hecha se conserva
  await linkTables(admin, profileId, found.playerId, changes).catch((err) => console.error('link tables', err))
  return { ok: true, linked: true, name: found.name, changes: changes.length, verified }
}

/** Eventos de los últimos días que se siguen buscando en el Lounge (más allá, se da por no verificable) */
const PENDING_DAYS = 30

/**
 * Reintenta la verificación de los eventos que quedaron pendientes (la mesa del Lounge tarda en verificarse y puede aparecer
 * después de subir el evento). Lo llama el cron diario. Procesa como mucho `maxUsers` creadores y para al llegar a `budgetMs`.
 */
export async function reverifyPending(
  admin: SupabaseClient,
  opts: { maxUsers?: number; budgetMs?: number } = {},
): Promise<{ users: number; lounge: number; wars: number; errors: number }> {
  const { maxUsers = 25, budgetMs = 40_000 } = opts
  const started = Date.now()
  const out = { users: 0, lounge: 0, wars: 0, errors: 0 }
  const since = new Date(Date.now() - PENDING_DAYS * 24 * 3_600_000).toISOString()
  const { data, error } = await admin
    .from('events')
    .select('created_by')
    .eq('status', 'finished')
    .gte('created_at', since)
    .or('and(kind.eq.lounge,lounge_change_id.is.null),and(kind.eq.lounge,lounge_table_id.is.null),and(kind.eq.war,lounge_table_id.is.null,opponent_confirmed.is.null)')
    .limit(2000)
  if (error) throw new Error(error.message)
  const creators = [...new Set((data ?? []).map((e) => e.created_by as string))].slice(0, maxUsers)

  for (const id of creators) {
    if (Date.now() - started > budgetMs) break
    try {
      const { data: auth } = await admin.auth.admin.getUserById(id)
      const identity = auth.user?.identities?.find((i) => i.provider === 'discord')
      const discordId = (identity?.identity_data?.provider_id as string | undefined) || (identity?.identity_data?.sub as string | undefined)
      if (!discordId) continue
      const r = await syncLounge(admin, id, discordId)
      out.users++
      out.lounge += r.verified.lounge
      out.wars += r.verified.wars
    } catch (err) {
      console.error('reverify', id, err)
      out.errors++
    }
  }
  return out
}
