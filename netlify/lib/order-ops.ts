import { and, asc, desc, eq, sql } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { auditLogs, inventoryMovements, notifications, orderItems, orders, payments, productVariants, products } from '../../db/schema.js'
import { orderRef, parseOrderRef } from '../../src/lib/catalogue.js'
import type { FulfilmentStatus, OrderAction, OrderDetail, OrderListRow, PaymentStatus } from '../../src/lib/admin-types.js'
import type { AdminUser } from './auth.js'
import { releaseDiscount } from './discounts.js'
import { enqueue, type Channel } from './outbox.js'

type Order = typeof orders.$inferSelect
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

/** A rejected action with a message that is safe to show in the admin. */
export class ActionRejected extends Error {}

const iso = (d: Date | string | null) => (d === null ? null : typeof d === 'string' ? new Date(d).toISOString() : d.toISOString())

/* ---------- Reads ---------- */

export async function listOrders(opts: { q?: string; status?: FulfilmentStatus; payment?: PaymentStatus; sort?: string; limit?: number; demo?: boolean }): Promise<Array<OrderListRow>> {
  const conds = [sql`true`]
  if (opts.status) conds.push(sql`${orders.fulfilmentStatus} = ${opts.status}`)
  if (opts.payment) conds.push(sql`${orders.paymentStatus} = ${opts.payment}`)
  if (opts.demo === false) conds.push(sql`${orders.isDemo} = false`)
  const q = opts.q?.trim()
  if (q) {
    const like = `%${q.toLowerCase()}%`
    const number = parseOrderRef(q) ?? (/^\d+$/.test(q) ? Number(q) : null)
    conds.push(sql`(
      lower(${orders.customerName}) LIKE ${like} OR lower(${orders.email}) LIKE ${like}
      OR regexp_replace(${orders.phone}, '\\s', '', 'g') LIKE ${`%${q.replace(/\s/g, '')}%`}
      OR lower(${orders.postcode}) LIKE ${like} OR lower(coalesce(${orders.discountCode}, '')) LIKE ${like}
      ${number !== null ? sql`OR ${orders.number} = ${number}` : sql``}
      OR EXISTS (SELECT 1 FROM ${orderItems} oi WHERE oi.order_id = ${orders.id} AND (lower(oi.sku) LIKE ${like} OR lower(oi.product_name) LIKE ${like}))
    )`)
  }
  const order = {
    oldest: asc(orders.createdAt),
    highest: desc(orders.totalPence),
    lowest: asc(orders.totalPence),
  }[opts.sort ?? ''] ?? desc(orders.createdAt)

  const rows = await db
    .select({
      o: orders,
      units: sql<number>`(SELECT coalesce(sum(quantity), 0)::int FROM ${orderItems} WHERE order_id = ${orders.id})`,
      summary: sql<string>`(SELECT string_agg(product_name || ' ' || variant_name || ' ×' || quantity, ', ' ORDER BY id) FROM ${orderItems} WHERE order_id = ${orders.id})`,
    })
    .from(orders)
    .where(and(...conds))
    .orderBy(order, desc(orders.id))
    .limit(Math.min(opts.limit ?? 500, 1000))

  return rows.map(({ o, units, summary }) => ({
    number: orderRef(o.number),
    createdAt: iso(o.createdAt)!,
    customerName: o.customerName,
    email: o.email,
    city: o.city,
    postcode: o.postcode,
    totalPence: o.totalPence,
    discountCode: o.discountCode,
    paymentStatus: o.paymentStatus,
    fulfilmentStatus: o.fulfilmentStatus,
    units,
    itemsSummary: summary ?? '',
    isDemo: o.isDemo,
  }))
}

async function findByRef(ref: string) {
  const number = parseOrderRef(ref)
  if (number === null) return null
  const [o] = await db.select().from(orders).where(eq(orders.number, number))
  return o ?? null
}

