import { useState } from 'react'
import { useI18n } from '../i18n'
import type { TtCategory } from '../lib/timeTrials'
import Leaderboard from './Leaderboard'
import { Tabs } from './ui'

/** Ranking de la comunidad: categoría (Carrera / FLAP) e items (con items / NITA). */
export default function TimeTrialBoard({ trackId }: { trackId: string }) {
  const { t } = useI18n()
  const [category, setCategory] = useState<TtCategory>('race')
  const [items, setItems] = useState<'items' | 'nita'>('items')

  return (
    <section className="space-y-4">
      <div>
        <h3 className="font-display text-xl font-bold">{t('tt.community')}</h3>
        <p className="text-sm text-muted">{t('tt.communityHint')}</p>
      </div>
      <div className="flex flex-wrap gap-3">
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
      </div>
      <Leaderboard key={`${trackId}-${category}-${items}`} trackId={trackId} category={category} nita={items === 'nita'} />
    </section>
  )
}
