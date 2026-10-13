import type { Config } from '@netlify/functions'
import { z } from 'zod'
import { parseOrderRef } from '../../src/lib/catalogue.js'
import { findCustomerOrder, orderSummary } from '../lib/orders.js'

const Input = z.object({ orderNumber: z.string().trim().max(40), email: z.email().max(200) })

/**
 * Current status of an order for the customer who placed it. Both the order number and the email
 * address must match, so order numbers can't be used to look up other people's orders. Read-only:
 * nothing here (or on the confirmation page) changes payment or fulfilment status.
 */
export default async (req: Request) => {
  const parsed = Input.safeParse(await req.json().catch(() => null))
  const number = parsed.success ? parseOrderRef(parsed.data.orderNumber) : null
  if (!parsed.success || !number) return Response.json({ error: 'Enter your order number and email address.' }, { status: 400 })

  const order = await findCustomerOrder(number, parsed.data.email)
  if (!order) return Response.json({ error: 'We couldn’t find an order with those details.' }, { status: 404 })

  const { orderNumber, createdAt, paymentStatus, fulfilmentStatus, trackingNumber, items, subtotal, shipping, total } = await orderSummary(order)
  return Response.json(
    { orderNumber, createdAt, paymentStatus, fulfilmentStatus, trackingNumber, items, subtotal, shipping, total },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}

export const config: Config = {
  path: '/api/order-status',
  method: 'POST',
  rateLimit: { windowLimit: 20, windowSize: 60, aggregateBy: ['ip', 'domain'] },
}
