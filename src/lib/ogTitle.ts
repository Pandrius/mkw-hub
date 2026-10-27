/**
 * Aspecto de los títulos del perfil en las imágenes de vista previa: los mismos colores y materiales que las placas de la web
 * (.rank-chip, .title-chip y .war-rank de index.css, y la placa de la pista en «Dueño de …»), sin animaciones.
 */
import { getTrack, getTrackPlateBackground, getTrackTextColor } from '../data/tracks.js'

export type TitleSpec = {
  /** Fondo liso o, mejor, un degradado de CSS (`backgroundImage`) */
  bg?: string
  image?: string
  ink: string
  /** Filete alrededor (ancho en px y color) */
  edge?: { width: number; color: string }
  /** Rango militar: placa del color del nivel con los galones en un bloque oscuro a un lado */
  war?: { level: number; color: string }
}

/** Colores de cada nivel (los de TIER_COLOR de tiers.ts con el oro ya resuelto) */
const TIER_HEX = ['#3b3b38', '#d98a45', '#c9ced6', '#ffd500', '#28d7f5', '#22e07f']
const MULTI = 'linear-gradient(100deg, #7df9ff, #a78bfa, #ff7ad9, #ffc46b, #7dffb2, #6ea8ff, #e879f9, #fff1a8, #7df9ff)'

const RANKS: Record<string, TitleSpec> = {
  bronze: { image: 'linear-gradient(135deg, #7a3f04 0%, #d98a3d 35%, #b45f06 55%, #e3a064 78%, #8c4a07 100%)', ink: '#1d0e00', edge: { width: 1, color: '#5c2f03' } },
  silver: { image: 'linear-gradient(135deg, #9a9fa6 0%, #f4f6f8 32%, #c4c8cd 52%, #ffffff 74%, #a3a8ae 100%)', ink: '#1b1d20', edge: { width: 1, color: '#7d838a' } },
  gold: { image: 'linear-gradient(135deg, #a67c00 0%, #ffe27a 30%, #f1c232 52%, #fff0a8 74%, #b8860b 100%)', ink: '#2a1d00', edge: { width: 1, color: '#8a6500' } },
  platinum: { image: 'linear-gradient(135deg, #2c7f8a 0%, #8fdde6 32%, #3fabb8 54%, #b7eef4 76%, #2f8f9b 100%)', ink: '#04262b', edge: { width: 1, color: '#1f6872' } },
  sapphire: { image: 'linear-gradient(135deg, #123f8c 0%, #4f8df0 40%, #286cd3 60%, #1a4fa8 100%)', ink: '#ffffff', edge: { width: 1, color: '#0d2d66' } },
  ruby: { image: 'linear-gradient(135deg, #8f0a3a 0%, #f2477f 40%, #d51c5e 60%, #a1124a 100%)', ink: '#ffffff', edge: { width: 1, color: '#5e0524' } },
  diamond: { image: 'linear-gradient(135deg, #8fd8ee 0%, #ffffff 30%, #b9f2ff 50%, #e6fbff 70%, #9ee3f5 100%)', ink: '#062a36', edge: { width: 1, color: '#62bfd8' } },
  master: { image: 'linear-gradient(135deg, #4b2b9a 0%, #9370db 45%, #6f4fc2 65%, #3f2486 100%)', ink: '#ffffff', edge: { width: 1, color: '#2a1563' } },
  grandmaster: { image: 'linear-gradient(135deg, #5c0118 0%, #d1103f 40%, #a3022c 62%, #6e011d 100%)', ink: '#ffe27a', edge: { width: 1, color: '#f1c232' } },
}