export async function orderDetail(ref: string): Promise<OrderDetail | null> {
  const o = await findByRef(ref)
  if (!o) return null
  const items = await db
    .select({ i: orderItems, preOrder: products.preOrder })
    .from(orderItems)
    .leftJoin(productVariants, eq(productVariants.id, orderItems.variantId))
    .leftJoin(products, eq(products.id, productVariants.productId))
    .where(eq(orderItems.orderId, o.id))
    .orderBy(asc(orderItems.id))
  const movements = await db
    .select({ m: inventoryMovements, sku: productVariants.sku })
    .from(inventoryMovements)
    .innerJoin(productVariants, eq(productVariants.id, inventoryMovements.variantId))
    .where(eq(inventoryMovements.orderId, o.id))
    .orderBy(asc(inventoryMovements.id))
  const notes = await db.select().from(notifications).where(eq(notifications.orderId, o.id)).orderBy(asc(notifications.id))
  const audit = await db
    .select()
    .from(auditLogs)
    .where(and(eq(auditLogs.entityType, 'order'), eq(auditLogs.entityId, orderRef(o.number))))
    .orderBy(asc(auditLogs.id))

  return {
    number: orderRef(o.number),
    createdAt: iso(o.createdAt)!,
    updatedAt: iso(o.updatedAt)!,
    customerName: o.customerName,
    email: o.email,
    phone: o.phone,
    address: o.address,
    city: o.city,
    postcode: o.postcode,
    country: o.country,
    notes: o.notes,
    adminNotes: o.adminNotes,
    subtotalPence: o.subtotalPence,
    shippingPence: o.shippingPence,
    discountCode: o.discountCode,
    discountPence: o.discountPence,
    totalPence: o.totalPence,
    paymentStatus: o.paymentStatus,
    fulfilmentStatus: o.fulfilmentStatus,
    trackingNumber: o.trackingNumber,
    paidAt: iso(o.paidAt),
    shippedAt: iso(o.shippedAt),
    completedAt: iso(o.completedAt),
    cancelledAt: iso(o.cancelledAt),
    isDemo: o.isDemo,
    items: items.map(({ i, preOrder }) => ({
      id: i.id, variantId: i.variantId, productName: i.productName, variantName: i.variantName, sku: i.sku,
      quantity: i.quantity, unitPricePence: i.unitPricePence, preOrder: !!preOrder,
    })),
    movements: movements.map(({ m, sku }) => ({ id: m.id, sku, reason: m.reason, delta: m.delta, stockAfter: m.stockAfter, note: m.note, createdAt: iso(m.createdAt)! })),
    notifications: notes.map((n) => ({
      id: n.id, channel: n.channel, event: n.event, status: n.status as OrderDetail['notifications'][number]['status'],
      attempts: n.attempts, lastError: n.lastError, sentAt: iso(n.sentAt), createdAt: iso(n.createdAt)!,
    })),
    timeline: [
      { at: iso(o.createdAt)!, actor: 'Customer', action: 'order.placed', details: { total: o.totalPence } },
      ...audit.map((a) => ({ at: iso(a.createdAt)!, actor: a.actor, action: a.action, details: a.details as Record<string, unknown> })),
    ],
  }
}

/* ---------- Actions ---------- */

const FULFILMENT_NEXT: Partial<Record<OrderAction['action'], { from: Array<FulfilmentStatus>; to: FulfilmentStatus }>> = {
  start_packing: { from: ['NEW'], to: 'PACKING' },
  mark_packed: { from: ['NEW', 'PACKING'], to: 'PACKED' },
  ship: { from: ['NEW', 'PACKING', 'PACKED'], to: 'SHIPPED' },
  complete: { from: ['SHIPPED'], to: 'COMPLETED' },
  cancel: { from: ['NEW', 'PACKING', 'PACKED'], to: 'CANCELLED' },
}

/** Returns each order line's stock to its variant, with a CANCELLATION movement. */
async function restock(tx: Tx, o: Order, admin: AdminUser) {
  const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, o.id))
  for (const i of items) {
    const [v] = await tx
      .update(productVariants)
      .set({ stock: sql`${productVariants.stock} + ${i.quantity}`, updatedAt: new Date() })
      .where(eq(productVariants.id, i.variantId))
      .returning({ stock: productVariants.stock })
    if (!v) continue
    await tx.insert(inventoryMovements).values({
      variantId: i.variantId, orderId: o.id, userId: admin.id, reason: 'CANCELLATION', delta: i.quantity, stockAfter: v.stock,
      note: `CANCELLED ${orderRef(o.number)}`, isDemo: o.isDemo,
    })
  }
}

/**
 * Applies one management action to an order in a transaction (order row locked), writes an audit
 * entry and queues the matching notifications. Returns the IDs of notifications to deliver now.
 */
