import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { getTrack, getTrackPlateBackground, getTrackTextColor, TRACKS } from '../data/tracks'
import { useI18n } from '../i18n'
import type { MessageKey } from '../i18n/es'
import { useAuth } from '../lib/auth'
import { getCommunity, type Community } from '../lib/community'
import { PERIODS, type BoardKey, type Period } from '../lib/communityBoard'
import { REDEMPTION_FROM } from '../lib/achievements'
import { CROWN_PERIODS, type CrownPeriod } from '../lib/crowns'
import { RECORD_IDS, standingIn, type RecordEntry, type RecordId } from '../lib/records'
import { ALL_MIN_RACES, WEEK_MIN_RACES } from '../lib/trackBoard'
import { CrownBadge } from './CrownBadge'
import { TitleChip } from './Showcase'
import { Th } from './StatBlocks'
import { useNum } from './statFormat'
import { EmptyState, Flag, Plate, Tabs } from './ui'

/** Orden de los logros en el selector (el general va el primero) */
const BOARD_KEYS: BoardKey[] = [
  'overall',
  'podiums',
  'wins',
  'top6',
  'winStreak',
  'top6Streak',
  'cleanEvent',
  'bigEvent',
  'legendEvent',
  'redemption',
  'finalRace',
  'stealthWin',
  'warWins',
  'podiumEverywhere',
  'winEverywhere',
  'allAchievements',
]

/** Jugadores que salen en cada récord antes de «tu posición» */
const RECORD_TOP = 3
/** Jugadores que salen en cada lista de «más veces» de las coronas */
const CROWN_TOP = 3

/** Carga una vez los datos de la comunidad (rankings de logros, récords y coronas) */
function useCommunity() {
  const [data, setData] = useState<Community | null | undefined>(undefined)
  useEffect(() => {
    let cancelled = false
    getCommunity().then((c) => !cancelled && setData(c))
    return () => {
      cancelled = true
    }
  }, [])
  return data
}

function PlayerCell({ id, data }: { id: string; data: Community }) {
  const { locale } = useI18n()
  const p = data.players[id]
  return (
    <Link to={`/estadisticas/${id}`} className="flex min-w-0 items-center gap-2 font-semibold hover:text-kart-yellow">
      {p?.avatar_url && <img src={p.avatar_url} alt="" className="size-6 shrink-0 rounded-full" />}
      <Flag code={p?.country_code ?? null} locale={locale} />
      <span className="truncate">{p?.username ?? '?'}</span>
    </Link>
  )
}

