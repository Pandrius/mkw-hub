import { useState } from 'react'
import { useNavigate } from 'react-router'
import { EmptyState, PageHeader, Tabs } from '../components/ui'
import { useI18n } from '../i18n'
import { useAuth } from '../lib/auth'
import { createEvent, type EventKind } from '../lib/events'

export default function NewEvent() {
  const { t } = useI18n()
  const { profile, loading } = useAuth()
  const navigate = useNavigate()
  const [kind, setKind] = useState<EventKind>('war')
  const [teamTag, setTeamTag] = useState('')
  const [opponentTag, setOpponentTag] = useState('')
  const [players, setPlayers] = useState<string[]>(() => Array(6).fill(''))
  const [ingame, setIngame] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (loading) return <p className="text-muted">{t('common.loading')}</p>
  if (!profile) return <EmptyState title={t('stats.signInTitle')}>{t('stats.signInText')}</EmptyState>

  // El primer jugador de la war es, por defecto, quien la crea (si se deja vacío)
  const roster = players.map((p, i) => (i === 0 && !p.trim() ? profile.username : p))
  const placeholder = (i: number) => (i === 0 ? profile.username : t('event.playerN', { n: i + 1 }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const entries = kind === 'war' ? roster.map((p) => p.trim()) : [ingame.trim()]
      const id = await createEvent(kind, teamTag, opponentTag, entries)
      navigate(`/eventos/${id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.saveError'))
      setSaving(false)
    }
  }

  const input =
    'field'

  return (
    <>
      <PageHeader title={t('event.newTitle')} subtitle={t('event.newSubtitle')} />
      <form onSubmit={submit} className="max-w-2xl space-y-6 panel p-6">
        <div>
          <p className="mb-2 text-sm text-muted">{t('event.kind')}</p>
          <Tabs
            tabs={[
              { id: 'war', label: t('event.war') },
              { id: 'lounge', label: t('event.lounge') },
            ]}
            value={kind}
            onChange={setKind}
          />
        </div>

        {kind === 'war' ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <label>
                <span className="mb-1 block text-sm text-muted">{t('event.teamTag')}</span>
                <input required maxLength={12} value={teamTag} onChange={(e) => setTeamTag(e.target.value)} className={input} />
              </label>
              <label>
                <span className="mb-1 block text-sm text-muted">{t('event.opponentTag')}</span>
                <input required maxLength={12} value={opponentTag} onChange={(e) => setOpponentTag(e.target.value)} className={input} />
              </label>
            </div>
            <div>
              <p className="text-sm font-semibold">{t('event.players')}</p>
              <p className="mb-3 text-xs text-muted">{t('event.playersHint')}</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {players.map((p, i) => (
                  <input
                    key={i}
                    required={i > 0}
                    maxLength={80}
                    value={p}
                    onChange={(e) => setPlayers((ps) => ps.map((x, j) => (j === i ? e.target.value : x)))}
                    placeholder={placeholder(i)}
                    className={input}
                  />
                ))}
              </div>
            </div>
          </>
        ) : (
          <label className="block">
            <span className="mb-1 block text-sm text-muted">{t('event.ingameName')}</span>
            <input maxLength={40} value={ingame} onChange={(e) => setIngame(e.target.value)} placeholder={profile.username} className={input} />
          </label>
        )}

        {error && <p className="text-sm text-kart-red">{error}</p>}
        <button
          type="submit"
          disabled={saving}
          className="btn-yellow text-base"
        >
          {saving ? t('event.starting') : t('event.start')}
        </button>
      </form>
    </>
  )
}
