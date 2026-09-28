import { EmptyState, PageHeader } from '../components/ui'

export default function Teams() {
  return (
    <>
      <PageHeader
        title="Equipos"
        subtitle="Equipos de Mario Kart World registrados y aprobados en Mario Kart Central."
      />
      <EmptyState title="Los equipos se sincronizarán con Mario Kart Central">
        Al entrar con Discord, la web te unirá automáticamente a tu equipo si apareces en su roster de MKC. Los
        líderes y managers podrán gestionar las wars del equipo.
      </EmptyState>
    </>
  )
}
