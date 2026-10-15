import { useI18n } from '../i18n'
import type { StatsFilter } from '../lib/stats'

/** Etiqueta de «puntos por evento» según el filtro: por war, por mogi (Lounge y SQ) o por evento (todos) */
export function perEventKey(filter: StatsFilter): 'an.perWar' | 'an.perMogi' | 'an.perEvent' {
  return filter === 'war' ? 'an.perWar' : filter === 'lounge' || filter === 'sq' ? 'an.perMogi' : 'an.perEvent'
}

/** Número con los decimales justos y el separador del idioma */
export function useNum() {
  const { locale } = useI18n()
  return (n: number, digits = 1) => n.toLocaleString(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

/** Color de una posición: podio amarillo, top 6 verde, mitad de abajo apagada, cola roja */
export function positionColor(p: number): string {
  if (p <= 3) return 'var(--color-kart-yellow)'
  if (p <= 6) return 'var(--color-kart-green)'
  if (p <= 9) return 'var(--color-line)'
  return 'var(--color-kart-red)'
}

