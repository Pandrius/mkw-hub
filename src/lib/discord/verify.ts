/**
 * Verificación de la firma Ed25519 que Discord añade a cada petición
 * (cabeceras X-Signature-Ed25519 y X-Signature-Timestamp).
 * Usa WebCrypto (globalThis.crypto.subtle), disponible en Node 20+ y en los navegadores.
 */

export function hexToBytes(hex: string): Uint8Array<ArrayBuffer> | null {
  if (hex.length % 2 !== 0 || !/^[0-9a-fA-F]*$/.test(hex)) return null
  const out = new Uint8Array(hex.length / 2)
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  return out
}

/**
 * true si `signature` (hex) es la firma de timestamp + body con la clave pública `publicKey` (hex).
 * Cualquier dato mal formado devuelve false, nunca lanza.
 */
export async function verifyDiscordSignature(
  publicKey: string,
  signature: string | null | undefined,
  timestamp: string | null | undefined,
  body: string,
): Promise<boolean> {
  if (!signature || !timestamp) return false
  const key = hexToBytes(publicKey.trim())
  const sig = hexToBytes(signature)
  if (!key || key.length !== 32 || !sig || sig.length !== 64) return false
  try {
    const cryptoKey = await crypto.subtle.importKey('raw', key, { name: 'Ed25519' }, false, ['verify'])
    return await crypto.subtle.verify('Ed25519', cryptoKey, sig, new TextEncoder().encode(timestamp + body))
  } catch {
    return false
  }
}
