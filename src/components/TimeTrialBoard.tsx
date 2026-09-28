import { useState } from 'react'
import type { TtCategory } from '../lib/timeTrials'
import Leaderboard from './Leaderboard'
import { Tabs } from './ui'

/** Selector de categoría (Carrera / FLAP) y de items (NITA / con items) + ranking. */
export default function TimeTrialBoard({ trackId }: { trackId: string }) {
  const [category, setCategory] = useState<TtCategory>('race')
  const [items, setItems] = useState<'items' | 'nita'>('items')

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <Tabs
          tabs={[
            { id: 'race', label: 'Carrera completa' },
            { id: 'flap', label: 'FLAP' },
          ]}
          value={category}
          onChange={setCategory}
        />
        <Tabs
          tabs={[
            { id: 'items', label: 'Con items' },
            { id: 'nita', label: 'NITA' },
          ]}
          value={items}
          onChange={setItems}
        />
      </div>
      <Leaderboard key={`${trackId}-${category}-${items}`} trackId={trackId} category={category} nita={items === 'nita'} />
    </div>
  )
}
