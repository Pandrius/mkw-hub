import type { EventKind } from './events.js'

/** Campos de un evento que dicen si está verificado */
export type Verifiable = {
  kind: EventKind
  lounge_change_id?: number | null
  lounge_table_id?: number | null
  /** Un perfil de confianza que jugó en el evento (o un admin) lo avaló; también cuenta la validación de una war por un rival de confianza */
  vouched_by?: string | null
  /** Lo subió un perfil de confianza (lo marca un admin) */
  trusted?: boolean | null
  /** Captura de la sala final: 'auto' (los puntos coinciden, a falta de revisar) y 'approved' la verifican; 'pending' y 'rejected', no */
  proof_status?: 'auto' | 'pending' | 'approved' | 'rejected' | null
}

/**
 * Un evento está verificado cuando algo ajeno al propio jugador lo respalda:
 *  - Lounge: una mesa suya del Lounge de MKCentral con la misma puntuación a la hora jugada.
 *  - War: coincide con una mesa SQ 6v6 del Lounge. La validación del equipo rival, por sí sola, NO basta: dos equipos podrían
 *    ponerse de acuerdo para inventar una war.
 *  - Lo subió un perfil de confianza, o uno que jugó en él (o un admin) lo avaló.
 * Solo los eventos verificados cuentan para los logros. (Misma regla que la columna `verified` de player_results.)
 */
export function isVerified(e: Verifiable): boolean {
  if (e.trusted || e.vouched_by || e.proof_status === 'auto' || e.proof_status === 'approved') return true
  return e.kind === 'lounge' ? !!e.lounge_change_id : !!e.lounge_table_id
}

export type VerifyState = 'verified' | 'unverified'

/** Cómo se ha verificado, para mostrarlo */
export function verifiedBy(e: Verifiable): 'lounge' | 'sq' | 'vouched' | 'trusted' | 'proof' | null {
  if (e.kind === 'lounge' && e.lounge_change_id) return 'lounge'
  if (e.kind === 'war' && e.lounge_table_id) return 'sq'
  if (e.vouched_by) return 'vouched'
  if (e.proof_status === 'auto' || e.proof_status === 'approved') return 'proof'
  return e.trusted ? 'trusted' : null
}
