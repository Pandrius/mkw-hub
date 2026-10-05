import { describe, expect, it } from 'vitest'
import { hexToBytes, verifyDiscordSignature } from './verify'

const toHex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')

/** Par de claves Ed25519 nuevo y una función para firmar como lo haría Discord */
async function keyPair() {
  const pair = (await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify'])) as CryptoKeyPair
  const publicKey = toHex(await crypto.subtle.exportKey('raw', pair.publicKey))
  const sign = async (timestamp: string, body: string) =>
    toHex(await crypto.subtle.sign('Ed25519', pair.privateKey, new TextEncoder().encode(timestamp + body)))
  return { publicKey, sign }
}

describe('verifyDiscordSignature', () => {
  const body = JSON.stringify({ type: 1 })
  const ts = '1700000000'

  it('acepta una firma válida', async () => {
    const { publicKey, sign } = await keyPair()
    expect(await verifyDiscordSignature(publicKey, await sign(ts, body), ts, body)).toBe(true)
  })

  it('rechaza si cambia el cuerpo o el timestamp', async () => {
    const { publicKey, sign } = await keyPair()
    const sig = await sign(ts, body)
    expect(await verifyDiscordSignature(publicKey, sig, ts, body + ' ')).toBe(false)
    expect(await verifyDiscordSignature(publicKey, sig, '1700000001', body)).toBe(false)
  })

  it('rechaza la firma de otra clave', async () => {
    const a = await keyPair()
    const b = await keyPair()
    expect(await verifyDiscordSignature(a.publicKey, await b.sign(ts, body), ts, body)).toBe(false)
  })

  it('rechaza datos ausentes o mal formados sin lanzar', async () => {
    const { publicKey, sign } = await keyPair()
    const sig = await sign(ts, body)
    expect(await verifyDiscordSignature(publicKey, null, ts, body)).toBe(false)
    expect(await verifyDiscordSignature(publicKey, sig, null, body)).toBe(false)
    expect(await verifyDiscordSignature(publicKey, 'zz' + sig.slice(2), ts, body)).toBe(false)
    expect(await verifyDiscordSignature(publicKey, sig.slice(2), ts, body)).toBe(false)
    expect(await verifyDiscordSignature('abcd', sig, ts, body)).toBe(false)
  })
})

describe('hexToBytes', () => {
  it('convierte hex y rechaza lo que no lo es', () => {
    expect([...hexToBytes('00ff10')!]).toEqual([0, 255, 16])
    expect(hexToBytes('abc')).toBeNull()
    expect(hexToBytes('zz')).toBeNull()
  })
})
