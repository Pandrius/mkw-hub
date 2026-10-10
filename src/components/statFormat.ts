import { useI18n } from '../i18n'

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

