import { describe, expect, it } from 'vitest'
import { applyCapture, bestReading, MAX_PLAYER_POINTS, parseCaptureLines, swapSides, teamOfColor, type CaptureLine, type Rgb } from './captureTable'
import { emptyWar } from './freeTable'

const RED: Rgb = [190, 40, 50]
const BLUE: Rgb = [40, 80, 200]
const line = (text: string, y: number, rgb: Rgb | null = null): CaptureLine => ({ text, y, confidence: 90, rgb })

describe('teamOfColor', () => {
  it('reconoce el rojo y el azul de las filas', () => {
    expect(teamOfColor(RED)).toBe('red')
    expect(teamOfColor([220, 60, 40])).toBe('red')
    expect(teamOfColor([255, 90, 160])).toBe('red') // rosado: cercano al rojo
    expect(teamOfColor(BLUE)).toBe('blue')
    expect(teamOfColor([60, 150, 230])).toBe('blue')
  })

  it('ignora grises, oscuros y otros colores', () => {
    expect(teamOfColor([120, 120, 120])).toBeNull()
    expect(teamOfColor([20, 20, 30])).toBeNull()
    expect(teamOfColor([60, 200, 80])).toBeNull() // verde
    expect(teamOfColor([220, 200, 40])).toBeNull() // amarillo
  })
})

