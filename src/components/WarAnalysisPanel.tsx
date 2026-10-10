import { useMemo } from 'react'
import { getTrack } from '../data/tracks'
import { useI18n } from '../i18n'
import type { MessageKey } from '../i18n/es'
import { PHASES } from '../lib/statMath'
import { computeWarAnalytics, type WarPlayerLine } from '../lib/warAnalytics'
import type { WarTable } from '../lib/warTable'
import { LineChart } from './Charts'
import { RecordText, SectionTitle, Signed, StatTile, Th, TrackName } from './StatBlocks'
import { useNum } from './statFormat'

/** Análisis interno de una war: evolución del marcador, fases, reparto de posiciones y rendimiento individual */
export default function WarAnalysisPanel({ table, teamTag, opponentTag }: { table: WarTable; teamTag: string; opponentTag: string }) {
  const { t } = useI18n()
  const num = useNum()
  const a = useMemo(() => computeWarAnalytics(table), [table])
  if (!a) return null

  const trackName = (id: string) => getTrack(id)?.abbr ?? id

  return (
    <section className="space-y-6">
      <h2 className="font-display text-2xl font-black">{t('an.war.title')}</h2>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label={t('an.war.raceRecord')}
          value={<RecordText record={a.raceRecord} />}
          sub={t('an.war.raceRecordSub', { n: Math.round((a.raceRecord.w / a.races) * 100), races: a.races })}
        />
        <StatTile
          label={t('an.war.maxLead')}
          value={a.maxLead ? <Signed value={a.maxLead.value} digits={0} /> : '—'}
          sub={a.maxLead ? t('an.war.afterRace', { n: a.maxLead.raceNo }) : undefined}
        />
        <StatTile
          label={t('an.war.maxDeficit')}
          value={a.maxDeficit ? <Signed value={a.maxDeficit.value} digits={0} /> : '—'}
          sub={a.maxDeficit ? t('an.war.afterRace', { n: a.maxDeficit.raceNo }) : undefined}
        />
        <StatTile label={t('an.war.leadChanges')} hint={t('an.war.leadChangesHint')} value={a.leadChanges} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="panel p-5">
          <SectionTitle title={t('an.war.progress')} hint={t('an.war.progressHint')} />
          {table.races.length >= 2 ? (
            <LineChart
              ariaLabel={t('an.war.progress')}
              zeroLine
              format={(v) => num(v, 0)}
              points={table.races.map((r) => ({
                value: r.runningDiff,
                tip: (
                  <>
                    <b>{t('an.war.raceN', { n: r.race.race_no })}</b> · {trackName(r.race.track_id)} · {r.home}–{r.away} (
                    <Signed value={r.diff} digits={0} />) · {t('an.war.total')} <Signed value={r.runningDiff} digits={0} />
                  </>
                ),
              }))}
            />
          ) : (
            <p className="text-sm text-muted">{t('an.war.needTwo')}</p>
          )}
        </div>

        <div className="panel overflow-x-auto">
          <div className="px-5 pt-4">
            <SectionTitle title={t('an.war.phases')} />
          </div>
          <table className="w-full text-sm">
            <thead className="bg-bg font-display text-xs text-kart-yellow">
              <tr>
                <Th right={false}> </Th>
                <Th>{t('an.col.races')}</Th>
                <Th>{t('an.war.phaseDiff')}</Th>
              </tr>
            </thead>
            <tbody>
              {PHASES.map((ph) => {
                const p = a.phases[ph]
                return (
                  <tr key={ph} className="border-t border-line/60">
                    <td className="px-3 py-2 font-semibold">{t(`an.phase.${ph}` as MessageKey)}</td>
                    <td className="px-3 py-2 text-right font-mono text-muted">{p?.races ?? 0}</td>
                    <td className="px-3 py-2 text-right font-mono font-bold">{p ? <Signed value={p.diff} digits={0} /> : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div className="space-y-2 border-t border-line px-5 py-3 text-sm">
            {a.bestRace && (
              <p className="flex items-center justify-between gap-2">
                <span className="text-muted">{t('an.war.bestRace', { n: a.bestRace.raceNo })}</span>
                <span className="flex items-center gap-2">
                  <TrackName trackId={a.bestRace.trackId} short />
                  <Signed value={a.bestRace.diff} digits={0} className="font-mono font-bold" />
                </span>
              </p>
            )}
            {a.worstRace && (
              <p className="flex items-center justify-between gap-2">
                <span className="text-muted">{t('an.war.worstRace', { n: a.worstRace.raceNo })}</span>
                <span className="flex items-center gap-2">
                  <TrackName trackId={a.worstRace.trackId} short />
                  <Signed value={a.worstRace.diff} digits={0} className="font-mono font-bold" />
                </span>
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="panel overflow-x-auto p-5">
        <SectionTitle title={t('an.war.positions')} hint={t('an.war.positionsHint')} />
        <table className="w-full min-w-max text-center text-sm">
          <thead className="font-mono text-xs text-muted">
            <tr>
              <th className="px-2 py-1 text-left font-normal" />
              {a.positions.home.map((_, i) => (
                <th key={i} className="w-9 px-1 py-1 font-normal">
                  {i + 1}
                </th>
              ))}
              <th className="px-2 py-1 text-right font-normal">{t('an.col.avgPos')}</th>
            </tr>
          </thead>
          <tbody className="font-mono">
            {(
              [
                [teamTag, a.positions.home, a.positions.away, a.avgPos.home],
                [opponentTag, a.positions.away, a.positions.home, a.avgPos.away],
              ] as const
            ).map(([tag, mine, theirs, avg]) => (
              <tr key={tag} className="border-t border-line/60">
                <td className="px-2 py-1.5 text-left font-display font-black normal-case">{tag}</td>
                {mine.map((n, i) => (
                  <td key={i} className={`px-1 py-1.5 tabular-nums ${n > theirs[i] ? 'font-bold text-ink' : 'text-muted'}`}>
                    {n || '·'}
                  </td>
                ))}
                <td className="px-2 py-1.5 text-right tabular-nums">{num(avg, 1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-sm">
          {t('an.war.top6', { tag: teamTag, n: num(a.top6PerRace, 1) })}
        </p>
      </div>

      <div className="space-y-4">
        <PlayerLines title={teamTag} players={a.homePlayers} races={a.races} />
        {a.awayPlayers.length > 0 ? (
          <PlayerLines title={opponentTag} players={a.awayPlayers} races={a.races} />
        ) : (
          <p className="panel self-start p-5 text-sm text-muted">{t('an.war.noRivalLines')}</p>
        )}
      </div>
    </section>
  )
}

function PlayerLines({ title, players, races }: { title: string; players: WarPlayerLine[]; races: number }) {
  const { t } = useI18n()
  const num = useNum()
  return (
    <div className="panel overflow-x-auto">
      <p className="px-4 pt-3 font-display text-lg font-black normal-case">{title}</p>
      <table className="w-full min-w-max text-sm">
        <thead className="bg-bg font-display text-xs text-kart-yellow">
          <tr>
            <Th right={false}>{t('event.player')}</Th>
            <Th>{t('event.points')}</Th>
            <Th>{t('an.col.avgPos')}</Th>
            <Th>{t('an.war.range')}</Th>
            <Th hint={t('an.war.sdHint')}>{t('an.war.sd')}</Th>
            <Th hint={t('an.col.shareHint')}>{t('an.col.share')}</Th>
            <Th hint={t('an.war.leadsHint')}>{t('an.war.leads')}</Th>
            <Th>{t('an.war.podiums')}</Th>
          </tr>
        </thead>
        <tbody>
          {players.map((p) => (
            <tr key={p.name} className="border-t border-line/60">
              <td className="px-3 py-2 font-semibold">
                {p.name}
                {p.races < races && (
                  <span className="ml-1 text-xs text-muted" title={t('an.war.partial', { n: p.races, pts: p.perWar })}>
                    ({p.races})
                  </span>
                )}
              </td>
              <td className="px-3 py-2 text-right font-display text-base font-bold tabular-nums">{p.points}</td>
              <td className="px-3 py-2 text-right font-mono">{num(p.avgPos, 1)}</td>
              <td className="px-3 py-2 text-right font-mono text-muted">
                {p.best}–{p.worst}
              </td>
              <td className="px-3 py-2 text-right font-mono text-muted">{num(p.sdPos, 1)}</td>
              <td className="px-3 py-2 text-right font-mono">{num(p.share, 1)} %</td>
              <td className="px-3 py-2 text-right font-mono">{p.leads}</td>
              <td className="px-3 py-2 text-right font-mono">{p.podiums}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
