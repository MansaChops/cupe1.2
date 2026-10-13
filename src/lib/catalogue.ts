/**
 * Catalogue types and pure helpers shared by the storefront and the server. The data itself lives
 * in the database and reaches the browser only through server functions (src/server/catalogue.ts).
 * Prices here are for display; the server re-prices every order from the database.
 */

export type Category = {
  slug: string
  name: string
  blurb: string
}

export type Variant = {
  id: string
  inventoryId: string
  name: string
  sku: string
  price: number
  salePrice?: number
  stock: number
  lowStockThreshold: number
  active: boolean
  /** Sold only in multiples of this many units (e.g. 10 pins). Prices are per single unit. */
  step?: number
  /** Most units one order may contain */
  maxPerOrder?: number
}

export type Product = {
  id: string
  slug: string
  name: string
  category: string
  shortDescription: string
  description: string
  /** Image source for img(): a file in public/img, or a site path such as /media/products/… */
  image: string
  gallery: Array<string>
  featured: boolean
  active: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
  variants: Array<Variant>
  /** Show every size and price above the size picker so customers see all options before adding to basket */
  showSizeGuide?: boolean
  /** Pre-order only: dispatched separately, on a longer lead time than in-stock items */
  preOrder?: boolean
}

export const categories: Array<Category> = [
  { slug: 'single-peptides', name: 'Single peptides', blurb: 'Individual lyophilised compounds in sealed glass vials.' },
  { slug: 'copper-peptides', name: 'Copper peptides', blurb: 'Copper-complexed peptides, supplied as powder.' },
  { slug: 'supplies', name: 'Supplies', blurb: 'Diluent, swabs and storage accessories.' },
]

/** Shown when a product has neither an uploaded nor a bundled image. */
export const FALLBACK_IMAGE = 'vial-slate.png'

export const findVariantIn = (catalogue: Array<Product>, variantId: string) => {
  for (const product of catalogue) {
    const variant = product.variants.find((v) => v.id === variantId)
    if (variant) return { product, variant }
  }
  return undefined
}
export const unitPrice = (v: Variant) => v.salePrice ?? v.price
export const fromPrice = (product: Product) => Math.min(...product.variants.map(unitPrice))
/** Quantity increment for a variant (1 unless sold in packs) */
export const qtyStep = (v: Variant) => v.step ?? 1
/** Most units of a variant one basket/order may hold: limited by stock and any per-order cap, rounded down to a whole pack */
export const maxQty = (v: Variant) => {
  const step = qtyStep(v)
  return Math.floor(Math.min(v.stock, v.maxPerOrder ?? Infinity) / step) * step
}
/** Snap a requested quantity to a valid one (a whole number of packs, within limits); 0 means remove */
export const clampQty = (v: Variant, quantity: number) => {
  const step = qtyStep(v)
  return Math.max(0, Math.min(Math.floor(quantity / step) * step, maxQty(v)))
}
/** Price shown to customers: per pack for pack-sold items, otherwise per unit */
export const packPrice = (v: Variant) => unitPrice(v) * qtyStep(v)
export const priceLabel = (v: Variant) => (qtyStep(v) > 1 ? `per ${qtyStep(v)}` : '')
export const totalStock = (product: Product) => product.variants.reduce((n, v) => n + v.stock, 0)

/** Customer-facing order reference. The number comes from the order_number_seq Postgres sequence. */
export const orderRef = (n: number) => `ORD-${n}`
/** Accepts ORD-10001 (current) and CP-YYYYMMDD-010001 (orders placed before ORD- numbering). */
export const parseOrderRef = (ref: string) => {
  const m = ref.trim().toUpperCase().match(/^(?:ORD-?(\d{1,9})|CP-\d{8}-(\d{1,9}))$/)
  return m ? Number(m[1] ?? m[2]) : null
}
