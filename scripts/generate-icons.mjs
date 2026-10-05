/**
 * Genera los iconos de la PWA a partir de public/favicon.svg:
 *   public/icons/icon-192.png, icon-512.png     → manifest (purpose "any")
 *   public/icons/maskable-512.png               → manifest (purpose "maskable"), con margen de seguridad
 *   public/icons/apple-touch-icon.png (180 px)  → iOS (pantalla de inicio)
 *
 * Uso: npm run icons
 */
import { mkdir, readFile } from 'node:fs/promises'
import sharp from 'sharp'

const OUT = 'public/icons'
const svg = await readFile('public/favicon.svg', 'utf8')

// Versión "maskable": Android recorta el icono en círculo o squircle, así que la M
// se encoge para que quepa en la zona segura (círculo del 80 % central).
const shapes = svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '')
const background = shapes.match(/<rect[^>]*\/>/)?.[0] ?? ''
const foreground = shapes.replace(background, '')
const maskable = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  ${background}
  <g transform="translate(32 32) scale(0.72) translate(-32 -32)">${foreground}</g>
</svg>`

const ICONS = [
  { file: 'icon-192.png', size: 192, source: svg },
  { file: 'icon-512.png', size: 512, source: svg },
  { file: 'maskable-512.png', size: 512, source: maskable },
  { file: 'apple-touch-icon.png', size: 180, source: svg },
]

await mkdir(OUT, { recursive: true })
for (const { file, size, source } of ICONS) {
  await sharp(Buffer.from(source), { density: Math.ceil((72 * size) / 64) })
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toFile(`${OUT}/${file}`)
  console.log(`✓ ${OUT}/${file}`)
}
