import type { LoungeChange } from './lounge'
import { supabase } from './supabase'

export type LoungeSeason = {
  season: number
  mmr: number | null
  maxMmr: number | null
  overallRank: number | null
  eventsPlayed: number | null
  winRate: number | null
  averageScore: number | null
}

/** Cuenta del Lounge enlazada a un usuario (temporada actual + resumen de las anteriores) */
export type LoungeAccount = {
  name: string
  countryCode: string | null
  season: number
  mmr: number | null
  maxMmr: number | null
  overallRank: number | null
  totalPlayers: number | null
  /** Puesto entre los jugadores de su país */
  countryRank: number | null
  countryTotal: number | null
  eventsPlayed: number | null
  winRate: number | null
  rankName: string | null
  seasons: LoungeSeason[]
  syncedAt: string
}

export type LoungeData = { account: LoungeAccount; changes: LoungeChange[] }

type AccountRow = {
  name: string
  country_code: string | null
  season: number
  mmr: number | null
  max_mmr: number | null
  overall_rank: number | null
  total_players: number | null
  country_rank: number | null
  country_total: number | null
  events_played: number | null
  win_rate: number | null
  rank_name: string | null
  seasons: LoungeSeason[]
  synced_at: string
}

type ChangeRow = {
  change_id: number
  season: number
  time: string
  new_mmr: number
  delta: number
  reason: string
  score: number | null
  partner_scores: number[]
  partner_ids: number[]
  partner_mmrs: (number | null)[]
  rank: number | null
  tier: string | null
  num_teams: number | null
  num_players: number | null
}

/** Cuenta del Lounge y historial de MMR de un jugador, o null si no tiene el Lounge enlazado */
export async function getLoungeData(profileId: string): Promise<LoungeData | null> {
  if (!supabase) return null
  const [acc, ch] = await Promise.all([
    supabase.from('lounge_players').select('*').eq('profile_id', profileId).maybeSingle(),
    supabase.from('lounge_changes').select('*').eq('profile_id', profileId).order('time').limit(5000),
  ])
  if (acc.error) throw acc.error
  if (ch.error) throw ch.error
  const a = acc.data as AccountRow | null
  if (!a) return null
  return {
    account: {
      name: a.name,
      countryCode: a.country_code,
      season: a.season,
      mmr: a.mmr,
      maxMmr: a.max_mmr,
      overallRank: a.overall_rank,
      totalPlayers: a.total_players,
      countryRank: a.country_rank,
      countryTotal: a.country_total,
      eventsPlayed: a.events_played,
      winRate: a.win_rate,
      rankName: a.rank_name,
      seasons: a.seasons ?? [],
      syncedAt: a.synced_at,
    },
    changes: ((ch.data ?? []) as ChangeRow[]).map((c) => ({
      changeId: c.change_id,
      season: c.season,
      time: c.time,
      newMmr: c.new_mmr,
      delta: c.delta,
      reason: c.reason,
      score: c.score,
      partnerScores: c.partner_scores ?? [],
      partnerIds: c.partner_ids ?? [],
      partnerMmrs: c.partner_mmrs ?? [],
      rank: c.rank,
      tier: c.tier,
      numTeams: c.num_teams,
      numPlayers: c.num_players,
    })),
  }
}

export type LoungeSyncReply = { ok: boolean; skipped?: string; linked?: boolean; verified?: { lounge: number; wars: number } }

/**
 * Pide al servidor que descargue el Lounge del usuario y verifique sus eventos. Nunca lanza: devuelve null si no hay sesión
 * o el servidor falla (los datos que ya hubiera guardados se siguen mostrando).
 */
export async function requestLoungeSync(): Promise<LoungeSyncReply | null> {
  if (!supabase) return null
  try {
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    if (!token) return null
    const res = await fetch('/api/lounge', { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
    return res.ok ? ((await res.json()) as LoungeSyncReply) : null
  } catch {
    return null
  }
}
