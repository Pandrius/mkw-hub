// Capturas de la sala final de una war: subida al bucket privado `war-proofs`, envío a revisión y revisión.
// La lógica de comparar los puntos está en proofCheck.ts; las reglas de quién puede qué, en la migración 0027.
import { bestProof, proofMatches, readProof, type ProofPlayer, type ProofReading } from './proofCheck'
import { supabase } from './supabase'

const BUCKET = 'war-proofs'
/** Por encima de este tamaño se reduce la imagen antes de subirla (el bucket admite 5 MB) */
const MAX_BYTES = 4_500_000

function client() {
  if (!supabase) throw new Error('Supabase no está configurado')
  return supabase
}

/** Huella SHA-256 (hex) de la imagen: una misma captura no puede respaldar dos wars */
export async function sha256Hex(blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer())
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** Reduce una imagen demasiado grande a JPEG de hasta 2000 px de ancho */
async function shrink(file: Blob): Promise<Blob> {
  if (file.size <= MAX_BYTES) return file
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, 2000 / bitmap.width)
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  const out = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85))
  if (!out || out.size > MAX_BYTES) throw new Error('La imagen es demasiado grande')
  return out
}

/** Lee la captura en el navegador y compara los puntos de nuestros jugadores con los de la war */
export async function readProofImage(file: Blob, players: ProofPlayer[], onProgress?: (p: number) => void): Promise<{ reading: ProofReading; auto: boolean }> {
  const { readImageLines } = await import('./ocrImage')
  const passes = await readImageLines(file, onProgress)
  const reading = bestProof([passes.inverted, passes.normal].map((lines) => readProof(lines, players)))
  return { reading, auto: proofMatches(reading, players) }
}

/** Sube la captura y la envía a revisión. Devuelve 'auto' (puntos coincidentes, cuenta ya) o 'pending' (espera a un revisor) */
export async function submitWarProof(eventId: string, file: Blob, reading: ProofReading, auto: boolean): Promise<'auto' | 'pending'> {
  const db = client()
  const image = await shrink(file)
  const hash = await sha256Hex(image)
  const ext = image.type === 'image/png' ? 'png' : image.type === 'image/webp' ? 'webp' : 'jpg'
  const path = `${eventId}/${hash.slice(0, 16)}.${ext}`
  const { error: upError } = await db.storage.from(BUCKET).upload(path, image, { contentType: image.type || 'image/jpeg', upsert: false })
  if (upError && !/exists/i.test(upError.message)) throw new Error(upError.message)
  const { data, error } = await db.rpc('submit_war_proof', { target: eventId, path, hash, auto_match: auto, reading })
  if (error) {
    // Si el servidor la rechaza, no dejamos la imagen suelta en el bucket
    if (!upError) await db.storage.from(BUCKET).remove([path])
    throw new Error(error.message)
  }
  return data as 'auto' | 'pending'
}

/** Enlace temporal para ver la captura (solo quien la subió o un revisor) */
export async function proofImageUrl(path: string): Promise<string> {
  const { data, error } = await client().storage.from(BUCKET).createSignedUrl(path, 600)
  if (error) throw new Error(error.message)
  return data.signedUrl
}

export async function reviewWarProof(eventId: string, approve: boolean): Promise<void> {
  const { error } = await client().rpc('review_war_proof', { target: eventId, approve })
  if (error) throw new Error(error.message)
}
