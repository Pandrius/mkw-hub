import type { MessageKey } from '../i18n/es'
import type { Tier } from '../lib/badges'

/** Color de cada nivel: bronce, plata, oro (el amarillo de la web) y platino */
export const TIER_COLOR: Record<Tier, string> = {
  0: 'var(--color-line)',
  1: '#d98a45',
  2: '#c9ced6',
  3: 'var(--color-kart-yellow)',
  4: '#28d7f5',
}

export const tierLabel = (tier: Tier): MessageKey => `badge.tier.${tier}` as MessageKey
