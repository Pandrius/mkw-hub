/**
 * Datos del servidor para validar las recompensas del perfil (ver titles.ts): recalcula logros, insignias y datos del Lounge
 * de un usuario a partir de la base de datos, nunca de lo que mande el navegador.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { TRACKS } from '../data/tracks.js'
import { computeAchievements } from './achievements.js'
import { computeBadges } from './badges.js'
import { loadCommunity } from './communityServer.js'
import { crownFactsOf, type CrownFacts } from './crowns.js'
import { tracksLedBy } from './trackBoard.js'
import { fetchTimeline } from './timelineQuery.js'
import { featurable, loungeFactsOf, type Featurable, type TitleContext } from './titles.js'

export async function loadTitleContext(admin: SupabaseClient, profileId: string): Promise<{ ctx: TitleContext; owned: Featurable[] }> {
  // Solo cuentan los eventos verificados
  const timeline = (await fetchTimeline(admin, profileId)).filter((r) => r.verified)
  const achievements = computeAchievements(timeline, TRACKS.length)
  const badges = computeBadges(timeline, TRACKS.length)

  // Las coronas y las pistas que lidera salen de la instantánea de la comunidad; si no está disponible, no se ofrecen esos títulos
  let crowns: CrownFacts | null = null
  let led = { owned: [] as string[], weekly: [] as string[] }
  try {
    const community = await loadCommunity(admin)
    crowns = crownFactsOf(community.crowns, profileId)
    led = tracksLedBy(community.trackBoards, profileId)
  } catch (err) {
    console.error('showcase community', err)
  }

  const [acc, ch] = await Promise.all([
    admin.from('lounge_players').select('overall_rank, total_players').eq('profile_id', profileId).maybeSingle(),
    admin.from('lounge_changes').select('reason, tier, new_mmr').eq('profile_id', profileId).limit(5000),
  ])
  if (acc.error) throw new Error(acc.error.message)
  if (ch.error) throw new Error(ch.error.message)
  const rows = (ch.data ?? []) as { reason: string; tier: string | null; new_mmr: number }[]
  const lounge = loungeFactsOf(
    acc.data ? { overallRank: acc.data.overall_rank as number | null, totalPlayers: acc.data.total_players as number | null } : null,
    rows.map((r) => ({ reason: r.reason, tier: r.tier, newMmr: r.new_mmr })),
  )

  return { ctx: { achievements, badges, ownedTracks: led.owned, weeklyTracks: led.weekly, lounge, crowns }, owned: featurable(achievements, badges) }
}
