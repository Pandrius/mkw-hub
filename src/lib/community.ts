// Este módulo lo importa también el servidor (api/): los imports que se ejecutan llevan la extensión .js
import type { AchievementBoard } from './communityBoard.js'
import { periodStart } from './communityBoard.js'
import { CROWN_PERIODS, type CrownPeriod, type Crowns } from './crowns.js'
import type { RecordHistory, RecordId, Records } from './records.js'
import type { TeamTrackEntry } from './teamTrackBoard.js'
import type { TrackBoards } from './trackBoard.js'

export type CommunityPlayer = { username: string; avatar_url: string | null; country_code: string | null }

/**
 * Lo que devuelve /api/community: rankings de logros, récords (clasificación completa e historia), coronas y mejores de cada pista
 * (jugadores y equipos) de la comunidad. El servidor lo guarda como instantánea y lo recalcula como mucho cada pocos minutos.
 */
export type Community = {
  ok: true
  generatedAt: string
  players: Record<string, CommunityPlayer>
  board: AchievementBoard
  records: Records
  history: RecordHistory
  crowns: Crowns
  /** Mejores jugadores de cada pista, de todo el tiempo y de la semana */
  trackBoards: TrackBoards
  /** Mejores equipos de cada pista según sus wars */
  teamTrackBoards: Record<string, TeamTrackEntry[]>
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

/** Periodos de las clasificaciones por pista */
export type TrackPeriod = 'all' | 'week'

/**
 * Cambios entre dos instantáneas de los que se avisa al jugador:
 *  - `record_lost`: le quitan el primer puesto de un récord · `throne_lost`: le quitan el trono histórico
 *  - `crown_won`: gana una corona (pole del día, de la semana o trono)
 *  - `track_won`: pasa a ser el primero de una pista (Dueño o semanal) · `track_lost`: se la quitan
 */
export type Turnover =
  | { kind: 'record_lost'; profileId: string; to: string; record: RecordId; value: number; dedupe: string }
  | { kind: 'throne_lost'; profileId: string; to: string; dedupe: string }
  | { kind: 'crown_won'; profileId: string; period: CrownPeriod; dedupe: string }
  | { kind: 'track_won'; profileId: string; track: string; period: TrackPeriod; dedupe: string }
  | { kind: 'track_lost'; profileId: string; to: string; track: string; period: TrackPeriod; dedupe: string }

type Snapshot = Pick<Community, 'records' | 'crowns' | 'generatedAt'> & Partial<Pick<Community, 'trackBoards'>>

/** Relevos entre dos instantáneas (función pura). La anterior puede ser de una versión sin las clasificaciones por pista */
export function turnovers(prev: Snapshot | null, next: Snapshot): Turnover[] {
  if (!prev?.records || !prev.crowns) return []
  const out: Turnover[] = []

  for (const id of Object.keys(next.records) as RecordId[]) {
    const before = prev.records[id]?.[0]?.profileId
    const now = next.records[id][0]
    if (before && now && now.profileId !== before) out.push({ kind: 'record_lost', profileId: before, to: now.profileId, record: id, value: now.value, dedupe: `${id}:${now.profileId}:${now.value}` })
  }

  for (const p of CROWN_PERIODS) {
    const before = prev.crowns[p]?.holder
    const now = next.crowns[p].holder
    if (now && now !== before) out.push({ kind: 'crown_won', profileId: now, period: p, dedupe: `${p}:${now}:${next.crowns[p].counts[now] ?? 0}` })
    if (p === 'all' && before && now && before !== now) out.push({ kind: 'throne_lost', profileId: before, to: now, dedupe: `${now}:${next.crowns.all.counts[now] ?? 0}` })
  }

  if (prev.trackBoards && next.trackBoards) {
    // La semana forma parte de la clave de los avisos semanales: el mismo jugador puede volver a ser el primero otra semana
    const week = periodStart('week', new Date(next.generatedAt))?.slice(0, 10) ?? ''
    for (const period of ['all', 'week'] as TrackPeriod[]) {
      const before = prev.trackBoards[period] ?? {}
      const now = next.trackBoards[period]
      for (const track of Object.keys(now)) {
        const lead = now[track][0]
        const was = before[track]?.[0]?.profileId
        if (lead.profileId === was) continue
        const key = `${period}:${track}:${lead.profileId}:${period === 'week' ? week : lead.races}`
        out.push({ kind: 'track_won', profileId: lead.profileId, track, period, dedupe: key })
        if (was) out.push({ kind: 'track_lost', profileId: was, to: lead.profileId, track, period, dedupe: key })
      }
    }
  }
  return out
}
