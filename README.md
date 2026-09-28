# MKW Hub

Guías, contrarreloj, estadísticas y wars para la comunidad competitiva de **Mario Kart World**.

🌐 https://pandrius.github.io/mkw-hub/

> Fan site no oficial. Mario Kart World es una marca de Nintendo; esta web no está afiliada ni respaldada por Nintendo.

## Desarrollo

```bash
npm install
npm run dev      # http://localhost:5173/mkw-hub/
npm test         # tests (cálculo de puntos de war, etc.)
npm run build
```

Configuración local en `.env.local` (no se sube al repo):

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

Sin estas variables la web funciona igualmente, pero sin login ni datos.

## Publicación

Cada push a `main` se publica automáticamente en GitHub Pages (`.github/workflows/deploy.yml`).
Las variables `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` se configuran como *Variables* del repo
(Settings → Secrets and variables → Actions → Variables).

Consulta [ROADMAP.md](ROADMAP.md) para ver las fases y funcionalidades.
