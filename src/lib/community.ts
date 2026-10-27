import type { AchievementBoard } from './communityBoard'
import type { Records } from './records'

export type CommunityPlayer = { username: string; avatar_url: string | null; country_code: string | null }

/** Lo que devuelve /api/community: rankings de logros y récords de la comunidad (el servidor los deja en caché unos minutos) */
export type Community = { ok: true; generatedAt: string; players: Record<string, CommunityPlayer>; board: AchievementBoard; records: Records }

export async function getCommunity(): Promise<Community | null> {
  try {
    const res = await fetch('/api/community')
    if (!res.ok) return null
    const json = (await res.json()) as Community
    return json.ok ? json : null
  } catch {
    return null
  }
}
