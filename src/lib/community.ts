import type { Crowns } from './crowns'
import type { AchievementBoard } from './communityBoard'
import type { RecordHistory, RecordId, Records } from './records'
import type { TrackBoards } from './trackBoard'

export type CommunityPlayer = { username: string; avatar_url: string | null; country_code: string | null }

/**
 * Lo que devuelve /api/community: rankings de logros, récords (clasificación completa e historia) y coronas de la comunidad. El
 * servidor lo guarda como instantánea y lo recalcula como mucho cada pocos minutos.
 */
export type Community = {
  ok: true
  generatedAt: string
  players: Record<string, CommunityPlayer>
  board: AchievementBoard
  records: Records
  history: RecordHistory
  crowns: Crowns
  /** Mejores de cada pista, de todo el tiempo y de la semana */
  trackBoards: TrackBoards
}

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

/** Alguien ha perdido un récord o el trono ante otro jugador (se le avisa) */
export type Turnover =
  | { kind: 'record_lost'; profileId: string; to: string; record: RecordId; value: number; dedupe: string }
  | { kind: 'throne_lost'; profileId: string; to: string; dedupe: string }

/** Relevos entre dos instantáneas: quién tenía el primer puesto de cada récord y del trono y ya no (función pura) */
export function turnovers(prev: Pick<Community, 'records' | 'crowns'> | null, next: Pick<Community, 'records' | 'crowns'>): Turnover[] {
  if (!prev?.records || !prev.crowns) return []
  const out: Turnover[] = []
  for (const id of Object.keys(next.records) as RecordId[]) {
    const before = prev.records[id]?.[0]?.profileId
    const now = next.records[id][0]
    if (before && now && now.profileId !== before) out.push({ kind: 'record_lost', profileId: before, to: now.profileId, record: id, value: now.value, dedupe: `${id}:${now.profileId}:${now.value}` })
  }
  const before = prev.crowns.all.holder
  const now = next.crowns.all.holder
  if (before && now && before !== now) out.push({ kind: 'throne_lost', profileId: before, to: now, dedupe: `${now}:${next.crowns.all.counts[now] ?? 0}` })
  return out
}
