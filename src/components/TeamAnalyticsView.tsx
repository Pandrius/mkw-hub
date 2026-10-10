import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { useI18n } from '../i18n'
import type { MessageKey } from '../i18n/es'
import { PHASES } from '../lib/statMath'
import { CLOSE_MARGIN, computeTeamOverview, HALFTIME_RACE, type TeamOverview, type WarSummary } from '../lib/teamAnalytics'
import type { TeamForm } from '../lib/teamForm'
import {
  computeTeamPlayerStats,
  computeTeamStats,
  MIN_OFF_RACES,
  PLAYER_RECENT_RACES,
  rivalKeyOf,
  type TeamPlayerStats,
  type TeamStats,
  type TeamTrackStats,
  type TeamWar,
} from '../lib/teamStats'
import { filterRowsByTrack } from '../lib/trackSearch'
import { DiffBars } from './Charts'
import { SearchBox } from './SearchBox'
import { RecordText, SectionTitle, Signed, StatTile, Th, TrackName } from './StatBlocks'
import { useNum } from './statFormat'
import { trackSuggestion } from './trackSuggestion'
import { EmptyState, Plate } from './ui'

const RESULT_COLOR: Record<WarSummary['result'], string> = {
  W: 'var(--color-kart-green)',
  L: 'var(--color-kart-red)',
  T: 'var(--color-kart-yellow)',
}

/** Letra del resultado en el idioma actual (V/D/E o W/L/T) */
function useResultLetter() {
  const { t } = useI18n()
  return (r: WarSummary['result']) => t(`an.result.${r}` as MessageKey)
}

/** Cifras principales de un conjunto de wars (del equipo o contra un rival) */
function OverviewTiles({ o }: { o: TeamOverview }) {
  const { t } = useI18n()
  const num = useNum()
  return (
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatTile label={t('an.team.wars')} value={o.wars} sub={<RecordText record={o.record} />} />
      <StatTile label={t('an.team.winRate')} value={`${o.winRate} %`} accent sub={t('an.team.raceWinRateSub', { n: o.raceWinRate })} />
      <StatTile
        label={t('an.team.avgDiff')}
        hint={t('an.team.avgDiffHint')}
        value={<Signed value={o.avgDiff} />}
        sub={t('an.team.perRace', { n: (o.diffPerRace > 0 ? '+' : '') + num(o.diffPerRace, 1) })}
      />
      <StatTile
        label={t('an.team.avgScore')}
        hint={t('an.team.avgScoreHint')}
        value={num(o.avgFor, 0)}
        sub={t('an.team.against', { n: num(o.avgAgainst, 0) })}
      />
    </section>
  )
}

