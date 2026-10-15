import { useMemo, useState } from 'react'
import { useI18n } from '../i18n'
import type { MessageKey } from '../i18n/es'
import {
  bestGroup,
  worstGroup,
  MIN_TOGETHER,
  type TeammateStat,
  computeLoungeStats,
  mmrSeries,
  topPercent,
  type Group,
  type LoungeFormat,
  type LoungeStats,
} from '../lib/lounge'
import type { LoungeData } from '../lib/loungeApi'
import { DiffBars, LineChart } from './Charts'
import { SectionTitle, Signed, StatTile, Th } from './StatBlocks'
import { useNum } from './statFormat'
import { countryName } from '../lib/countries'
import { Flag, Tabs } from './ui'

type Period = 'all' | `${number}`

/** Datos del Lounge de MKCentral de un jugador: MMR, historial y estadísticas que salen de ahí */
export function LoungePanel({ data, isMe }: { data: LoungeData | null; isMe: boolean }) {
  const { t, locale } = useI18n()
  const num = useNum()
  const [period, setPeriod] = useState<Period>('all')
  const [tzOffset] = useState(() => -new Date().getTimezoneOffset())

  const seasons = useMemo(() => [...new Set((data?.changes ?? []).map((c) => c.season))].sort((a, b) => b - a), [data])
  const rows = useMemo(() => (data ? data.changes.filter((c) => period === 'all' || c.season === Number(period)) : []), [data, period])
  const stats = useMemo(() => computeLoungeStats(rows, tzOffset), [rows, tzOffset])
  const series = useMemo(() => mmrSeries(rows), [rows])

  if (!data) {
    return (
      <section id="lounge" className="scroll-mt-24">
        <SectionTitle title={t('lg.title')} />
        <div className="panel p-5 text-sm text-muted">{isMe ? t('lg.noneMine') : t('lg.none')}</div>
      </section>
    )
  }

  const { account } = data
  const pct = topPercent(account.overallRank, account.totalPlayers)
  const dateTime = (iso: string) => new Date(iso).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' })
  const date = (iso: string) => new Date(iso).toLocaleDateString(locale, { dateStyle: 'medium' })

  return (
    <section id="lounge" className="scroll-mt-24 space-y-4">
      <SectionTitle title={t('lg.title')} hint={t('lg.hint')}>
        <p className="flex items-center gap-2 font-mono text-xs text-muted">
          <Flag code={account.countryCode} locale={locale} />
          {account.name}
          {account.rankName && <span className="font-bold text-kart-yellow">{account.rankName}</span>}
        </p>
      </SectionTitle>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label={t('lg.mmr')} value={account.mmr !== null ? num(account.mmr, 0) : '—'} sub={t('lg.season', { n: account.season })} accent />
        <StatTile
          label={t('lg.peak')}
          value={num(stats?.peak.mmr ?? account.maxMmr ?? 0, 0)}
          sub={stats ? date(stats.peak.time) : undefined}
          hint={t('lg.peakHint')}
        />
        <StatTile
          label={t('lg.rank')}
          value={account.overallRank !== null ? `#${num(account.overallRank, 0)}` : '—'}
          sub={[
            pct !== null && t('lg.topPercent', { pct: num(pct, 1), total: num(account.totalPlayers ?? 0, 0) }),
            account.countryRank && account.countryCode && t('lg.countryRank', { rank: account.countryRank, total: num(account.countryTotal ?? 0, 0), country: countryName(account.countryCode, locale) }),
          ]
            .filter(Boolean)
            .join(' · ')}
        />
        <StatTile
          label={t('lg.tables')}
          value={stats ? stats.tables : 0}
          sub={stats ? t('lg.winLoss', { w: stats.wins, l: stats.losses, pct: stats.winRate }) : undefined}
          hint={t('lg.tablesHint')}
        />
      </div>

      {seasons.length > 1 && (
        <Tabs
          tabs={[{ id: 'all' as Period, label: t('lg.allSeasons') }, ...seasons.map((s) => ({ id: String(s) as Period, label: t('lg.seasonShort', { n: s }) }))]}
          value={period}
          onChange={setPeriod}
        />
      )}

      {stats ? (
        <>
          <div className="panel p-5">
            <SectionTitle title={t('lg.chart')} hint={t('lg.chartHint')} />
            <LineChart
              points={series.map((p) => ({
                value: p.mmr,
                tip: (
                  <>
                    <b className="font-mono">{num(p.mmr, 0)}</b> <Signed value={p.delta} digits={0} />
                    <span className="block text-muted">{dateTime(p.time)}</span>
                  </>
                ),
              }))}
              format={(v) => num(v, 0)}
              ariaLabel={t('lg.chart')}
              height={220}
            />
          </div>

          <StatsGrid stats={stats} />

          <PartnerPanel stats={stats} />

          <TeammatesPanel stats={stats} />

          <div className="grid gap-4 lg:grid-cols-2">
            <GroupTable
              title={t('lg.byFormat')}
              hint={t('lg.byFormatHint')}
              groups={stats.byFormat}
              label={(g) => t(`lg.fmt.${g.key as LoungeFormat}` as MessageKey)}
            />
            <GroupTable title={t('lg.byTier')} hint={t('lg.byTierHint')} groups={stats.byTier} label={(g) => (g.key === 'SQ' ? 'SQ' : `${t('lg.tier')} ${g.key}`)} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="panel p-5">
              <SectionTitle title={t('lg.weekly')} hint={t('lg.weeklyHint')} />
              <DiffBars
                items={stats.weekly.map((w) => ({
                  key: w.week,
                  value: w.delta,
                  tip: (
                    <>
                      <b>{date(w.week)}</b> · <Signed value={w.delta} digits={0} /> MMR · {t('lg.tablesN', { n: w.tables })}
                    </>
                  ),
                }))}
                ariaLabel={t('lg.weekly')}
              />
            </div>
            <WhenPanel stats={stats} />
          </div>
        </>
      ) : (
        <div className="panel p-5 text-sm text-muted">{t('lg.noTables')}</div>
      )}
    </section>
  )
}