/** Quién lleva ahora cada corona y quién la ha ganado más veces */
function CrownStrip({ data }: { data: Community }) {
  const { t } = useI18n()
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {CROWN_PERIODS.map((p: CrownPeriod) => {
        const board = data.crowns[p]
        const top = Object.entries(board.counts)
          .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
          .slice(0, CROWN_TOP)
        return (
          <section key={p} className="panel flex gap-4 p-4">
            <CrownBadge period={p} state={board.holder ? 'now' : 'none'} size={64} />
            <div className="min-w-0 flex-1">
              <h3 className="font-display text-xl leading-[1.05] font-black">{t(`crown.${p}.name` as MessageKey)}</h3>
              <div className="mt-1.5 text-sm">{board.holder ? <PlayerCell id={board.holder} data={data} /> : <span className="text-muted">{t('crown.vacant')}</span>}</div>
              {top.length > 0 && (
                <ol className="mt-2.5 space-y-0.5 border-t border-line/60 pt-2 font-mono text-[11px] text-muted">
                  {top.map(([id, n]) => (
                    <li key={id} className="flex items-center justify-between gap-2">
                      <span className="truncate">{data.players[id]?.username ?? '?'}</span>
                      <span className="shrink-0 font-bold text-ink">×{n}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </section>
        )
      })}
    </div>
  )
}

/** Rankings de cada logro: todo el tiempo, esta semana (desde el lunes) y hoy, y las coronas de la comunidad */
export function AchievementsRanking() {
  const { t } = useI18n()
  const num = useNum()
  const data = useCommunity()
  const [period, setPeriod] = useState<Period>('all')
  const [key, setKey] = useState<BoardKey>('overall')

  if (data === undefined) return <p className="text-muted">{t('common.loading')}</p>
  if (data === null) return <p className="text-kart-red">{t('common.loadError')}</p>

  const entries = data.board[period][key] ?? []
  const name = (k: BoardKey) => (k === 'overall' ? t('cb.overall') : t(`ach.${k}.name` as MessageKey))

  return (
    <div className="space-y-4">
      <p className="max-w-3xl text-xs text-muted">{t('crown.rankHint')}</p>
      <CrownStrip data={data} />
      <div className="flex flex-wrap items-center gap-3 pt-2">
        <Tabs tabs={PERIODS.map((p) => ({ id: p, label: t(`cb.period.${p}` as MessageKey) }))} value={period} onChange={setPeriod} />
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted">{t('cb.achievement')}</span>
          <select value={key} onChange={(e) => setKey(e.target.value as BoardKey)} className="field w-64">
            {BOARD_KEYS.filter((k) => k !== 'allAchievements' || period === 'all').map((k) => (
              <option key={k} value={k}>
                {name(k)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="max-w-3xl text-xs text-muted">{t(period === 'all' ? 'cb.hintAll' : 'cb.hintWindow')}</p>
      {entries.length === 0 ? (
        <EmptyState title={t('cb.empty')} />
      ) : (
        <div className="panel overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-bg font-display text-xs text-kart-yellow">
              <tr>
                <Th right={false}>#</Th>
                <Th right={false}>{t('rk.player')}</Th>
                <Th>{key === 'overall' ? t('cb.levels') : t('cb.count')}</Th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e, i) => (
                <tr key={e.profileId} className="border-t border-line/60">
                  <td className="px-3 py-2 font-mono text-muted">{i + 1}</td>
                  <td className="px-3 py-2">
                    <PlayerCell id={e.profileId} data={data} />
                  </td>
                  <td className="px-3 py-2 text-right font-mono font-bold text-kart-yellow">{num(e.count, 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="font-mono text-[11px] text-muted">{t('cb.updated', { time: new Date(data.generatedAt).toLocaleString() })}</p>
    </div>
  )
}

/** Los mejores de cada pista (todo el tiempo y esta semana): el primero lleva «Dueño de …» o el título semanal */
export function TrackRanking() {
  const { t } = useI18n()
  const num = useNum()
  const data = useCommunity()
  const [period, setPeriod] = useState<'all' | 'week'>('all')
  const [picked, setPicked] = useState<string | null>(null)

  if (data === undefined) return <p className="text-muted">{t('common.loading')}</p>
  if (data === null) return <p className="text-kart-red">{t('common.loadError')}</p>

  const boards = data.trackBoards[period]
  // Por defecto, la primera pista que ya tiene clasificación
  const trackId = picked ?? TRACKS.find((tr) => boards[tr.id])?.id ?? TRACKS[0].id
  const entries = boards[trackId] ?? []
  const led = TRACKS.filter((tr) => boards[tr.id])
  const titleId = `${period === 'all' ? 'owner' : 'weekly'}:${trackId}`
  const plate = (id: string) => {
    const tr = getTrack(id)
    return (
      <Plate color={getTrackPlateBackground(tr)} textColor={getTrackTextColor(tr)}>
        {tr?.abbr ?? id}
      </Plate>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Tabs
          tabs={[
            { id: 'all' as const, label: t('cb.period.all') },
            { id: 'week' as const, label: t('cb.period.week') },
          ]}
          value={period}
          onChange={setPeriod}
        />
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted">{t('tk.track')}</span>
          <select value={trackId} onChange={(e) => setPicked(e.target.value)} className="field w-64">
            {TRACKS.map((tr) => (
              <option key={tr.id} value={tr.id}>
                {tr.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="max-w-3xl text-xs text-muted">{t(period === 'all' ? 'tk.hintAll' : 'tk.hintWeek', { n: period === 'all' ? ALL_MIN_RACES : WEEK_MIN_RACES })}</p>

      {entries.length === 0 ? (
        <EmptyState title={t('tk.empty')}>{t(period === 'all' ? 'tk.emptyAll' : 'tk.emptyWeek', { n: period === 'all' ? ALL_MIN_RACES : WEEK_MIN_RACES })}</EmptyState>
      ) : (
        <div className="panel overflow-x-auto">
          <div className="flex flex-wrap items-center gap-3 border-b border-line/60 px-3 py-3">
            {plate(trackId)}
            <span className="font-display text-lg font-bold">{getTrack(trackId)?.name}</span>
            <span className="ml-auto">
              <TitleChip def={{ id: titleId, param: trackId }} size="sm" />
            </span>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-bg font-display text-xs text-kart-yellow">
              <tr>
                <Th right={false}>#</Th>
                <Th right={false}>{t('rk.player')}</Th>
                <Th hint={t('tk.adjHint')}>{t('tk.adj')}</Th>
                <Th>{t('rk.pts')}</Th>
                <Th>{t('an.col.races')}</Th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e, i) => (
                <tr key={e.profileId} className="border-t border-line/60">
                  <td className="px-3 py-2 font-mono text-muted">{i + 1}</td>
                  <td className="px-3 py-2">
                    <PlayerCell id={e.profileId} data={data} />
                  </td>
                  <td className="px-3 py-2 text-right font-mono font-bold text-kart-yellow">{num(e.adj, 2)}</td>
                  <td className="px-3 py-2 text-right font-mono">{num(e.avg, 2)}</td>
                  <td className="px-3 py-2 text-right font-mono text-muted">{e.races}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {led.length > 0 && (
        <section>
          <h3 className="font-display text-lg font-bold">{t('tk.who')}</h3>
          <ul className="mt-2 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
            {led.map((tr) => (
              <li key={tr.id}>
                <button type="button" onClick={() => setPicked(tr.id)} className={`flex w-full items-center gap-2 border px-2.5 py-1.5 text-left text-sm ${tr.id === trackId ? 'border-kart-yellow bg-surface-2' : 'border-line hover:border-muted'}`}>
                  {plate(tr.id)}
                  <span className="min-w-0 flex-1 truncate font-semibold">{data.players[boards[tr.id][0].profileId]?.username ?? '?'}</span>
                  <span className="font-mono text-[11px] text-muted">{num(boards[tr.id][0].adj, 1)}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

/** Salón de la fama: las mejores marcas de la comunidad, tu posición, la comparación con otro jugador y la historia de cada récord */
export function HallOfFame() {
  const { t } = useI18n()
  const { profile } = useAuth()
  const data = useCommunity()
  const [rivalId, setRivalId] = useState('')
  const [open, setOpen] = useState<RecordId | null>(null)
  const me = profile?.id ?? null

  const choices = useMemo(
    () =>
      data
        ? Object.entries(data.players)
            .filter(([id]) => id !== me)
            .sort((a, b) => a[1].username.localeCompare(b[1].username))
        : [],
    [data, me],
  )

  if (data === undefined) return <p className="text-muted">{t('common.loading')}</p>
  if (data === null) return <p className="text-kart-red">{t('common.loadError')}</p>
  if (RECORD_IDS.every((id) => data.records[id].length === 0)) return <EmptyState title={t('hof.empty')} />

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <p className="max-w-2xl flex-1 text-xs text-muted">{t('hof.hint')}</p>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted">{t(me ? 'hof.compareMe' : 'hof.compare')}</span>
          <select value={rivalId} onChange={(e) => setRivalId(e.target.value)} className="field w-56">
            <option value="">—</option>
            {choices.map(([id, p]) => (
              <option key={id} value={id}>
                {p.username}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {RECORD_IDS.filter((id) => data.records[id].length > 0).map((id) => (
          <RecordCard key={id} id={id} data={data} me={me} rivalId={rivalId || null} open={open === id} onToggle={() => setOpen(open === id ? null : id)} />
        ))}
      </div>
    </div>
  )
}

function RecordCard({ id, data, me, rivalId, open, onToggle }: { id: RecordId; data: Community; me: string | null; rivalId: string | null; open: boolean; onToggle: () => void }) {
  const { t } = useI18n()
  const num = useNum()
  const list = data.records[id]
  const top = list.slice(0, RECORD_TOP)
  // Quienes se miran aparte (tú y el otro jugador) si no están ya entre los primeros
  const focus = [me, rivalId].filter((x): x is string => !!x && !top.some((e) => e.profileId === x))
  const history = data.history[id]

  const value = (e: RecordEntry) =>
    e.eventId ? (
      <Link to={`/eventos/${e.eventId}`} className="font-mono text-lg font-bold hover:text-kart-yellow" title={e.date.slice(0, 10)}>
        {num(e.value, 0)}
      </Link>
    ) : (
      <span className="font-mono text-lg font-bold">{num(e.value, 0)}</span>
    )

  return (
    <section className="panel flex flex-col p-4">
      <h3 className="font-display text-xl leading-tight font-black">{t(`hof.${id}` as MessageKey)}</h3>
      <p className="mt-1 text-xs text-muted">{t(`hof.${id}.desc` as MessageKey, { from: REDEMPTION_FROM })}</p>
      <ol className="mt-3 space-y-2">
        {top.map((e, i) => (
          <li key={e.profileId} className="flex items-center gap-3">
            <span className={`w-5 font-mono text-sm font-bold ${i === 0 ? 'text-kart-yellow' : 'text-muted'}`}>{i + 1}</span>
            <span className="min-w-0 flex-1">
              <PlayerCell id={e.profileId} data={data} />
            </span>
            <span className="text-right">
              {value(e)}
              <span className="block font-mono text-[10px] text-muted">{e.date.slice(0, 10)}</span>
            </span>
          </li>
        ))}
      </ol>
      {focus.length > 0 && (
        <ul className="mt-3 space-y-2 border-t border-dashed border-line pt-3">
          {focus.map((pid) => {
            const s = standingIn(list, pid)
            return (
              <li key={pid} className="flex items-center gap-3">
                <span className="w-5 font-mono text-sm font-bold text-muted">{s?.rank ?? '–'}</span>
                <span className="min-w-0 flex-1">
                  <PlayerCell id={pid} data={data} />
                  {pid === me && <span className="ml-1 font-mono text-[10px] text-kart-yellow uppercase">{t('stats.you')}</span>}
                  {s?.gap != null && <span className="block font-mono text-[10px] text-muted">{t('hof.gap', { n: num(s.gap, 0), rank: s.rank - 1 })}</span>}
                  {!s && <span className="block font-mono text-[10px] text-muted">{t('hof.noMark')}</span>}
                </span>
                {s && <span className="text-right">{value(s.entry)}</span>}
              </li>
            )
          })}
        </ul>
      )}
      {history.length > 1 && (
        <div className="mt-auto pt-3">
          <button type="button" aria-expanded={open} onClick={onToggle} className="font-mono text-[11px] font-bold text-kart-yellow uppercase hover:underline">
            {open ? t('hof.hideHistory') : t('hof.history', { n: history.length })}
          </button>
          {open && (
            <ol className="mt-2 space-y-1.5 border-t border-line pt-2">
              {[...history].reverse().map((h, i, arr) => {
                const before = arr[i + 1]
                return (
                  <li key={`${h.profileId}${h.date}${h.value}`} className="text-xs">
                    <span className="font-mono text-muted">{h.date.slice(0, 10)}</span> · <span className="font-semibold">{data.players[h.profileId]?.username ?? '?'}</span>{' '}
                    <span className="font-mono font-bold text-kart-yellow">{num(h.value, 0)}</span>
                    {before && (
                      <span className="text-muted">
                        {' '}
                        — {before.profileId === h.profileId ? t('hof.improved', { value: num(before.value, 0) }) : t('hof.beat', { name: data.players[before.profileId]?.username ?? '?', value: num(before.value, 0) })}
                      </span>
                    )}
                  </li>
                )
              })}
            </ol>
          )}
        </div>
      )}
    </section>
  )
}
