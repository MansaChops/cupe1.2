import type { Config, Context } from '@netlify/functions'
import { isValidImageKey, readProductImage } from '../lib/images.js'

/**
 * Serves uploaded product images from Netlify Blobs at /media/products/<key>. The storefront never
 * links here directly: it requests /.netlify/images?url=/media/products/<key>&w=…, and the Image
 * CDN fetches this site-relative path as its source, then resizes, converts and caches the result.
 * Keys are content-addressed, so responses are immutable.
 */
export default async (_req: Request, context: Context) => {
  const key = `${context.params.product}/${context.params.file}`
  if (!isValidImageKey(key)) return new Response('Not found', { status: 404 })
  const image = await readProductImage(key)
  if (!image) return new Response('Not found', { status: 404, headers: { 'Cache-Control': 'no-store' } })
  return new Response(image.body, {
    headers: {
      'Content-Type': image.contentType,
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}

// HEAD is answered automatically for GET routes.
export const config: Config = { path: '/media/products/:product/:file', method: ['GET'] }
