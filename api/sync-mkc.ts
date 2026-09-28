/**
 * Sincronización diaria con Mario Kart Central (cron de Vercel, ver vercel.json).
 *
 * - Copia el top 10 de contrarreloj (carrera completa, con items) de cada pista.
 * - Al escribir en la base de datos cada día, evita que Supabase pause el proyecto.
 *
 * Los imports llevan .js porque Vercel compila cada archivo por separado como ESM.
 *
 * Protegida con CRON_SECRET: Vercel la envía automáticamente en la cabecera Authorization.
 */
import { createClient } from '@supabase/supabase-js'
import { TRACKS } from '../src/data/tracks.js'
import { bestProof, MKC_API, pickTop, type MkcTimeTrial } from '../src/lib/mkc.js'

const TOP_N = 10
const BATCH_SIZE = 8

export async function GET(request: Request): Promise<Response> {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false },
  })

  const syncTrack = async (trackId: string, abbr: string): Promise<number> => {
    const res = await fetch(`${MKC_API}/time-trials/leaderboard?game=mkworld&track=${encodeURIComponent(abbr)}`)
    if (!res.ok) throw new Error(`MKC respondió ${res.status}`)
    const { records } = (await res.json()) as { records: MkcTimeTrial[] }
    const top = pickTop(records, TOP_N)
    // Sin datos (pistas SNES, o MKC caído): no se toca nada para no vaciar el ranking
    if (top.length === 0) return 0

    const rows = top.map((r) => ({
      track_id: trackId,
      category: 'race',
      nita: false,
      time_ms: r.time_ms,
      player_name: r.player_name?.trim() || 'Desconocido',
      country_code: r.player_country_code?.match(/^[A-Z]{2}$/) ? r.player_country_code : null,
      proof_url: bestProof(r.proofs),
      achieved_on: r.created_at.slice(0, 10),
      source: 'mkc',
      external_id: `mkc:${r.id}`,
      created_by: null,
    }))

    const { error } = await supabase.from('time_trials').upsert(rows, { onConflict: 'external_id' })
    if (error) throw error

    // Quita los tiempos de MKC que ya no están en el top
    const keep = rows.map((r) => `"${r.external_id}"`).join(',')
    const { error: delError } = await supabase
      .from('time_trials')
      .delete()
      .eq('source', 'mkc')
      .eq('track_id', trackId)
      .not('external_id', 'in', `(${keep})`)
    if (delError) throw delError

    return rows.length
  }

  // En tandas para no pasar del límite de tiempo de Vercel ni saturar la API de MKC
  const summary: Record<string, number | string> = {}
  const tracks = TRACKS.filter((t) => t.abbr)
  for (let i = 0; i < tracks.length; i += BATCH_SIZE) {
    await Promise.all(
      tracks.slice(i, i + BATCH_SIZE).map(async (t) => {
        try {
          summary[t.abbr!] = await syncTrack(t.id, t.abbr!)
        } catch (e) {
          summary[t.abbr!] = `error: ${e instanceof Error ? e.message : String(e)}`
        }
      }),
    )
  }

  return Response.json({ ok: true, syncedAt: new Date().toISOString(), tracks: summary })
}
