import { useEffect, useState } from 'react'
import { useI18n } from '../i18n'
import type { EventRace, GameEvent } from '../lib/events'
import type { WarTable } from '../lib/warTable'
import { useWarImage } from './useWarImage'

/**
 * Vista previa de la tabla de la war: la misma imagen que se descarga o se copia
 * (marcador, escudos, diferencia acumulada por pista, posición media de cada jugador…).
 */
export default function WarImagePreview({ event, races, table }: { event: GameEvent; races: EventRace[]; table: WarTable }) {
  const { t } = useI18n()
  const { data, labels, render } = useWarImage(event, races, table)
  const [shown, setShown] = useState<{ key: string; url: string } | null>(null)
  const [failed, setFailed] = useState(false)

  // Se vuelve a dibujar solo cuando cambia algo de lo que aparece en la imagen
  const key = JSON.stringify({ data, labels, team: event.team_id, opponent: event.opponent_team_id })

  useEffect(() => {
    let cancelled = false
    let objectUrl: string | null = null
    setFailed(false)
    render().then(
      (blob) => {
        objectUrl = URL.createObjectURL(blob)
        if (cancelled) URL.revokeObjectURL(objectUrl)
        else setShown({ key, url: objectUrl })
      },
      () => !cancelled && setFailed(true),
    )
    return () => {
      cancelled = true
    }
    // render() depende de data y labels, que ya van en key
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  // Libera la imagen anterior cuando llega otra y al salir de la página
  useEffect(() => {
    const url = shown?.url
    return () => {
      if (url) URL.revokeObjectURL(url)
    }
  }, [shown])

  if (failed && !shown) return <p className="bg-bg px-5 py-8 text-center text-sm text-muted">{t('warImg.error')}</p>
  if (!shown) return <p className="bg-bg px-5 py-8 text-center text-sm text-muted">{t('warImg.generating')}</p>
  return (
    <div className="bg-bg">
      <img
        src={shown.url}
        alt={`${data.home.tag} ${data.home.total} – ${data.away.total} ${data.away.tag}`}
        className={`w-full transition-opacity ${shown.key === key ? '' : 'opacity-60'}`}
      />
    </div>
  )
}
