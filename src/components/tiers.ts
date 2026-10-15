import type { MessageKey } from '../i18n/es'
import type { Tier } from '../lib/badges'

/** Color de cada nivel: bronce, plata, oro (el amarillo de la web) y platino */
export const TIER_COLOR: Record<Tier, string> = {
  0: 'var(--color-line)',
  1: '#d98a45',
  2: '#c9ced6',
  3: 'var(--color-kart-yellow)',
  4: '#28d7f5',
  5: '#22e07f',
}

export const tierLabel = (tier: Tier): MessageKey => `badge.tier.${tier}` as MessageKey

/** Diseño de la medalla: metal por niveles, o uno propio para los dos logros únicos */
export type MedalKind = 'metal' | 'ruby' | 'legend'

/** Diseño de un logro o insignia destacada a partir de su identificador (ach:legendEvent, legendEvent...) */
export function medalKindOf(id: string): MedalKind {
  const key = id.replace(/^ach:/, '')
  return key === 'legendEvent' ? 'ruby' : key === 'allAchievements' ? 'legend' : 'metal'
}

/** Rojo rubí (carmesí) para los acentos del evento legendario */
export const RUBY = '#e8112d'
