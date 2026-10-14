/**
 * Hora a la que se jugó un evento (en punto, en la zona del dispositivo). Mismas reglas que create_event en la base de datos:
 * no puede ser futura ni tener más de 7 días.
 */
export const MAX_DAYS_BACK = 7

const HOUR_MS = 3_600_000

/** La hora actual en punto */
export function currentHour(now = new Date()): Date {
  const d = new Date(now)
  d.setMinutes(0, 0, 0)
  return d
}

/** Días elegibles, de hoy a hace 7 días (a las 00:00 locales) */
export function dayOptions(now = new Date()): Date[] {
  return Array.from({ length: MAX_DAYS_BACK + 1 }, (_, i) => {
    const d = new Date(now)
    d.setHours(0, 0, 0, 0)
    d.setDate(d.getDate() - i)
    return d
  })
}

/** Instante de una hora de un día (ambos locales) */
export function at(day: Date, hour: number): Date {
  const d = new Date(day)
  d.setHours(hour, 0, 0, 0)
  return d
}

/** Horas (0-23) válidas de un día: ni futuras ni de más de 7 días */
export function hoursFor(day: Date, now = new Date()): number[] {
  const latest = currentHour(now).getTime()
  const earliest = latest - MAX_DAYS_BACK * 24 * HOUR_MS
  return Array.from({ length: 24 }, (_, h) => h).filter((h) => {
    const t = at(day, h).getTime()
    return t <= latest && t >= earliest
  })
}
