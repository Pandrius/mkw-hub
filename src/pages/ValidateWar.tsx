import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import WarImagePreview from '../components/WarImagePreview'
import { EmptyState, PageHeader, Plate } from '../components/ui'
import { useI18n } from '../i18n'
import { useAuth } from '../lib/auth'
import { teamsOf } from '../lib/compare'
import { acceptOpponentWar, getEvent, getMirrorOf, rejectOpponentWar, type EventDetail } from '../lib/events'
import { mirrorEventDetail, NO_CORRECTIONS, warPlayerNames, type WarCorrections } from '../lib/mirrorWar'
import { buildWarTable } from '../lib/warTable'

type Group = 'teamNames' | 'opponentNames' | 'penaltyLabels'

/**
 * Un miembro del equipo rival revisa la war que subió el otro equipo y la valida: se sube también en su equipo,
 * desde su perspectiva. Puede corregir nombres de jugadores y de penalties; puntuaciones y pistas no.
 */
export default function ValidateWar() {
  const { t } = useI18n()
  const { eventId = '' } = useParams()
  const { profile, isAdmin, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [detail, setDetail] = useState<EventDetail | null | undefined>(undefined)
  const [myTeams, setMyTeams] = useState<number[] | null>(null)
  const [copyId, setCopyId] = useState<string | null>(null)
  const [fix, setFix] = useState<WarCorrections>(NO_CORRECTIONS)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    getEvent(eventId).then(
      async (d) => {
        if (cancelled) return
        setDetail(d)
        // Si ya la validó alguien, se enseña dónde está la copia
        if (d?.event.opponent_confirmed) {
          const copy = await getMirrorOf(eventId).catch(() => null)
          if (!cancelled) setCopyId(copy?.id ?? null)
        }
      },
      () => !cancelled && setDetail(null),
    )
    return () => {
      cancelled = true
    }
  }, [eventId])

  useEffect(() => {
    if (!profile) return
    let cancelled = false
    teamsOf(profile.id).then(
      (teams) => !cancelled && setMyTeams(teams.filter((x) => x.kind === 'team').map((x) => x.id)),
      () => !cancelled && setMyTeams([]),
    )
    return () => {
      cancelled = true
    }
  }, [profile])

  const names = useMemo(() => (detail ? warPlayerNames(detail) : null), [detail])
  const mirrored = useMemo(() => (detail ? mirrorEventDetail(detail, fix) : null), [detail, fix])
  const table = useMemo(
    () =>
      mirrored
        ? buildWarTable(mirrored.players, mirrored.races, mirrored.event.opponent_players, mirrored.event.penalties, mirrored.event.substitutions)
        : null,
    [mirrored],
  )

  if (authLoading || detail === undefined || (profile && myTeams === null)) return <p className="text-muted">{t('common.loading')}</p>
  if (!profile) return <EmptyState title={t('stats.signInTitle')}>{t('stats.signInText')}</EmptyState>
  if (!detail || !names || !mirrored || !table) return <EmptyState title={t('event.notFound')} />

  const { event } = detail
  const ready = event.kind === 'war' && event.status === 'finished' && event.team_id !== null && event.opponent_team_id !== null && !event.mirror_of
  const allowed = isAdmin || (myTeams ?? []).includes(event.opponent_team_id ?? -1)
  const validated = event.opponent_confirmed === true
  const rejected = event.opponent_confirmed === false

  if (!ready) return <EmptyState title={t('validate.notReady')} />
  if (!allowed) return <EmptyState title={t('validate.notAllowed')} />

  const setName = (group: Group, key: string, value: string, original: string) =>
    setFix((f) => {
      const next = { ...f[group] }
      if (value === original) delete next[key]
      else next[key] = value
      return { ...f, [group]: next }
    })

  const run = async (action: () => Promise<void>) => {
    setBusy(true)
    setError(null)
    try {
      await action()
    } catch (err) {
      const message = err instanceof Error ? err.message : t('common.saveError')
      // Otra persona del equipo se adelantó: se recarga para enseñar que ya está validada
      setError(message.includes('conflict') ? t('validate.conflict') : message)
      if (message.includes('conflict')) setDetail(await getEvent(eventId).catch(() => detail))
    } finally {
      setBusy(false)
    }
  }

  const accept = () =>
    run(async () => {
      const id = await acceptOpponentWar(eventId, fix)
      navigate(`/eventos/${id}`)
    })

  const reject = () => {
    if (!confirm(t('validate.confirmReject'))) return
    void run(async () => {
      await rejectOpponentWar(eventId)
      navigate(`/equipos/${event.opponent_team_id}`)
    })
  }

  const field = 'field py-1.5'

  return (
    <div className="space-y-6">
      <Link to={`/equipos/${event.opponent_team_id}`} className="text-sm text-muted hover:text-ink">
        {t('validate.back', { team: event.opponent_tag ?? '' })}
      </Link>
      <PageHeader title={t('validate.title')} subtitle={t('validate.subtitle', { tag: event.team_tag ?? '?' })} />

      {validated && (
        <div className="border-l-4 border-kart-green bg-surface px-4 py-3 text-sm">
          <p className="font-semibold">{t('validate.already')}</p>
          {copyId && (
            <Link to={`/eventos/${copyId}`} className="mt-1 inline-block font-semibold text-kart-blue hover:underline">
              {t('validate.seeCopy')} →
            </Link>
          )}
        </div>
      )}
      {rejected && <p className="border-l-4 border-kart-red bg-surface px-4 py-3 text-sm">{t('validate.rejected')}</p>}

      <section className="overflow-hidden panel">
        <h2 className="border-b border-line px-5 py-3 font-display text-xl font-bold">{t('validate.preview')}</h2>
        <WarImagePreview event={mirrored.event} races={mirrored.races} table={table} />
      </section>

      {!validated && (
        <section className="panel space-y-5 p-5">
          <div>
            <h2 className="font-display text-xl font-bold">{t('validate.fix')}</h2>
            <p className="text-xs text-muted">{t('validate.fixHint')}</p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <fieldset className="space-y-2">
              <legend className="mb-1 flex items-center gap-2 font-mono text-xs font-bold uppercase text-kart-yellow">
                <Plate>{event.opponent_tag ?? '?'}</Plate> {t('validate.yourTeam')}
              </legend>
              {names.team.map((name) => (
                <input
                  key={name}
                  maxLength={80}
                  value={fix.teamNames[name] ?? name}
                  onChange={(e) => setName('teamNames', name, e.target.value, name)}
                  aria-label={name}
                  className={field}
                />
              ))}
            </fieldset>

            <fieldset className="space-y-2">
              <legend className="mb-1 flex items-center gap-2 font-mono text-xs font-bold uppercase text-muted">
                <Plate>{event.team_tag ?? '?'}</Plate> {t('validate.theirTeam')}
              </legend>
              {names.opponent.map((name) => (
                <input
                  key={name}
                  maxLength={40}
                  value={fix.opponentNames[name] ?? name}
                  onChange={(e) => setName('opponentNames', name, e.target.value, name)}
                  aria-label={name}
                  className={field}
                />
              ))}
            </fieldset>
          </div>

          {event.penalties.length > 0 && (
            <fieldset className="space-y-2">
              <legend className="mb-1 font-mono text-xs font-bold uppercase text-muted">{t('validate.penalties')}</legend>
              {event.penalties.map((p, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="w-14 font-display font-black text-muted">{p.side === 'home' ? event.team_tag : event.opponent_tag}</span>
                  <input
                    maxLength={40}
                    value={fix.penaltyLabels[String(i)] ?? p.label}
                    onChange={(e) => setName('penaltyLabels', String(i), e.target.value, p.label)}
                    aria-label={p.label}
                    className={`${field} flex-1`}
                  />
                  <span className="w-12 text-right font-display text-lg font-bold tabular-nums text-kart-red" title={t('validate.points')}>
                    {p.points}
                  </span>
                </div>
              ))}
            </fieldset>
          )}

          {error && <p className="text-sm text-kart-red">{error}</p>}

          <div className="flex flex-wrap justify-end gap-3 border-t border-line pt-4">
            <button onClick={reject} disabled={busy} className="btn-line text-base">
              {t('validate.reject')}
            </button>
            <button onClick={accept} disabled={busy} className="btn-yellow text-base">
              {busy ? t('validate.accepting') : t('validate.accept')}
            </button>
          </div>
        </section>
      )}
    </div>
  )
}
