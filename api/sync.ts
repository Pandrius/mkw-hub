/**
 * Sincronización diaria (cron de Vercel, ver vercel.json).
 *
 * - Récords mundiales de las 40 pistas desde mkwrs.com (la web del canal @MKWorldRecords).
 * - Al escribir cada día en la base de datos, evita que Supabase pause el proyecto.
 *
 * Los imports llevan .js porque Vercel compila cada archivo por separado como ESM.
 * Protegida con CRON_SECRET: Vercel la envía automáticamente en la cabecera Authorization.
 */
import { createClient } from '@supabase/supabase-js'
import { MKWRS_CSV_URL, parseWorldRecords } from '../src/lib/mkwrs.js'

const CHUNK_SIZE = 500

export async function GET(request: Request): Promise<Response> {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false },
  })

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

  // Sincroniza equipos de Mario Kart World y Mario Kart Wii desde Mario Kart Central (MKC)
  let mkcTeamsCount = 0
  try {
    const games = ['mkworld', 'mkw']
    const allMap = new Map<number, { id: number; name: string; tag: string; color: number | null; updated_at: string }>()
    for (const g of games) {
      let page = 1
      let pageCount = 1
      while (page <= pageCount) {
        const mkcRes = await fetch(`https://mkcentral.com/api/registry/teams?game=${g}&page=${page}`, {
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
            rosters?: { tag?: string; roster_tag?: string }[]
          }[]
        }
        pageCount = data.page_count || 1
        for (const t of data.teams ?? []) {
          const tag = t.rosters?.[0]?.roster_tag || t.rosters?.[0]?.tag || t.tag || ''
          if (!allMap.has(t.id)) {
            allMap.set(t.id, {
              id: t.id,
              name: t.name,
              tag,
              color: t.color ?? null,
              updated_at: startedAt,
            })
          }
        }
        page++
      }
    }

    const teams = Array.from(allMap.values())
    if (teams.length > 0) {
      for (let i = 0; i < teams.length; i += CHUNK_SIZE) {
        await supabase.from('teams').upsert(teams.slice(i, i + CHUNK_SIZE), { onConflict: 'id' })
      }
      mkcTeamsCount = teams.length
    }
  } catch (err) {
    console.error('Error sincronizando equipos de MKC:', err)
  }

  return Response.json({
    ok: true,
    syncedAt: startedAt,
    worldRecords: records.length,
    tracks,
    removed: count ?? 0,
    mkcTeams: mkcTeamsCount,
  })
}
