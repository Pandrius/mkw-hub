# MKW Hub

Guías, contrarreloj, estadísticas y wars para la comunidad competitiva de **Mario Kart World**.

🌐 https://mkw-hub.vercel.app

> Fan site no oficial. Mario Kart World es una marca de Nintendo; esta web no está afiliada ni respaldada por Nintendo.

## Desarrollo

```bash
npm install
npm run dev      # http://localhost:5173
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

Cada push a `main` se publica automáticamente en **Vercel**; cada rama o PR tiene su propia URL de previsualización.
Las variables `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` están configuradas en el proyecto de Vercel.
GitHub Actions (`.github/workflows/ci.yml`) pasa lint, tests y build en cada push.

## Créditos

- Miniaturas de las pistas (`public/tracks/` y `public/tracks/hd/`): [Super Mario Wiki](https://www.mariowiki.com/Gallery:Mario_Kart_World#Course_selection_icons) (iconos oficiales de selección de circuito en *Mario Kart World*). Imágenes © Nintendo.
- Abreviaturas de pistas: convención de la comunidad (Mario Kart Central / Lounge).
- Récords mundiales: [mkwrs.com](https://mkwrs.com/mkworld/) y el canal [@MKWorldRecords](https://www.youtube.com/@MKWorldRecords), sincronizados a diario desde su CSV público.
- Banderas: [flagcdn.com](https://flagcdn.com).

Consulta [ROADMAP.md](ROADMAP.md) para ver las fases y funcionalidades.
