import { getStore } from '@netlify/blobs'

// Product images live in a site-wide Blobs store. Keys are content-addressed
// (<productId>/<sha256>.<ext>), so a new upload always gets a new URL: the Image CDN and browsers
// can cache each one forever, and nothing is ever re-downloaded or re-uploaded per request.
const STORE = 'product-images'
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024

const store = () => getStore({ name: STORE, consistency: 'strong' })

// Identified from the file's own bytes, not the browser-supplied name or MIME type.
const SIGNATURES: Array<{ type: string; ext: string; test: (b: Uint8Array) => boolean }> = [
  { type: 'image/jpeg', ext: 'jpg', test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { type: 'image/png', ext: 'png', test: (b) => [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((x, i) => b[i] === x) },
  { type: 'image/webp', ext: 'webp', test: (b) => ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 12) === 'WEBP' },
  { type: 'image/avif', ext: 'avif', test: (b) => ascii(b, 4, 8) === 'ftyp' && ['avif', 'avis'].includes(ascii(b, 8, 12)) },
]
const ascii = (b: Uint8Array, from: number, to: number) => String.fromCharCode(...b.subarray(from, to))

export class ImageRejected extends Error {}

export function detectImageType(bytes: Uint8Array) {
  return SIGNATURES.find((s) => s.test(bytes)) ?? null
}

/** Validates and stores an image. Returns its key; the caller records the key on the product. */
export async function saveProductImage(productId: string, file: File) {
  if (file.size === 0) throw new ImageRejected('The file is empty.')
  if (file.size > MAX_IMAGE_BYTES) throw new ImageRejected(`Images must be ${MAX_IMAGE_BYTES / 1024 / 1024} MB or smaller.`)
  const buffer = await file.arrayBuffer()
  const kind = detectImageType(new Uint8Array(buffer, 0, Math.min(16, buffer.byteLength)))
  if (!kind) throw new ImageRejected('Upload a JPEG, PNG, WebP or AVIF image.')

  const hash = Buffer.from(await crypto.subtle.digest('SHA-256', buffer)).toString('hex').slice(0, 32)
  const key = `${productId}/${hash}.${kind.ext}`
  await store().set(key, buffer)
  return key
}

export async function readProductImage(key: string) {
  const body = await store().get(key, { type: 'stream' })
  if (!body) return null
  const ext = key.split('.').pop()
  return { body, contentType: SIGNATURES.find((s) => s.ext === ext)?.type ?? 'application/octet-stream' }
}

export const deleteProductImage = (key: string) => store().delete(key)

/** Keys are only ever ones we generated: <productId>/<hex>.<ext>. Anything else is rejected. */
export const isValidImageKey = (key: string) => /^[a-z0-9_]{1,64}\/[a-f0-9]{32}\.(jpg|png|webp|avif)$/.test(key)
