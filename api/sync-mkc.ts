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

export async function GET(request: Request): Promise<Response> {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false },
  })

  const summary: Record<string, number | string> = {}

  for (const track of TRACKS) {
    if (!track.abbr) continue
    try {
      const res = await fetch(`${MKC_API}/time-trials/leaderboard?game=mkworld&track=${encodeURIComponent(track.abbr)}`)
      if (!res.ok) throw new Error(`MKC respondió ${res.status}`)
      const { records } = (await res.json()) as { records: MkcTimeTrial[] }
      const top = pickTop(records, TOP_N)

      const rows = top.map((r) => ({
        track_id: track.id,
        category: 'race',
        nita: false,
        time_ms: r.time_ms,
        player_name: r.player_name.trim() || 'Desconocido',
        country_code: r.player_country_code?.match(/^[A-Z]{2}$/) ? r.player_country_code : null,
        proof_url: bestProof(r.proofs),
        achieved_on: r.created_at.slice(0, 10),
        source: 'mkc',
        external_id: `mkc:${r.id}`,
        created_by: null,
      }))

      if (rows.length) {
        const { error } = await supabase.from('time_trials').upsert(rows, { onConflict: 'external_id' })
        if (error) throw error
      }

      // Quita los tiempos de MKC que ya no están en el top
      const keep = rows.map((r) => r.external_id)
      let del = supabase.from('time_trials').delete().eq('source', 'mkc').eq('track_id', track.id)
      if (keep.length) del = del.not('external_id', 'in', `(${keep.map((k) => `"${k}"`).join(',')})`)
      const { error: delError } = await del
      if (delError) throw delError

      summary[track.abbr] = rows.length
    } catch (e) {
      summary[track.abbr] = `error: ${e instanceof Error ? e.message : String(e)}`
    }
  }

  return Response.json({ ok: true, syncedAt: new Date().toISOString(), tracks: summary })
}
