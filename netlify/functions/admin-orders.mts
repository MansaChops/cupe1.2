import type { Config, Context } from '@netlify/functions'
import { z } from 'zod'
import { FULFILMENT_STATUSES, PAYMENT_STATUSES } from '../../src/lib/admin-types.js'
import { READ_ROLES, WRITE_ROLES, requireAdmin } from '../lib/auth.js'
import { ActionRejected, applyOrderAction, listOrders, orderDetail } from '../lib/order-ops.js'
import { deliverAll } from '../lib/outbox.js'

const headers = { 'Cache-Control': 'no-store' }

const Action = z.discriminatedUnion('action', [
  z.object({ action: z.literal('mark_paid') }),
  z.object({ action: z.literal('mark_unpaid') }),
  z.object({ action: z.literal('start_packing') }),
  z.object({ action: z.literal('mark_packed') }),
  z.object({ action: z.literal('ship'), trackingNumber: z.string().trim().min(1).max(60) }),
  z.object({ action: z.literal('complete') }),
  z.object({ action: z.literal('cancel'), restock: z.boolean().default(true) }),
  z.object({ action: z.literal('mark_refunded'), restock: z.boolean().default(true) }),
  z.object({ action: z.literal('note'), text: z.string().trim().min(1).max(1000) }),
  z.object({ action: z.literal('resend'), channel: z.enum(['slack', 'email', 'sheets']), event: z.string().max(40) }),
])

/**
 * GET  /api/admin/orders?q=&status=&payment=&sort=   → order list (any management role)
 * GET  /api/admin/orders/:number                      → one order with items, stock movements,
 *                                                       notifications and timeline
 * POST /api/admin/orders/:number                      → an action (OWNER only): mark paid, start
 *                                                       packing, ship with tracking, cancel…
 */
export default async (req: Request, context: Context) => {
  const admin = await requireAdmin(req, req.method === 'GET' ? READ_ROLES : WRITE_ROLES)
  if (admin instanceof Response) return admin
  const ref = context.params.number

  try {
    if (req.method === 'GET' && !ref) {
      const url = new URL(req.url)
      const status = url.searchParams.get('status') ?? undefined
      const payment = url.searchParams.get('payment') ?? undefined
      const rows = await listOrders({
        q: url.searchParams.get('q') ?? undefined,
        status: FULFILMENT_STATUSES.find((s) => s === status),
        payment: PAYMENT_STATUSES.find((s) => s === payment),
        sort: url.searchParams.get('sort') ?? undefined,
      })
      return Response.json(rows, { headers })
    }
    if (!ref) return Response.json({ error: 'Not found' }, { status: 404, headers })

    if (req.method === 'POST') {
      const parsed = Action.safeParse(await req.json().catch(() => null))
      if (!parsed.success) return Response.json({ error: 'That action isn’t valid.' }, { status: 400, headers })
      const ids = await applyOrderAction(ref, parsed.data, admin)
      // Deliver straight away; anything that fails is retried by the outbox schedule.
      if (ids.length) context.waitUntil(deliverAll(ids))
    }

    const detail = await orderDetail(ref)
    if (!detail) return Response.json({ error: 'Order not found.' }, { status: 404, headers })
    return Response.json(detail, { headers })
  } catch (err) {
    if (err instanceof ActionRejected) return Response.json({ error: err.message }, { status: 409, headers })
    console.error(`[admin-orders] ${req.method} ${ref ?? ''} failed`, err)
    return Response.json({ error: 'Something went wrong. Please try again.' }, { status: 500, headers })
  }
}

export const config: Config = { path: ['/api/admin/orders', '/api/admin/orders/:number'], method: ['GET', 'POST'] }
