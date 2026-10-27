import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { EmptyState, PageHeader, Plate } from '../components/ui'
import { getTrack } from '../data/tracks'
import { useI18n } from '../i18n'
import type { MessageKey } from '../i18n/es'
import { useAuth } from '../lib/auth'
import { listNotices, markNoticesRead, type Notice } from '../lib/notices'

type Translate = (key: MessageKey, vars?: Record<string, string | number>) => string
const RANKING_KINDS: Notice['kind'][] = ['record_lost', 'throne_lost', 'crown_won', 'track_won', 'track_lost']

/** Texto de un aviso de ranking y la pestaña del ranking a la que lleva */
function rankingNotice(n: Notice, t: Translate): { text: string; tab: string } {
  const who = n.actor?.username ?? '?'
  const track = getTrack(n.data?.track ?? '')
  const title = t(n.data?.period === 'week' ? 'title.weekly.name' : 'title.owner.name', { track: track?.abbr ?? track?.name ?? n.data?.track ?? '' })
  switch (n.kind) {
    case 'throne_lost':
      return { text: t('notices.throneLost', { who }), tab: 'achievements' }
    case 'crown_won':
      return { text: t('notices.crownWon', { crown: t(`crown.${n.data?.period ?? 'day'}.name` as MessageKey) }), tab: 'achievements' }
    case 'track_won':
      return { text: t('notices.trackWon', { title }), tab: 'tracks' }
    case 'track_lost':
      return { text: t('notices.trackLost', { who, title }), tab: 'tracks' }
    default:
      return { text: t('notices.recordLost', { who, record: t(`hof.${n.data?.record ?? 'bestEvent'}` as MessageKey), value: n.data?.value ?? 0 }), tab: 'records' }
  }
}

/** Avisos: wars en las que te han apuntado, con la opción de subirlas también desde tu lado */
export default function Notices() {
  const { t, locale } = useI18n()
  const { profile, loading } = useAuth()
  const [notices, setNotices] = useState<Notice[] | null>(null)
  const [failed, setFailed] = useState(false)
  const profileId = profile?.id

  useEffect(() => {
    if (!profileId) return
    let cancelled = false
    listNotices().then(
      (list) => {
        if (cancelled) return
        setNotices(list)
        // Se marcan como leídas al verlas; los «nuevos» se siguen señalando en esta visita
        if (list.some((n) => !n.read_at)) {
          void markNoticesRead().then(() => window.dispatchEvent(new Event('notices-read')), () => {})
        }
      },
      () => !cancelled && setFailed(true),
    )
    return () => {
      cancelled = true
    }
  }, [profileId])

  if (loading) return <p className="text-muted">{t('common.loading')}</p>
  if (!profile) return <EmptyState title={t('stats.signInTitle')}>{t('stats.signInText')}</EmptyState>

  const day = (n: Notice) => {
    const iso = n.event?.played_on ?? n.event?.finished_at ?? n.created_at
    return new Date(iso).toLocaleDateString(locale, { dateStyle: 'medium' })
  }

  return (
    <>
      <PageHeader title={t('notices.title')} subtitle={t('notices.subtitle')} />
      {failed && <p className="text-sm text-kart-red">{t('common.saveError')}</p>}
      {notices === null && !failed && <p className="text-muted">{t('common.loading')}</p>}
      {notices?.length === 0 && <EmptyState title={t('notices.empty')} />}
      {!!notices?.length && (
        <ul className="panel divide-y divide-line/60">
          {notices.map((n) =>
            RANKING_KINDS.includes(n.kind) ? (
              <li key={n.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm">
                    {!n.read_at && <span className="bg-kart-yellow px-1.5 py-0.5 font-mono text-[10px] font-bold text-bg uppercase">{t('notices.new')}</span>}
                    <span>{rankingNotice(n, t).text}</span>
                  </p>
                  <p className="mt-1 font-mono text-xs text-muted">{new Date(n.created_at).toLocaleDateString(locale, { dateStyle: 'medium' })}</p>
                </div>
                <Link to={`/ranking?tab=${rankingNotice(n, t).tab}`} className="btn-line text-sm">
                  {t('notices.seeRanking')}
                </Link>
              </li>
            ) : (
            <li key={n.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-sm">
                  {!n.read_at && <span className="bg-kart-yellow px-1.5 py-0.5 font-mono text-[10px] font-bold text-bg uppercase">{t('notices.new')}</span>}
                  <span>{t(n.kind === 'war_proof' ? 'notices.proof' : 'notices.posted', { who: n.actor?.username ?? '?' })}</span>
                  <Plate>{n.event?.team_tag ?? '?'}</Plate>
                  <span className="text-muted">vs</span>
                  <Plate>{n.event?.opponent_tag ?? '?'}</Plate>
                </p>
                <p className="mt-1 font-mono text-xs text-muted">{day(n)}</p>
                {n.kind === 'war_proof' && <p className="mt-1 text-xs text-muted">{t('notices.proofHint')}</p>}
                {n.can_upload && <p className="mt-1 text-xs text-muted">{n.event?.opponent_confirmed ? t('notices.alreadyUploaded') : t('notices.uploadHint')}</p>}
              </div>
              <div className="flex flex-wrap gap-2">
                <Link to={`/eventos/${n.event_id}`} className="btn-line text-sm">
                  {t(n.kind === 'war_proof' ? 'notices.review' : 'notices.view')}
                </Link>
                {n.can_upload && !n.event?.opponent_confirmed && (
                  <Link to={`/eventos/${n.event_id}/validar`} className="btn-yellow text-sm">
                    {t('notices.upload')}
                  </Link>
                )}
              </div>
            </li>
            ),
          )}
        </ul>
      )}
    </>
  )
}
