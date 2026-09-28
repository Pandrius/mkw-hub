export type Cup = {
  id: string
  name: string
  /** Color de acento de la copa en la interfaz */
  color: string
}

export type Track = {
  id: string
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
  { id: 'mario-bros-circuit', name: 'Mario Bros. Circuit', cupId: 'mushroom' },
  { id: 'crown-city', name: 'Crown City', cupId: 'mushroom' },
  { id: 'whistlestop-summit', name: 'Whistlestop Summit', cupId: 'mushroom' },
  { id: 'dk-spaceport', name: 'DK Spaceport', cupId: 'mushroom' },

  { id: 'desert-hills', name: 'Desert Hills', cupId: 'flower', origin: 'DS' },
  { id: 'shy-guy-bazaar', name: 'Shy Guy Bazaar', cupId: 'flower', origin: '3DS' },
  { id: 'wario-stadium', name: 'Wario Stadium', cupId: 'flower', origin: 'N64' },
  { id: 'airship-fortress', name: 'Airship Fortress', cupId: 'flower', origin: 'DS' },

  { id: 'dk-pass', name: 'DK Pass', cupId: 'star', origin: 'DS' },
  { id: 'starview-peak', name: 'Starview Peak', cupId: 'star' },
  { id: 'sky-high-sundae', name: 'Sky-High Sundae', cupId: 'star', origin: 'Tour' },
  { id: 'wario-shipyard', name: 'Wario Shipyard', cupId: 'star', origin: '3DS' },

  { id: 'koopa-troopa-beach', name: 'Koopa Troopa Beach', cupId: 'shell', origin: 'SNES' },
  { id: 'faraway-oasis', name: 'Faraway Oasis', cupId: 'shell' },
  { id: 'peach-stadium', name: 'Peach Stadium', cupId: 'shell' },

  { id: 'peach-beach', name: 'Peach Beach', cupId: 'banana', origin: 'GCN' },
  { id: 'salty-salty-speedway', name: 'Salty Salty Speedway', cupId: 'banana' },
  { id: 'dino-dino-jungle', name: 'Dino Dino Jungle', cupId: 'banana', origin: 'GCN' },
  { id: 'great-block-ruins', name: 'Great ? Block Ruins', cupId: 'banana' },

  { id: 'cheep-cheep-falls', name: 'Cheep Cheep Falls', cupId: 'leaf' },
  { id: 'dandelion-depths', name: 'Dandelion Depths', cupId: 'leaf' },
  { id: 'boo-cinema', name: 'Boo Cinema', cupId: 'leaf' },
  { id: 'dry-bones-burnout', name: 'Dry Bones Burnout', cupId: 'leaf' },

  { id: 'moo-moo-meadows', name: 'Moo Moo Meadows', cupId: 'lightning', origin: 'Wii' },
  { id: 'choco-mountain', name: 'Choco Mountain', cupId: 'lightning', origin: 'N64' },
  { id: 'toads-factory', name: "Toad's Factory", cupId: 'lightning', origin: 'Wii' },
  { id: 'bowsers-castle', name: "Bowser's Castle", cupId: 'lightning' },

  { id: 'acorn-heights', name: 'Acorn Heights', cupId: 'special' },
  { id: 'mario-circuit', name: 'Mario Circuit', cupId: 'special' },
  { id: 'rainbow-road', name: 'Rainbow Road', cupId: 'special' },

  { id: 'snes-mario-circuit-1', name: 'SNES Mario Circuit 1', cupId: 'snes', origin: 'SNES', parentId: 'mario-circuit' },
  { id: 'snes-mario-circuit-2', name: 'SNES Mario Circuit 2', cupId: 'snes', origin: 'SNES', parentId: 'mario-circuit' },
  { id: 'snes-mario-circuit-3', name: 'SNES Mario Circuit 3', cupId: 'snes', origin: 'SNES', parentId: 'mario-circuit' },
  { id: 'snes-ghost-valley-1', name: 'SNES Ghost Valley 1', cupId: 'snes', origin: 'SNES', parentId: 'boo-cinema' },
  { id: 'snes-ghost-valley-2', name: 'SNES Ghost Valley 2', cupId: 'snes', origin: 'SNES', parentId: 'boo-cinema' },
  { id: 'snes-ghost-valley-3', name: 'SNES Ghost Valley 3', cupId: 'snes', origin: 'SNES', parentId: 'boo-cinema' },
  { id: 'snes-choco-island-1', name: 'SNES Choco Island 1', cupId: 'snes', origin: 'SNES', parentId: 'choco-mountain' },
  { id: 'snes-choco-island-2', name: 'SNES Choco Island 2', cupId: 'snes', origin: 'SNES', parentId: 'choco-mountain' },
  { id: 'snes-koopa-beach-1', name: 'SNES Koopa Beach 1', cupId: 'snes', origin: 'SNES', parentId: 'koopa-troopa-beach' },
  { id: 'snes-vanilla-lake-1', name: 'SNES Vanilla Lake 1', cupId: 'snes', origin: 'SNES', parentId: 'sky-high-sundae' },
]

export function getTrack(id: string): Track | undefined {
  return TRACKS.find((t) => t.id === id)
}

export function getCup(id: string): Cup | undefined {
  return CUPS.find((c) => c.id === id)
}
