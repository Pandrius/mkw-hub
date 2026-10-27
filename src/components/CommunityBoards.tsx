import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { useI18n } from '../i18n'
import type { MessageKey } from '../i18n/es'
import { getCommunity, type Community } from '../lib/community'
import { PERIODS, type BoardKey, type Period } from '../lib/communityBoard'
import { RECORD_IDS } from '../lib/records'
import { Th } from './StatBlocks'
import { useNum } from './statFormat'
import { EmptyState, Flag, Tabs } from './ui'

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

/** Carga una vez los datos de la comunidad (rankings de logros y récords) */
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
    <Link to={`/estadisticas/${id}`} className="flex items-center gap-2 font-semibold hover:text-kart-yellow">
      {p?.avatar_url && <img src={p.avatar_url} alt="" className="size-6 rounded-full" />}
      <Flag code={p?.country_code ?? null} locale={locale} />
      {p?.username ?? '?'}
    </Link>
  )
}

/** Rankings de cada logro: todo el tiempo, esta semana (desde el lunes) y hoy */
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
      <div className="flex flex-wrap items-center gap-3">
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

/** Salón de la fama: las mejores marcas de la comunidad */
export function HallOfFame() {
  const { t } = useI18n()
  const num = useNum()
  const data = useCommunity()

  if (data === undefined) return <p className="text-muted">{t('common.loading')}</p>
  if (data === null) return <p className="text-kart-red">{t('common.loadError')}</p>
  if (RECORD_IDS.every((id) => data.records[id].length === 0)) return <EmptyState title={t('hof.empty')} />

  return (
    <div className="space-y-4">
      <p className="max-w-3xl text-xs text-muted">{t('hof.hint')}</p>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {RECORD_IDS.filter((id) => data.records[id].length > 0).map((id) => (
          <section key={id} className="panel p-4">
            <h3 className="font-display text-xl leading-tight font-black">{t(`hof.${id}` as MessageKey)}</h3>
            <p className="mt-1 text-xs text-muted">{t(`hof.${id}.desc` as MessageKey)}</p>
            <ol className="mt-3 space-y-2">
              {data.records[id].map((e, i) => (
                <li key={e.profileId} className="flex items-center gap-3">
                  <span className={`w-5 font-mono text-sm font-bold ${i === 0 ? 'text-kart-yellow' : 'text-muted'}`}>{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate">
                    <PlayerCell id={e.profileId} data={data} />
                  </span>
                  <span className="text-right">
                    {e.eventId ? (
                      <Link to={`/eventos/${e.eventId}`} className="font-mono text-lg font-bold hover:text-kart-yellow" title={e.date?.slice(0, 10)}>
                        {num(e.value, 0)}
                      </Link>
                    ) : (
                      <span className="font-mono text-lg font-bold">{num(e.value, 0)}</span>
                    )}
                    {e.date && <span className="block font-mono text-[10px] text-muted">{e.date.slice(0, 10)}</span>}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>
    </div>
  )
}
