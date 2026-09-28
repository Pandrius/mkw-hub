/** Tipos y utilidades para la API pública de Mario Kart Central. */

export const MKC_API = 'https://mkcentral.com/api'

export type MkcProof = { url: string; type: string; status: string }

export type MkcTimeTrial = {
  id: string
  player_id: number
  track: string
  time_ms: number
  proofs: MkcProof[]
  created_at: string
  validation_status: string
  player_name: string
  player_country_code: string | null
}

/** Top N de un leaderboard de MKC: solo validados y un único tiempo por jugador. */
export function pickTop(records: MkcTimeTrial[], n: number): MkcTimeTrial[] {
  const seen = new Set<number>()
  return records
    .filter((r) => r.validation_status === 'valid')
    .sort((a, b) => a.time_ms - b.time_ms)
    .filter((r) => (seen.has(r.player_id) ? false : (seen.add(r.player_id), true)))
    .slice(0, n)
}

/** Prueba preferida: vídeo completo, luego clip, luego lo que haya. */
export function bestProof(proofs: MkcProof[]): string | null {
  const valid = proofs.filter((p) => p.status === 'valid' && p.url.startsWith('https://'))
  const byType = (t: string) => valid.find((p) => p.type.toLowerCase().includes(t))
  return (byType('full video') ?? byType('video') ?? valid[0])?.url ?? null
}
