import { Link } from 'react-router'
import { useI18n } from '../i18n'
import { penaltyTotals } from '../lib/penalties'
import { scoreTeamRace } from '../lib/scoring'
import type { MirroredWar } from '../lib/teamStats'
import { Plate } from './ui'

/** Wars que subió el equipo rival contra este y que alguien de este equipo tiene que revisar y validar */
export function PendingWars({ wars }: { wars: MirroredWar[] }) {
  const { t } = useI18n()

  return (
    <section className="border-2 border-kart-yellow/60 bg-surface p-4">
      <p className="font-mono text-xs font-bold uppercase text-kart-yellow">{t('pending.title', { n: wars.length })}</p>
      <p className="mt-1 text-xs text-muted">{t('pending.hint')}</p>
      <div className="mt-3 divide-y divide-line/60">
        {wars.map((w) => {
          const score = w.races.reduce(
            (acc, r) => {
              const s = scoreTeamRace(r.positions, r.missing_home, r.missing_away)
              return { home: acc.home + s.home, away: acc.away + s.away }
            },
            { home: 0, away: 0 },
          )
          const pen = penaltyTotals(w.penalties)
          score.home += pen.home
          score.away += pen.away
          return (
            <div key={w.id} className="flex flex-wrap items-center gap-3 py-3">
              <div className="flex flex-1 items-center gap-2">
                <span className="text-sm text-muted">vs</span>
                <Plate>{w.opponent_tag ?? '?'}</Plate>
                <span className="font-mono text-xs text-muted">{(w.finished_at ?? w.created_at).slice(0, 10)}</span>
                <span className="font-display text-lg font-bold tabular-nums">
                  {score.home} – {score.away}
                </span>
                <span className="text-xs text-muted">{t('pending.loggedBy', { tag: w.opponent_tag ?? '?' })}</span>
              </div>
              <Link to={`/eventos/${w.id}/validar`} className="btn-yellow text-sm">
                {t('pending.review')}
              </Link>
            </div>
          )
        })}
      </div>
    </section>
  )
}
