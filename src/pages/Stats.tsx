import { useState } from 'react'
import { EmptyState, PageHeader, Tabs } from '../components/ui'

type Mode = 'all' | 'war' | 'lounge'

export default function Stats() {
  const [mode, setMode] = useState<Mode>('all')

  return (
    <>
      <PageHeader
        title="Estadísticas"
        subtitle="Registra tus eventos de 12 carreras y descubre tu posición media en cada pista."
      />
      <Tabs
        tabs={[
          { id: 'all', label: 'Todo' },
          { id: 'war', label: 'War' },
          { id: 'lounge', label: 'Lounge' },
        ]}
        value={mode}
        onChange={setMode}
      />
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <Step n={1} title="Inicia un evento">
          Elige si es War o Lounge. Un evento son 12 carreras.
        </Step>
        <Step n={2} title="Apunta cada carrera">
          Pista y posición. Puedes corregir cualquier carrera mientras el evento siga abierto.
        </Step>
        <Step n={3} title="Finaliza">
          Tras confirmar, el evento queda bloqueado y cuenta para tus estadísticas.
        </Step>
      </div>
      <div className="mt-6">
        <EmptyState title="Inicia sesión para ver tus estadísticas">
          El registro de carreras llegará en la fase de estadísticas individuales.
        </EmptyState>
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
