import type { ReactNode } from 'react'
import { useI18n } from '../i18n'
import type { MessageKey } from '../i18n/es'
import { MIN_TRACK_RACES, TRACK_PRIOR, type PlayerAnalytics } from '../lib/playerAnalytics'
import { comparePlayers, DUEL_TIE, type TrackDuel } from '../lib/playerCompare'
import { PHASES } from '../lib/statMath'
import { SectionTitle, Signed, Th, TrackName } from './StatBlocks'
import { perEventKey, useNum } from './statFormat'
import type { StatsFilter } from '../lib/stats'
import { copyText } from '../lib/clipboard'
import type { HeadToHead } from '../lib/headToHead'
import { useState } from 'react'

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
export function PlayerCompareView({ a, b, nameA, nameB, filter, h2h }: { a: PlayerAnalytics; b: PlayerAnalytics; nameA: string; nameB: string; filter: StatsFilter; h2h: HeadToHead | null }) {
  const { t } = useI18n()
  const num = useNum()
  const cmp = comparePlayers(a, b)
  const [copied, setCopied] = useState(false)
  // Veredicto: en cuántas métricas del resumen gana cada uno y en cuántas pistas comunes
  const wins = METRICS.reduce(
    (acc, m) => {
      const va = m.value(a)
      const vb = m.value(b)
      if (va === vb) return acc
      return (m.higherBetter ? va > vb : va < vb) ? { ...acc, a: acc.a + 1 } : { ...acc, b: acc.b + 1 }
    },
    { a: 0, b: 0 },
  )
  const tracksA = cmp.duels.filter((d) => d.diff >= DUEL_TIE).length
  const tracksB = cmp.duels.filter((d) => d.diff <= -DUEL_TIE).length
  const copyLink = async () => {
    if (await copyText(window.location.href)) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="space-y-8">
      <section className="panel space-y-3 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="font-display text-2xl font-black">
            {wins.a === wins.b ? t('cmp.verdictTie', { a: wins.a, b: wins.b }) : t('cmp.verdict', { name: wins.a > wins.b ? nameA : nameB, w: Math.max(wins.a, wins.b), l: Math.min(wins.a, wins.b) })}
          </p>
          <button type="button" onClick={copyLink} className="btn-line text-sm">
            {copied ? t('share.copied') : t('cmp.copyLink')}
          </button>
        </div>
        <p className="text-sm text-muted">
          {t('cmp.verdictTracks', { a: nameA, na: tracksA, b: nameB, nb: tracksB })}
        </p>
        {h2h ? (
          <div className="border-t border-line pt-3 text-sm">
            <p className="font-semibold">{t('cmp.h2hTitle', { n: h2h.events })}</p>
            <p className="mt-1">
              {t('cmp.h2hEvents', { a: nameA, wa: h2h.aWins, b: nameB, wb: h2h.bWins, ties: h2h.ties })}
            </p>
            <p className="text-muted">
              {t('cmp.h2hRaces', { a: nameA, ra: h2h.aAhead, b: nameB, rb: h2h.bAhead, pa: num(h2h.aPoints, 2), pb: num(h2h.bPoints, 2) })}
            </p>
          </div>
        ) : (
          <p className="border-t border-line pt-3 text-sm text-muted">{t('cmp.h2hNone')}</p>
        )}
      </section>

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
                <MetricRow key={m.key} label={t(m.key === 'an.perWar' ? perEventKey(filter) : m.key)} m={m} a={a} b={b} num={num} />
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
                  <Th hint={t('cmp.diffHint', { races: 'n', prior: TRACK_PRIOR })}>{t('cmp.diff')}</Th>
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
                    <td className="px-3 py-2 text-right font-mono" title={t('cmp.diffTip', { aAdj: num(d.aAdj, 2), bAdj: num(d.bAdj, 2) })}>
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
            <li
              key={d.trackId}
              className="flex items-center justify-between gap-3"
              title={t('cmp.duelTip', {
                a: num(d.aPoints, 2),
                b: num(d.bPoints, 2),
                aAdj: num(d.aAdj, 2),
                bAdj: num(d.bAdj, 2),
                diff: num(Math.abs(d.diff), 2),
              })}
            >
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
