import { and, asc, eq, inArray } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { productVariants, products } from '../../db/schema.js'
import { FALLBACK_IMAGE, type Product, type Variant } from '../../src/lib/catalogue.js'
import { site } from '../../src/config/site.js'

// Server-only catalogue reads. Everything the storefront shows about price and stock comes from here.

export const productImagePath = (p: Pick<typeof products.$inferSelect, 'imageKey' | 'imageFile'>) =>
  p.imageKey ? `/media/products/${p.imageKey}` : (p.imageFile ?? FALLBACK_IMAGE)

const toVariant = (v: typeof productVariants.$inferSelect): Variant => ({
  id: v.id,
  inventoryId: v.inventoryCode,
  name: v.name,
  sku: v.sku,
  price: v.pricePence / 100,
  salePrice: v.salePricePence == null ? undefined : v.salePricePence / 100,
  stock: v.stock,
  lowStockThreshold: v.lowStockThreshold,
  active: v.active,
  step: v.packSize > 1 ? v.packSize : undefined,
  maxPerOrder: v.maxPerOrder ?? undefined,
})

const toProduct = (p: typeof products.$inferSelect, variants: Array<typeof productVariants.$inferSelect>): Product => {
  const image = productImagePath(p)
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    category: p.category,
    shortDescription: p.shortDescription,
    description: p.description,
    image,
    gallery: [image],
    featured: p.featured,
    active: p.active,
    sortOrder: p.sortOrder,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
    variants: variants.map(toVariant),
    showSizeGuide: p.showSizeGuide || undefined,
    preOrder: p.preOrder || undefined,
  }
}

/** Active products with their active variants, in display order. */
export async function listCatalogue(): Promise<Array<Product>> {
  const rows = await db
    .select({ product: products, variant: productVariants })
    .from(products)
    .innerJoin(productVariants, eq(productVariants.productId, products.id))
    .where(and(eq(products.active, true), eq(productVariants.active, true)))
    .orderBy(asc(products.sortOrder), asc(products.id), asc(productVariants.sortOrder), asc(productVariants.id))

  const byId = new Map<string, { product: typeof products.$inferSelect; variants: Array<typeof productVariants.$inferSelect> }>()
  for (const { product, variant } of rows) {
    const entry = byId.get(product.id) ?? { product, variants: [] }
    entry.variants.push(variant)
    byId.set(product.id, entry)
  }
  return [...byId.values()].map(({ product, variants }) => toProduct(product, variants))
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  const [product] = await db.select().from(products).where(and(eq(products.slug, slug), eq(products.active, true)))
  if (!product) return null
  const variants = await db
    .select()
    .from(productVariants)
    .where(and(eq(productVariants.productId, product.id), eq(productVariants.active, true)))
    .orderBy(asc(productVariants.sortOrder), asc(productVariants.id))
  return variants.length ? toProduct(product, variants) : null
}

export type BasketInput = Array<{ variantId: string; quantity: number }>
export type BasketIssue = { variantId: string; message: string; maxQuantity: number }

/** Why a line can't be bought as requested, or null if it can. Shared by basket checks and order creation. */
export function lineProblem(
  row: { product: Pick<typeof products.$inferSelect, 'name' | 'active'>; variant: typeof productVariants.$inferSelect } | undefined,
  quantity: number,
): { message: string; maxQuantity: number } | null {
  if (!row || !row.product.active || !row.variant.active) return { message: `${row?.product.name ?? 'An item'} is no longer available.`, maxQuantity: 0 }
  const { variant } = row
  const max = Math.floor(Math.min(variant.stock, variant.maxPerOrder ?? Infinity) / variant.packSize) * variant.packSize
  const label = `${row.product.name} ${variant.name}`
  if (max === 0) return { message: `${label} is out of stock.`, maxQuantity: 0 }
  if (quantity % variant.packSize !== 0) return { message: `${label} is sold in packs of ${variant.packSize}.`, maxQuantity: max }
  if (quantity > max) return { message: `Only ${max} of ${label} can be ordered right now.`, maxQuantity: max }
  return null
}

export const shippingFor = (subtotalPence: number) =>
  subtotalPence === 0 || subtotalPence >= Math.round(site.shipping.freeOver * 100) ? 0 : Math.round(site.shipping.standard * 100)

/**
 * Re-prices a basket from the database and reports anything that can't be bought as requested.
 * Read-only: the authoritative check (with row locks) happens again when the order is created.
 */
export async function checkBasket(items: BasketInput) {
  const ids = [...new Set(items.map((i) => i.variantId))]
  const rows = ids.length
    ? await db
        .select({ product: products, variant: productVariants })
        .from(productVariants)
        .innerJoin(products, eq(products.id, productVariants.productId))
        .where(inArray(productVariants.id, ids))
    : []
  const byId = new Map(rows.map((r) => [r.variant.id, r]))

  const issues: Array<BasketIssue> = []
  const lines = []
  for (const { variantId, quantity } of items) {
    const row = byId.get(variantId)
    const problem = lineProblem(row, quantity)
    if (problem) issues.push({ variantId, ...problem })
    if (!row || problem) continue
    const unitPricePence = row.variant.salePricePence ?? row.variant.pricePence
    lines.push({ variantId, quantity, unitPricePence, lineTotalPence: unitPricePence * quantity })
  }
  const subtotalPence = lines.reduce((s, l) => s + l.lineTotalPence, 0)
  const shippingPence = shippingFor(subtotalPence)
  return { ok: issues.length === 0, issues, lines, subtotalPence, shippingPence, totalPence: subtotalPence + shippingPence }
}
