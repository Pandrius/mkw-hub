import { useMemo, useState } from 'react'
import { useI18n } from '../i18n'
import type { MessageKey } from '../i18n/es'
import type { Streak } from '../lib/form'
import { MIN_BASELINE, MIN_TRACK_RACES, RECENT_RACES, type PerfLine, type PlayerAnalytics, type PlayerTrack } from '../lib/playerAnalytics'
import { PHASES } from '../lib/statMath'
import { filterRowsByTrack } from '../lib/trackSearch'
import { LineChart, PositionHistogram } from './Charts'
import { SearchBox } from './SearchBox'
import { PositionChip, SectionTitle, Signed, StatTile, Th, TrackName } from './StatBlocks'
import { useNum } from './statFormat'
import { trackSuggestion } from './trackSuggestion'

/** Carreras en una pista por debajo de las cuales el dato se marca como poco fiable */
const LOW_SAMPLE = 3

/** Estadísticas individuales de un jugador: resumen, distribución, forma, fases, rachas y pistas */
export function PlayerAnalyticsView({ a, showSplit }: { a: PlayerAnalytics; showSplit: boolean }) {
  const { t } = useI18n()
  const num = useNum()

  return (
    <div className="space-y-8">
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label={t('an.perWar')} hint={t('an.perWarHint')} value={a.perWar} sub={t('an.ptsPerRaceValue', { n: num(a.avgPoints, 2) })} accent />
        <StatTile label={t('an.avgPos')} value={num(a.avgPos, 2)} sub={t('an.median', { n: num(a.medianPos, 1) })} />
        <StatTile label={t('an.top6Rate')} value={`${a.top6Rate} %`} sub={t('an.winPodium', { win: a.winRate, podium: a.podiumRate })} />
        <StatTile label={t('an.consistency')} hint={t('an.consistencyHint')} value={`± ${num(a.sdPos, 1)}`} sub={t('an.racesEvents', { races: a.races, events: a.eventCount })} />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="panel p-5">
          <SectionTitle title={t('an.distribution')} hint={t('an.distributionHint')} />
          <PositionHistogram
            counts={a.distribution}
            ariaLabel={t('an.distribution')}
            label={(pos, n, pct) => t('an.distributionTip', { pos, n, pct })}
          />
        </div>
        <FormPanel a={a} />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="panel overflow-x-auto">
          <PerfTable
            title={t('an.phases')}
            hint={t('an.phasesHint')}
            rows={PHASES.map((ph) => ({ key: ph, label: t(`an.phase.${ph}` as MessageKey), perf: a.phases[ph] }))}
            overall={a.avgPoints}
          />
        </div>
        {showSplit && (
          <div className="panel overflow-x-auto">
            <PerfTable
              title={t('an.split')}
              hint={t('an.splitHint')}
              rows={[
                { key: 'war', label: t('stats.war'), perf: a.split.war },
                { key: 'lounge', label: t('stats.lounge'), perf: a.split.lounge },
              ]}
              overall={a.avgPoints}
            />
          </div>
        )}
      </section>

      <section>
        <SectionTitle title={t('an.streaks')} hint={t('an.streaksHint')} />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StreakTile label={t('an.streak.top6')} streak={a.streaks.top6} />
          <StreakTile label={t('an.streak.podium')} streak={a.streaks.podium} />
          <StreakTile label={t('an.streak.win')} streak={a.streaks.win} />
          <StreakTile label={t('an.streak.outsideTop6')} streak={a.streaks.outsideTop6} bad />
        </div>
      </section>

      <section>
        <SectionTitle title={t('an.keyTracks')} hint={t('an.keyTracksHint', { n: MIN_TRACK_RACES })} />
        <div className="grid gap-4 md:grid-cols-2">
          <KeyTracks title={t('an.strongTracks')} tracks={a.strongest} />
          <KeyTracks title={t('an.weakTracks')} tracks={a.weakest} />
        </div>
      </section>

      <TrackTable tracks={a.tracks} />
    </div>
  )
}

