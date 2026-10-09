import type { EventDetail } from './events'
import { parsePenalties } from './penalties'

/** Los campos libres (jsonb / text[]) se descartan si no tienen la forma esperada, para no romper la página */
export function sanitizeEventDetail(detail: EventDetail): EventDetail {
  const players = detail.event.opponent_players
  return {
    ...detail,
    event: {
      ...detail.event,
      opponent_players: Array.isArray(players) ? players.filter((p) => typeof p === 'string').slice(0, 12) : null,
      penalties: parsePenalties(detail.event.penalties),
    },
    races: detail.races.map((r) => ({
      ...r,
      opponent_results: Array.isArray(r.opponent_results)
        ? r.opponent_results
            .filter((x) => x && typeof x.name === 'string' && Number.isInteger(x.position))
            .slice(0, 12)
        : null,
    })),
  }
}
