import { useI18n } from '../i18n'
import { useWarDesign } from './useWarDesign'

/**
 * Perspectiva de la imagen de la war: Neutral (igual para los dos equipos, la de siempre) o Equipo (vista desde el
 * equipo de la izquierda, con la diferencia y los resultados en color). Vale para la vista previa y para la imagen
 * que se descarga o se copia.
 */
export default function PerspectiveToggle() {
  const { t } = useI18n()
  const [design, setDesign] = useWarDesign()

  const option = (active: boolean, label: string, neutral: boolean) => (
    <button
      type="button"
      aria-pressed={active}
      onClick={() => setDesign({ ...design, neutral })}
      className={active ? 'bg-kart-yellow px-2 font-bold text-bg' : 'text-kart-blue hover:underline'}
    >
      {label}
    </button>
  )

  return (
    <span role="group" aria-label={t('design.perspective')} title={t('design.perspectiveHint')} className="flex items-center gap-1.5">
      <span aria-hidden="true">⚖</span>
      <span className="text-muted">{t('design.perspective')}:</span>
      {option(design.neutral, t('design.perspectiveNeutral'), true)}
      <span className="text-line">/</span>
      {option(!design.neutral, t('design.perspectiveTeam'), false)}
    </span>
  )
}
