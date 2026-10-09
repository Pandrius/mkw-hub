import { describe, expect, it } from 'vitest'
import { buildLorenziBody, isAllowedLogoUrl, sniffImageMime } from './lorenziEmblems'

describe('isAllowedLogoUrl', () => {
  it('solo acepta https de Mario Kart Central', () => {
    expect(isAllowedLogoUrl('https://mkcentral.com/img/team_logos/3046.png')).toBe(true)
    expect(isAllowedLogoUrl('https://www.mkcentral.com/img/x.png')).toBe(true)
    expect(isAllowedLogoUrl('http://mkcentral.com/img/x.png')).toBe(false)
    expect(isAllowedLogoUrl('https://evil.com/mkcentral.com/x.png')).toBe(false)
    expect(isAllowedLogoUrl('https://mkcentral.com.evil.com/x.png')).toBe(false)
    expect(isAllowedLogoUrl('https://user:pw@mkcentral.com/x.png')).toBe(false)
    expect(isAllowedLogoUrl('http://169.254.169.254/latest')).toBe(false)
    expect(isAllowedLogoUrl(null)).toBe(false)
    expect(isAllowedLogoUrl('no es una url')).toBe(false)
  })
})

describe('sniffImageMime', () => {
  it('detecta el tipo por los primeros bytes, no por lo que diga el servidor', () => {
    expect(sniffImageMime(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe('image/png')
    expect(sniffImageMime(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg')
    expect(sniffImageMime(Uint8Array.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]))).toBe('image/gif')
    const webp = new TextEncoder().encode('RIFF\0\0\0\0WEBP')
    expect(sniffImageMime(webp)).toBe('image/webp')
    expect(sniffImageMime(new TextEncoder().encode('<html>'))).toBeNull()
  })
})

describe('buildLorenziBody', () => {
  it('añade el estilo solo de los equipos con escudo', () => {
    const body = buildLorenziBody('txt', [
      { tag: 'NB', dataUri: 'data:image/png;base64,AA' },
      { tag: 'SR', dataUri: null },
    ])
    expect(body).toEqual({ data: 'txt', style: { emblemTag1: 'NB', emblemSrc1: 'data:image/png;base64,AA' } })
  })
  it('sin escudos pide la imagen normal', () => {
    expect(buildLorenziBody('txt', [{ tag: 'NB', dataUri: null }])).toEqual({ data: 'txt' })
  })
})
