import { useState } from 'react'
import { useI18n } from '../i18n'
import type { MessageKey } from '../i18n/es'
import { RACES_PER_EVENT, type GameEvent, type EventRace } from '../lib/events'
import { formatDate } from '../lib/time'
import { buildWarImageData, hasRealOpponents, warImageFileName } from '../lib/warImage'
import { loadTeamLogos, renderWarImage, type WarImageLabels } from '../lib/warImageDraw'
import type { WarTable } from '../lib/warTable'

type Status = 'idle' | 'busy' | 'copied' | 'downloaded' | 'fallback' | 'error'

const STATUS_TEXT: Partial<Record<Status, MessageKey>> = {
  busy: 'warImg.generating',
  copied: 'warImg.copied',
  downloaded: 'warImg.downloaded',
  fallback: 'warImg.fallback',
  error: 'warImg.error',
}

function download(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** ¿Se puede copiar una imagen al portapapeles? (Clipboard API con ClipboardItem) */
const canCopyImage = () =>
  typeof ClipboardItem !== 'undefined' && typeof navigator !== 'undefined' && !!navigator.clipboard?.write

/** Botones para descargar o copiar la tabla de la war como imagen PNG (para Discord) */
export default function WarImageButtons({ event, races, table }: { event: GameEvent; races: EventRace[]; table: WarTable }) {
  const { t, locale } = useI18n()
  const [status, setStatus] = useState<Status>('idle')

  const data = buildWarImageData(event, table, hasRealOpponents(event, races))
  const labels: WarImageLabels = {
    status: data.inProgress ? t('warImg.live', { n: data.races.length, total: RACES_PER_EVENT }) : t('warImg.final'),
    date: formatDate(data.date, locale),
    player: t('event.player'),
    avgPos: t('event.avgPos'),
    points: t('event.points'),
    missing: t('event.missingPts'),
    runningDiff: t('warImg.runningDiff'),
    noOpponents: t('warImg.noOpponents'),
    footer: t('warImg.footer'),
  }
  const fileName = warImageFileName(data)

  const render = async () => renderWarImage(data, labels, await loadTeamLogos(event.team_id, event.opponent_team_id))

  const flash = (next: Status) => {
    setStatus(next)
    setTimeout(() => setStatus('idle'), next === 'fallback' || next === 'error' ? 4000 : 2000)
  }

  const onDownload = async () => {
    setStatus('busy')
    try {
      download(await render(), fileName)
      flash('downloaded')
    } catch {
      flash('error')
    }
  }

  const onCopy = async () => {
    setStatus('busy')
    // La promesa se crea ya: Safari exige crear el ClipboardItem dentro del clic, sin esperar antes
    const png = render()
    if (canCopyImage()) {
      try {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })])
        flash('copied')
        return
      } catch {
        // Sin permiso o formato no admitido: descargamos en su lugar
      }
    }
    try {
      download(await png, fileName)
      flash('fallback')
    } catch {
      flash('error')
    }
  }

  const busy = status === 'busy'
  const message = STATUS_TEXT[status]

  return (
    <>
      <button onClick={onDownload} disabled={busy} className="text-kart-blue hover:underline disabled:opacity-50">
        {t('warImg.download')}
      </button>
      <button onClick={onCopy} disabled={busy} className="text-kart-blue hover:underline disabled:opacity-50">
        {t('warImg.copy')}
      </button>
      {message && (
        <span role="status" className={status === 'error' ? 'text-kart-red' : 'text-muted'}>
          {t(message)}
        </span>
      )}
    </>
  )
}
