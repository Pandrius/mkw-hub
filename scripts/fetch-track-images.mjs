/**
 * Descarga las fotos oficiales de selección de pista de Mario Kart World (Super Mario Wiki)
 * y las convierte a WebP en dos resoluciones optimizadas:
 *   public/tracks/<abbr>.webp      800 px  → tarjetas, lista de pistas, cinta de WR
 *   public/tracks/hd/<abbr>.webp  1600 px  → cabeceras de pista en alta definición
 *
 * Incluye las 30 pistas principales y las 10 pistas SNES.
 *
 * Uso: node scripts/fetch-track-images.mjs
 */
import { mkdir, writeFile } from 'node:fs/promises'
import sharp from 'sharp'

const FILES = {
  // Copa Champiñón
  MBC: 'MKWd Mario Bros Circuit Icon.png',
  CC: 'MKWd Crown City Icon.png',
  WS: 'MKWd Whistlestop Summit Icon.png',
  DKS: 'MKWd DK Spaceport Icon.png',

  // Copa Flor
  rDH: 'MKWd Desert Hills Icon.png',
  rSGB: 'MKWd Shy Guy Bazaar Icon.png',
  rWS: 'MKWd Wario Stadium Icon.png',
  rAF: 'MKWd Airship Fortress Icon.png',

  // Copa Estrella
  rDKP: 'MKWd DK Pass Icon.png',
  SP: 'MKWd Starview Peak Icon.png',
  rSHS: 'MKWd Sky-High Sundae Icon.png',
  rWSh: 'MKWd Wario Shipyard Icon.png',

  // Copa Caparazón
  rKTB: 'MKWd Koopa Troopa Beach Icon.png',
  FO: 'MKWd Faraway Oasis Icon.png',
  PS: 'MKWorld Peach Stadium icon 2.png',

  // Copa Plátano
  rPB: 'Peach-Beach-MarioKartWorld.jpg',
  SSS: 'Salty Salty Speedway Mario Kart World.jpg',
  rDDJ: 'Dino Dino Jungle Mario Kart World.png',
  GBR: 'MKWorld Question Ruins icon.png',

  // Copa Hoja
  CCF: 'MKWorld Cheep Cheep Falls icon.png',
  DD: 'MKWorld Dandelion Depths icon.png',
  BCi: 'MKWorld Boo Cinema icon.png',
  DBB: 'MKWorld Dry Bones Burnout icon.png',

  // Copa Centella
  rMMM: 'MKWorld Moo Moo Meadows icon.png',
  rCM: 'MKWorld Choco Mountain icon.png',
  rTF: 'MKWorld Toads Factory icon.png',
  BC: 'MKWorld Bowsers Castle icon.png',

  // Copa Especial
  AH: 'MKWorld Acorn Heights Icon.jpg',
  rMC: 'MKWorld Mario Circuit icon.png',
  RR: 'MKWorld Rainbow Road icon.png',

  // Copa SNES (sub-pistas)
  rMC1: 'MKWorld SNES Mario Circuit 1 Icon.png',
  rMC2: 'MKWorld SNES Mario Circuit 2 Icon.png',
  rMC3: 'MKWorld SNES Mario Circuit 3 Icon.png',
  rGV1: 'MKWorld SNES Ghost Valley 1 Icon.png',
  rGV2: 'MKWorld SNES Ghost Valley 2 Icon.png',
  rGV3: 'MKWorld SNES Ghost Valley 3 Icon.png',
  rKB1: 'MKWorld SNES Koopa Beach 1 Icon.png',
  rCM1: 'MKWorld SNES Choco Island 1 Icon.png',
  rCM2: 'MKWorld SNES Choco Island 2 Icon.png',
  rVL1: 'MKWorld SNES Vanilla Lake 1 Icon.png',
}

const UA = { 'User-Agent': 'MKWHub/1.0 (https://mkw-hub.vercel.app)' }
const API = 'https://www.mariowiki.com/api.php'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function fileUrls() {
  const titles = Object.values(FILES).map((n) => `File:${n}`)
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    formatversion: '2',
    prop: 'imageinfo',
    iiprop: 'url',
    titles: titles.join('|'),
  })
  const res = await fetch(`${API}?${params}`, { headers: UA })
  const json = await res.json()
  const norm = new Map((json.query.normalized ?? []).map((n) => [n.from, n.to]))
  const red = new Map((json.query.redirects ?? []).map((r) => [r.from, r.to]))
  const byTitle = new Map(json.query.pages.filter((p) => p.imageinfo).map((p) => [p.title, p.imageinfo[0].url]))
  return Object.fromEntries(
    Object.entries(FILES).map(([abbr, n]) => {
      const raw = `File:${n}`
      const normalized = norm.get(raw) ?? raw
      const finalTitle = red.get(normalized) ?? normalized
      return [abbr, byTitle.get(finalTitle)]
    }),
  )
}

await mkdir('public/tracks/hd', { recursive: true })
console.log('Consultando URLs de imágenes en Super Mario Wiki...')
const urls = await fileUrls()

let count = 0
for (const [abbr, url] of Object.entries(urls)) {
  if (!url) {
    console.warn(`[!] ${abbr}: no encontrada en el wiki`)
    continue
  }
  const res = await fetch(url, { headers: UA })
  if (!res.ok) {
    console.error(`[!] ${abbr}: HTTP ${res.status}`)
    continue
  }
  const input = Buffer.from(await res.arrayBuffer())
  const hd = await sharp(input)
    .resize({ width: 1600, kernel: 'lanczos3' })
    .webp({ quality: 90 })
    .toBuffer()
  const card = await sharp(input)
    .resize({ width: 800, kernel: 'lanczos3' })
    .webp({ quality: 85 })
    .toBuffer()

  await writeFile(`public/tracks/hd/${abbr}.webp`, hd)
  await writeFile(`public/tracks/${abbr}.webp`, card)
  count++
  console.log(`[${count}/40] ${abbr}: 800w ${(card.length / 1024).toFixed(0)} KB | 1600w ${(hd.length / 1024).toFixed(0)} KB`)
  await sleep(250)
}

console.log(`\n¡Listo! ${count} pistas descargadas y optimizadas en public/tracks/ y public/tracks/hd/`)