function StatsGrid({ stats }: { stats: LoungeStats }) {
  const { t, locale } = useI18n()
  const num = useNum()
  const date = (iso: string) => new Date(iso).toLocaleDateString(locale, { dateStyle: 'medium' })
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatTile
        label={t('lg.avgScore')}
        value={num(stats.avgScore, 1)}
        sub={[stats.noSqAvgScore !== null && t('lg.noSq', { n: num(stats.noSqAvgScore, 1) }), stats.sqAvgScore !== null && t('lg.sqAvg', { n: num(stats.sqAvgScore, 1) })]
          .filter(Boolean)
          .join(' · ')}
        hint={t('lg.avgScoreHint')}
      />
      <StatTile label={t('lg.net')} value={<Signed value={stats.net} digits={0} />} sub={t('lg.avgRank', { n: stats.avgRank !== null ? num(stats.avgRank, 1) : '—' })} />
      <StatTile
        label={t('lg.best')}
        value={stats.bestScore ? stats.bestScore.score : '—'}
        sub={stats.bestScore ? date(stats.bestScore.time) : undefined}
        hint={t('lg.bestHint')}
      />
      <StatTile
        label={t('lg.streak')}
        value={stats.streak.best}
        sub={t('lg.streakNow', { n: stats.streak.current })}
        hint={t('lg.streakHint')}
      />
      <StatTile
        label={t('lg.bestGain')}
        value={stats.bestGain ? <Signed value={stats.bestGain.delta} digits={0} /> : '—'}
        sub={stats.bestGain ? date(stats.bestGain.time) : undefined}
      />
      <StatTile
        label={t('lg.worstLoss')}
        value={stats.worstLoss ? <Signed value={stats.worstLoss.delta} digits={0} /> : '—'}
        sub={stats.worstLoss ? date(stats.worstLoss.time) : undefined}
      />
      {stats.lastTen && (
        <StatTile
          label={t('lg.lastTen')}
          value={`${stats.lastTen.wins}–${stats.lastTen.losses}`}
          sub={
            <>
              <Signed value={stats.lastTen.gain} digits={0} /> MMR · {t('lg.avgShort', { n: num(stats.lastTen.avgScore, 1) })}
            </>
          }
        />
      )}
    </div>
  )
}

