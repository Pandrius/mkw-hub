import { useState } from 'react'
import { EmptyState, PageHeader, Tabs } from '../components/ui'

type Category = 'race' | 'flap'
type Items = 'nita' | 'items'

export default function TimeTrials() {
  const [category, setCategory] = useState<Category>('race')
  const [items, setItems] = useState<Items>('nita')

  return (
    <>
      <PageHeader
        title="Contrarreloj"
        subtitle="Rankings por pista. NITA = No Items Time Attack (sin usar champiñones). FLAP = vuelta más rápida."
      />
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
            { id: 'nita', label: 'NITA' },
            { id: 'items', label: 'Con items' },
          ]}
          value={items}
          onChange={setItems}
        />
      </div>
      <div className="mt-6">
        <EmptyState title="Todavía no hay tiempos">
          Los editores podrán registrar tiempos con enlace al vídeo. Cada jugador tendrá su historial de récords
          personales.
        </EmptyState>
      </div>
    </>
  )
}
