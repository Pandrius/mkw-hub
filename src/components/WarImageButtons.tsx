import { useState } from 'react'
import { useI18n } from '../i18n'
import type { MessageKey } from '../i18n/es'
import type { GameEvent, EventRace } from '../lib/events'
import type { WarTable } from '../lib/warTable'
import { useWarImage } from './useWarImage'

type Status = 'idle' | 'busy' | 'copied' | 'downloaded' | 'fallback' | 'shared' | 'error'

const STATUS_TEXT: Partial<Record<Status, MessageKey>> = {
  busy: 'warImg.generating',
  copied: 'warImg.copied',
  downloaded: 'warImg.downloaded',
  fallback: 'warImg.fallback',
  shared: 'warImg.shared',
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

/** ¿Se puede compartir un archivo con la hoja de compartir del sistema (móviles)? */
const canShareFile = (file: File) => typeof navigator !== 'undefined' && !!navigator.canShare && !!navigator.share && navigator.canShare({ files: [file] })

/** Botones para descargar o copiar la tabla de la war como imagen PNG (para Discord) */
export default function WarImageButtons({ event, races, table }: { event: GameEvent; races: EventRace[]; table: WarTable }) {
  const { t } = useI18n()
  const [status, setStatus] = useState<Status>('idle')
  const { fileName, render } = useWarImage(event, races, table)

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

  const onShare = async () => {
    setStatus('busy')
    try {
      const file = new File([await render()], fileName, { type: 'image/png' })
      if (!canShareFile(file)) return flash('error')
      await navigator.share({ files: [file] })
      flash('shared')
    } catch (err) {
      // Cancelar la hoja de compartir no es un error
      if (err instanceof DOMException && err.name === 'AbortError') setStatus('idle')
      else flash('error')
    }
  }

  const busy = status === 'busy'
  const mobile = typeof navigator !== 'undefined' && !!navigator.canShare && !!navigator.share && /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent)
  const message = STATUS_TEXT[status]

  return (
    <>
      {mobile ? (
        <button onClick={onShare} disabled={busy} className="btn-yellow text-base">
          {t('warImg.share')}
        </button>
      ) : (
        <button onClick={onCopy} disabled={busy} className="btn-yellow text-base">
          {t('warImg.copy')}
        </button>
      )}
      <button onClick={mobile ? onCopy : onDownload} disabled={busy} className="btn-line text-base">
        {mobile ? t('warImg.copy') : t('warImg.download')}
      </button>
      {message && (
        <span role="status" className={status === 'error' ? 'text-kart-red' : 'text-muted'}>
          {t(message)}
        </span>
      )}
    </>
  )
}
