/**
 * Día en que se jugó un evento (AAAA-MM-DD, en la zona del dispositivo). Solo el día: el bot de Discord y la web pueden estar
 * en zonas horarias distintas, y la verificación con el Lounge ya cubre cualquier zona. No puede ser futuro ni tener más de 7 días
 * (misma regla que create_event en la base de datos).
 */
export const MAX_DAYS_BACK = 7

const pad = (n: number) => String(n).padStart(2, '0')

/** AAAA-MM-DD en la zona local */
export function localDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export type DayOption = { value: string; date: Date }

/** Días elegibles, de hoy a hace 7 días */
export function dayOptions(now = new Date()): DayOption[] {
  return Array.from({ length: MAX_DAYS_BACK + 1 }, (_, i) => {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)
    return { value: localDate(date), date }
  })
}

/** Fecha de un evento para ordenarlo: cuándo se creó, salvo que se declarara un día muy anterior (se subió tarde) */
export function eventDate(createdAt: string, playedOn: string | null | undefined): string {
  if (!playedOn) return createdAt
  const lagMs = Date.parse(createdAt) - Date.parse(`${playedOn}T00:00:00Z`)
  return lagMs > 2 * 24 * 3_600_000 ? `${playedOn}T12:00:00Z` : createdAt
}
