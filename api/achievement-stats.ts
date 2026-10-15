/**
 * Contadores de cada logro de todos los jugadores con eventos verificados, para enseñar en qué % de la gente está cada uno.
 * Solo salen números sueltos, sin nombres. Se deja en caché unos minutos.
 */
import { createClient } from '@supabase/supabase-js'
import { TRACKS } from '../src/data/tracks.js'
import { computeAchievements } from '../src/lib/achievements.js'
import { buildAchievementStats } from '../src/lib/achievementStats.js'
import { fetchTimeline } from '../src/lib/timelineQuery.js'

export async function GET(): Promise<Response> {
  const admin = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false },
  })
  try {
    const { data, error } = await admin.rpc('verified_player_ids')
    if (error) throw new Error(error.message)
    const ids = ((data ?? []) as { profile_id: string }[]).map((r) => r.profile_id)
    const perPlayer = []
    for (const id of ids) {
      const timeline = (await fetchTimeline(admin, id)).filter((r) => r.verified)
      if (timeline.length > 0) perPlayer.push(computeAchievements(timeline, TRACKS.length))
    }
    return Response.json(buildAchievementStats(perPlayer), {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=900' },
    })
  } catch (err) {
    console.error('achievement stats', err)
    return Response.json({ ok: false }, { status: 500 })
  }
}