function FormPanel({ a }: { a: PlayerAnalytics }) {
  const { t } = useI18n()
  const num = useNum()
  const f = a.form
  const trendColor = f?.trend === 'up' ? 'text-kart-green' : f?.trend === 'down' ? 'text-kart-red' : 'text-ink'
  return (
    <div className="panel p-5">
      <SectionTitle title={t('an.form')} hint={t('an.formHint', { n: RECENT_RACES })} />
      {!f ? (
        <p className="text-sm text-muted">{t('an.formNotEnough', { n: RECENT_RACES + MIN_BASELINE })}</p>
      ) : (
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <p className={`font-display text-2xl font-black ${trendColor}`}>{t(`an.trend.${f.trend}` as MessageKey)}</p>
          <p className="text-sm">
            {t('an.formLine', { recent: num(f.recent.avgPoints, 2), baseline: num(f.baseline.avgPoints, 2) })}{' '}
            <Signed value={f.delta} digits={2} className="font-mono font-bold" />
          </p>
        </div>
      )}
      {a.rolling.length >= 2 && (
        <div className="mt-4">
          <p className="mb-2 font-mono text-[11px] text-muted uppercase">{t('an.rolling', { n: RECENT_RACES })}</p>
          <LineChart
            ariaLabel={t('an.rolling', { n: RECENT_RACES })}
            points={a.rolling.map((p) => ({ value: p.value, tip: t('an.rollingTip', { date: p.date.slice(0, 10), value: num(p.value, 2) }) }))}
            reference={a.avgPoints}
            referenceLabel={t('an.careerAvg', { n: num(a.avgPoints, 2) })}
            format={(v) => num(v, 0)}
            height={150}
          />
        </div>
      )}
    </div>
  )
}

