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

  it('reparte los equipos por el color de la fila', () => {
    const reading = parseCaptureLines([line('1 Ana 88', 10, RED), line('2 Beto 85', 20, BLUE), line('3 Carla 80', 30, RED), line('4 Dani 75', 40, BLUE)])
    expect(reading.sidesFromColor).toBe(true)
    expect(reading.rows.map((r) => [r.name, r.side])).toEqual([['Ana', 'home'], ['Beto', 'away'], ['Carla', 'home'], ['Dani', 'away']])
  })

  it('si no se distinguen los colores, todas van al primer equipo para elegir a mano', () => {
    const reading = parseCaptureLines([line('1 Ana 88', 10, RED), line('2 Beto 85', 20, [120, 120, 120])])
    expect(reading.sidesFromColor).toBe(false)
    expect(reading.rows.every((r) => r.side === 'home')).toBe(true)
  })

  it('los totales de equipo (demasiados puntos) salen sin marcar', () => {
    const { rows } = parseCaptureLines([line('1 Ana 88', 10), line('Team 480', 20)])
    expect(rows.map((r) => [r.name, r.include])).toEqual([['Ana', true], ['Team', false]])
    expect(MAX_PLAYER_POINTS).toBe(200)
  })

  it('quita el tag sin corchetes que repiten los de un mismo equipo', () => {
    const reading = parseCaptureLines([line('1 NEB Ana 88', 10, RED), line('2 NEB Beto 85', 20, RED), line('3 Carla 80', 30, BLUE), line('4 Dani 75', 40, BLUE)])
    expect(reading.rows.map((r) => r.name)).toEqual(['Ana', 'Beto', 'Carla', 'Dani'])
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

  it('pasa a la tabla solo las filas marcadas, en su equipo, sin tocar tags ni nombres de equipo', () => {
    const war = emptyWar()
    war.home.tag = 'NEB'
    const rows = [...b.rows.map((r) => ({ ...r })), { id: 99, name: 'Total', points: '480', side: 'away' as const, include: false, raw: '' }]
    rows[1].side = 'away'
    const out = applyCapture(war, rows)
    expect(out.home.tag).toBe('NEB')
    expect(out.home.players.map((p) => [p.name, p.points])).toEqual([['Ana', '88']])
    expect(out.away.players.map((p) => [p.name, p.points])).toEqual([['Beto', '85']])
  })
})
