/**
 * Descarga las capturas de cada pista de Super Mario Wiki (originales en 4K) y las
 * convierte a WebP en dos tamaños:
 *   public/tracks/<abbr>.webp      800 px  → tarjetas, cinta de récords
 *   public/tracks/hd/<abbr>.webp  1600 px  → cabeceras de pista
 *
 * Uso: node scripts/fetch-track-images.mjs
 * Las 10 variantes SNES no tienen captura propia: usan la de su pista madre (ver src/data/tracks.ts).
 */
import { mkdir, writeFile } from 'node:fs/promises'
import sharp from 'sharp'

const FILES = {
  MBC: 'Mario Bros Circuit', CC: 'Crown City', WS: 'Whistlestop Summit', DKS: 'DK Spaceport',
  rDH: 'Desert Hills', rSGB: 'Shy Guy Bazaar', rWS: 'Wario Stadium', rAF: 'Airship Fortress',
  rDKP: 'DK Pass', SP: 'Starview Peak', rSHS: 'Sky High Sundae', rWSh: 'Wario Shipyard',
  rKTB: 'Koopa Troopa Beach', FO: 'Faraway Oasis', PS: 'Peach Stadium', rPB: 'Peach Beach',
  SSS: 'Salty Salty Speedway', rDDJ: 'Dino Dino Jungle', GBR: 'Great Q Block Ruins', CCF: 'Cheep Cheep Falls',
  DD: 'Dandelion Depths', BCi: 'Boo Cinema', DBB: 'Dry Bones Burnout', rMMM: 'Moo Moo Meadows',
  rCM: 'Choco Mountain', rTF: 'Toads Factory', BC: 'Bowsers Castle', AH: 'Acorn Heights',
  rMC: 'Mario Circuit', RR: 'Rainbow Road',
}

const UA = { 'User-Agent': 'MKWHub/1.0 (https://mkw-hub.vercel.app)' }
const API = 'https://www.mariowiki.com/api.php'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function thumbUrls() {
  const titles = Object.values(FILES).map((n) => `File:NM MKWorld ${n}.png`)
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    formatversion: '2',
    prop: 'imageinfo',
    iiprop: 'url|size',
    iiurlwidth: '1600',
    titles: titles.join('|'),
  })
  const res = await fetch(`${API}?${params}`, { headers: UA })
  const json = await res.json()
  const norm = new Map((json.query.normalized ?? []).map((n) => [n.from, n.to]))
  const byTitle = new Map(json.query.pages.filter((p) => p.imageinfo).map((p) => [p.title, p.imageinfo[0].thumburl]))
  return Object.fromEntries(
    Object.entries(FILES).map(([abbr, n]) => {
      const t = `File:NM MKWorld ${n}.png`
      return [abbr, byTitle.get(norm.get(t) ?? t)]
    }),
  )
}

await mkdir('public/tracks/hd', { recursive: true })
const urls = await thumbUrls()
for (const [abbr, url] of Object.entries(urls)) {
  if (!url) {
    console.log(`${abbr}: no encontrada en el wiki`)
    continue
  }
  const res = await fetch(url, { headers: UA })
  if (!res.ok) {
    console.log(`${abbr}: error ${res.status}`)
    continue
  }
  const input = Buffer.from(await res.arrayBuffer())
  const hd = await sharp(input).resize({ width: 1600 }).webp({ quality: 80 }).toBuffer()
  const card = await sharp(input).resize({ width: 800 }).webp({ quality: 76 }).toBuffer()
  await writeFile(`public/tracks/hd/${abbr}.webp`, hd)
  await writeFile(`public/tracks/${abbr}.webp`, card)
  console.log(`${abbr}: ${(card.length / 1024).toFixed(0)} KB / HD ${(hd.length / 1024).toFixed(0)} KB`)
  await sleep(400) // sin prisas con el wiki
}