function PerfTable({
  title,
  hint,
  rows,
  overall,
}: {
  title: string
  hint: string
  rows: { key: string; label: string; perf: PerfLine | null }[]
  overall: number
}) {
  const { t } = useI18n()
  const num = useNum()
  return (
    <>
      <div className="px-5 pt-4">
        <SectionTitle title={title} hint={hint} />
      </div>
      <table className="w-full text-sm">
        <thead className="bg-bg font-display text-xs text-kart-yellow">
          <tr>
            <Th right={false}>{' '}</Th>
            <Th>{t('an.col.races')}</Th>
            <Th>{t('an.col.avgPos')}</Th>
            <Th>{t('an.col.ptsPerRace')}</Th>
            <Th hint={t('an.col.vsAvgHint')}>{t('an.col.vsAvg')}</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ key, label, perf }) => (
            <tr key={key} className="border-t border-line/60">
              <td className="px-3 py-2 font-semibold">{label}</td>
              <td className="px-3 py-2 text-right font-mono text-muted">{perf?.races ?? 0}</td>
              <td className="px-3 py-2 text-right font-mono">{perf ? num(perf.avgPos, 2) : '—'}</td>
              <td className="px-3 py-2 text-right font-mono font-bold">{perf ? num(perf.avgPoints, 2) : '—'}</td>
              <td className="px-3 py-2 text-right font-mono">{perf ? <Signed value={perf.avgPoints - overall} digits={2} /> : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}

function StreakTile({ label, streak, bad }: { label: string; streak: Streak; bad?: boolean }) {
  const { t } = useI18n()
  const color = bad ? 'var(--color-kart-red)' : 'var(--color-kart-green)'
  return (
    <div className="panel border-l-4 p-4" style={{ borderLeftColor: color }}>
      <p className="text-xs text-muted sm:text-sm">{label}</p>
      <div className="mt-1 flex items-baseline gap-3">
        <p className="font-display text-3xl font-extrabold">{streak.current}</p>
        <p className="font-mono text-xs text-muted">
          {t('an.streakRecord')}: <span className="font-bold text-ink">{streak.best}</span>
        </p>
      </div>
      <p className="font-mono text-[11px] text-muted uppercase">{t('an.streakCurrent')}</p>
    </div>
  )
}

function KeyTracks({ title, tracks }: { title: string; tracks: PlayerTrack[] }) {
  const { t } = useI18n()
  const num = useNum()
  return (
    <div className="panel p-5">
      <h4 className="font-display text-lg font-bold">{title}</h4>
      {tracks.length === 0 ? (
        <p className="mt-2 text-sm text-muted">{t('an.noKeyTracks')}</p>
      ) : (
        <ol className="mt-3 space-y-2">
          {tracks.map((tr) => (
            <li key={tr.trackId} className="flex items-center justify-between gap-3">
              <TrackName trackId={tr.trackId} />
              <span className="shrink-0 text-right font-mono text-sm">
                <Signed value={tr.delta} digits={2} className="font-bold" />
                <span className="ml-2 text-xs text-muted">
                  {t('an.trackLine', { pts: num(tr.avgPoints, 1), n: tr.races })}
                </span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

function TrackTable({ tracks }: { tracks: PlayerTrack[] }) {
  const { t } = useI18n()
  const num = useNum()
  const [search, setSearch] = useState('')
  const { rows, suggestions } = useMemo(() => filterRowsByTrack(tracks, (tr) => tr.trackId, search), [tracks, search])

  return (
    <section>
      <SectionTitle title={t('stats.byTrack')} hint={t('an.byTrackHint')}>
        <SearchBox
          value={search}
          onChange={setSearch}
          suggestions={suggestions.slice(0, 8).map(trackSuggestion)}
          onPick={(s) => setSearch(s.label)}
          placeholder={t('stats.searchTrack')}
          className="field w-full text-sm"
          wrapperClassName="relative w-full sm:w-72"
        />
      </SectionTitle>
      <div className="panel overflow-x-auto">
        <table className="w-full min-w-max text-sm">
          <thead className="bg-bg font-display text-xs text-kart-yellow sm:text-sm">
            <tr>
              <Th right={false}>{t('stats.colTrack')}</Th>
              <Th>{t('an.col.races')}</Th>
              <Th>{t('an.col.avgPos')}</Th>
              <Th>{t('an.col.ptsPerRace')}</Th>
              <Th hint={t('an.col.vsAvgHint')}>{t('an.col.vsAvg')}</Th>
              <Th>{t('an.col.podium')}</Th>
              <Th>{t('an.col.best')}</Th>
              <Th right={false}>{t('an.col.recent')}</Th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-sm text-muted">
                  {t('stats.noTracksFound')}
                </td>
              </tr>
            ) : (
              rows.map((tr) => (
                <tr key={tr.trackId} className={`border-t border-line/60 ${tr.races < LOW_SAMPLE ? 'text-muted' : ''}`}>
                  <td className="max-w-56 px-3 py-2">
                    <TrackName trackId={tr.trackId} />
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    {tr.races}
                    {tr.races < LOW_SAMPLE && <span title={t('stats.lowSample')}>*</span>}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">{num(tr.avgPos, 2)}</td>
                  <td className="px-3 py-2 text-right font-mono font-bold">{num(tr.avgPoints, 2)}</td>
                  <td className="px-3 py-2 text-right font-mono">
                    <Signed value={tr.delta} digits={2} />
                  </td>
                  <td className="px-3 py-2 text-right font-mono">{tr.podiumRate} %</td>
                  <td className="px-3 py-2 text-right font-mono">{tr.best}</td>
                  <td className="px-3 py-2">
                    <span className="flex gap-1">
                      {tr.recent.map((p, i) => (
                        <PositionChip key={i} position={p} />
                      ))}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <p className="border-t border-line px-4 py-2 text-xs text-muted">
          * {t('stats.lowSample')} ({'<'} {LOW_SAMPLE})
        </p>
      </div>
    </section>
  )
}
