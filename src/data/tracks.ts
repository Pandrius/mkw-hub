export type Cup = {
  id: string
  name: string
  /** Color de acento de la copa en la interfaz */
  color: string
}

export type Track = {
  id: string
  /** Abreviatura usada por la comunidad (Lounge, MKC). La "r" inicial indica pista retro. */
  abbr?: string
  name: string
  cupId: string
  /** Juego original si es una pista retro */
  origin?: string
  /** Pista "madre" en la que está anidada (variantes SNES de la 1.8.0) */
  parentId?: string
}

export const CUPS: Cup[] = [
  { id: 'mushroom', name: 'Copa Champiñón', color: '#ff3b3b' },
  { id: 'flower', name: 'Copa Flor', color: '#ff9a1f' },
  { id: 'star', name: 'Copa Estrella', color: '#ffcc1f' },
  { id: 'shell', name: 'Copa Caparazón', color: '#2fd07a' },
  { id: 'banana', name: 'Copa Plátano', color: '#f5e050' },
  { id: 'leaf', name: 'Copa Hoja', color: '#7ad13b' },
  { id: 'lightning', name: 'Copa Rayo', color: '#b07bff' },
  { id: 'special', name: 'Copa Especial', color: '#3b8bff' },
  { id: 'snes', name: 'Pistas SNES (1.8.0)', color: '#c0c6dc' },
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

// Pistas con captura propia en public/tracks/. Las variantes SNES sin captura usan la de su pista madre.
const TRACK_IMAGES = new Set([
  'MBC', 'CC', 'WS', 'DKS', 'rDH', 'rSGB', 'rWS', 'rAF', 'rDKP', 'SP', 'rSHS', 'rWSh', 'rKTB', 'FO', 'PS',
  'rPB', 'SSS', 'rDDJ', 'GBR', 'CCF', 'DD', 'BCi', 'DBB', 'rMMM', 'rCM', 'rTF', 'BC', 'AH', 'rMC', 'RR',
])

export function getTrackImage(track: Track): string | undefined {
  const source = track.abbr && TRACK_IMAGES.has(track.abbr) ? track : track.parentId ? getTrack(track.parentId) : undefined
  return source?.abbr ? `${import.meta.env.BASE_URL}tracks/${source.abbr}.webp` : undefined
}

/** Busca una pista por su abreviatura, sin distinguir mayúsculas (p. ej. "rdkp" → DK Pass). */
export function getTrackByAbbr(abbr: string): Track | undefined {
  const a = abbr.trim().toLowerCase()
  return TRACKS.find((t) => t.abbr?.toLowerCase() === a)
}

export function getCup(id: string): Cup | undefined {
  return CUPS.find((c) => c.id === id)
}
