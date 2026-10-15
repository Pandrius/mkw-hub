import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { EmptyState, PageHeader, Plate } from '../components/ui'
import { useI18n } from '../i18n'
import { useAuth } from '../lib/auth'
import { listNotices, markNoticesRead, type Notice } from '../lib/notices'

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
          {notices.map((n) => (
            <li key={n.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-sm">
                  {!n.read_at && <span className="bg-kart-yellow px-1.5 py-0.5 font-mono text-[10px] font-bold text-bg uppercase">{t('notices.new')}</span>}
                  <span>{t('notices.posted', { who: n.actor?.username ?? '?' })}</span>
                  <Plate>{n.event?.team_tag ?? '?'}</Plate>
                  <span className="text-muted">vs</span>
                  <Plate>{n.event?.opponent_tag ?? '?'}</Plate>
                </p>
                <p className="mt-1 font-mono text-xs text-muted">{day(n)}</p>
                {n.can_upload && <p className="mt-1 text-xs text-muted">{n.event?.opponent_confirmed ? t('notices.alreadyUploaded') : t('notices.uploadHint')}</p>}
              </div>
              <div className="flex flex-wrap gap-2">
                <Link to={`/eventos/${n.event_id}`} className="btn-line text-sm">
                  {t('notices.view')}
                </Link>
                {n.can_upload && !n.event?.opponent_confirmed && (
                  <Link to={`/eventos/${n.event_id}/validar`} className="btn-yellow text-sm">
                    {t('notices.upload')}
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