describe('parseCaptureLines', () => {
  it('saca el nombre y los puntos, sin la posición del principio', () => {
    const { rows } = parseCaptureLines([line('1 Peckmat 88', 10), line('2. Rayito1005 85', 20), line('3º Ana 7', 30)])
    expect(rows.map((r) => [r.name, r.points])).toEqual([['Peckmat', '88'], ['Rayito1005', '85'], ['Ana', '7']])
  })

  it('el número pegado al final del nombre no son los puntos', () => {
    const { rows } = parseCaptureLines([line('1 Rayito1005 85', 10), line('2 Beto2 70', 20)])
    expect(rows.map((r) => [r.name, r.points])).toEqual([['Rayito1005', '85'], ['Beto2', '70']])
  })

  it('limpia los nombres: sin tag ni símbolos, con alfabetos no latinos', () => {
    const { rows } = parseCaptureLines([line('1 [NEB] Peckmat 88', 10), line('2 Αλέξανδρος ~ 80', 20), line('3 たろう 77', 30), line('4 山田太郎 70', 40), line('5 §Bob§ 60', 50)])
    expect(rows.map((r) => r.name)).toEqual(['Peckmat', 'Αλέξανδρος', 'たろう', '山田太郎', 'Bob'])
  })

  it('quita el tag conocido de los equipos escritos en el editor', () => {
    const { rows } = parseCaptureLines([line('1 NEB Peckmat 88', 10)], ['NEB'])
    expect(rows[0].name).toBe('Peckmat')
  })

  it('ordena por altura y descarta lo que no es una fila de jugador', () => {
    const { rows } = parseCaptureLines([line('2 Beto 70', 40), line('Resultados', 5), line('1 Ana 80', 20), line('Ana', 60), line('12', 70)])
    expect(rows.map((r) => r.name)).toEqual(['Ana', 'Beto'])
  })

  it('reparte los equipos por el tag de cada jugador y saca el tag de cada equipo', () => {
    const r = parseCaptureLines([line('1 [NEB] Ana 88', 10), line('2 [RKL] Beto 85', 20), line('3 [NEB] Carla 80', 30), line('4 [RKL] Dani 75', 40)])
    expect(r.sidesFrom).toBe('tag')
    expect(r.tags).toEqual({ home: 'NEB', away: 'RKL' })
    expect(r.rows.map((x) => [x.name, x.side])).toEqual([['Ana', 'home'], ['Beto', 'away'], ['Carla', 'home'], ['Dani', 'away']])
  })

  it('el tag sin corchetes que repiten los de un equipo también vale', () => {
    const r = parseCaptureLines([line('1 NEB Ana 88', 10), line('2 RKL Beto 85', 20), line('3 NEB Carla 80', 30), line('4 RKL Dani 75', 40)])
    expect(r.tags).toEqual({ home: 'NEB', away: 'RKL' })
    expect(r.rows.map((x) => x.name)).toEqual(['Ana', 'Beto', 'Carla', 'Dani'])
  })

  it('sin tags escritos, el equipo 1 es el del jugador que va arriba en la captura', () => {
    const r = parseCaptureLines([line('1 [RKL] Ana 88', 10), line('2 [NEB] Beto 85', 20), line('3 [NEB] Carla 80', 30), line('4 [RKL] Dani 75', 40), line('5 [NEB] Eva 70', 50)])
    expect(r.tags).toEqual({ home: 'RKL', away: 'NEB' })
  })

  it('el equipo 1 es el del tag escrito en el editor', () => {
    const r = parseCaptureLines([line('1 [NEB] Ana 88', 10), line('2 [RKL] Beto 85', 20), line('3 [NEB] Carla 80', 30), line('4 [RKL] Dani 75', 40), line('5 [RKL] Eva 70', 50)], ['RKL', 'NEB'])
    expect(r.tags).toEqual({ home: 'RKL', away: 'NEB' })
    expect(r.rows.filter((x) => x.side === 'home').map((x) => x.name)).toEqual(['Beto', 'Dani', 'Eva'])
  })

  it('un solo equipo con tag: los demás son el rival', () => {
    const r = parseCaptureLines([line('1 [NEB] Ana 88', 10), line('2 Beto 85', 20), line('3 [NEB] Carla 80', 30), line('4 Dani 75', 40)])
    expect(r.tags).toEqual({ home: 'NEB', away: '' })
    expect(r.rows.map((x) => [x.name, x.side])).toEqual([['Ana', 'home'], ['Beto', 'away'], ['Carla', 'home'], ['Dani', 'away']])
  })

  it('con tags de dos equipos, quien no lleva tag va por el color o, si no, donde faltan jugadores', () => {
    const r = parseCaptureLines([line('1 [NEB] Ana 88', 10, RED), line('2 [RKL] Beto 85', 20, BLUE), line('3 [NEB] Carla 80', 30, RED), line('4 [RKL] Dani 75', 40, BLUE), line('5 Eva 70', 50, BLUE), line('6 Fran 60', 60, RED)])
    expect(r.rows.find((x) => x.name === 'Eva')?.side).toBe('away')
    expect(r.rows.find((x) => x.name === 'Fran')?.side).toBe('home')
  })

  it('un tag que lleva un solo jugador no hace un equipo', () => {
    expect(parseCaptureLines([line('1 [NEB] Ana 88', 10), line('2 Beto 85', 20)]).sidesFrom).toBe('none')
  })

  it('sin tags, reparte los equipos por el color de la fila', () => {
    const reading = parseCaptureLines([line('1 Ana 88', 10, RED), line('2 Beto 85', 20, BLUE), line('3 Carla 80', 30, RED), line('4 Dani 75', 40, BLUE)])
    expect(reading.sidesFrom).toBe('color')
    expect(reading.tags).toEqual({ home: '', away: '' })
    expect(reading.rows.map((r) => [r.name, r.side])).toEqual([['Ana', 'home'], ['Beto', 'away'], ['Carla', 'home'], ['Dani', 'away']])
  })

  it('si no hay tags ni colores, todas van al primer equipo para elegir a mano', () => {
    const reading = parseCaptureLines([line('1 Ana 88', 10, RED), line('2 Beto 85', 20, [120, 120, 120])])
    expect(reading.sidesFrom).toBe('none')
    expect(reading.rows.every((r) => r.side === 'home')).toBe(true)
  })

  it('los totales de equipo (demasiados puntos) salen sin marcar', () => {
    const { rows } = parseCaptureLines([line('1 Ana 88', 10), line('Team 480', 20)])
    expect(rows.map((r) => [r.name, r.include])).toEqual([['Ana', true], ['Team', false]])
    expect(MAX_PLAYER_POINTS).toBe(200)
  })
})

