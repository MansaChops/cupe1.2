import type { Config, Context } from '@netlify/functions'
import { asc, eq } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { auditLogs, productVariants, products } from '../../db/schema.js'
import { READ_ROLES, WRITE_ROLES, requireAdmin } from '../lib/auth.js'
import { productImagePath } from '../lib/catalogue.js'
import { ImageRejected, deleteProductImage, saveProductImage } from '../lib/images.js'

const headers = { 'Cache-Control': 'no-store' }

/**
 * GET    /api/admin/products               → every product (including inactive) with variants
 * POST   /api/admin/products/:id/image     → upload an image (multipart field "image")
 * DELETE /api/admin/products/:id/image     → remove the uploaded image (falls back to the bundled one)
 * Reading: any admin role. Changing images: OWNER or ADMIN.
 */
export default async (req: Request, context: Context) => {
  const productId = context.params.id
  const admin = await requireAdmin(req, req.method === 'GET' ? READ_ROLES : WRITE_ROLES)
  if (admin instanceof Response) return admin

  if (req.method === 'GET' && !productId) {
    const rows = await db.select().from(products).orderBy(asc(products.sortOrder), asc(products.id))
    const variants = await db.select().from(productVariants).orderBy(asc(productVariants.sortOrder), asc(productVariants.id))
    return Response.json(
      rows.map((p) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        active: p.active,
        isDemo: p.isDemo,
        image: productImagePath(p),
        hasUpload: !!p.imageKey,
        variants: variants
          .filter((v) => v.productId === p.id)
          .map((v) => ({ id: v.id, name: v.name, sku: v.sku, price: (v.salePricePence ?? v.pricePence) / 100, stock: v.stock, lowStockThreshold: v.lowStockThreshold })),
      })),
      { headers },
    )
  }

  if (!productId) return Response.json({ error: 'Not found' }, { status: 404, headers })
  const [product] = await db.select().from(products).where(eq(products.id, productId))
  if (!product) return Response.json({ error: 'Product not found.' }, { status: 404, headers })

  try {
    if (req.method === 'POST') {
      const form = await req.formData().catch(() => null)
      const file = form?.get('image')
      if (!(file instanceof File)) return Response.json({ error: 'Choose an image to upload.' }, { status: 400, headers })
      const key = await saveProductImage(product.id, file)
      await db.update(products).set({ imageKey: key, updatedAt: new Date() }).where(eq(products.id, product.id))
      await db.insert(auditLogs).values({ userId: admin.id, actor: admin.email, action: 'product.image_uploaded', entityType: 'product', entityId: product.id, details: { key, previous: product.imageKey } })
      // Old image is no longer referenced. Removing it is best-effort.
      if (product.imageKey && product.imageKey !== key) await deleteProductImage(product.imageKey).catch(() => {})
      return Response.json({ image: productImagePath({ imageKey: key, imageFile: product.imageFile }) }, { status: 201, headers })
    }

    if (req.method === 'DELETE') {
      if (!product.imageKey) return Response.json({ image: productImagePath(product) }, { headers })
      await db.update(products).set({ imageKey: null, updatedAt: new Date() }).where(eq(products.id, product.id))
      await db.insert(auditLogs).values({ userId: admin.id, actor: admin.email, action: 'product.image_removed', entityType: 'product', entityId: product.id, details: { key: product.imageKey } })
      await deleteProductImage(product.imageKey).catch(() => {})
      return Response.json({ image: productImagePath({ imageKey: null, imageFile: product.imageFile }) }, { headers })
    }
  } catch (err) {
    if (err instanceof ImageRejected) return Response.json({ error: err.message }, { status: 422, headers })
    console.error(`[admin-products] ${req.method} ${product.id} failed`, err)
    return Response.json({ error: 'The image could not be saved. Please try again.' }, { status: 500, headers })
  }
  return Response.json({ error: 'Method not allowed' }, { status: 405, headers })
}

export const config: Config = { path: ['/api/admin/products', '/api/admin/products/:id/image'], method: ['GET', 'POST', 'DELETE'] }
