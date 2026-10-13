import type { Config, Context } from '@netlify/functions'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../../db/index.js'
import { auditLogs, inventoryMovements, productVariants, products } from '../../db/schema.js'
import { READ_ROLES, WRITE_ROLES, requireAdmin } from '../lib/auth.js'
import { inventoryRows, movements } from '../lib/reports.js'

const headers = { 'Cache-Control': 'no-store' }
const err = (status: number, error: string) => Response.json({ error }, { status, headers })

const Adjust = z.object({
  variantId: z.string().max(100),
  mode: z.enum(['add', 'remove', 'set']),
  quantity: z.number().int().min(0).max(100_000),
  note: z.string().trim().max(200).default(''),
})
const VariantPatch = z
  .object({
    pricePence: z.number().int().min(1).max(10_000_000),
    salePricePence: z.number().int().min(1).max(10_000_000).nullable(),
    lowStockThreshold: z.number().int().min(0).max(100_000),
    maxPerOrder: z.number().int().min(1).max(100_000).nullable(),
    active: z.boolean(),
  })
  .partial()
const ProductPatch = z.object({ active: z.boolean(), preOrder: z.boolean(), featured: z.boolean() }).partial()

/**
 * GET   /api/admin/inventory                       → every variant with stock, prices, 30-day sales
 * GET   /api/admin/inventory/movements[?variant=]  → stock history
 * POST  /api/admin/inventory/adjust                → add/remove/set stock with a reason
 * PATCH /api/admin/inventory/variants/:id          → price, sale price, alert level, cap, active
 * PATCH /api/admin/inventory/products/:id          → active, pre-order, featured
 * Reading: any management role. Changing: OWNER only.
 */
export default async (req: Request, context: Context) => {
  const admin = await requireAdmin(req, req.method === 'GET' ? READ_ROLES : WRITE_ROLES)
  if (admin instanceof Response) return admin
  const url = new URL(req.url)
  const path = url.pathname.replace(/\/+$/, '')

  try {
    if (req.method === 'GET' && path === '/api/admin/inventory') return Response.json(await inventoryRows(), { headers })
    if (req.method === 'GET' && path === '/api/admin/inventory/movements') {
      return Response.json(await movements(url.searchParams.get('variant') ?? undefined, 200), { headers })
    }

    if (req.method === 'POST' && path === '/api/admin/inventory/adjust') {
      const parsed = Adjust.safeParse(await req.json().catch(() => null))
      if (!parsed.success) return err(400, 'Enter a whole number of units.')
      const { variantId, mode, quantity, note } = parsed.data
      const result = await db.transaction(async (tx) => {
        const [v] = await tx.select().from(productVariants).where(eq(productVariants.id, variantId)).for('update')
        if (!v) return null
        const next = mode === 'set' ? quantity : mode === 'add' ? v.stock + quantity : v.stock - quantity
        if (next < 0) throw new RangeError(`Only ${v.stock} in stock, so you can’t remove ${quantity}.`)
        const delta = next - v.stock
        if (delta === 0) return { stock: v.stock }
        await tx.update(productVariants).set({ stock: next, updatedAt: new Date() }).where(eq(productVariants.id, v.id))
        await tx.insert(inventoryMovements).values({
          variantId: v.id, userId: admin.id, reason: delta > 0 && mode === 'add' ? 'RESTOCK' : 'ADJUSTMENT', delta, stockAfter: next,
          note: note || (mode === 'set' ? 'Stock count set' : delta > 0 ? 'Stock added' : 'Stock removed'),
        })
        await tx.insert(auditLogs).values({ userId: admin.id, actor: admin.name ?? admin.email, action: 'inventory.adjust', entityType: 'variant', entityId: v.id, details: { from: v.stock, to: next, note } })
        return { stock: next }
      })
      if (!result) return err(404, 'That product size no longer exists.')
      return Response.json(result, { headers })
    }

    const id = context.params.id
    if (req.method === 'PATCH' && path.startsWith('/api/admin/inventory/variants/') && id) {
      const parsed = VariantPatch.safeParse(await req.json().catch(() => null))
      if (!parsed.success || !Object.keys(parsed.data).length) return err(400, 'Check the values and try again.')
      const [before] = await db.select().from(productVariants).where(eq(productVariants.id, id))
      if (!before) return err(404, 'That product size no longer exists.')
      const price = parsed.data.pricePence ?? before.pricePence
      const sale = parsed.data.salePricePence === undefined ? before.salePricePence : parsed.data.salePricePence
      if (sale !== null && sale > price) return err(400, 'The sale price must be lower than the normal price.')
      await db.update(productVariants).set({ ...parsed.data, updatedAt: new Date() }).where(eq(productVariants.id, id))
      const changed = Object.fromEntries(Object.entries(parsed.data).map(([k, v]) => [k, { from: before[k as keyof typeof before], to: v }]))
      await db.insert(auditLogs).values({ userId: admin.id, actor: admin.name ?? admin.email, action: 'variant.update', entityType: 'variant', entityId: id, details: changed })
      return Response.json({ ok: true }, { headers })
    }

    if (req.method === 'PATCH' && path.startsWith('/api/admin/inventory/products/') && id) {
      const parsed = ProductPatch.safeParse(await req.json().catch(() => null))
      if (!parsed.success || !Object.keys(parsed.data).length) return err(400, 'Check the values and try again.')
      const [row] = await db.update(products).set({ ...parsed.data, updatedAt: new Date() }).where(eq(products.id, id)).returning({ id: products.id })
      if (!row) return err(404, 'Product not found.')
      await db.insert(auditLogs).values({ userId: admin.id, actor: admin.name ?? admin.email, action: 'product.update', entityType: 'product', entityId: id, details: parsed.data })
      return Response.json({ ok: true }, { headers })
    }
  } catch (e) {
    if (e instanceof RangeError) return err(409, e.message)
    console.error(`[admin-inventory] ${req.method} ${path} failed`, e)
    return err(500, 'Something went wrong. Please try again.')
  }
  return err(404, 'Not found')
}

export const config: Config = {
  path: ['/api/admin/inventory', '/api/admin/inventory/movements', '/api/admin/inventory/adjust', '/api/admin/inventory/variants/:id', '/api/admin/inventory/products/:id'],
  method: ['GET', 'POST', 'PATCH'],
}