function GroupTable({ title, hint, groups, label }: { title: string; hint: string; groups: Group[]; label: (g: Group) => string }) {
  const { t } = useI18n()
  const num = useNum()
  if (groups.length === 0) return null
  return (
    <div className="panel overflow-x-auto">
      <div className="px-5 pt-4">
        <SectionTitle title={title} hint={hint} />
      </div>
      <table className="w-full text-sm">
        <thead className="bg-bg font-display text-xs text-kart-yellow">
          <tr>
            <Th right={false}>{' '}</Th>
            <Th>{t('lg.col.tables')}</Th>
            <Th>{t('lg.col.score')}</Th>
            <Th>{t('lg.col.delta')}</Th>
            <Th>{t('lg.col.win')}</Th>
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => (
            <tr key={g.key} className="border-t border-line/60">
              <td className="px-3 py-2 font-semibold">{label(g)}</td>
              <td className="px-3 py-2 text-right font-mono text-muted">{g.tables}</td>
              <td className="px-3 py-2 text-right font-mono">{num(g.avgScore, 1)}</td>
              <td className="px-3 py-2 text-right font-mono font-bold">
                <Signed value={g.avgDelta} digits={1} />
              </td>
              <td className="px-3 py-2 text-right font-mono whitespace-nowrap">{g.winRate} %</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Mejor y peor día de la semana y franja horaria según el MMR medio ganado por mesa */
function WhenPanel({ stats }: { stats: LoungeStats }) {
  const { t, locale } = useI18n()
  const bestDay = bestGroup(stats.byWeekday)
  const worstDay = worstGroup(stats.byWeekday)
  const bestHour = bestGroup(stats.byHour)
  const worstHour = worstGroup(stats.byHour)
  const weekday = (key: string) => new Date(Date.UTC(2024, 0, 7 + Number(key))).toLocaleDateString(locale, { weekday: 'long', timeZone: 'UTC' })
  const hours = (key: string) => `${String(key).padStart(2, '0')}:00`
  const sub = (g: Group) => t('lg.whenSub', { delta: g.avgDelta > 0 ? `+${g.avgDelta}` : String(g.avgDelta), n: g.tables })
  const items: { key: string; label: string; g: Group | null; text: (g: Group) => string; good: boolean }[] = [
    { key: 'bd', label: t('lg.bestDay'), g: bestDay, text: (g) => weekday(g.key), good: true },
    { key: 'wd', label: t('lg.worstDay'), g: worstDay, text: (g) => weekday(g.key), good: false },
    { key: 'bh', label: t('lg.bestHour'), g: bestHour, text: (g) => hours(g.key), good: true },
    { key: 'wh', label: t('lg.worstHour'), g: worstHour, text: (g) => hours(g.key), good: false },
  ]
  return (
    <div className="panel p-5">
      <SectionTitle title={t('lg.when')} hint={t('lg.whenHint')} />
      {!bestDay && !bestHour ? (
        <p className="text-sm text-muted">{t('lg.whenFew')}</p>
      ) : (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-4 text-sm">
          {items.map(({ key, label, g, text, good }) =>
            g ? (
              <div key={key} className="min-w-0">
                <dt className="text-muted">{label}</dt>
                <dd className={`font-display text-xl font-bold capitalize sm:text-2xl ${good ? '' : 'text-kart-red'}`}>{text(g)}</dd>
                <dd className="font-mono text-xs text-muted">{sub(g)}</dd>
              </div>
            ) : null,
          )}
        </dl>
      )}
      <p className="mt-3 text-xs text-muted">{t('lg.localTime')}</p>
    </div>
  )
}

/** Tu media frente a la de tus compañeros de equipo: en todas las mesas por equipos, solo en SQ y solo en el Lounge normal */
function PartnerPanel({ stats }: { stats: LoungeStats }) {
  const { t } = useI18n()
  const num = useNum()
  const rows = [
    { key: 'all', label: t('lg.partnerAll'), p: stats.partnerSplit.all },
    { key: 'sq', label: 'SQ', p: stats.partnerSplit.sq },
    { key: 'lounge', label: t('lg.partnerLounge'), p: stats.partnerSplit.lounge },
  ]
  if (!rows[0].p) return null
  return (
    <div className="panel overflow-x-auto">
      <div className="px-5 pt-4">
        <SectionTitle title={t('lg.partner')} hint={t('lg.partnerHint')} />
      </div>
      <table className="w-full text-sm">
        <thead className="bg-bg font-display text-xs text-kart-yellow">
          <tr>
            <Th right={false}>{' '}</Th>
            <Th>{t('lg.col.tables')}</Th>
            <Th>{t('lg.partnerYou')}</Th>
            <Th>{t('lg.partnerThem')}</Th>
            <Th>{t('lg.partnerDiff')}</Th>
            <Th hint={t('lg.partnerMmrHint')}>{t('lg.partnerMmrYou')}</Th>
            <Th hint={t('lg.partnerMmrHint')}>{t('lg.partnerMmrThem')}</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ key, label, p }) => (
            <tr key={key} className="border-t border-line/60">
              <td className="px-3 py-2 font-semibold">{label}</td>
              <td className="px-3 py-2 text-right font-mono text-muted">{p?.tables ?? 0}</td>
              <td className="px-3 py-2 text-right font-mono">{p ? num(p.avgScore, 1) : '—'}</td>
              <td className="px-3 py-2 text-right font-mono">{p ? num(p.avgPartnerScore, 1) : '—'}</td>
              <td className="px-3 py-2 text-right font-mono font-bold">{p ? <Signed value={p.diff} digits={1} /> : '—'}</td>
              <td className="px-3 py-2 text-right font-mono">{p?.avgOwnMmr != null ? num(p.avgOwnMmr, 0) : '—'}</td>
              <td className="px-3 py-2 text-right font-mono font-bold">
                {p?.avgPartnerMmr != null ? num(p.avgPartnerMmr, 0) : '—'}
                {p?.avgPartnerMmr != null && p.mmrTables < p.tables && <span className="ml-1 text-[10px] font-normal text-muted">({p.mmrTables}/{p.tables})</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Ficha con el nombre de un compañero (el nombre puede ser largo: se parte en vez de salirse de la ficha) */
function MateTile({ label, mate, sub }: { label: string; mate: TeammateStat | null; sub?: (m: TeammateStat) => React.ReactNode }) {
  if (!mate) return null
  return (
    <div className="panel min-w-0 p-4">
      <p className="text-xs text-muted sm:text-sm">{label}</p>
      <p className="mt-1 font-display text-xl leading-tight font-extrabold break-words sm:text-3xl">{mate.name ?? `#${mate.id}`}</p>
      {sub && <p className="mt-1.5 font-mono text-xs text-muted">{sub(mate)}</p>}
    </div>
  )
}

/** Compañeros de SQ: con quién más juegas, con quién ganas y pierdes más MMR, y la lista de los más habituales */
function TeammatesPanel({ stats }: { stats: LoungeStats }) {
  const { t, locale } = useI18n()
  const num = useNum()
  const mates = stats.teammates
  const date = (iso: string) => new Date(iso).toLocaleDateString(locale, { dateStyle: 'medium' })
  if (!mates) return null
  const h = mates.highlights
  const net = (m: TeammateStat) => (
    <>
      {t('lg.mateTables', { n: m.tables })} · <Signed value={m.net} digits={0} /> MMR
    </>
  )
  const top = mates.list.slice(0, 10)
  return (
    <div className="space-y-3">
      <SectionTitle title={t('lg.mates')} hint={t('lg.matesHint', { n: MIN_TOGETHER })} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <MateTile label={t('lg.mateMost')} mate={h.mostPlayed} sub={net} />
        <MateTile label={t('lg.mateBestNet')} mate={h.bestNet} sub={net} />
        <MateTile label={t('lg.mateWorstNet')} mate={h.worstNet} sub={net} />
        <MateTile
          label={t('lg.mateBestAvg')}
          mate={h.bestAvg}
          sub={(m) => (
            <>
              <Signed value={m.avgDelta} digits={1} /> MMR · {t('lg.mateTables', { n: m.tables })}
            </>
          )}
        />
        <MateTile
          label={t('lg.mateBestScore')}
          mate={h.bestScore}
          sub={(m) => t('lg.mateScoreSub', { them: num(m.theirAvgScore, 1), me: num(m.myAvgScore, 1) })}
        />
        <MateTile
          label={t('lg.mateHighestMmr')}
          mate={h.highestMmr}
          sub={(m) => t('lg.mateMmrSub', { mmr: num(m.avgMmr ?? 0, 0), n: m.tables })}
        />
      </div>

      {(stats.carry.best || stats.carry.worst) && (
        <div className="grid grid-cols-2 gap-3">
          {stats.carry.best && (
            <StatTile label={t('lg.carryBest')} value={<Signed value={stats.carry.best.diff} digits={1} />} sub={`${date(stats.carry.best.change.time)} · ${stats.carry.best.change.score} pts`} hint={t('lg.carryHint')} />
          )}
          {stats.carry.worst && (
            <StatTile label={t('lg.carryWorst')} value={<Signed value={stats.carry.worst.diff} digits={1} />} sub={`${date(stats.carry.worst.change.time)} · ${stats.carry.worst.change.score} pts`} hint={t('lg.carryHint')} />
          )}
        </div>
      )}

      <div className="panel overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-bg font-display text-xs text-kart-yellow">
            <tr>
              <Th right={false}>{t('lg.mate')}</Th>
              <Th>{t('lg.col.tables')}</Th>
              <Th>{t('lg.mateNet')}</Th>
              <Th>{t('lg.mateAvg')}</Th>
              <Th>{t('lg.col.win')}</Th>
              <Th>{t('lg.mateMyScore')}</Th>
              <Th>{t('lg.mateTheirScore')}</Th>
              <Th>{t('lg.mateTheirMmr')}</Th>
            </tr>
          </thead>
          <tbody>
            {top.map((m) => (
              <tr key={m.id} className="border-t border-line/60">
                <td className="max-w-40 px-3 py-2 font-semibold break-words">{m.name ?? `#${m.id}`}</td>
                <td className="px-3 py-2 text-right font-mono text-muted">{m.tables}</td>
                <td className="px-3 py-2 text-right font-mono font-bold">
                  <Signed value={m.net} digits={0} />
                </td>
                <td className="px-3 py-2 text-right font-mono">
                  <Signed value={m.avgDelta} digits={1} />
                </td>
                <td className="px-3 py-2 text-right font-mono whitespace-nowrap">{m.winRate} %</td>
                <td className="px-3 py-2 text-right font-mono">{num(m.myAvgScore, 1)}</td>
                <td className="px-3 py-2 text-right font-mono">{num(m.theirAvgScore, 1)}</td>
                <td className="px-3 py-2 text-right font-mono">{m.avgMmr !== null ? num(m.avgMmr, 0) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
