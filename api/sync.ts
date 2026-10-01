/**
 * Sincronización periódica (cron diario de Vercel, ver vercel.json).
 *
 * - Récords mundiales de las 40 pistas desde mkwrs.com.
 * - Equipos de Mario Kart World desde Mario Kart Central (MKC).
 * - Comprobación y sincronización de rosters de los usuarios registrados contra MKC (1 vez al día).
 * - Mantiene el proyecto de Supabase activo escribiendo cada día.
 *
 * Los imports llevan .js porque Vercel compila cada archivo por separado como ESM.
 * Protegida con CRON_SECRET de Vercel o token de administrador/moderador.
 */
import { createClient } from '@supabase/supabase-js'
import { MKWRS_CSV_URL, parseWorldRecords } from '../src/lib/mkwrs.js'
import { syncAllRegisteredUsersMkc } from '../src/lib/mkc.js'

const CHUNK_SIZE = 500

export async function GET(request: Request): Promise<Response> {
  const authHeader = request.headers.get('authorization')?.replace(/^Bearer /, '')
  const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false },
  })

  let isAuthorized = authHeader === process.env.CRON_SECRET
  if (!isAuthorized && authHeader) {
    const { data: authUser } = await supabase.auth.getUser(authHeader)
    if (authUser?.user) {
      const { data: prof } = await supabase.from('profiles').select('role').eq('id', authUser.user.id).maybeSingle()
      if (prof?.role === 'admin' || prof?.role === 'moderator') {
        isAuthorized = true
      }
    }
  }

  if (!isAuthorized) {
    return new Response('Unauthorized', { status: 401 })
  }

  const startedAt = new Date().toISOString()
  const res = await fetch(MKWRS_CSV_URL, { headers: { 'User-Agent': 'MKW Hub (https://mkw-hub.vercel.app)' } })
  if (!res.ok) return Response.json({ ok: false, error: `mkwrs respondió ${res.status}` }, { status: 502 })

  const records = parseWorldRecords(await res.text())
  // Si el CSV viene vacío o roto, no se toca nada para no borrar los récords
  if (records.length < 100) {
    return Response.json({ ok: false, error: `CSV sospechoso: solo ${records.length} récords` }, { status: 502 })
  }

  for (let i = 0; i < records.length; i += CHUNK_SIZE) {
    const chunk = records.slice(i, i + CHUNK_SIZE).map((r) => ({ ...r, synced_at: startedAt }))
    const { error } = await supabase.from('world_records').upsert(chunk, { onConflict: 'id' })
    if (error) return Response.json({ ok: false, error: error.message }, { status: 500 })
  }

  // Borra los que mkwrs haya eliminado (no se han tocado en esta sincronización)
  const { error: delError, count } = await supabase
    .from('world_records')
    .delete({ count: 'exact' })
    .lt('synced_at', startedAt)
  if (delError) return Response.json({ ok: false, error: delError.message }, { status: 500 })

  const tracks = new Set(records.map((r) => r.track_id)).size

  // Sincroniza equipos de Mario Kart World desde Mario Kart Central (MKC)
  let mkcTeamsCount = 0
  try {
    const allMap = new Map<
      number,
      {
        id: number
        name: string
        tag: string
        color: number | null
        parent_team_id: number | null
        parent_name: string | null
        logo_url: string | null
        updated_at: string
      }
    >()
    let page = 1
    let pageCount = 1
    while (page <= pageCount) {
      const mkcRes = await fetch(`https://mkcentral.com/api/registry/teams?game=mkworld&page=${page}`, {
        headers: { 'User-Agent': 'MKW Hub (https://mkw-hub.vercel.app)' },
      })
      if (!mkcRes.ok) break
      const data = (await mkcRes.json()) as {
        page_count?: number
        teams?: {
          id: number
          name: string
          tag: string
          color?: number | null
          logo?: string | null
          rosters?: {
            id: number
            name?: string
            tag?: string
            color?: number | null
            game: string
          }[]
        }[]
      }
      pageCount = data.page_count || 1
      for (const t of data.teams ?? []) {
        const logoUrl = t.logo
          ? t.logo.startsWith('http')
            ? t.logo
            : `https://mkcentral.com${t.logo.startsWith('/') ? '' : '/'}${t.logo}`
          : `https://mkcentral.com/img/team_logos/${t.id}.png`

        const mkworldRosters = (t.rosters ?? []).filter((r) => r.game === 'mkworld')
        if (mkworldRosters.length > 0) {
          for (const r of mkworldRosters) {
            allMap.set(r.id, {
              id: r.id,
              name: r.name || t.name,
              tag: r.tag || t.tag || '',
              color: r.color ?? t.color ?? null,
              parent_team_id: t.id,
              parent_name: t.name,
              logo_url: logoUrl,
              updated_at: startedAt,
            })
          }
        } else {
          allMap.set(t.id, {
            id: t.id,
            name: t.name,
            tag: t.tag || '',
            color: t.color ?? null,
            parent_team_id: t.id,
            parent_name: t.name,
            logo_url: logoUrl,
            updated_at: startedAt,
          })
        }
      }
      page++
    }

    const teams = Array.from(allMap.values())
    if (teams.length > 0) {
      for (let i = 0; i < teams.length; i += CHUNK_SIZE) {
        await supabase.from('teams').upsert(teams.slice(i, i + CHUNK_SIZE), { onConflict: 'id' })
      }
      // Borra equipos que ya no pertenezcan a mkworld
      await supabase.from('teams').delete().lt('updated_at', startedAt)
      mkcTeamsCount = teams.length
    }
  } catch (err) {
    console.error('Error sincronizando equipos de MKC:', err)
  }

  // Comprueba que los jugadores registrados estén en el equipo que les corresponde en MKC
  // y actualiza cualquier cambio en los rosters
  let userRosterStats = { checked: 0, updated: 0, errors: 0 }
  try {
    userRosterStats = await syncAllRegisteredUsersMkc(supabase, {
      olderThanHours: 24,
      maxUsers: 100,
      delayMs: 100,
    })
  } catch (err) {
    console.error('Error verificando rosters de usuarios:', err)
  }

  return Response.json({
    ok: true,
    syncedAt: startedAt,
    worldRecords: records.length,
    tracks,
    removed: count ?? 0,
    mkcTeams: mkcTeamsCount,
    usersChecked: userRosterStats.checked,
    usersUpdated: userRosterStats.updated,
    userErrors: userRosterStats.errors,
  })
}
