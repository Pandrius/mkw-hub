export type Cup = {
  /** El nombre se traduce con la clave cup.<id> */
  id: 'mushroom' | 'flower' | 'star' | 'shell' | 'banana' | 'leaf' | 'lightning' | 'special' | 'snes'
  /** Color de acento de la copa en la interfaz */
  color: string
}

export type Track = {
  id: string
  /** Abreviatura usada por la comunidad (Lounge, MKC). La "r" inicial indica pista retro. */
  abbr?: string
  name: string
  cupId: Cup['id']
  /** Juego original si es una pista retro */
  origin?: string
  /** Pista "madre" en la que está anidada (variantes SNES de la 1.8.0) */
  parentId?: string
}

export const CUPS: Cup[] = [
  { id: 'mushroom', color: '#ff3b3b' },
  { id: 'flower', color: '#ff9a1f' },
  { id: 'star', color: '#ffcc1f' },
  { id: 'shell', color: '#2fd07a' },
  { id: 'banana', color: '#f5e050' },
  { id: 'leaf', color: '#7ad13b' },
  { id: 'lightning', color: '#b07bff' },
  { id: 'special', color: '#3b8bff' },
  { id: 'snes', color: '#c0c6dc' },
]

// En la copa Caparazón y Especial se repiten Crown City y Peach Stadium,
// así que solo se listan una vez (en su primera aparición).
export const TRACKS: Track[] = [
  { id: 'mario-bros-circuit', abbr: 'MBC', name: 'Mario Bros. Circuit', cupId: 'mushroom' },
  { id: 'crown-city', abbr: 'CC', name: 'Crown City', cupId: 'mushroom' },
  { id: 'whistlestop-summit', abbr: 'WS', name: 'Whistlestop Summit', cupId: 'mushroom' },
  { id: 'dk-spaceport', abbr: 'DKS', name: 'DK Spaceport', cupId: 'mushroom' },

  { id: 'desert-hills', abbr: 'rDH', name: 'Desert Hills', cupId: 'flower', origin: 'DS' },
  { id: 'shy-guy-bazaar', abbr: 'rSGB', name: 'Shy Guy Bazaar', cupId: 'flower', origin: '3DS' },
  { id: 'wario-stadium', abbr: 'rWS', name: 'Wario Stadium', cupId: 'flower', origin: 'N64' },
  { id: 'airship-fortress', abbr: 'rAF', name: 'Airship Fortress', cupId: 'flower', origin: 'DS' },

  { id: 'dk-pass', abbr: 'rDKP', name: 'DK Pass', cupId: 'star', origin: 'DS' },
  { id: 'starview-peak', abbr: 'SP', name: 'Starview Peak', cupId: 'star' },
  { id: 'sky-high-sundae', abbr: 'rSHS', name: 'Sky-High Sundae', cupId: 'star', origin: 'Tour' },
  { id: 'wario-shipyard', abbr: 'rWSh', name: 'Wario Shipyard', cupId: 'star', origin: '3DS' },

  { id: 'koopa-troopa-beach', abbr: 'rKTB', name: 'Koopa Troopa Beach', cupId: 'shell', origin: 'SNES' },
  { id: 'faraway-oasis', abbr: 'FO', name: 'Faraway Oasis', cupId: 'shell' },
  { id: 'peach-stadium', abbr: 'PS', name: 'Peach Stadium', cupId: 'shell' },

  { id: 'peach-beach', abbr: 'rPB', name: 'Peach Beach', cupId: 'banana', origin: 'GCN' },
  { id: 'salty-salty-speedway', abbr: 'SSS', name: 'Salty Salty Speedway', cupId: 'banana' },
  { id: 'dino-dino-jungle', abbr: 'rDDJ', name: 'Dino Dino Jungle', cupId: 'banana', origin: 'GCN' },
  { id: 'great-block-ruins', abbr: 'GBR', name: 'Great ? Block Ruins', cupId: 'banana' },

  { id: 'cheep-cheep-falls', abbr: 'CCF', name: 'Cheep Cheep Falls', cupId: 'leaf' },
  { id: 'dandelion-depths', abbr: 'DD', name: 'Dandelion Depths', cupId: 'leaf' },
  { id: 'boo-cinema', abbr: 'BCi', name: 'Boo Cinema', cupId: 'leaf' },
  { id: 'dry-bones-burnout', abbr: 'DBB', name: 'Dry Bones Burnout', cupId: 'leaf' },

  { id: 'moo-moo-meadows', abbr: 'rMMM', name: 'Moo Moo Meadows', cupId: 'lightning', origin: 'Wii' },
  { id: 'choco-mountain', abbr: 'rCM', name: 'Choco Mountain', cupId: 'lightning', origin: 'N64' },
  { id: 'toads-factory', abbr: 'rTF', name: "Toad's Factory", cupId: 'lightning', origin: 'Wii' },
  { id: 'bowsers-castle', abbr: 'BC', name: "Bowser's Castle", cupId: 'lightning' },

  { id: 'acorn-heights', abbr: 'AH', name: 'Acorn Heights', cupId: 'special' },
  { id: 'mario-circuit', abbr: 'rMC', name: 'Mario Circuit', cupId: 'special' },
  { id: 'rainbow-road', abbr: 'RR', name: 'Rainbow Road', cupId: 'special' },

  { id: 'snes-mario-circuit-1', abbr: 'rMC1', name: 'SNES Mario Circuit 1', cupId: 'snes', origin: 'SNES', parentId: 'mario-circuit' },
  { id: 'snes-mario-circuit-2', abbr: 'rMC2', name: 'SNES Mario Circuit 2', cupId: 'snes', origin: 'SNES', parentId: 'mario-circuit' },
  { id: 'snes-mario-circuit-3', abbr: 'rMC3', name: 'SNES Mario Circuit 3', cupId: 'snes', origin: 'SNES', parentId: 'mario-circuit' },
  { id: 'snes-ghost-valley-1', abbr: 'rGV1', name: 'SNES Ghost Valley 1', cupId: 'snes', origin: 'SNES', parentId: 'boo-cinema' },
  { id: 'snes-ghost-valley-2', abbr: 'rGV2', name: 'SNES Ghost Valley 2', cupId: 'snes', origin: 'SNES', parentId: 'boo-cinema' },
  { id: 'snes-ghost-valley-3', abbr: 'rGV3', name: 'SNES Ghost Valley 3', cupId: 'snes', origin: 'SNES', parentId: 'boo-cinema' },
  { id: 'snes-choco-island-1', abbr: 'rCM1', name: 'SNES Choco Island 1', cupId: 'snes', origin: 'SNES', parentId: 'choco-mountain' },
  { id: 'snes-choco-island-2', abbr: 'rCM2', name: 'SNES Choco Island 2', cupId: 'snes', origin: 'SNES', parentId: 'choco-mountain' },
  { id: 'snes-koopa-beach-1', abbr: 'rKB1', name: 'SNES Koopa Beach 1', cupId: 'snes', origin: 'SNES', parentId: 'koopa-troopa-beach' },
  { id: 'snes-vanilla-lake-1', abbr: 'rVL1', name: 'SNES Vanilla Lake 1', cupId: 'snes', origin: 'SNES', parentId: 'sky-high-sundae' },
]

