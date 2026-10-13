import { createServerFn } from '@tanstack/react-start'
import { notFound } from '@tanstack/react-router'
import { z } from 'zod'
import { checkBasket, getProductBySlug, listCatalogue } from '../../netlify/lib/catalogue'
import { DiscountRejected, previewDiscount } from '../../netlify/lib/discounts'

// Storefront reads. These run only on the server (TanStack Start replaces them with RPC calls in
// the browser bundle), so database access never reaches the client.

export const getCatalogue = createServerFn({ method: 'GET' }).handler(() => listCatalogue())

export const getProduct = createServerFn({ method: 'GET' })
  .validator(z.object({ slug: z.string().max(200) }))
  .handler(async ({ data }) => {
    const product = await getProductBySlug(data.slug)
    if (!product) throw notFound()
    return product
  })

/** Current prices and stock for a basket, plus anything that can no longer be bought as requested. */
export const validateBasket = createServerFn({ method: 'POST' })
  .validator(z.object({ items: z.array(z.object({ variantId: z.string().max(100), quantity: z.number().int().min(1).max(1000) })).max(50) }))
  .handler(({ data }) => checkBasket(data.items))

/** Checks a discount code against the current basket. Read-only: the order transaction re-checks it. */
export const checkDiscountCode = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      code: z.string().trim().min(1).max(40),
      email: z.string().max(200).optional(),
      items: z.array(z.object({ variantId: z.string().max(100), quantity: z.number().int().min(1).max(1000) })).min(1).max(50),
    }),
  )
  .handler(async ({ data }) => {
    const basket = await checkBasket(data.items)
    try {
      const d = await previewDiscount(data.code, basket.subtotalPence, basket.shippingPence, data.email || undefined)
      return { ok: true as const, code: d.code, label: d.label, amount: d.discountPence / 100 }
    } catch (err) {
      if (err instanceof DiscountRejected) return { ok: false as const, error: err.message }
      throw err
    }
  })
