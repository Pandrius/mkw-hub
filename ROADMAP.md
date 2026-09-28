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
- [ ] Historial de récords personales

### 3. Estadísticas individuales
- [ ] Eventos de 12 carreras: **Iniciar → editar → Finalizar** (con confirmación). Finalizado = bloqueado
- [ ] Cada carrera es **War** o **Lounge**; filtros War / Lounge / Todo
- [ ] Posición media por pista y general, mejores y peores pistas, evolución, aviso de pocos datos

### 4. Equipos y wars
- [ ] Equipos y tags importados de MKC; miembros verificados por Discord ID; líder/manager administra
- [ ] Al iniciar una war se indican los **6 jugadores** que van a jugar
- [ ] **Sustituciones** en cualquier carrera del evento
- [ ] Carreras de 11 o 10 jugadores indicando de qué equipo faltan
- [ ] Las posiciones de la war cuentan en las estadísticas War de cada jugador
- [ ] Rendimiento del equipo por pista, historial contra rivales

### 5. Extras
- [ ] Recomendador de picks para wars
- [ ] Comparador jugador vs jugador
- [ ] Combos recomendados por pista
- [ ] **Lectura desde capturadora** (OCR en el navegador):
  - Lounge: el jugador indica su nombre en el juego antes de empezar
  - War: se apuntan todos automáticamente; revisión antes de finalizar
  - Alias de nombre con el formato `Original = nombre en el juego` (p. ej. `Peckmat = tortelini`)
  - Las filas rojas y azules ayudan a identificar el equipo

## Puntuación de wars

`15 12 10 9 8 7 6 5 4 3 2 1`

- **11 jugadores:** el ausente recibe 1 punto (como si quedase 12.º).
- **10 jugadores:** puntúan del 1.º al 10.º, cada ausente recibe 1 punto y se pierde 1 punto (81 en total).
