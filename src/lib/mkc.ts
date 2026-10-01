import type { SupabaseClient } from '@supabase/supabase-js'

export const MKC_REGISTRY_BASE = 'https://mkcentral.com/api/registry'

export type MkcRoster = {
  roster_id?: number
  roster_name?: string
  roster_tag?: string
  team_id: number
  team_name: string
  team_tag: string
  team_color?: number
  game: string
}

export type PlayerRosterResult = {
  ok: boolean
  mkcPlayer: number | null
  teams: string[]
  country?: string | null
  error?: string
}

/**
 * Sincroniza un jugador con Mario Kart Central usando su mkc_player_id o discord_id:
 * 1. Busca el perfil del jugador en MKC.
 * 2. Extrae sus rosters de Mario Kart World (game === 'mkworld').
 * 3. Actualiza la tabla teams (upsert de los equipos/rosters encontrados con su club padre).
 * 4. Actualiza team_members (elimina equipos antiguos y añade los actuales).
 * 5. Actualiza profiles (mkc_player_id, country_code, mkc_synced_at).
 */
export async function syncPlayerRoster(
  admin: SupabaseClient,
  user: { id: string; discord_id: string | null; mkc_player_id: number | null }
): Promise<PlayerRosterResult> {
  const headers = { 'User-Agent': 'MKW Hub (https://mkw-hub.vercel.app)' }
  const now = new Date().toISOString()

  let playerId = user.mkc_player_id
  let countryCode: string | null = null

  // 1. Si no hay mkc_player_id conocido, buscar en MKC mediante discord_id
  if (!playerId) {
    if (!user.discord_id) {
      await admin.from('profiles').update({ mkc_synced_at: now }).eq('id', user.id)
      return { ok: true, mkcPlayer: null, teams: [] }
    }

    try {
      const searchRes = await fetch(`${MKC_REGISTRY_BASE}/players?discord_id=${encodeURIComponent(user.discord_id)}`, {
        headers,
      })
      if (!searchRes.ok) {
        return { ok: false, mkcPlayer: null, teams: [], error: `MKC search HTTP ${searchRes.status}` }
      }
      const searchData = (await searchRes.json()) as {
        player_list?: { id: number; country_code?: string | null }[]
      }
      const player = searchData.player_list?.[0]
      if (!player) {
        // El usuario no tiene cuenta de MKC vinculada a este Discord
        await admin.from('profiles').update({ mkc_synced_at: now }).eq('id', user.id)
        return { ok: true, mkcPlayer: null, teams: [] }
      }
      playerId = player.id
      countryCode = player.country_code ?? null
    } catch (err) {
      return { ok: false, mkcPlayer: null, teams: [], error: String(err) }
    }
  }

  // 2. Obtener el detalle del jugador con sus rosters oficiales de MKC
  let rosters: MkcRoster[] = []
  try {
    const detailRes = await fetch(`${MKC_REGISTRY_BASE}/players/${playerId}`, { headers })
    if (!detailRes.ok) {
      return { ok: false, mkcPlayer: playerId, teams: [], error: `MKC detail HTTP ${detailRes.status}` }
    }
    const detailData = (await detailRes.json()) as {
      country_code?: string | null
      rosters?: MkcRoster[]
    }
    countryCode = detailData.country_code ?? countryCode
    rosters = (detailData.rosters ?? []).filter((r) => r.game === 'mkworld')
  } catch (err) {
    return { ok: false, mkcPlayer: playerId, teams: [], error: String(err) }
  }

  // 3. Mapear rosters únicos de Mario Kart World (incluyendo sub-equipos del mismo club)
  const uniqueRosters = [...new Map(rosters.map((r) => [r.roster_id || r.team_id, r])).values()]
  const rosterIds = uniqueRosters.map((r) => r.roster_id || r.team_id)

  // Consulta los equipos existentes en DB para no sobreescribir sus logos oficiales si ya los tienen
  const { data: existingRows } = await admin.from('teams').select('id, logo_url').in('id', rosterIds)
  const existingLogoMap = new Map((existingRows ?? []).map((t) => [t.id, t.logo_url as string | null]))

  const teams = uniqueRosters.map((r) => {
    const rosterId = r.roster_id || r.team_id
    const existingLogo = existingLogoMap.get(rosterId)
    const logoUrl = existingLogo !== undefined ? existingLogo : null
    return {
      id: rosterId,
      name: r.roster_name || r.team_name,
      tag: r.roster_tag || r.team_tag,
      color: r.team_color ?? null,
      parent_team_id: r.team_id,
      parent_name: r.team_name,
      logo_url: logoUrl,
      updated_at: now,
    }
  })

  if (teams.length > 0) {
    const { error: upsertErr } = await admin.from('teams').upsert(teams, { onConflict: 'id' })
    if (upsertErr) {
      console.error('Error haciendo upsert de equipos desde MKC:', upsertErr)
    }
  }

  // 4. Actualizar miembros del equipo para este usuario
  // Elimina cualquier afiliación previa y añade la lista actual de MKC
  const { error: delErr } = await admin.from('team_members').delete().eq('profile_id', user.id)
  if (delErr) {
    console.error('Error eliminando team_members antiguos:', delErr)
  }

  if (teams.length > 0) {
    const { error: insertErr } = await admin
      .from('team_members')
      .insert(teams.map((t) => ({ team_id: t.id, profile_id: user.id })))
    if (insertErr) {
      console.error('Error insertando nuevos team_members:', insertErr)
    }
  }

  // 5. Actualizar el perfil del usuario con país, player_id y timestamp
  const country = countryCode?.toUpperCase()
  const validCountry = country && /^[A-Z]{2}$/.test(country) ? country : null

  await admin
    .from('profiles')
    .update({
      mkc_player_id: playerId,
      country_code: validCountry,
      mkc_synced_at: now,
    })
    .eq('id', user.id)

  return {
    ok: true,
    mkcPlayer: playerId,
    teams: teams.map((t) => t.tag),
    country: validCountry,
  }
}

/**
 * Comprueba periódicamente (1 vez al día o cada 2 días) los rosters de los usuarios registrados.
 * Consulta los usuarios cuya última sincronización sea anterior a `olderThanHours` horas o null.
 */
export async function syncAllRegisteredUsersMkc(
  admin: SupabaseClient,
  options?: { olderThanHours?: number; maxUsers?: number; delayMs?: number }
): Promise<{ checked: number; updated: number; errors: number }> {
  const olderThanHours = options?.olderThanHours ?? 24
  const maxUsers = options?.maxUsers ?? 100
  const delayMs = options?.delayMs ?? 100
  const cutoff = new Date(Date.now() - olderThanHours * 60 * 60 * 1000).toISOString()

  const { data: users, error } = await admin
    .from('profiles')
    .select('id, discord_id, mkc_player_id, mkc_synced_at')
    .or(`mkc_synced_at.is.null,mkc_synced_at.lt.${cutoff}`)
    .order('mkc_synced_at', { ascending: true, nullsFirst: true })
    .limit(maxUsers)

  if (error || !users || users.length === 0) {
    return { checked: 0, updated: 0, errors: 0 }
  }

  let checked = 0
  let updated = 0
  let errors = 0

  for (const user of users) {
    try {
      checked++
      const res = await syncPlayerRoster(admin, user)
      if (res.ok) {
        updated++
      } else {
        errors++
      }
    } catch (err) {
      console.error(`Error sincronizando usuario ${user.id} con MKC:`, err)
      errors++
    }

    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
  }

  return { checked, updated, errors }
}
