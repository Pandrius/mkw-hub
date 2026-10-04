import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import AddTimeForm from '../components/AddTimeForm'
import TimeGoals from '../components/TimeGoals'
import { EmptyState, Flag, PageHeader, Plate, Tabs } from '../components/ui'
import { getCup, TRACKS } from '../data/tracks'
import { useI18n } from '../i18n'
import { useAuth } from '../lib/auth'
import {
  buildComparison,
  ENTITY_COLORS,
  entityKey,
  getBestTimes,
  getProfileNames,
  resolveEntities,
  searchEntities,
  summarize,
  teamsOf,
  type BestTime,
  type Entity,
} from '../lib/compare'
import { formatTime } from '../lib/time'
import type { TtCategory } from '../lib/timeTrials'
import { listCurrentWorldRecords, type WorldRecord } from '../lib/worldRecords'

const MAX_ENTITIES = 12

/** Diferencia en segundos con signo: +1.234 / −0.500 */
const gap = (ms: number) => `${ms >= 0 ? '+' : '−'}${(Math.abs(ms) / 1000).toFixed(3)}`

export default function MyTimes() {
  const { t } = useI18n()
  const { profile, loading, enabled, signIn } = useAuth()
  const [params, setParams] = useSearchParams()
  const [entities, setEntities] = useState<Entity[] | null>(null)
  const [category, setCategory] = useState<TtCategory>('race')
  const [items, setItems] = useState<'items' | 'nita'>('items')
  const [times, setTimes] = useState<BestTime[]>([])
  const [names, setNames] = useState<Map<string, string>>(new Map())
  const [wrs, setWrs] = useState<Map<string, WorldRecord>>(new Map())
  const [myTeams, setMyTeams] = useState<Entity[]>([])
  const [adding, setAdding] = useState(false)
  const [version, setVersion] = useState(0)

  // Selección desde la URL (?con=player:<id>,team:<id>); por defecto, uno mismo
  const keysParam = params.get('con')
  const keys = useMemo(
    () => (keysParam ? keysParam.split(',').filter(Boolean) : profile ? [`player:${profile.id}`] : []),
    [keysParam, profile],
  )

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    resolveEntities(keys).then((e) => !cancelled && setEntities(e), () => !cancelled && setEntities([]))
    return () => {
      cancelled = true
    }
  }, [enabled, keys])

  useEffect(() => {
    if (!enabled) return
    listCurrentWorldRecords().then((data) => setWrs(new Map(data.map((r) => [r.track_id, r]))), () => {})
  }, [enabled])

  useEffect(() => {
    if (!profile) return
    teamsOf(profile.id).then(setMyTeams, () => {})
  }, [profile])

  const profileIds = useMemo(
    () => [...new Set((entities ?? []).flatMap((e) => (e.kind === 'player' ? [e.id] : e.memberIds)))],
    [entities],
  )

  useEffect(() => {
    if (!enabled || !entities) return
    let cancelled = false
    Promise.all([getBestTimes(profileIds, category, items === 'nita'), getProfileNames(profileIds)]).then(
      ([bt, n]) => {
        if (cancelled) return
        setTimes(bt)
        setNames(n)
      },
      () => {},
    )
    return () => {
      cancelled = true
    }
  }, [enabled, entities, profileIds, category, items, version])

  const setKeys = (next: string[]) => setParams(next.length ? { con: next.join(',') } : {})
  const add = (e: Entity) => {
    const k = entityKey(e)
    if (!keys.includes(k) && keys.length < MAX_ENTITIES) setKeys([...keys, k])
  }
  const remove = (e: Entity) => setKeys(keys.filter((k) => k !== entityKey(e)))

  if (loading) return <p className="text-muted">{t('common.loading')}</p>

  const list = entities ?? []
  const rows = buildComparison(
    TRACKS.map((tr) => tr.id),
    list,
    times,
  )
  const summary = summarize(rows, list.length)
  const showWr = category === 'race' && items === 'items'
  const onlyMe = list.length === 1 && list[0].kind === 'player' && list[0].id === profile?.id

  return (
    <>
      <PageHeader
        title={onlyMe || list.length === 0 ? t('times.title') : t('times.compareTitle')}
        subtitle={t('times.subtitle')}
        kicker={t('times.kicker')}
      />

      {!profile && list.length === 0 && (
        <EmptyState title={t('stats.signInTitle')}>
          <p>{t('times.signIn')}</p>
          {enabled && (
            <button onClick={signIn} className="btn-yellow mt-4 text-base">
              {t('auth.signIn')}
            </button>
          )}
        </EmptyState>
      )}

      <section className="mb-6 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          {list.map((e, i) => (
            <EntityChip key={entityKey(e)} entity={e} color={ENTITY_COLORS[i % ENTITY_COLORS.length]} onRemove={() => remove(e)} />
          ))}
          {keys.length < MAX_ENTITIES && <EntitySearch onPick={add} exclude={keys} />}
        </div>

        {(profile || myTeams.length > 0) && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-mono text-xs font-bold text-muted">{t('times.quick')}</span>
            {profile && !keys.includes(`player:${profile.id}`) && (
              <button
                onClick={() => add({ kind: 'player', id: profile.id, name: profile.username, country: profile.country_code, avatar: profile.avatar_url })}
                className="border-2 border-line px-2 py-0.5 font-semibold hover:border-kart-yellow"
              >
                + {t('times.me')}
              </button>
            )}
            {myTeams
              .filter((tm) => !keys.includes(entityKey(tm)))
              .map((tm) => (
                <button key={entityKey(tm)} onClick={() => add(tm)} className="border-2 border-line px-2 py-0.5 font-semibold hover:border-kart-yellow">
                  + {tm.kind === 'team' ? tm.tag : ''}
                </button>
              ))}
            {keys.length > 1 && (
              <button onClick={() => setKeys(profile ? [`player:${profile.id}`] : [])} className="text-muted underline-offset-4 hover:underline">
                {t('times.reset')}
              </button>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Tabs
            tabs={[
              { id: 'race', label: t('tt.race') },
              { id: 'flap', label: t('tt.flap') },
            ]}
            value={category}
            onChange={setCategory}
          />
          <Tabs
            tabs={[
              { id: 'items', label: t('tt.items') },
              { id: 'nita', label: t('tt.nita') },
            ]}
            value={items}
            onChange={setItems}
          />
          {profile && !adding && (
            <button onClick={() => setAdding(true)} className="btn-yellow ml-auto text-base">
              + {t('tt.addMine')}
            </button>
          )}
        </div>

        {adding && (
          <AddTimeForm
            category={category}
            nita={items === 'nita'}
            onDone={() => {
              setAdding(false)
              setVersion((v) => v + 1)
            }}
            onCancel={() => setAdding(false)}
          />
        )}
      </section>

      {/* Objetivos: solo cuando se mira a un único jugador */}
      {list.length === 1 && list[0].kind === 'player' && (
        <TimeGoals
          profileId={list[0].id}
          category={category}
          nita={items === 'nita'}
          times={times}
          wrs={showWr ? new Map([...wrs].map(([trackId, wr]) => [trackId, wr.time_ms])) : null}
        />
      )}

      {list.length > 0 && (
        <div className="panel overflow-x-auto">
          <table className="w-full min-w-max text-sm">
            <thead className="bg-bg text-left font-display text-sm tracking-wider text-kart-yellow">
              <tr>
                <th className="sticky left-0 z-10 bg-bg px-4 py-2 font-extrabold">{t('wr.colTrack')}</th>
                {showWr && <th className="px-4 py-2 font-extrabold text-muted">WR</th>}
                {list.map((e, i) => (
                  <th key={entityKey(e)} className="px-4 py-2 font-extrabold" style={{ color: ENTITY_COLORS[i % ENTITY_COLORS.length] }}>
                    {e.kind === 'player' ? e.name : e.tag}
                  </th>
                ))}
              </tr>
              <tr className="border-t border-line font-mono text-[11px] font-bold tracking-normal text-muted normal-case">
                <td className="sticky left-0 z-10 bg-bg px-4 py-1.5">{t('times.summary')}</td>
                {showWr && <td />}
                {summary.map((s, i) => (
                  <td key={i} className="px-4 py-1.5">
                    {t('times.tracksCount', { n: s.tracks, total: TRACKS.length })}
                    {list.length > 1 && ` · ${t('times.wins', { n: s.wins })}`}
                  </td>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const track = TRACKS.find((tr) => tr.id === row.trackId)!
                const wr = wrs.get(row.trackId)
                return (
                  <tr key={row.trackId} className="border-t border-line/60">
                    <td className="sticky left-0 z-10 bg-surface px-4 py-2">
                      <Link to={`/pistas/${track.id}`} className="flex items-center gap-2 hover:text-kart-yellow">
                        <Plate color={getCup(track.cupId)?.color}>{track.abbr}</Plate>
                        <span className="hidden whitespace-nowrap sm:inline">{track.name}</span>
                      </Link>
                    </td>
                    {showWr && <td className="time px-4 py-2 font-medium text-muted">{wr ? formatTime(wr.time_ms) : '—'}</td>}
                    {row.cells.map((cell, i) => {
                      const e = list[i]
                      const color = ENTITY_COLORS[i % ENTITY_COLORS.length]
                      const isFastest = list.length > 1 && row.fastest === i
                      return (
                        <td
                          key={i}
                          className="px-4 py-2 whitespace-nowrap"
                          style={isFastest ? { boxShadow: `inset 3px 0 0 ${color}`, background: `color-mix(in srgb, ${color} 12%, transparent)` } : undefined}
                        >
                          {cell ? (
                            <>
                              <div className="flex items-baseline gap-1.5">
                                <span className="time text-base">{formatTime(cell.time_ms)}</span>
                                {showWr && wr && <span className="font-mono text-xs text-muted">{gap(cell.time_ms - wr.time_ms)}</span>}
                              </div>
                              <div className="flex items-center gap-2 text-xs text-muted">
                                {e.kind === 'team' && <span>{names.get(cell.profileId) ?? '?'}</span>}
                                {cell.proof_url && (
                                  <a
                                    href={cell.proof_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-kart-blue hover:underline"
                                    title={t('common.proof')}
                                  >
                                    ↗
                                  </a>
                                )}
                              </div>
                            </>
                          ) : (
                            <span className="text-line">—</span>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      {list.length > 0 && (
        <p className="mt-3 text-xs text-muted">
          {showWr ? t('times.footnoteWr') : t('times.footnote')}
          {list.length > 1 && ` · ${t('times.highlight')}`}
        </p>
      )}
    </>
  )
}

function EntityChip({ entity, color, onRemove }: { entity: Entity; color: string; onRemove: () => void }) {
  const { t, locale } = useI18n()
  return (
    <span className="flex items-center gap-2 border-2 bg-surface py-1 pr-2 pl-2" style={{ borderColor: color }}>
      <span className="h-4 w-1.5" style={{ background: color }} />
      {entity.kind === 'player' ? (
        <>
          <Flag code={entity.country} locale={locale} />
          <span className="font-semibold">{entity.name}</span>
        </>
      ) : (
        <>
          <span className="font-display text-base font-black">{entity.tag}</span>
          <span className="text-xs text-muted">
            {entity.name} · {t('times.members', { n: entity.memberIds.length })}
          </span>
        </>
      )}
      <button onClick={onRemove} aria-label={t('common.delete')} className="ml-1 text-muted hover:text-kart-red">
        ✕
      </button>
    </span>
  )
}

function EntitySearch({ onPick, exclude }: { onPick: (e: Entity) => void; exclude: string[] }) {
  const { t } = useI18n()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Entity[]>([])

  useEffect(() => {
    if (query.trim().length < 2) return
    let cancelled = false
    const timer = setTimeout(() => {
      searchEntities(query).then((r) => !cancelled && setResults(r), () => {})
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [query])

  const visible = query.trim().length < 2 ? [] : results.filter((r) => !exclude.includes(entityKey(r)))

  return (
    <div className="relative">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t('times.search')}
        className="field w-64"
      />
      {visible.length > 0 && (
        <ul className="absolute z-20 mt-1 w-80 border-2 border-kart-yellow bg-bg">
          {visible.map((r) => (
            <li key={entityKey(r)}>
              <button
                onClick={() => {
                  onPick(r)
                  setQuery('')
                  setResults([])
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-surface-2"
              >
                <span className={`px-1.5 font-mono text-[10px] font-bold ${r.kind === 'team' ? 'bg-kart-yellow text-bg' : 'bg-ink text-bg'}`}>
                  {r.kind === 'team' ? t('times.team') : t('times.player')}
                </span>
                <span className="font-semibold">{r.kind === 'team' ? `${r.tag} · ${r.name}` : r.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
