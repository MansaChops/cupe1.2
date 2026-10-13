import type { Config, Context } from '@netlify/functions'
import { z } from 'zod'
import { OrderRejected, orderSummary, placeOrder } from '../lib/orders.js'
import { deliverAll } from '../lib/outbox.js'

const OrderInput = z.object({
  checkoutId: z.uuid(),
  details: z.object({
    name: z.string().trim().min(2).max(120),
    email: z.email().max(200),
    phone: z.string().trim().refine((v) => v.replace(/\D/g, '').length >= 10).pipe(z.string().max(30)),
    address: z.string().trim().min(4).max(200),
    city: z.string().trim().min(2).max(100),
    postcode: z.string().trim().regex(/^[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2}$/i),
    country: z.literal('United Kingdom'),
    notes: z.string().trim().max(500).default(''),
  }),
  items: z.array(z.object({ variantId: z.string().max(100), quantity: z.number().int().min(1).max(1000) })).min(1).max(50),
  discountCode: z.string().trim().max(40).optional(),
})

/**
 * Places an order. The browser sends only variant IDs, quantities and delivery details; prices,
 * totals, discounts and stock come from the database (see placeOrder). No payment is taken: the
 * order is committed first, then the invoice email, Slack message and Sheets sync are delivered on
 * a best-effort basis. A delivery failure never fails the order; it stays in the notifications
 * outbox and is retried by `retry-notifications`.
 */
export default async (req: Request, context: Context) => {
  if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 })

  const parsed = OrderInput.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return Response.json({ error: 'Please check your details and try again.' }, { status: 400 })
  const { checkoutId, details, items, discountCode } = parsed.data

  try {
    const result = await placeOrder(checkoutId, details, items, discountCode)
    // Only the request that created the order sends notifications, so retries never duplicate them.
    if (result.created && result.notificationIds.length) context.waitUntil(deliverAll(result.notificationIds))
    return Response.json(await orderSummary(result.order), { status: result.created ? 201 : 200 })
  } catch (err) {
    if (err instanceof OrderRejected) return Response.json({ error: err.message, variantId: err.variantId }, { status: 409 })
    console.error('[orders] Could not place order', { checkoutId, error: err })
    return Response.json({ error: 'We couldn’t place your order. Please try again.' }, { status: 500 })
  }
}

export const config: Config = {
  path: '/api/orders',
  method: 'POST',
  rateLimit: { windowLimit: 10, windowSize: 60, aggregateBy: ['ip', 'domain'] },
}
