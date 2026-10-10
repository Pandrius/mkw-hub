import { getTrackColor, getTrackTextColor, type Track } from '../data/tracks'
import type { Suggestion } from './SearchBox'
import { Plate } from './ui'

/** Sugerencia de pista con su placa de color; la clave es el id de la pista */
export const trackSuggestion = (track: Track): Suggestion => ({
  key: track.id,
  label: track.name,
  icon: (
    <Plate color={getTrackColor(track)} textColor={getTrackTextColor(track)}>
      {track.abbr ?? track.id}
    </Plate>
  ),
})