export async function applyOrderAction(ref: string, input: OrderAction, admin: AdminUser): Promise<Array<number>> {
  const number = parseOrderRef(ref)
  if (number === null) throw new ActionRejected('Order not found.')

  return db.transaction(async (tx) => {
    const [o] = await tx.select().from(orders).where(eq(orders.number, number)).for('update')
    if (!o) throw new ActionRejected('Order not found.')
    const queue: Array<[Channel, string]> = []
    const patch: Partial<Order> = {}
    const details: Record<string, unknown> = {}
    const now = new Date()

    const step = FULFILMENT_NEXT[input.action]
    if (step) {
      if (!step.from.includes(o.fulfilmentStatus)) {
        throw new ActionRejected(`This order is ${o.fulfilmentStatus.toLowerCase()}, so it can’t be ${step.to.toLowerCase()} now.`)
      }
      patch.fulfilmentStatus = step.to
      details.from = o.fulfilmentStatus
      details.to = step.to
    }

    switch (input.action) {
      case 'mark_paid':
        if (o.paymentStatus === 'PAID') throw new ActionRejected('This order is already marked as paid.')
        if (o.fulfilmentStatus === 'CANCELLED') throw new ActionRejected('This order is cancelled.')
        patch.paymentStatus = 'PAID'
        patch.paidAt = now
        await tx.update(payments).set({ status: 'PAID', updatedAt: now }).where(eq(payments.orderId, o.id))
        queue.push(['email', 'order.paid'], ['slack', 'order.paid'])
        break
      case 'mark_unpaid':
        if (o.paymentStatus !== 'PAID') throw new ActionRejected('This order isn’t marked as paid.')
        patch.paymentStatus = 'PENDING'
        patch.paidAt = null
        await tx.update(payments).set({ status: 'PENDING', updatedAt: now }).where(eq(payments.orderId, o.id))
        break
      case 'ship': {
        const tracking = input.trackingNumber.trim().toUpperCase().replace(/\s+/g, ' ')
        if (tracking.length < 6) throw new ActionRejected('Enter the tracking number.')
        patch.trackingNumber = tracking
        patch.shippedAt = now
        details.trackingNumber = tracking
        queue.push(['email', 'order.shipped'], ['slack', 'order.shipped'])
        break
      }
      case 'complete':
        patch.completedAt = now
        break
      case 'cancel':
        patch.cancelledAt = now
        if (o.paymentStatus === 'PENDING') {
          patch.paymentStatus = 'CANCELLED'
          await tx.update(payments).set({ status: 'CANCELLED', updatedAt: now }).where(eq(payments.orderId, o.id))
        }
        if (input.restock) await restock(tx, o, admin)
        await releaseDiscount(tx, o.discountCode)
        details.restocked = input.restock
        queue.push(['email', 'order.cancelled'], ['slack', 'order.cancelled'])
        break
      case 'mark_refunded':
        if (o.paymentStatus !== 'PAID') throw new ActionRejected('Only paid orders can be marked refunded.')
        patch.paymentStatus = 'REFUNDED'
        await tx.update(payments).set({ status: 'REFUNDED', refundedPence: o.totalPence, updatedAt: now }).where(eq(payments.orderId, o.id))
        // Not yet shipped: the order won't go out, so it's refunded rather than fulfilled.
        if (['NEW', 'PACKING', 'PACKED'].includes(o.fulfilmentStatus)) {
          patch.fulfilmentStatus = 'REFUNDED'
          patch.cancelledAt = now
          if (input.restock) await restock(tx, o, admin)
          await releaseDiscount(tx, o.discountCode)
          details.restocked = input.restock
        }
        break
      case 'note': {
        const text = input.text.trim().slice(0, 1000)
        if (!text) throw new ActionRejected('Write a note first.')
        const stamp = now.toLocaleString('en-GB', { timeZone: 'Europe/London', dateStyle: 'short', timeStyle: 'short' })
        patch.adminNotes = [o.adminNotes, `[${stamp} · ${admin.name ?? admin.email}] ${text}`].filter(Boolean).join('\n')
        details.text = text
        break
      }
      case 'resend':
        queue.push([input.channel, input.event])
        details.channel = input.channel
        details.event = input.event
        break
      default:
        if (!step) throw new ActionRejected('Unknown action.')
    }

    if (Object.keys(patch).length) await tx.update(orders).set({ ...patch, updatedAt: now }).where(eq(orders.id, o.id))
    await tx.insert(auditLogs).values({
      userId: admin.id, actor: admin.name ?? admin.email, action: `order.${input.action}`, entityType: 'order', entityId: orderRef(o.number), details,
    })
    // The Google Sheet mirrors every change.
    if (input.action !== 'resend' && input.action !== 'note') queue.push(['sheets', 'order.updated'])
    const ids: Array<number> = []
    for (const [channel, event] of queue) {
      // Resends and status-driven Slack/email/Sheets rows are re-armed so the same event can go out again.
      const id = await enqueue(tx, o.id, channel, event, true)
      if (id) ids.push(id)
    }
    return ids
  })
}
