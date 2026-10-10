# MKW Hub — Hoja de ruta

Fan site no oficial para la comunidad competitiva de Mario Kart World.

## Stack

- **Web:** React + Vite + TypeScript + Tailwind, publicada en Vercel.
- **Datos, login y permisos:** Supabase (Postgres + Row Level Security). Login con Discord.
- **Idiomas:** español e inglés (src/i18n/), con selector en la cabecera.
- **Sincronización diaria:** función de Vercel (api/sync.ts): récords mundiales desde el CSV de mkwrs.com (y más adelante los equipos de Mario Kart Central). Además mantiene Supabase activo.

## Roles

| Rol | Permisos |
|---|---|
| Admin | Todo; gestiona todos los roles |
| Moderador | Todos los permisos de editor + dar y quitar permisos de editor |
| Editor de contrarreloj | Añade y borra tiempos de la comunidad |
| Editor de strats | Guías y consejos de las pistas |
| Usuario | Registra y edita solo sus propias carreras |
| Miembro de equipo | Registra y edita las wars de su equipo (verificado con MKC por Discord) |

## Fases

### 1. Base
- [x] Lista de pistas (30 + 10 variantes SNES de la 1.8.0)
- [x] Página de pista con pestañas: guía de contrarreloj, guía de carreras, tiempos, estadísticas
- [x] Cálculo de puntos de war (12/11/10 jugadores) con tests
- [x] Login con Discord
- [x] Guías editables por editores (consejos con título, texto y vídeo de YouTube)

### 2. Contrarreloj
- [x] Tiempos por pista: **Carrera completa** y **FLAP** (vuelta rápida), con marca **NITA**
- [x] Rankings por pista y categoría con enlace a la prueba
- [x] Récords mundiales de las 40 pistas (actual + historial, bandera, vídeo, combo y parciales),
      sincronizados cada día desde mkwrs.com / canal @MKWorldRecords (cron de Vercel)
- [x] Panel de administración: roles y permisos de editor (contrarreloj / strats)
- [x] Web en español e inglés
- [x] Historial de récords personales (progresión por pista con gráfico, aviso de nuevo PB, últimos PBs)
- [x] Objetivos: puesto en la comunidad, distancia al siguiente puesto / top 10 / top 3, % del récord mundial

### 3. Estadísticas individuales
- [x] Eventos de 12 carreras: **Iniciar → editar → Finalizar** (con confirmación). Finalizado = bloqueado
- [x] Cada carrera es **War** o **Lounge**; filtros War / Lounge / Todo
- [x] Posición media por pista y general, mejores y peores pistas, aviso de pocos datos
- [x] Al iniciar una war se indican los **6 jugadores** (alias `Usuario = nombre en el juego`)
- [x] **Sustituciones** en cualquier carrera del evento
- [x] Carreras de 11 o 10 jugadores indicando de qué equipo faltan
- [x] Tabla automática de la war (puntos por jugador, marcador, texto para copiar)
- [x] Las posiciones de la war cuentan en las estadísticas War de cada jugador
- [x] Puntos por war, distribución de posiciones, regularidad, rendimiento por fase (1-4 / 5-8 / 9-12) y war frente a lounge
- [x] Forma (últimas 12 carreras frente a las anteriores, media móvil) y rachas
- [x] Pistas fuertes y débiles frente a la media propia, ajustadas por número de carreras
- [x] Análisis de cada war: evolución de la diferencia, cambios de líder, fases, reparto de posiciones y rendimiento individual

### 3b. Bot de Discord
- [x] Comandos `/evento iniciar`, `/carrera`, `/sub`, `/corregir`, `/evento ver`, `/evento finalizar`
- [x] Marcador tras cada carrera (embed)
- [ ] Tabla en imagen al finalizar (en la web ya existe el botón de imagen)
- [x] Funciona por HTTP en Vercel (sin servidor aparte), mismas funciones de la base de datos que la web
- [ ] **Activarlo:** aplicar la migración 0012 y configurar la app de Discord (ver README)

### 4. Equipos
- [x] Equipos y tags importados de MKC; miembros verificados por Discord ID
- [ ] Líder/manager administra el equipo
- [x] Wars vinculadas al equipo: solo sus miembros las editan
- [x] Rendimiento del equipo por pista (+/- y % de carreras ganadas), cara a cara con cada rival
- [x] Forma del equipo, remontadas, ventajas mantenidas, wars ajustadas y rendimiento por fase
- [x] Jugadores del equipo: puntos por war, % de los puntos del equipo, +/- con y sin el jugador
- [ ] Disponibilidad del equipo para organizar wars (más adelante)

### 5. Extras
- [ ] Recomendador de picks para wars
- [x] Comparador de tiempos entre jugadores y equipos
- [ ] Combos recomendados por pista
- [ ] **Lectura desde capturadora** (OCR en el navegador) — aparcado de momento:
  - Lounge: el jugador indica su nombre en el juego antes de empezar
  - War: se apuntan todos automáticamente; revisión antes de finalizar
  - Alias de nombre con el formato `Original = nombre en el juego` (p. ej. `Peckmat = tortelini`)
  - Las filas rojas y azules ayudan a identificar el equipo

### 6. Comodidad
- [x] Buscador global en la cabecera (jugadores, equipos y pistas; atajo `/` o Ctrl+K)
- [x] Web instalable (PWA) con service worker que nunca cachea Supabase ni `/api/`
- [x] Tabla de la war como imagen (descargar o copiar para Discord)

## Puntuación de wars

`15 12 10 9 8 7 6 5 4 3 2 1`

- **11 jugadores:** el ausente recibe 1 punto (como si quedase 12.º).
- **10 jugadores:** puntúan del 1.º al 10.º, cada ausente recibe 1 punto y se pierde 1 punto (81 en total).
