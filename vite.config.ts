/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { createReadStream, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { defineConfig, type Plugin } from 'vite'

// Ficheros de Tesseract.js (lector de capturas) servidos desde /tesseract/, sin depender de un CDN
const require = createRequire(import.meta.url)
const pkgDir = (name: string) => dirname(require.resolve(`${name}/package.json`))
const TESSERACT_FILES: Record<string, string> = {
  'worker.min.js': join(pkgDir('tesseract.js'), 'dist/worker.min.js'),
  'eng.traineddata.gz': join(pkgDir('@tesseract.js-data/eng'), '4.0.0_best_int/eng.traineddata.gz'),
  ...Object.fromEntries(
    ['tesseract-core-lstm.wasm.js', 'tesseract-core-simd-lstm.wasm.js', 'tesseract-core-relaxedsimd-lstm.wasm.js'].map(
      (f) => [f, join(pkgDir('tesseract.js-core'), f)],
    ),
  ),
}

function tesseractAssets(): Plugin {
  return {
    name: 'tesseract-assets',
    configureServer(server) {
      server.middlewares.use('/tesseract/', (req, res, next) => {
        const file = TESSERACT_FILES[(req.url ?? '').replace(/^\//, '').split('?')[0]]
        if (!file) return next()
        res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : 'application/octet-stream')
        createReadStream(file).pipe(res)
      })
    },
    generateBundle() {
      for (const [name, file] of Object.entries(TESSERACT_FILES)) {
        this.emitFile({ type: 'asset', fileName: `tesseract/${name}`, source: readFileSync(file) })
      }
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), tesseractAssets()],
  test: {
    include: ['src/**/*.test.ts'],
  },
})
