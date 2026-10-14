import { getTrack } from '../data/tracks'
import { useI18n } from '../i18n'
import type { MessageKey } from '../i18n/es'
import type { BadgeSet, Progress, Tier } from '../lib/badges'
import { SectionTitle, TrackName } from './StatBlocks'

/** Color de cada nivel: bronce, plata, oro (amarillo de la web) y platino */
const TIER_COLOR: Record<Tier, string> = {
  0: 'var(--color-line)',
  1: '#cd7f32',
  2: '#c4c9d1',
  3: 'var(--color-kart-yellow)',
  4: '#28d7f5',
}

const tierLabel = (tier: Tier): MessageKey => `badge.tier.${tier}` as MessageKey

/** Insignias por volumen de juego: premian jugar mucho, no las posiciones */
export function BadgesPanel({ badges }: { badges: BadgeSet }) {
  const { t } = useI18n()
  const { mostPlayed } = badges

  return (
    <section>
      <SectionTitle title={t('badge.title')} hint={t('badge.hint')} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Medal label={t('badge.races')} p={badges.races} />
        <Medal label={t('badge.events')} p={badges.events} />
        <Medal label={t('badge.explorer')} p={badges.explorer} suffix={t('badge.ofTracks')} />
      </div>

      <div className="panel mt-3 p-5">
        <h4 className="font-display text-lg font-bold">{t('badge.byTrack')}</h4>
        {badges.tracks.length === 0 ? (
          <p className="mt-2 text-sm text-muted">
            {mostPlayed
              ? t('badge.noneYet', { track: getTrack(mostPlayed.trackId)?.name ?? mostPlayed.trackId, n: mostPlayed.races })
              : t('badge.noRaces')}
          </p>
        ) : (
          <ul className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2">
            {badges.tracks.map((b) => (
              <li key={b.trackId} className="flex items-center justify-between gap-3">
                <TrackName trackId={b.trackId} />
                <span className="flex shrink-0 items-center gap-2 font-mono text-xs">
                  <span className="px-1.5 py-0.5 font-bold text-bg" style={{ background: TIER_COLOR[b.tier] }}>
                    {t(tierLabel(b.tier))}
                  </span>
                  <span className="text-muted" title={b.next ? t('badge.nextAt', { n: b.next }) : t('badge.maxed')}>
                    {b.count}
                    {b.next ? ` / ${b.next}` : ''}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
        {mostPlayed && badges.tracks.length > 0 && (
          <p className="mt-4 border-t border-line pt-3 text-sm text-muted">
            {t('badge.mostPlayed')}: <span className="font-semibold text-ink">{getTrack(mostPlayed.trackId)?.name ?? mostPlayed.trackId}</span> ·{' '}
            {t('badge.racesN', { n: mostPlayed.races })}
          </p>
        )}
      </div>
    </section>
  )
}

function Medal({ label, p, suffix }: { label: string; p: Progress; suffix?: string }) {
  const { t } = useI18n()
  const pct = p.next ? Math.min(100, Math.round((p.count / p.next) * 100)) : 100
  return (
    <div className="panel border-l-4 p-4" style={{ borderLeftColor: TIER_COLOR[p.tier] }}>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-xs text-muted sm:text-sm">{label}</p>
        <p className="font-mono text-[11px] font-bold uppercase" style={{ color: p.tier ? TIER_COLOR[p.tier] : undefined }}>
          {p.tier ? t(tierLabel(p.tier)) : t('badge.locked')}
        </p>
      </div>
      <p className="mt-1 font-display text-3xl leading-none font-extrabold">
        {p.count}
        {suffix && <span className="ml-1 text-base font-bold text-muted">{suffix}</span>}
      </p>
      <div className="mt-3 h-1.5 bg-line" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
        <div className="h-full" style={{ width: `${pct}%`, background: TIER_COLOR[Math.min(4, p.tier + 1) as Tier] }} />
      </div>
      <p className="mt-1.5 font-mono text-[11px] text-muted">{p.next ? t('badge.nextAt', { n: p.next }) : t('badge.maxed')}</p>
    </div>
  )
}
