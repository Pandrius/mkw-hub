/**
 * Rankings de logros (todo el tiempo, semana y día) y récords de la comunidad, a partir de las carreras verificadas de todos los
 * jugadores. Un solo recorrido de datos para ambos. Se deja en caché unos minutos.
 */
import { createClient } from '@supabase/supabase-js'
import { TRACKS } from '../src/data/tracks.js'
import type { Community, CommunityPlayer } from '../src/lib/community.js'
import { buildBoard } from '../src/lib/communityBoard.js'
import type { TimedResult } from '../src/lib/form.js'
import { buildRecords } from '../src/lib/records.js'
import { fetchTimeline } from '../src/lib/timelineQuery.js'

/** Jugadores cuyas carreras se piden a la vez */
const BATCH = 6

export async function GET(): Promise<Response> {
  const admin = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false },
  })
  try {
    const { data, error } = await admin.rpc('verified_player_ids')
    if (error) throw new Error(error.message)
    const ids = ((data ?? []) as { profile_id: string }[]).map((r) => r.profile_id)

    const players: { id: string; timeline: TimedResult[] }[] = []
    for (let i = 0; i < ids.length; i += BATCH) {
      const chunk = await Promise.all(
        ids.slice(i, i + BATCH).map(async (id) => ({ id, timeline: (await fetchTimeline(admin, id)).filter((r) => r.verified) })),
      )
      players.push(...chunk.filter((p) => p.timeline.length > 0))
    }

    const now = new Date()
    const board = buildBoard(players, TRACKS.length, now)
    const records = buildRecords(players)

    // Solo los datos públicos de quienes salen en alguna lista
    const shown = new Set<string>()
    for (const list of Object.values(board)) for (const entries of Object.values(list)) for (const e of entries ?? []) shown.add(e.profileId)
    for (const entries of Object.values(records)) for (const e of entries) shown.add(e.profileId)
    const { data: profiles, error: profilesError } = shown.size
      ? await admin.from('profiles').select('id, username, avatar_url, country_code').in('id', [...shown])
      : { data: [], error: null }
    if (profilesError) throw new Error(profilesError.message)
    const byId: Record<string, CommunityPlayer> = {}
    for (const p of (profiles ?? []) as (CommunityPlayer & { id: string })[]) byId[p.id] = { username: p.username, avatar_url: p.avatar_url, country_code: p.country_code }

    const body: Community = { ok: true, generatedAt: now.toISOString(), players: byId, board, records }
    return Response.json(body, { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=900' } })
  } catch (err) {
    console.error('community', err)
    return Response.json({ ok: false }, { status: 500 })
  }
}