/** Pestaña principal del equipo: cifras, diferencia de cada war, cómo se deciden, fases, forma y pistas clave */
export function TeamOverviewPanel({ o, form, stats }: { o: TeamOverview; form: TeamForm | null; stats: TeamStats }) {
  const { t } = useI18n()
  const num = useNum()
  const letter = useResultLetter()

  return (
    <div className="space-y-8">
      <OverviewTiles o={o} />

      <section className="panel p-5">
        <SectionTitle title={t('an.team.diffChart')} hint={t('an.team.diffChartHint')} />
        <DiffBars
          ariaLabel={t('an.team.diffChart')}
          items={o.series.slice(-30).map((w) => ({
            key: w.eventId,
            value: w.diff,
            href: `/eventos/${w.eventId}`,
            tip: (
              <>
                <b>{w.date.slice(0, 10)}</b> · vs {w.opponent} · {w.home}–{w.away} (<Signed value={w.diff} digits={0} />)
              </>
            ),
          }))}
        />
        {o.series.length > 30 && <p className="mt-2 text-xs text-muted">{t('an.team.lastN', { n: 30 })}</p>}
      </section>

      <section>
        <SectionTitle title={t('an.team.situations')} hint={t('an.team.situationsHint', { race: HALFTIME_RACE })} />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile
            label={t('an.team.comebacks')}
            hint={t('an.team.comebacksHint', { race: HALFTIME_RACE })}
            value={t('an.ofN', { a: o.comebacks.won, b: o.comebacks.of })}
            sub={o.comebacks.of ? t('an.pctSub', { n: Math.round((o.comebacks.won / o.comebacks.of) * 100) }) : '—'}
          />
          <StatTile
            label={t('an.team.leadsHeld')}
            hint={t('an.team.leadsHeldHint', { race: HALFTIME_RACE })}
            value={t('an.ofN', { a: o.leadsHeld.won, b: o.leadsHeld.of })}
            sub={o.leadsHeld.of ? t('an.pctSub', { n: Math.round((o.leadsHeld.won / o.leadsHeld.of) * 100) }) : '—'}
          />
          <StatTile
            label={t('an.team.close', { n: CLOSE_MARGIN })}
            hint={t('an.team.closeHint', { n: CLOSE_MARGIN })}
            value={o.close.w + o.close.l + o.close.t ? <RecordText record={o.close} /> : '—'}
          />
          <div className="panel space-y-2 p-4 text-sm">
            <ExtremeWar label={t('an.team.biggestWin')} war={o.biggestWin} />
            <ExtremeWar label={t('an.team.biggestLoss')} war={o.biggestLoss} />
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="panel overflow-x-auto">
          <div className="px-5 pt-4">
            <SectionTitle title={t('an.team.phases')} hint={t('an.team.phasesHint')} />
          </div>
          <table className="w-full text-sm">
            <thead className="bg-bg font-display text-xs text-kart-yellow">
              <tr>
                <Th right={false}> </Th>
                <Th>{t('an.col.races')}</Th>
                <Th>{t('an.col.diffPerRace')}</Th>
                <Th>{t('an.col.raceWins')}</Th>
              </tr>
            </thead>
            <tbody>
              {PHASES.map((ph) => {
                const p = o.phases[ph]
                return (
                  <tr key={ph} className="border-t border-line/60">
                    <td className="px-3 py-2 font-semibold">{t(`an.phase.${ph}` as MessageKey)}</td>
                    <td className="px-3 py-2 text-right font-mono text-muted">{p?.races ?? 0}</td>
                    <td className="px-3 py-2 text-right font-mono font-bold">{p ? <Signed value={p.diffPerRace} /> : '—'}</td>
                    <td className="px-3 py-2 text-right font-mono">{p ? `${p.raceWinRate} %` : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {form && (
          <div className="panel p-5">
            <SectionTitle title={t('an.team.form')} />
            <div className="flex flex-wrap gap-2">
              {form.last.map((w) => (
                <Link
                  key={w.eventId}
                  to={`/eventos/${w.eventId}`}
                  className="flex min-w-16 flex-col items-center border-2 px-2 py-1.5 hover:bg-surface-2"
                  style={{ borderColor: RESULT_COLOR[w.result] }}
                  title={`${w.home} – ${w.away}`}
                >
                  <span className="font-display text-2xl leading-none font-black" style={{ color: RESULT_COLOR[w.result] }}>
                    {letter(w.result)}
                  </span>
                  <span className="font-mono text-[11px] font-bold">
                    <Signed value={w.diff} digits={0} />
                  </span>
                  <span className="max-w-16 truncate font-mono text-[10px] text-muted">{w.opponent}</span>
                </Link>
              ))}
            </div>
            {o.recent && (
              <p className="mt-3 text-sm">
                {t('an.team.recent', { n: o.recent.wars })} <Signed value={o.recent.avgDiff} className="font-mono font-bold" />{' '}
                <span className="text-muted">{t('an.team.recentVs', { n: (o.avgDiff > 0 ? '+' : '') + num(o.avgDiff, 1) })}</span>
              </p>
            )}
            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              {form.current && (
                <>
                  <dt className="text-muted">{t('an.team.currentStreak')}</dt>
                  <dd className="text-right font-mono font-bold" style={{ color: RESULT_COLOR[form.current.result] }}>
                    {form.current.length} {letter(form.current.result)}
                  </dd>
                </>
              )}
              <dt className="text-muted">{t('an.team.bestWinStreak')}</dt>
              <dd className="text-right font-mono font-bold">{form.winStreak.best}</dd>
              <dt className="text-muted">{t('an.team.worstLossStreak')}</dt>
              <dd className="text-right font-mono font-bold">{form.lossStreak.best}</dd>
              <dt className="text-muted">{t('an.team.raceWinStreak')}</dt>
              <dd className="text-right font-mono font-bold">{form.raceWinStreak.best}</dd>
            </dl>
          </div>
        )}
      </section>

      {stats.tracks.length > 0 && (
        <section>
          <SectionTitle title={t('an.keyTracks')} hint={t('an.team.keyTracksHint')} />
          <div className="grid gap-4 md:grid-cols-2">
            <KeyTeamTracks title={t('an.team.goodTracks')} tracks={stats.bestTracks} />
            <KeyTeamTracks title={t('an.team.badTracks')} tracks={stats.worstTracks} />
          </div>
        </section>
      )}
    </div>
  )
}

function ExtremeWar({ label, war }: { label: string; war: WarSummary | null }) {
  return (
    <div>
      <p className="text-xs text-muted">{label}</p>
      {war ? (
        <Link to={`/eventos/${war.eventId}`} className="font-mono font-bold hover:text-kart-yellow">
          <Signed value={war.diff} digits={0} /> <span className="text-muted">vs</span> {war.opponent}
        </Link>
      ) : (
        <p className="font-mono text-muted">—</p>
      )}
    </div>
  )
}

function KeyTeamTracks({ title, tracks }: { title: string; tracks: TeamTrackStats[] }) {
  const { t } = useI18n()
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
                <Signed value={tr.diff} className="font-bold" />
                <span className="ml-2 text-xs text-muted">{t('an.team.trackLine', { wr: tr.raceWinRate, n: tr.races })}</span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

/** Rendimiento del equipo en cada pista */
export function TeamTracksTable({ tracks }: { tracks: TeamTrackStats[] }) {
  const { t } = useI18n()
  const num = useNum()
  const [search, setSearch] = useState('')
  const { rows, suggestions } = useMemo(() => filterRowsByTrack(tracks, (tr) => tr.trackId, search), [tracks, search])
  if (!tracks.length) return <EmptyState title={t('teamStats.noWars')} />

  return (
    <section>
      <SectionTitle title={t('teamStats.trackPerformance')} hint={t('an.team.tracksHint')}>
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
              <Th>{t('an.col.raceWins')}</Th>
              <Th hint={t('an.col.scoreHint')}>{t('an.col.score')}</Th>
              <Th>{t('an.col.diffPerRace')}</Th>
              <Th hint={t('an.col.posHint')}>{t('an.col.pos')}</Th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-sm text-muted">
                  {t('stats.noTracksFound')}
                </td>
              </tr>
            ) : (
              rows.map((tr) => (
                <tr key={tr.trackId} className="border-t border-line/60">
                  <td className="max-w-56 px-3 py-2">
                    <TrackName trackId={tr.trackId} />
                  </td>
                  <td className="px-3 py-2 text-right font-mono">{tr.races}</td>
                  <td className="px-3 py-2 text-right font-mono">
                    {tr.raceWinRate} % <span className="text-xs text-muted">({tr.raceWins})</span>
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    {num(tr.avgHome, 1)} <span className="text-muted">–</span> {num(tr.avgAway, 1)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono font-bold">
                    <Signed value={tr.diff} />
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-muted">
                    {num(tr.avgPosHome, 2)} / {num(tr.avgPosAway, 2)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}

/** Rendimiento de cada jugador en las wars del equipo */
export function TeamPlayersTable({ players, compact = false }: { players: TeamPlayerStats[]; compact?: boolean }) {
  const { t } = useI18n()
  const num = useNum()
  if (!players.length) return <EmptyState title={t('teamStats.noWars')} />

  return (
    <div className="panel overflow-x-auto">
      <table className="w-full min-w-max text-sm">
        <thead className="bg-bg font-display text-xs text-kart-yellow sm:text-sm">
          <tr>
            <Th right={false}>{t('event.player')}</Th>
            <Th>{t('an.col.wars')}</Th>
            <Th>{t('an.col.races')}</Th>
            <Th hint={t('an.perWarHint')}>{t('an.col.perWar')}</Th>
            <Th>{t('an.col.ptsPerRace')}</Th>
            <Th>{t('an.col.avgPos')}</Th>
            <Th>{t('an.col.podium')}</Th>
            <Th hint={t('an.col.shareHint')}>{t('an.col.share')}</Th>
            <Th hint={t('an.col.leadHint')}>{t('an.col.lead')}</Th>
            {!compact && (
              <>
                <Th hint={t('an.col.sdHint')}>{t('an.col.sd')}</Th>
                <Th hint={t('an.col.onOffHint', { n: MIN_OFF_RACES })}>{t('an.col.onOff')}</Th>
                <Th hint={t('an.col.formHint', { n: PLAYER_RECENT_RACES })}>{t('an.col.form')}</Th>
                <Th right={false}>{t('teamStats.bestTrack')}</Th>
                <Th right={false}>{t('teamStats.worstTrack')}</Th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {players.map((p) => (
            <tr key={p.key} className="border-t border-line/60">
              <td className="px-3 py-2 font-semibold">
                {p.profileId ? (
                  <Link to={`/estadisticas/${p.profileId}`} className="hover:text-kart-yellow">
                    {p.name}
                  </Link>
                ) : (
                  p.name
                )}
              </td>
              <td className="px-3 py-2 text-right font-mono">{p.wars}</td>
              <td className="px-3 py-2 text-right font-mono">{p.races}</td>
              <td className="px-3 py-2 text-right font-display text-base font-bold tabular-nums">{p.perWar}</td>
              <td className="px-3 py-2 text-right font-mono">{num(p.avgPoints, 2)}</td>
              <td className="px-3 py-2 text-right font-mono text-muted">{num(p.avgPos, 2)}</td>
              <td className="px-3 py-2 text-right font-mono text-muted">{p.top3Rate} %</td>
              <td className="px-3 py-2 text-right font-mono">{num(p.share, 1)} %</td>
              <td className="px-3 py-2 text-right font-mono">{p.leadRate} %</td>
              {!compact && (
                <>
                  <td className="px-3 py-2 text-right font-mono text-muted">{num(p.sdPoints, 1)}</td>
                  <td className="px-3 py-2 text-right font-mono">
                    {p.onOff ? (
                      <span title={t('an.col.onOffTip', { n: p.onOff.withoutRaces })}>
                        <Signed value={p.onOff.with} /> <span className="text-muted">/</span> <Signed value={p.onOff.without} />
                      </span>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">{p.formDelta === null ? <span className="text-muted">—</span> : <Signed value={p.formDelta} digits={2} />}</td>
                  <td className="px-3 py-2">{p.bestTrack && <TrackWithValue trackId={p.bestTrack.trackId} value={p.bestTrack.avgPoints} n={p.bestTrack.races} />}</td>
                  <td className="px-3 py-2">{p.worstTrack && <TrackWithValue trackId={p.worstTrack.trackId} value={p.worstTrack.avgPoints} n={p.worstTrack.races} />}</td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function TrackWithValue({ trackId, value, n }: { trackId: string; value: number; n: number }) {
  const { t } = useI18n()
  const num = useNum()
  return (
    <span className="flex items-center gap-2">
      <TrackName trackId={trackId} short />
      <span className="font-mono text-xs text-muted">{t('an.trackLine', { pts: num(value, 1), n })}</span>
    </span>
  )
}

/** Cara a cara: balance contra cada rival y, al elegir uno, el detalle de esos enfrentamientos */
export function HeadToHead({ teamId, wars, stats }: { teamId: number; wars: TeamWar[]; stats: TeamStats }) {
  const { t } = useI18n()
  const letter = useResultLetter()
  const [selected, setSelected] = useState<string | null>(null)

  const rows = useMemo(
    () =>
      stats.rivals.map((rv) => {
        const subset = wars.filter((w) => rivalKeyOf(w) === rv.opponentKey)
        return { rv, overview: computeTeamOverview(subset)!, subset }
      }),
    [stats.rivals, wars],
  )
  if (!rows.length) return <EmptyState title={t('teamStats.noWars')} />
  const current = rows.find((r) => r.rv.opponentKey === selected) ?? null

  return (
    <div className="space-y-6">
      <div className="panel overflow-x-auto">
        <table className="w-full min-w-max text-sm">
          <thead className="bg-bg font-display text-xs text-kart-yellow sm:text-sm">
            <tr>
              <Th right={false}>{t('an.h2h.rival')}</Th>
              <Th>{t('an.col.wars')}</Th>
              <Th>{t('an.h2h.record')}</Th>
              <Th hint={t('an.team.avgDiffHint')}>{t('an.h2h.avgDiff')}</Th>
              <Th>{t('an.col.raceWins')}</Th>
              <Th>{t('an.h2h.points')}</Th>
              <Th right={false}>{t('an.h2h.last')}</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ rv, overview }) => {
              const last = rv.matches[0]
              const active = rv.opponentKey === selected
              return (
                <tr
                  key={rv.opponentKey}
                  className={`cursor-pointer border-t border-line/60 hover:bg-surface-2 ${active ? 'bg-surface-2' : ''}`}
                  onClick={() => setSelected(active ? null : rv.opponentKey)}
                >
                  <td className="px-3 py-2">
                    <button type="button" className="flex items-center gap-2 text-left" aria-expanded={active}>
                      <Plate>{rv.opponentTag}</Plate>
                      <span className="font-semibold">{rv.opponentName}</span>
                    </button>
                  </td>
                  <td className="px-3 py-2 text-right font-mono">{rv.wars}</td>
                  <td className="px-3 py-2 text-right font-mono">
                    <RecordText record={overview.record} />
                  </td>
                  <td className="px-3 py-2 text-right font-mono font-bold">
                    <Signed value={overview.avgDiff} />
                  </td>
                  <td className="px-3 py-2 text-right font-mono">{overview.raceWinRate} %</td>
                  <td className="px-3 py-2 text-right font-mono text-muted">
                    {rv.pointsHome}–{rv.pointsAway}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">
                    {last && (
                      <span style={{ color: RESULT_COLOR[last.result] }}>
                        {letter(last.result)} {last.homeScore}–{last.awayScore}
                      </span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <p className="border-t border-line px-4 py-2 text-xs text-muted">{t('an.h2h.pick')}</p>
      </div>

      {current && (
        <RivalDetail
          key={current.rv.opponentKey}
          teamId={teamId}
          name={current.rv.opponentName}
          tag={current.rv.opponentTag}
          rivalId={current.rv.opponentId}
          overview={current.overview}
          wars={current.subset}
        />
      )}
    </div>
  )
}

function RivalDetail({
  teamId,
  name,
  tag,
  rivalId,
  overview,
  wars,
}: {
  teamId: number
  name: string
  tag: string
  rivalId: number | null
  overview: TeamOverview
  wars: TeamWar[]
}) {
  const { t } = useI18n()
  const letter = useResultLetter()
  const stats = useMemo(() => computeTeamStats(teamId, wars), [teamId, wars])
  const players = useMemo(() => computeTeamPlayerStats(wars), [wars])

  return (
    <section className="space-y-6 border-t-2 border-line pt-6">
      <h3 className="flex flex-wrap items-center gap-2 font-display text-2xl font-black">
        {t('an.h2h.vs')} <Plate>{tag}</Plate>
        {rivalId ? (
          <Link to={`/equipos/${rivalId}`} className="hover:text-kart-yellow">
            {name}
          </Link>
        ) : (
          name
        )}
      </h3>
      <OverviewTiles o={overview} />

      <div className="grid gap-4 md:grid-cols-2">
        <KeyTeamTracks title={t('an.h2h.goodTracks')} tracks={stats.bestTracks} />
        <KeyTeamTracks title={t('an.h2h.badTracks')} tracks={stats.worstTracks} />
      </div>

      <div>
        <SectionTitle title={t('an.h2h.players')} hint={t('an.h2h.playersHint')} />
        <TeamPlayersTable players={players} compact />
      </div>

      <div>
        <SectionTitle title={t('an.h2h.wars')} />
        <div className="panel divide-y divide-line/60">
          {[...overview.series].reverse().map((w) => (
            <Link key={w.eventId} to={`/eventos/${w.eventId}`} className="flex items-center justify-between gap-3 p-3 hover:bg-surface-2">
              <span className="flex items-center gap-3">
                <span className="w-6 text-center font-display text-xl font-black" style={{ color: RESULT_COLOR[w.result] }}>
                  {letter(w.result)}
                </span>
                <span className="font-mono text-xs text-muted">{w.date.slice(0, 10)}</span>
              </span>
              <span className="font-display text-lg font-bold tabular-nums">
                {w.home}–{w.away} <Signed value={w.diff} digits={0} className="font-mono text-sm" />
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