const UNIQUE: Record<string, TitleSpec> = {
  natureWinner: { bg: '#1f5a2a', ink: '#d9f7b8', edge: { width: 1, color: '#0f3517' } },
  podiumKing: { image: 'linear-gradient(90deg, #c98a4b 0%, #c98a4b 22%, #f5c542 22%, #f5c542 78%, #cfd3d8 78%, #cfd3d8 100%)', ink: '#231800', edge: { width: 1, color: '#6b4a10' } },
  unstoppable: { image: 'linear-gradient(100deg, #ff3d00, #ff9a1f, #ffd500, #ff9a1f, #ff3d00)', ink: '#2a0a00' },
  ironDriver: { image: 'repeating-linear-gradient(90deg, #3a3f45 0px, #3a3f45 2px, #484e55 2px, #484e55 4px)', ink: '#e8ecef', edge: { width: 2, color: '#1b1e22' } },
  cleanDriver: { image: 'linear-gradient(180deg, #ffffff, #e9f8fb)', ink: '#0a5560', edge: { width: 2, color: '#21b8cc' } },
  comeback: { image: 'repeating-linear-gradient(0deg, #0e7a5a 0px, #0e7a5a 7px, #12946e 7px, #12946e 14px)', ink: '#eafff6', edge: { width: 1, color: '#064634' } },
  closer: { bg: '#ffffff', ink: '#111111', edge: { width: 4, color: '#111111' } },
  legend: { image: 'linear-gradient(135deg, #04573a 0%, #12b27a 45%, #067a52 70%, #03402a 100%)', ink: '#fff3b8', edge: { width: 2, color: '#f1c232' } },
  allTerrain: { image: 'repeating-linear-gradient(135deg, #5b3a1e 0px, #5b3a1e 6px, #6f4a28 6px, #6f4a28 9px)', ink: '#ffe9c9', edge: { width: 2, color: '#2f1d0d' } },
  trackMaster: { image: 'linear-gradient(135deg, #0b1b4d, #1d3f9f 55%, #0b1b4d)', ink: '#ffe27a', edge: { width: 2, color: '#f1c232' } },
  veteran: { bg: '#7d7a45', ink: '#1f1e0c', edge: { width: 2, color: '#d8d49a' } },
  globetrotter: { image: 'linear-gradient(135deg, #0a5f9e, #14a3c7)', ink: '#ffffff', edge: { width: 1, color: '#063d66' } },
  sqPlayer: { image: 'linear-gradient(105deg, #d6262e 0%, #d6262e 50%, #1f5fd1 50%, #1f5fd1 100%)', ink: '#ffffff', edge: { width: 1, color: '#101010' } },
  'top:10': { image: 'linear-gradient(180deg, #d7ecff, #a9d3f7)', ink: '#0b2a4a', edge: { width: 2, color: '#5a9fd6' } },
  'top:5': { image: 'linear-gradient(135deg, #7a1fb5, #e12bd0 50%, #7a1fb5)', ink: '#ffffff', edge: { width: 1, color: '#3d0a63' } },
  'top:1': { bg: '#0b0b0b', ink: '#ffd34d', edge: { width: 2, color: '#f1c232' } },
  grandMaster: { bg: '#141414', ink: '#fff1a8', edge: { width: 2, color: '#3b3b38' } },
  // Coronas de la comunidad: placa de asfalto con el piano (rojo) o el amarillo de la casilla como marco; las «alguna vez», apagadas
  kingNow: { bg: '#141414', ink: '#ffd34d', edge: { width: 3, color: '#e8112d' } },
  poleWeek: { bg: '#141414', ink: '#f4f4f0', edge: { width: 3, color: '#e8112d' } },
  poleDay: { bg: '#141414', ink: '#ffd500', edge: { width: 2, color: '#ffd500' } },
  kingEver: { bg: '#262320', ink: '#d9b84a', edge: { width: 1, color: '#8a7430' } },
  poleWeekEver: { bg: '#262626', ink: '#d8d8d2', edge: { width: 1, color: '#8d8d88' } },
  poleDayEver: { bg: '#262400', ink: '#e6c200', edge: { width: 1, color: '#8f7a00' } },
}

/** Cómo se ve un título (`id` como se guarda: `owner:<pista>`, `weekly:<pista>`, `rank:gold`, `top:5`, `warRank3`, `veteran`…) */
export function titleSpec(id: string): TitleSpec {
  const [kind, param = ''] = id.split(':')
  if (kind === 'owner' || kind === 'weekly') {
    // Placa de la pista: su color y sus letras; Rainbow Road, el multicolor. «Dueño de …» (todo el tiempo) lleva además el filete dorado
    const track = getTrack(param)
    const plate = getTrackPlateBackground(track)
    const edge = kind === 'owner' ? { edge: { width: 3, color: '#ffd34d' } } : {}
    if (track?.abbr === 'RR') return { image: MULTI, ink: '#16121f', ...edge }
    return { bg: plate ?? '#ffd500', ink: getTrackTextColor(track), ...edge }
  }
  if (kind === 'rank') return RANKS[param] ?? { bg: '#ffd500', ink: '#141414' }
  if (id.startsWith('warRank')) {
    const level = Math.min(5, Math.max(1, Number(id.slice(-1)) || 1))
    return { bg: TIER_HEX[level], ink: '#141414', war: { level, color: TIER_HEX[level] } }
  }
  return UNIQUE[id] ?? { bg: '#ffd500', ink: '#141414' }
}
