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

## Bot de Discord

Comandos `/evento iniciar | ver | finalizar`, `/carrera`, `/corregir` y `/sub` para llevar una war o un lounge sin salir de Discord. Funciona por HTTP en Vercel (`api/discord.ts`); la lógica está en `src/lib/discord/`. Hay un evento activo por canal. Mientras no esté configurado, el endpoint responde 503 y no hace nada.

Puesta en marcha (una vez):

1. **Base de datos:** aplicar `supabase/migrations/0012_discord_bot.sql` en Supabase (SQL editor). Se puede comprobar con `supabase/tests/discord_bot.sql`, que lo deshace todo al final.
2. **Discord:** crear una aplicación en <https://discord.com/developers/applications> y un bot dentro.
3. **Vercel:** añadir `DISCORD_PUBLIC_KEY` (General Information → Public Key) y volver a desplegar. Usa también `VITE_SUPABASE_URL` y `SUPABASE_SECRET_KEY`, que ya existen.
4. **Endpoint:** en General Information → *Interactions Endpoint URL*, poner `https://mkw-hub.vercel.app/api/discord` (Discord lo valida con un PING al guardar).
5. **Comandos:** `DISCORD_APP_ID=... DISCORD_BOT_TOKEN=... node scripts/register-discord-commands.mjs` (añadiendo el ID de un servidor al final aparecen al instante, solo en ese servidor).
6. **Invitar el bot:** OAuth2 → URL Generator con el scope `applications.commands` (y `bot`).

Cada jugador tiene que haber entrado una vez en la web con Discord para que el bot lo reconozca.

## Créditos

- Miniaturas de las pistas (`public/tracks/` y `public/tracks/hd/`): [Super Mario Wiki](https://www.mariowiki.com/Gallery:Mario_Kart_World#Course_selection_icons) (iconos oficiales de selección de circuito en *Mario Kart World*). Imágenes © Nintendo.
- Abreviaturas de pistas: convención de la comunidad (Mario Kart Central / Lounge).
- Récords mundiales: [mkwrs.com](https://mkwrs.com/mkworld/) y el canal [@MKWorldRecords](https://www.youtube.com/@MKWorldRecords), sincronizados a diario desde su CSV público.
- Banderas: [flagcdn.com](https://flagcdn.com).

Consulta [ROADMAP.md](ROADMAP.md) para ver las fases y funcionalidades.
