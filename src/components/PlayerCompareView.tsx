import type { ReactNode } from 'react'
import { useI18n } from '../i18n'
import type { MessageKey } from '../i18n/es'
import { MIN_TRACK_RACES, type PlayerAnalytics } from '../lib/playerAnalytics'
import { comparePlayers, DUEL_TIE, type TrackDuel } from '../lib/playerCompare'
import { PHASES } from '../lib/statMath'
import { SectionTitle, Signed, Th, TrackName } from './StatBlocks'
import { useNum } from './statFormat'

type Metric = {
  key: MessageKey
  value: (p: PlayerAnalytics) => number
  digits: number
  suffix?: string
  /** true si un valor más alto es mejor */
  higherBetter: boolean
}

const METRICS: Metric[] = [
  { key: 'an.perWar', value: (p) => p.perWar, digits: 0, higherBetter: true },
  { key: 'cmp.ptsPerRace', value: (p) => p.avgPoints, digits: 2, higherBetter: true },
  { key: 'an.avgPos', value: (p) => p.avgPos, digits: 2, higherBetter: false },
  { key: 'cmp.win', value: (p) => p.winRate, digits: 0, suffix: ' %', higherBetter: true },
  { key: 'cmp.podium', value: (p) => p.podiumRate, digits: 0, suffix: ' %', higherBetter: true },
  { key: 'an.top6Rate', value: (p) => p.top6Rate, digits: 0, suffix: ' %', higherBetter: true },
  { key: 'an.consistency', value: (p) => p.sdPos, digits: 1, higherBetter: false },
]

/** Estadísticas de dos jugadores frente a frente: resumen, fases y pistas donde cada uno es mejor */
export function PlayerCompareView({ a, b, nameA, nameB }: { a: PlayerAnalytics; b: PlayerAnalytics; nameA: string; nameB: string }) {
  const { t } = useI18n()
  const num = useNum()
  const cmp = comparePlayers(a, b)

  return (
    <div className="space-y-8">
      <section>
        <SectionTitle title={t('cmp.summary')} hint={t('cmp.summaryHint')} />
        <div className="panel overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-bg font-display text-xs text-kart-yellow sm:text-sm">
              <tr>
                <Th right={false}>{' '}</Th>
                <Th>{nameA}</Th>
                <Th>{nameB}</Th>
              </tr>
            </thead>
            <tbody>
              {METRICS.map((m) => (
                <MetricRow key={m.key} label={t(m.key)} m={m} a={a} b={b} num={num} />
              ))}
              <tr className="border-t border-line/60 text-muted">
                <td className="px-3 py-2">{t('cmp.races')}</td>
                <td className="px-3 py-2 text-right font-mono">{a.races}</td>
                <td className="px-3 py-2 text-right font-mono">{b.races}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <SectionTitle title={t('cmp.phases')} hint={t('cmp.phasesHint')} />
        <div className="panel overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-bg font-display text-xs text-kart-yellow sm:text-sm">
              <tr>
                <Th right={false}>{' '}</Th>
                <Th>{nameA}</Th>
                <Th>{nameB}</Th>
              </tr>
            </thead>
            <tbody>
              {PHASES.map((ph) => {
                const pa = a.phases[ph]
                const pb = b.phases[ph]
                return (
                  <tr key={ph} className="border-t border-line/60">
                    <td className="px-3 py-2 font-semibold">{t(`an.phase.${ph}` as MessageKey)}</td>
                    <Cell value={pa ? num(pa.avgPoints, 2) : '—'} win={!!pa && !!pb && pa.avgPoints > pb.avgPoints} />
                    <Cell value={pb ? num(pb.avgPoints, 2) : '—'} win={!!pa && !!pb && pb.avgPoints > pa.avgPoints} />
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <SectionTitle title={t('cmp.tracks')} hint={t('cmp.tracksHint', { n: MIN_TRACK_RACES })} />
        {cmp.duels.length === 0 ? (
          <div className="panel p-5 text-sm text-muted">{t('cmp.noCommon', { n: MIN_TRACK_RACES })}</div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <DuelList title={t('cmp.wins', { name: nameA })} duels={cmp.aBetter} />
            <DuelList title={t('cmp.wins', { name: nameB })} duels={cmp.bBetter} />
          </div>
        )}
      </section>

      {cmp.duels.length > 0 && (
        <section>
          <SectionTitle title={t('cmp.allTracks')} hint={t('cmp.allTracksHint', { a: nameA, b: nameB })} />
          <div className="panel overflow-x-auto">
            <table className="w-full min-w-max text-sm">
              <thead className="bg-bg font-display text-xs text-kart-yellow sm:text-sm">
                <tr>
                  <Th right={false}>{t('stats.colTrack')}</Th>
                  <Th>{nameA}</Th>
                  <Th>{nameB}</Th>
                  <Th hint={t('cmp.diffHint')}>{t('cmp.diff')}</Th>
                </tr>
              </thead>
              <tbody>
                {cmp.duels.map((d) => (
                  <tr key={d.trackId} className="border-t border-line/60">
                    <td className="max-w-56 px-3 py-2">
                      <TrackName trackId={d.trackId} />
                    </td>
                    <Cell value={num(d.aPoints, 2)} sub={`×${d.aRaces}`} win={d.diff >= DUEL_TIE} />
                    <Cell value={num(d.bPoints, 2)} sub={`×${d.bRaces}`} win={d.diff <= -DUEL_TIE} />
                    <td className="px-3 py-2 text-right font-mono">
                      <Signed value={d.diff} digits={2} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}

function Cell({ value, sub, win }: { value: ReactNode; sub?: string; win: boolean }) {
  return (
    <td className={`px-3 py-2 text-right font-mono ${win ? 'font-bold text-kart-green' : ''}`}>
      {value}
      {sub && <span className="ml-1.5 text-xs font-normal text-muted">{sub}</span>}
    </td>
  )
}

function MetricRow({ label, m, a, b, num }: { label: string; m: Metric; a: PlayerAnalytics; b: PlayerAnalytics; num: (n: number, d?: number) => string }) {
  const va = m.value(a)
  const vb = m.value(b)
  const aWins = m.higherBetter ? va > vb : va < vb
  const bWins = m.higherBetter ? vb > va : vb < va
  const fmt = (v: number) => `${num(v, m.digits)}${m.suffix ?? ''}`
  return (
    <tr className="border-t border-line/60">
      <td className="px-3 py-2 font-semibold">{label}</td>
      <Cell value={fmt(va)} win={aWins} />
      <Cell value={fmt(vb)} win={bWins} />
    </tr>
  )
}

function DuelList({ title, duels }: { title: string; duels: TrackDuel[] }) {
  const { t } = useI18n()
  const num = useNum()
  return (
    <div className="panel p-5">
      <h4 className="font-display text-lg font-bold">{title}</h4>
      {duels.length === 0 ? (
        <p className="mt-2 text-sm text-muted">{t('cmp.noneHere')}</p>
      ) : (
        <ol className="mt-3 space-y-2">
          {duels.map((d) => (
            <li key={d.trackId} className="flex items-center justify-between gap-3">
              <TrackName trackId={d.trackId} />
              <span className="shrink-0 text-right font-mono text-sm">
                <Signed value={d.diff} digits={2} className="font-bold" />
                <span className="ml-2 text-xs text-muted">{t('cmp.duelLine', { a: num(d.aPoints, 1), b: num(d.bPoints, 1) })}</span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
