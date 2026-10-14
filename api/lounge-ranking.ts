/**
 * Ranking del Lounge de MKCentral (12p) global o de un país, para la web. La API del Lounge no admite llamadas desde el
 * navegador (CORS), así que se pide aquí y se deja en caché unos minutos.
 *   GET /api/lounge-ranking?country=ES&skip=0
 */
import { LOUNGE_API, LOUNGE_GAME } from '../src/lib/lounge.js'

const PAGE = 50
const MAX_SKIP = 5000

type Row = {
  id: number
  overallRank: number
  countryCode?: string
  name: string
  mmr?: number
  maxMmr?: number
  eventsPlayed?: number
  winRate?: number
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const country = (url.searchParams.get('country') ?? '').toUpperCase()
  const skip = Math.max(0, Math.min(MAX_SKIP, Number(url.searchParams.get('skip')) || 0))
  if (country && !/^[A-Z]{2}$/.test(country)) return Response.json({ ok: false, reason: 'invalid country' }, { status: 400 })

  const query = `game=${LOUNGE_GAME}&pageSize=${PAGE}&skip=${skip}${country ? `&country=${country}` : ''}`
  try {
    const res = await fetch(`${LOUNGE_API}player/leaderboard?${query}`, {
      headers: { 'User-Agent': 'MKW Hub (https://mkw-hub.vercel.app)', Accept: 'application/json' },
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) return Response.json({ ok: false, reason: 'lounge unavailable' }, { status: 502 })
    const json = (await res.json()) as { totalPlayers?: number; season?: number; data?: Row[] }
    const players = (json.data ?? []).map((p, i) => ({
      // Con país: puesto dentro del país; sin él, el puesto global
      rank: country ? skip + i + 1 : p.overallRank,
      overallRank: p.overallRank,
      loungeId: p.id,
      name: p.name,
      country: p.countryCode ?? null,
      mmr: p.mmr ?? null,
      maxMmr: p.maxMmr ?? null,
      events: p.eventsPlayed ?? 0,
      winRate: p.winRate !== undefined ? Math.round(p.winRate * 100) : null,
    }))
    return Response.json(
      { ok: true, season: json.season ?? null, total: json.totalPlayers ?? 0, skip, pageSize: PAGE, players },
      { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } },
    )
  } catch {
    return Response.json({ ok: false, reason: 'lounge unavailable' }, { status: 502 })
  }
}
