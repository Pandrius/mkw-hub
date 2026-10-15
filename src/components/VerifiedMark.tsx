import { useI18n } from '../i18n'
import { verifiedBy, type Verifiable } from '../lib/verify'
import { Badge } from './ui'

/** Marca de un evento: verificado (y por qué) o sin verificar. El texto largo sale al pasar el ratón */
export function VerifiedMark({ event, tier, className = '' }: { event: Verifiable; tier?: string | null; className?: string }) {
  const { t } = useI18n()
  const by = verifiedBy(event)
  if (!by) {
    return (
      <span className={className} title={t(event.kind === 'lounge' ? 'ver.whyLounge' : 'ver.whyWar')}>
        <Badge color="var(--color-muted)">{t('ver.unverified')}</Badge>
      </span>
    )
  }
  const label = { lounge: t('ver.lounge'), sq: t('ver.sq'), vouched: t('ver.vouched'), trusted: t('ver.trusted') }[by]
  const how = { lounge: t('ver.howLounge'), sq: t('ver.howSq'), vouched: t('ver.howVouched'), trusted: t('ver.howTrusted') }[by]
  return (
    <span className={`${className} whitespace-nowrap`} title={how}>
      <Badge color="var(--color-kart-green)">
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden className="mr-1 fill-current">
          <polygon points="0,5 1.5,3.5 4,6 8.5,1 10,2.5 4,9" />
        </svg>
        {label}
        {tier ? ` · ${tier}` : ''}
      </Badge>
    </span>
  )
}
