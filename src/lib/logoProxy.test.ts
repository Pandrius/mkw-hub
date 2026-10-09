import { describe, expect, it } from 'vitest'
import { isAllowedLogoUrl, proxiedLogoUrl, sniffImageMime } from './logoProxy'

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
    expect(sniffImageMime(new TextEncoder().encode('RIFF\0\0\0\0WEBP'))).toBe('image/webp')
    expect(sniffImageMime(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>'))).toBeNull()
  })
})

describe('proxiedLogoUrl', () => {
  it('pasa por nuestra función solo los logos de MKC', () => {
    expect(proxiedLogoUrl('https://mkcentral.com/img/team_logos/3046.png')).toBe(
      '/api/logo?u=https%3A%2F%2Fmkcentral.com%2Fimg%2Fteam_logos%2F3046.png',
    )
    expect(proxiedLogoUrl('https://otro.com/logo.png')).toBe('https://otro.com/logo.png')
  })
})
