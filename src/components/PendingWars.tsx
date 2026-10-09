import { useState } from 'react'
import { Link } from 'react-router'
import { useI18n } from '../i18n'
import { confirmOpponentWar } from '../lib/events'
import { penaltyTotals } from '../lib/penalties'
import { scoreTeamRace } from '../lib/scoring'
import type { MirroredWar } from '../lib/teamStats'
import { Plate } from './ui'

/** Wars que apuntó el equipo rival y que este equipo tiene que confirmar para que cuenten */
export function PendingWars({ wars, onDone }: { wars: MirroredWar[]; onDone: () => void }) {
  const { t } = useI18n()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const decide = async (id: string, accept: boolean) => {
    setBusy(id)
    setError(null)
    try {
      await confirmOpponentWar(id, accept)
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.saveError'))
    } finally {
      setBusy(null)
    }
  }

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
              <Link to={`/eventos/${w.id}`} className="flex flex-1 items-center gap-2 hover:text-kart-yellow">
                <span className="text-sm text-muted">vs</span>
                <Plate>{w.opponent_tag ?? '?'}</Plate>
                <span className="font-mono text-xs text-muted">{(w.finished_at ?? w.created_at).slice(0, 10)}</span>
                <span className="font-display text-lg font-bold tabular-nums">
                  {score.home} – {score.away}
                </span>
                <span className="text-xs text-muted">{t('pending.loggedBy', { tag: w.opponent_tag ?? '?' })}</span>
              </Link>
              <span className="flex gap-2">
                <button onClick={() => decide(w.id, false)} disabled={busy !== null} className="btn-line text-sm">
                  {t('pending.reject')}
                </button>
                <button onClick={() => decide(w.id, true)} disabled={busy !== null} className="btn-yellow text-sm">
                  {t('pending.confirm')}
                </button>
              </span>
            </div>
          )
        })}
      </div>
      {error && <p className="mt-2 text-sm text-kart-red">{error}</p>}
    </section>
  )
}
