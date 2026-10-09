import { useEffect, useState } from 'react'
import { useI18n } from '../i18n'
import { getAllTeams } from '../lib/compare'
import type { EventPlayer } from '../lib/events'
import { activeNames, type Substitution } from '../lib/substitutions'
import PlayerInput from './PlayerInput'

type Props = {
  teamTag: string
  opponentTag: string
  teamId: number | null
  opponentTeamId: number | null
  players: EventPlayer[]
  opponentNames: string[]
  substitutions: Substitution[]
  /** Siguiente carrera por apuntar: desde ahí cuenta el cambio salvo que se indique otra */
  nextRaceNo: number
  onSubstitute: (side: Substitution['side'], out: string, inEntry: string, fromRace: number) => Promise<void>
}

/** Cambio en mitad de una war: primero el equipo, luego quién sale, quién entra y desde qué carrera */
export default function SubstituteForm({
  teamTag,
  opponentTag,
  teamId,
  opponentTeamId,
  players,
  opponentNames,
  substitutions,
  nextRaceNo,
  onSubstitute,
}: Props) {
  const { t } = useI18n()
  const defaultRace = String(Math.min(nextRaceNo, 12))
  const [open, setOpen] = useState(false)
  const [side, setSide] = useState<Substitution['side'] | null>(null)
  const [out, setOut] = useState('')
  const [incoming, setIncoming] = useState('')
  const [fromRace, setFromRace] = useState(defaultRace)
  const [busy, setBusy] = useState(false)
  const [members, setMembers] = useState<Record<number, string[]>>({})

  // Miembros registrados de cada equipo, para sugerir quién entra
  useEffect(() => {
    if (!open) return
    let cancelled = false
    getAllTeams()
      .then((teams) => {
        if (cancelled) return
        setMembers(Object.fromEntries(teams.map((tm) => [tm.id, tm.members.map((m) => m.username)])))
      })
      .catch(() => {
        // sin sugerencias: se escribe el nombre a mano
      })
    return () => {
      cancelled = true
    }
  }, [open])

  const race = Math.trunc(Number(fromRace))
  const raceOk = Number.isInteger(race) && race >= 1 && race <= 12
  const names = side === 'home' ? players.map((p) => p.name) : side === 'away' ? opponentNames : []
  // Pueden salir quienes corren en esa carrera y aún no han sido sustituidos
  const leaving =
    side && raceOk
      ? activeNames(names, side, substitutions, race).filter((n) => !substitutions.some((s) => s.side === side && s.out === n))
      : []
  const sideTeamId = side === 'home' ? teamId : opponentTeamId
  const suggestions = (sideTeamId !== null ? members[sideTeamId] : undefined) ?? []
  const taken = [...names, ...substitutions.map((s) => s.in)]
  const ready = !!side && !!out && incoming.trim() !== '' && raceOk && !busy

  const reset = () => {
    setOpen(false)
    setSide(null)
    setOut('')
    setIncoming('')
    setFromRace(defaultRace)
  }

  if (!open) {
    return (
      <button
        onClick={() => {
          setFromRace(defaultRace)
          setOpen(true)
        }}
        className="btn-line text-base"
      >
        ⇄ {t('event.addSub')}
      </button>
    )
  }

  const pill = (active: boolean) =>
    `border-2 px-3 py-1.5 text-sm font-semibold transition-colors ${active ? 'border-kart-yellow bg-kart-yellow/10' : 'border-line hover:border-line/90'}`

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault()
        if (!ready || !side) return
        setBusy(true)
        try {
          await onSubstitute(side, out, incoming.trim(), race)
          reset()
        } finally {
          setBusy(false)
        }
      }}
      className="panel w-full space-y-4 p-4"
    >
      <h3 className="font-display text-lg font-bold">{t('event.addSub')}</h3>

      <div>
        <p className="mb-1 text-sm font-semibold">{t('event.sub.team')}</p>
        <div className="flex flex-wrap gap-2">
          {(['home', 'away'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                setSide(s)
                setOut('')
                setIncoming('')
              }}
              className={pill(side === s)}
            >
              {s === 'home' ? teamTag : opponentTag}
            </button>
          ))}
        </div>
      </div>

      {side && (
        <>
          <label className="block w-28">
            <span className="mb-1 block text-sm font-semibold">{t('event.sub.from')}</span>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={12}
              value={fromRace}
              onChange={(e) => {
                setFromRace(e.target.value)
                setOut('')
              }}
              className="field w-full"
            />
          </label>

          <div>
            <p className="mb-1 text-sm font-semibold">{t('event.sub.out')}</p>
            {leaving.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {leaving.map((n) => (
                  <button key={n} type="button" onClick={() => setOut(n)} className={pill(out === n)}>
                    {n}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted">{t('event.sub.none')}</p>
            )}
          </div>

          {out && (
            <div>
              <p className="mb-1 text-sm font-semibold">{t('event.sub.in')}</p>
              <div className="flex max-w-sm">
                <PlayerInput
                  value={incoming}
                  onChange={setIncoming}
                  suggestions={suggestions}
                  taken={taken}
                  placeholder={side === 'home' ? t('event.subPlaceholder') : opponentTag}
                  maxLength={side === 'home' ? 80 : 40}
                />
              </div>
            </div>
          )}

          {out && incoming.trim() && raceOk && (
            <p className="text-sm text-muted">
              {t('event.sub.summary', { n: race, in: (incoming.split('=').pop() ?? '').trim(), out })}
            </p>
          )}
        </>
      )}

      <div className="flex justify-end gap-2">
        <button type="button" onClick={reset} className="btn-line text-sm">
          {t('common.cancel')}
        </button>
        <button type="submit" disabled={!ready} className="btn-yellow text-sm disabled:opacity-50">
          {t('event.sub.confirm')}
        </button>
      </div>
    </form>
  )
}
