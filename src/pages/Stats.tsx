import { useState } from 'react'
import { EmptyState, PageHeader, Tabs } from '../components/ui'
import { useI18n } from '../i18n'

type Mode = 'all' | 'war' | 'lounge'

export default function Stats() {
  const { t } = useI18n()
  const [mode, setMode] = useState<Mode>('all')

  return (
    <>
      <PageHeader title={t('nav.stats')} subtitle={t('stats.subtitle')} />
      <Tabs
        tabs={[
          { id: 'all', label: t('stats.all') },
          { id: 'war', label: t('stats.war') },
          { id: 'lounge', label: t('stats.lounge') },
        ]}
        value={mode}
        onChange={setMode}
      />
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <Step n={1} title={t('stats.step1')}>
          {t('stats.step1Text')}
        </Step>
        <Step n={2} title={t('stats.step2')}>
          {t('stats.step2Text')}
        </Step>
        <Step n={3} title={t('stats.step3')}>
          {t('stats.step3Text')}
        </Step>
      </div>
      <div className="mt-6">
        <EmptyState title={t('stats.soonTitle')}>{t('stats.soonText')}</EmptyState>
      </div>
    </>
  )
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <span className="font-display text-3xl font-black italic text-kart-yellow">{n}</span>
      <p className="mt-1 font-bold">{title}</p>
      <p className="mt-1 text-sm text-muted">{children}</p>
    </div>
  )
}
