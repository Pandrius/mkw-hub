import { EmptyState, PageHeader } from '../components/ui'
import { useI18n } from '../i18n'

export default function Teams() {
  const { t } = useI18n()
  return (
    <>
      <PageHeader title={t('nav.teams')} subtitle={t('teams.subtitle')} />
      <EmptyState title={t('teams.soonTitle')}>{t('teams.soonText')}</EmptyState>
    </>
  )
}
