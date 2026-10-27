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

/** Jugadores cuyas carreras se piden a la vez */
const BATCH = 6
/** Cuánto vale una instantánea antes de recalcularla */
export const SNAPSHOT_MAX_AGE_MS = 10 * 60_000
const SNAPSHOT_ID = 'community'

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

  // Solo los datos públicos de quienes salen en alguna lista
  const shown = new Set<string>()
  for (const list of Object.values(board)) for (const entries of Object.values(list)) for (const e of entries ?? []) shown.add(e.profileId)
  for (const entries of [...Object.values(records), ...Object.values(history)]) for (const e of entries) shown.add(e.profileId)
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

  return { ok: true, generatedAt: now.toISOString(), players: byId, board, records, history, crowns }
}

const isCommunity = (v: unknown): v is Community => !!v && typeof v === 'object' && 'records' in v && 'crowns' in v && 'history' in v && 'board' in v

/** Avisa a quien ha perdido un récord o el trono (un aviso por relevo: si dos servidores a la vez lo intentan, solo entra uno) */
async function notifyTurnovers(admin: SupabaseClient, list: Turnover[]): Promise<void> {
  if (list.length === 0) return
  const rows = list.map((t) => ({
    profile_id: t.profileId,
    kind: t.kind,
    actor_id: t.to,
    dedupe: t.dedupe,
    data: t.kind === 'record_lost' ? { record: t.record, value: t.value } : null,
  }))
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
  const prev = isCommunity(saved.data?.payload) ? saved.data.payload : null
  if (prev && !force && Date.now() - Date.parse(saved.data!.updated_at as string) < maxAgeMs) return prev

  const next = await computeCommunity(admin)
  const { error } = await admin.from('community_snapshots').upsert({ id: SNAPSHOT_ID, payload: next, updated_at: new Date().toISOString() })
  if (error) console.error('community snapshot', error.message)
  else await notifyTurnovers(admin, turnovers(prev, next))
  return next
}
