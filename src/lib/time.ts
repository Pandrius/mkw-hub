/** 139361 → 2'19"361 (formato habitual en Mario Kart) */
export function formatTime(ms: number): string {
  const minutes = Math.floor(ms / 60000)
  const seconds = Math.floor((ms % 60000) / 1000)
  const millis = ms % 1000
  return `${minutes}'${String(seconds).padStart(2, '0')}"${String(millis).padStart(3, '0')}`
}

/** Fecha AAAA-MM-DD en el formato del idioma, sin que la zona horaria la mueva de día. */
export function formatDate(date: string, locale: string): string {
  return new Date(`${date.slice(0, 10)}T00:00:00Z`).toLocaleDateString(locale, { timeZone: 'UTC' })
}

/**
 * Convierte lo que escribe un editor en milisegundos. Acepta:
 * 2:19.361 · 2'19"361 · 2 19 361 · 0:45.2 (→ 45.200) · 45.123 (solo segundos)
 * Devuelve null si no se entiende.
 */
export function parseTime(input: string): number | null {
  const s = input.trim().replace(/[’′]/g, "'").replace(/[”″]/g, '"')
  const withMinutes = s.match(/^(\d{1,2})\s*[:'\s]\s*(\d{1,2})\s*[."\s,]\s*(\d{1,3})$/)
  const onlySeconds = s.match(/^(\d{1,2})\s*[."\s,]\s*(\d{1,3})$/)
  const m = withMinutes ?? (onlySeconds ? [onlySeconds[0], '0', onlySeconds[1], onlySeconds[2]] : null)
  if (!m) return null

  const minutes = Number(m[1])
  const seconds = Number(m[2])
  const millis = Number(m[3].padEnd(3, '0'))
  if (seconds > 59) return null
  return minutes * 60000 + seconds * 1000 + millis
}