export function getTrack(id: string): Track | undefined {
  return TRACKS.find((t) => t.id === id)
}

// Pistas con captura propia en public/tracks/ (las 30 principales + 10 variantes SNES).
// Si alguna pista no tuviera captura propia, recurre a su pista madre (track.parentId).
const TRACK_IMAGES = new Set([
  'MBC', 'CC', 'WS', 'DKS', 'rDH', 'rSGB', 'rWS', 'rAF', 'rDKP', 'SP', 'rSHS', 'rWSh', 'rKTB', 'FO', 'PS',
  'rPB', 'SSS', 'rDDJ', 'GBR', 'CCF', 'DD', 'BCi', 'DBB', 'rMMM', 'rCM', 'rTF', 'BC', 'AH', 'rMC', 'RR',
  'rMC1', 'rMC2', 'rMC3', 'rGV1', 'rGV2', 'rGV3', 'rKB1', 'rCM1', 'rCM2', 'rVL1',
])

export function getTrackImage(track: Track, hd = false): string | undefined {
  const source = track.abbr && TRACK_IMAGES.has(track.abbr) ? track : track.parentId ? getTrack(track.parentId) : undefined
  if (!source?.abbr) return undefined
  const prefix = hd ? 'tracks/hd/' : 'tracks/'
  return `${import.meta.env.BASE_URL}${prefix}${source.abbr}.webp`
}

