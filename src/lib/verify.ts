import type { EventKind } from './events.js'

/** Campos de un evento que dicen si está verificado */
export type Verifiable = {
  kind: EventKind
  lounge_change_id?: number | null
  lounge_table_id?: number | null
  opponent_confirmed?: boolean | null
  /** Lo subió un perfil de confianza (lo marca un admin) */
  trusted?: boolean | null
}

/**
 * Un evento está verificado cuando algo ajeno al propio jugador lo respalda:
 *  - Lounge: una mesa suya del Lounge de MKCentral con la misma puntuación a la hora jugada.
 *  - War: la valida el equipo rival, o coincide con una mesa SQ 6v6 del Lounge.
 *  - Lo subió un perfil de confianza.
 * Solo los eventos verificados cuentan para los logros. (Misma regla que la columna `verified` de player_results.)
 */
export function isVerified(e: Verifiable): boolean {
  if (e.trusted) return true
  return e.kind === 'lounge' ? !!e.lounge_change_id : e.opponent_confirmed === true || !!e.lounge_table_id
}

export type VerifyState = 'verified' | 'unverified'

/** Cómo se ha verificado, para mostrarlo */
export function verifiedBy(e: Verifiable): 'lounge' | 'sq' | 'rival' | 'trusted' | null {
  if (e.kind === 'lounge' && e.lounge_change_id) return 'lounge'
  if (e.kind === 'war' && e.lounge_table_id) return 'sq'
  if (e.kind === 'war' && e.opponent_confirmed === true) return 'rival'
  return e.trusted ? 'trusted' : null
}