describe('bestReading, swapSides y applyCapture', () => {
  const a = parseCaptureLines([line('1 Ana 88', 10)])
  const b = parseCaptureLines([line('1 Ana 88', 10), line('2 Beto 85', 20)])

  it('elige la lectura con más filas válidas', () => {
    expect(bestReading([a, b])).toBe(b)
  })

  it('cambia los equipos de todas las filas', () => {
    expect(swapSides(b.rows).map((r) => r.side)).toEqual(['away', 'away'])
  })

  it('pasa a la tabla solo las filas marcadas, en su equipo, sin tocar tags ni nombres de equipo si no hay tags nuevos', () => {
    const war = emptyWar()
    war.home.tag = 'NEB'
    const rows = [...b.rows.map((r) => ({ ...r })), { id: 99, name: 'Total', points: '480', side: 'away' as const, include: false, raw: '' }]
    rows[1].side = 'away'
    const out = applyCapture(war, rows)
    expect(out.home.tag).toBe('NEB')
    expect(out.home.players.map((p) => [p.name, p.points])).toEqual([['Ana', '88']])
    expect(out.away.players.map((p) => [p.name, p.points])).toEqual([['Beto', '85']])
  })

  it('con tags nuevos los pone a los equipos y suelta el equipo de la web elegido antes si el tag cambia', () => {
    const war = emptyWar()
    war.home = { ...war.home, tag: 'OLD', name: 'Viejo', teamId: 7 }
    war.away.tag = 'RKL'
    war.away.name = 'Rival'
    const out = applyCapture(war, b.rows, { home: 'NEB', away: 'rkl' })
    expect(out.home).toMatchObject({ tag: 'NEB', name: '', teamId: null })
    // Mismo tag con otra grafía: el equipo no cambia
    expect(out.away).toMatchObject({ tag: 'rkl', name: 'Rival' })
  })
})

describe('pantalla de resultados de dos columnas', () => {
  // Lo que lee el OCR de la captura de referencia (columna 0 = izquierda, 1 = derecha)
  const col = (column: 0 | 1, ...texts: string[]): CaptureLine[] => texts.map((text, i) => ({ text, y: 547 + i * 51, confidence: 80, column }))
  const reading = parseCaptureLines([
    ...col(0, '92: Ines 113', '92: 101', '92: sphinx 84', '921 JoyBy 79', '2: Aegis 68', '92: FFFFFF oo 2'),
    ...col(1, 'GO Polimar 86', 'GO skill 83', 'GO Waguri 82', 'GO tab 79', 'GO Dani 76', 'GO*Rayito 73'),
  ])

  it('cada columna es un equipo y su tag es la palabra que comparten, aunque el OCR la lea con variaciones', () => {
    expect(reading.sidesFrom).toBe('column')
    expect(reading.tags.home).toMatch(/^92/)
    expect(reading.tags.away).toBe('GO')
  })

  it('saca los nombres y los puntos de las 12 filas, con el jugador sin nombre incluido', () => {
    const left = reading.rows.filter((r) => r.side === 'home')
    const right = reading.rows.filter((r) => r.side === 'away')
    expect(left.map((r) => [r.name, r.points])).toEqual([['Ines', '113'], ['', '101'], ['sphinx', '84'], ['JoyBy', '79'], ['Aegis', '68'], ['FFFFFF', '2']])
    expect(right.map((r) => [r.name, r.points])).toEqual([['Polimar', '86'], ['skill', '83'], ['Waguri', '82'], ['tab', '79'], ['Dani', '76'], ['Rayito', '73']])
    expect(reading.rows.every((r) => r.include)).toBe(true)
  })

  it('los puntos de cada equipo suman el total de la captura (447 y 479)', () => {
    const total = (side: string) => reading.rows.filter((r) => r.side === side).reduce((n, r) => n + Number(r.points), 0)
    expect([total('home'), total('away')]).toEqual([447, 479])
  })

  it('pasa a la tabla también al jugador sin nombre, con sus puntos', () => {
    const out = applyCapture(emptyWar(), reading.rows, reading.tags)
    expect(out.home.players).toHaveLength(6)
    expect(out.home.players[1]).toMatchObject({ name: '', points: '101' })
    expect(out.away.tag).toBe('GO')
  })
})