/** Busca una pista por su abreviatura, sin distinguir mayúsculas (p. ej. "rdkp" → DK Pass). */
export function getTrackByAbbr(abbr: string): Track | undefined {
  const a = abbr.trim().toLowerCase()
  return TRACKS.find((t) => t.abbr?.toLowerCase() === a)
}

/**
 * Colores de la placa de cada pista, sacados de su captura (public/tracks): el fondo es el tono dominante y las
 * letras un tono oscuro (o claro, si el fondo es oscuro) de otro color de la misma captura, con contraste
 * suficiente para leerse. Las variantes de una misma pista (rMC1, rMC2, rMC3; rGV1, rGV2, rGV3…) comparten
 * los dos colores y salen de todas sus capturas juntas.
 */
type PlateColors = { bg: string; fg: string }
const plate = (bg: string, fg: string): PlateColors => ({ bg, fg })

const MC = plate('#e1c265', '#371710')
const GV = plate('#acd175', '#101a37')
const CM = plate('#da976c', '#102837')

const TRACK_PLATES: Record<string, PlateColors> = {
  MBC: plate('#dd9168', '#102937'), CC: plate('#63a0e3', '#371f10'), WS: plate('#d1925e', '#102637'), DKS: plate('#d54b53', '#080e1c'),
  rDH: plate('#d5c071', '#101837'), rSGB: plate('#d79c6f', '#102737'), rWS: plate('#c9603c', '#08171c'), rAF: plate('#ca885c', '#102837'),
  rDKP: plate('#699cdd', '#372610'), SP: plate('#5699c9', '#28240b'), rSHS: plate('#5b93ec', '#28220b'), rWSh: plate('#40b3bf', '#371410'),
  rKTB: plate('#559bf1', '#372610'), FO: plate('#d1a875', '#102637'), PS: plate('#d58f72', '#102c37'),
  rPB: plate('#d18f75', '#102c37'), SSS: plate('#d1a775', '#102c37'), rDDJ: plate('#e1965c', '#102637'), GBR: plate('#d79b48', '#102637'),
  CCF: plate('#e15c4e', '#281e0b'), DD: plate('#339bd8', '#371e10'), BCi: plate('#40bfb6', '#371013'), DBB: plate('#d02f3f', '#ebfaf8'),
  rMMM: plate('#5fe4e7', '#1a3710'), rCM: CM, rTF: plate('#c78653', '#102637'), BC: plate('#c77538', '#0b1b28'),
  AH: plate('#c6a140', '#102f37'), rMC: MC, RR: plate('#6c98ce', '#37101f'),
  rMC1: MC, rMC2: MC, rMC3: MC,
  rGV1: GV, rGV2: GV, rGV3: GV,
  rCM1: CM, rCM2: CM,
  rKB1: plate('#ebb55c', '#213710'), rVL1: plate('#52c6f4', '#371b10'),
}

function getPlate(track: Track | undefined | null): PlateColors | undefined {
  if (!track) return undefined
  const own = track.abbr ? TRACK_PLATES[track.abbr] : undefined
  if (own) return own
  return track.parentId ? getPlate(getTrack(track.parentId)) : undefined
}

/** Color de fondo de la placa de una pista (el de su captura; si no lo tiene, el de su pista madre y, si no, el de su copa) */
export function getTrackColor(track: Track | undefined | null): string | undefined {
  if (!track) return undefined
  return getPlate(track)?.bg ?? getCup(track.cupId)?.color
}

/** Color de las letras de la placa de una pista (casi negro si la pista no tiene par de colores propio) */
export function getTrackTextColor(track: Track | undefined | null): string {
  return getPlate(track)?.fg ?? '#141414'
}

export function getCup(id: string): Cup | undefined {
  return CUPS.find((c) => c.id === id)
}
