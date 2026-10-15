import { getTrack } from '../data/tracks'
import { useI18n } from '../i18n'
import type { MessageKey } from '../i18n/es'
import { achievementTotals, BIG_EVENT_POINTS, LEGEND_EVENT_POINTS, REDEMPTION_FROM, type Achievement } from '../lib/achievements'
import { EVENT_TIERS, RACE_TIERS, type BadgeSet } from '../lib/badges'
import { topPercentIn, type AchievementStats } from '../lib/achievementStats'
import { EpicCard, GrandCard, MedalCard } from './Medal'
import { SectionTitle, TrackName } from './StatBlocks'
import { medalKindOf, TIER_COLOR, tierLabel } from './tiers'

/** Insignias por volumen de juego y logros de desempeño */
export function BadgesPanel({ badges, achievements, totalTracks, stats = null }: { badges: BadgeSet; achievements: Achievement[]; totalTracks: number; stats?: AchievementStats | null }) {
  const { t } = useI18n()
  const { mostPlayed } = badges
  // Niveles conseguidos: los de varios niveles suman hasta 4 y los de una sola vez, 1. El supremo no cuenta aquí
  const regular = achievements.filter((a) => a.id !== 'allAchievements')
  const grand = achievements.find((a) => a.id === 'allAchievements')
  const { earned, possible, maxed } = achievementTotals(achievements)
  const descVars = {
    big: BIG_EVENT_POINTS,
    legend: LEGEND_EVENT_POINTS,
    from: REDEMPTION_FROM,
    total: totalTracks,
  }

  return (
    <section id="logros" className="scroll-mt-24">
      <SectionTitle title={t('ach.title')} hint={t('ach.hint')}>
        <p className="font-mono text-xs text-muted">{t('ach.progress', { done: earned, total: possible })}</p>
      </SectionTitle>
      {grand && (
        <div className="mb-3">
          <GrandCard
            glyph={grand.glyph}
            kicker={t('ach.supremeKicker')}
            name={t('ach.allAchievements.name')}
            description={t('ach.allAchievements.desc')}
            countLabel={t('ach.allAchievements.count')}
            progress={{ ...grand, count: maxed }}
            total={regular.length}
            doneLabel={t('ach.done')}
            topPercent={topPercentIn(stats, grand.id, grand.count)}
          />
        </div>
      )}
      <div className="mb-3 space-y-3">
        {regular
          .filter((a) => a.epic)
          .map((a) => (
            <EpicCard
              key={a.id}
              glyph={a.glyph}
              kicker={t('ach.epicKicker')}
              name={t(`ach.${a.id}.name` as MessageKey)}
              description={t(`ach.${a.id}.desc` as MessageKey, descVars)}
              ghost={String(LEGEND_EVENT_POINTS)}
              countLabel={t(`ach.${a.id}.count` as MessageKey)}
              progress={a}
              thresholds={a.thresholds}
              single={a.single}
              kind={medalKindOf(a.id)}
              topPercent={topPercentIn(stats, a.id, a.count)}
            />
          ))}
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {regular.filter((a) => !a.epic).map((a) => (
          <MedalCard
            key={a.id}
            glyph={a.glyph}
            name={a.id === 'warWins' ? t(`ach.warWins.rank.${a.tier}` as MessageKey) : t(`ach.${a.id}.name` as MessageKey)}
            description={t(`ach.${a.id}.desc` as MessageKey, descVars)}
            progress={a}
            thresholds={a.thresholds}
            single={a.single}
            topPercent={topPercentIn(stats, a.id, a.count)}
          />
        ))}
      </div>

      <div className="mt-6">
        <h4 className="font-display text-lg font-bold">{t('badge.title')}</h4>
        <p className="mb-3 mt-1 max-w-3xl text-sm text-muted">{t('badge.hint')}</p>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <MedalCard glyph="bars" name={t('badge.races')} description={t('badge.racesDesc')} progress={badges.races} thresholds={RACE_TIERS} />
          <MedalCard glyph="flag" name={t('badge.events')} description={t('badge.eventsDesc')} progress={badges.events} thresholds={EVENT_TIERS} />
          <MedalCard
            glyph="ring"
            name={t('badge.explorer')}
            description={t('badge.explorerDesc', { total: totalTracks })}
            progress={badges.explorer}
            thresholds={[0.25, 0.5, 0.75, 1].map((f) => Math.ceil(totalTracks * f))}
            suffix={t('badge.ofTracks')}
          />
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
      </div>
    </section>
  )
}
