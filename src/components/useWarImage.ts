import { useI18n } from '../i18n'
import { useCompetition, useWarDesign } from './useWarDesign'
import { RACES_PER_EVENT, type EventRace, type GameEvent } from '../lib/events'
import { formatDate } from '../lib/time'
import { buildWarImageData, hasRealOpponents, warImageFileName } from '../lib/warImage'
import { loadTeamLogos, renderWarImage, type WarImageLabels } from '../lib/warImageDraw'
import type { WarTable } from '../lib/warTable'

/** Datos, textos y generador de la imagen de la war (los usan la vista previa y los botones de descarga) */
export function useWarImage(event: GameEvent, races: EventRace[], table: WarTable) {
  const { t, locale } = useI18n()
  const [design] = useWarDesign()
  const [competition] = useCompetition(event.id)

  const data = buildWarImageData(event, table, hasRealOpponents(event, races))
  const labels: WarImageLabels = {
    status: data.inProgress ? t('warImg.live', { n: data.races.length, total: RACES_PER_EVENT }) : t('warImg.final'),
    date: formatDate(data.date, locale),
    player: t('event.player'),
    avgPos: t('event.avgPos'),
    points: t('event.points'),
    missing: t('event.missingPts'),
    penalty: t('event.penaltyDefault'),
    runningDiff: t('warImg.runningDiff'),
    competition: competition.trim(),
    raceByRace: t('warImg.raceByRace'),
    racesWon: t('warImg.racesWon'),
    avgRace: t('warImg.avgRace'),
    tied: t('warImg.tied'),
    noOpponents: t('warImg.noOpponents'),
    footer: t('warImg.footer'),
  }

  return {
    data,
    labels,
    fileName: warImageFileName(data),
    design,
    render: async () => renderWarImage(data, labels, await loadTeamLogos(event.team_id, event.opponent_team_id), design),
  }
}
