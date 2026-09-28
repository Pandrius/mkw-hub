import { describe, expect, it } from 'vitest'
import { countryCodeFromName } from './countries'
import { parseCsv, parseWorldRecords } from './mkwrs'

// Filas reales del CSV de mkwrs (recortadas a 30 columnas tal cual)
const CSV = [
  `3688,"Rjohn1277","2026-09-27","Rainbow Road",232710,30,"USA","https://www.youtube.com/watch?v=RanachJUn9U","8-10-2-0","0-3-0-0","Big Horn","-",1,"-",1,"Wiggler","57.752","48.522","52.898",0,0,"1:13.538","","","",150,\\N,"0",0,""`,
  `5,"Borgerboy","2025-06-05","Moo Moo Meadows",128910,24,"Australia","N/A","6-2-0","1-1-1","Dread Sled","-",0,"-",0,"Bowser","-","-","-",1,0,"","","","",150,\\N,"0",0,""`,
  `3686,"K4I","2026-09-27","SNES Vanilla Lake 1",82199,40,"Japan","https://www.youtube.com/watch?v=BGr_hlHpQYg","3-0-0-0-0","1-0-0-1-1","Dread Sled","-",1,"-",1,"Luigi","16.906","16.742","16.746",0,0,"15.926","15.879","","",150,\\N,"0",0,""`,
  `2908,"SuperFX","2025-12-07","Mario Bros. Circuit (Glitch)",108029,1001,"USA","https://www.youtube.com/watch?v=_oH7XrI25ik","8-0-0","1-1-1","R.O.B. H.O.G.","-",0,"-",1,"Nabbit","37.014","35.566","35.449",0,0,"","","","",150,\\N,"0",0,""`,
].join('\n')

describe('parseCsv', () => {
  it('respeta comillas, comas y comillas escapadas', () => {
    expect(parseCsv(`1,"a, b","say ""hi"""\n2,x,y`)).toEqual([
      ['1', 'a, b', 'say "hi"'],
      ['2', 'x', 'y'],
    ])
  })
})

describe('parseWorldRecords', () => {
  const records = parseWorldRecords(CSV)

  it('ignora las pistas que no son nuestras (Glitch)', () => {
    expect(records.map((r) => r.id)).toEqual([3688, 5, 3686])
  })

  it('convierte una fila completa', () => {
    expect(records[0]).toEqual({
      id: 3688,
      track_id: 'rainbow-road',
      time_ms: 232710,
      player_name: 'Rjohn1277',
      country_code: 'US',
      achieved_on: '2026-09-27',
      days_held: 1,
      video_url: 'https://www.youtube.com/watch?v=RanachJUn9U',
      character: 'Wiggler',
      vehicle: 'Big Horn',
      splits: ['57.752', '48.522', '52.898', '1:13.538'],
    })
  })

  it('sin vídeo ni parciales', () => {
    expect(records[1].video_url).toBeNull()
    expect(records[1].splits).toEqual([])
  })

  it('pistas SNES con 5 vueltas', () => {
    expect(records[2].track_id).toBe('snes-vanilla-lake-1')
    expect(records[2].splits).toHaveLength(5)
  })
})

describe('countryCodeFromName', () => {
  it.each([
    ['USA', 'US'],
    ['UK', 'GB'],
    ['South Korea', 'KR'],
    ['Puerto Rico', 'PR'],
    ['Spain', 'ES'],
    ['New Zealand', 'NZ'],
  ])('%s → %s', (name, code) => {
    expect(countryCodeFromName(name)).toBe(code)
  })

  it('Unknown → null', () => {
    expect(countryCodeFromName('Unknown')).toBeNull()
  })
})
