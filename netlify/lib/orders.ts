import { and, asc, eq, inArray, sql } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { customers, discountCodes, inventoryMovements, notifications, orderItems, orders, payments, productVariants, products } from '../../db/schema.js'
import { orderRef } from '../../src/lib/catalogue.js'
import { lineProblem, shippingFor, type BasketInput } from './catalogue.js'
import { DiscountRejected, checkDiscount, discountAmount, normaliseCode } from './discounts.js'

export type OrderDetails = {
  name: string
  email: string
  phone: string
  address: string
  city: string
  postcode: string
  country: string
  notes: string
}

/** A basket line that can't be fulfilled. Its message is safe to show to the customer. */
export class OrderRejected extends Error {
  constructor(
    message: string,
    readonly variantId?: string,
  ) {
    super(message)
  }
}

// Thrown inside the transaction to roll it back when another request already owns the checkout ID.
class AlreadyPlaced extends Error {}

export type PlaceOrderResult = { order: typeof orders.$inferSelect; created: boolean; notificationIds: Array<number> }

// Downstream deliveries queued with every new order. Each is retried independently by the outbox.
const NEW_ORDER_NOTIFICATIONS = [
  { channel: 'slack', event: 'order.created' },
  { channel: 'email', event: 'order.invoice' },
  { channel: 'sheets', event: 'order.created' },
] as const

/**
 * Creates an order in one transaction: re-prices the basket from the database, locks the variant
 * rows, decrements stock, and writes the order, items, stock movements, a pending payment and the
 * Slack outbox row. Either all of it commits or none of it does.
 *
 * - Overselling: variant rows are locked (SELECT … FOR UPDATE, in ID order to avoid deadlocks), so
 *   concurrent checkouts for the same stock queue up and each sees the stock left by the previous
 *   one. The stock >= 0 CHECK constraint is a final backstop.
 * - Retries: `checkoutId` is unique. A repeat returns the saved order, and stock is decremented
 *   only by the request that actually inserted the order (and the ORDER movement index is unique
 *   per order and variant).
 * - Order numbers: assigned by nextval('order_number_seq') on insert, which is concurrency-safe and
 *   never hands out the same number twice, even when this transaction rolls back.
 */
export async function placeOrder(checkoutId: string, details: OrderDetails, items: BasketInput, discountCode?: string): Promise<PlaceOrderResult> {
  const [existing] = await db.select().from(orders).where(eq(orders.checkoutId, checkoutId))
  if (existing) return { order: existing, created: false, notificationIds: [] }

  // Merge duplicate lines so each variant is locked and decremented once.
  const qty = new Map<string, number>()
  for (const i of items) qty.set(i.variantId, (qty.get(i.variantId) ?? 0) + i.quantity)
  const ids = [...qty.keys()].sort()

  try {
    return await db.transaction(async (tx) => {
      const rows = await tx
        .select({ product: products, variant: productVariants })
        .from(productVariants)
        .innerJoin(products, eq(products.id, productVariants.productId))
        .where(inArray(productVariants.id, ids))
        .orderBy(asc(productVariants.id))
        .for('update', { of: productVariants })
      const byId = new Map(rows.map((r) => [r.variant.id, r]))
      // A duplicate request waits on the locks above while the first one commits; check again so
      // it returns that order instead of re-validating against the stock it already took.
      const [placed] = await tx.select({ id: orders.id }).from(orders).where(eq(orders.checkoutId, checkoutId))
      if (placed) throw new AlreadyPlaced()

      const lines = ids.map((variantId) => {
        const row = byId.get(variantId)
        const quantity = qty.get(variantId)!
        const problem = lineProblem(row, quantity)
        if (problem || !row) throw new OrderRejected(problem?.message ?? 'An item in your basket is no longer available.', variantId)
        return { ...row, quantity, unitPricePence: row.variant.salePricePence ?? row.variant.pricePence }
      })
      const subtotalPence = lines.reduce((s, l) => s + l.unitPricePence * l.quantity, 0)
      const shippingPence = shippingFor(subtotalPence)

      // Discount code: lock the code row so concurrent orders can't exceed its usage limit.
      let code: string | null = null
      let discountPence = 0
      if (discountCode && normaliseCode(discountCode)) {
        const [row] = await tx
          .select()
          .from(discountCodes)
          .where(sql`upper(${discountCodes.code}) = ${normaliseCode(discountCode)}`)
          .for('update')
        try {
          await checkDiscount(tx, row, subtotalPence, details.email)
        } catch (err) {
          if (err instanceof DiscountRejected) throw new OrderRejected(err.message)
          throw err
        }
        code = row.code.toUpperCase()
        discountPence = discountAmount(row, subtotalPence, shippingPence)
        await tx.update(discountCodes).set({ uses: sql`${discountCodes.uses} + 1`, updatedAt: new Date() }).where(eq(discountCodes.id, row.id))
      }

      const customerId = await upsertCustomer(tx, details)
      const [order] = await tx
        .insert(orders)
        .values({
          checkoutId,
          customerId,
          customerName: details.name,
          email: details.email,
          phone: details.phone,
          address: details.address,
          city: details.city,
          postcode: details.postcode.toUpperCase(),
          country: details.country,
          notes: details.notes,
          subtotalPence,
          shippingPence,
          discountCode: code,
          discountPence,
          totalPence: subtotalPence + shippingPence - discountPence,
        })
        .onConflictDoNothing({ target: orders.checkoutId })
        .returning()
      // A concurrent request with the same checkout ID committed first; it owns the order and the
      // stock decrement. Roll back everything this request did.
      if (!order) throw new AlreadyPlaced()

      let lowStock = false
      for (const l of lines) {
        const [updated] = await tx
          .update(productVariants)
          .set({ stock: sql`${productVariants.stock} - ${l.quantity}`, updatedAt: new Date() })
          .where(and(eq(productVariants.id, l.variant.id), sql`${productVariants.stock} >= ${l.quantity}`))
          .returning({ stock: productVariants.stock })
        if (!updated) throw new OrderRejected(`${l.product.name} ${l.variant.name} has just sold out.`, l.variant.id)
        // Alert once, on the order that takes a variant to (or through) its low-stock threshold.
        if (updated.stock <= l.variant.lowStockThreshold && updated.stock + l.quantity > l.variant.lowStockThreshold) lowStock = true
        await tx.insert(inventoryMovements).values({
          variantId: l.variant.id,
          orderId: order.id,
          reason: 'ORDER',
          delta: -l.quantity,
          stockAfter: updated.stock,
          note: `ORDER ${orderRef(order.number)}`,
        })
      }

      await tx.insert(orderItems).values(
        lines.map((l) => ({
          orderId: order.id,
          variantId: l.variant.id,
          productName: l.product.name,
          variantName: l.variant.name,
          sku: l.variant.sku,
          quantity: l.quantity,
          unitPricePence: l.unitPricePence,
        })),
      )
      // No payments are taken on the site. The customer is emailed an invoice with payment
      // instructions; the order becomes PAID only when the owner marks it paid in management.
      await tx.insert(payments).values({ orderId: order.id, provider: 'manual', status: 'PENDING', amountPence: order.totalPence })
      const queued = await tx
        .insert(notifications)
        .values([...NEW_ORDER_NOTIFICATIONS, ...(lowStock ? [{ channel: 'slack', event: 'stock.low' } as const] : [])].map((n) => ({ orderId: order.id, ...n })))
        .onConflictDoNothing()
        .returning({ id: notifications.id })
      return { order, created: true, notificationIds: queued.map((n) => n.id) }
    })
  } catch (err) {
    if (!(err instanceof AlreadyPlaced)) throw err
    const [order] = await db.select().from(orders).where(eq(orders.checkoutId, checkoutId))
    return { order, created: false, notificationIds: [] }
  }
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

// One customer per email address (case-insensitive), updated with their latest details. A real
// order always marks its customer as real, so demo removal can never take it.
async function upsertCustomer(tx: Tx, d: OrderDetails) {
  const values = {
    name: d.name,
    phone: d.phone,
    address: d.address,
    city: d.city,
    postcode: d.postcode.toUpperCase(),
    country: d.country,
    isDemo: false,
    updatedAt: new Date(),
  }
  const match = sql`lower(${customers.email}) = lower(${d.email})`
  const [found] = await tx.select({ id: customers.id }).from(customers).where(match).for('update')
  if (found) {
    await tx.update(customers).set(values).where(eq(customers.id, found.id))
    return found.id
  }
  const [inserted] = await tx.insert(customers).values({ email: d.email, ...values }).onConflictDoNothing().returning({ id: customers.id })
  if (inserted) return inserted.id
  // Another checkout created the same customer in the meantime.
  const [raced] = await tx.select({ id: customers.id }).from(customers).where(match)
  return raced.id
}

/** The saved, server-priced order in the shape the storefront expects. */
export async function orderSummary(order: typeof orders.$inferSelect) {
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id)).orderBy(orderItems.id)
  return {
    orderNumber: orderRef(order.number),
    createdAt: order.createdAt.toISOString(),
    paymentStatus: order.paymentStatus,
    fulfilmentStatus: order.fulfilmentStatus,
    trackingNumber: order.trackingNumber,
    items: items.map((i) => ({
      variantId: i.variantId,
      name: i.productName,
      variant: i.variantName,
      sku: i.sku,
      quantity: i.quantity,
      unitPrice: i.unitPricePence / 100,
      lineTotal: (i.unitPricePence * i.quantity) / 100,
    })),
    subtotal: order.subtotalPence / 100,
    shipping: order.shippingPence / 100,
    discountCode: order.discountCode,
    discount: order.discountPence / 100,
    total: order.totalPence / 100,
  }
}

/** Looks up an order for a customer. Both the number and the email must match. */
export async function findCustomerOrder(number: number, email: string) {
  const [order] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.number, number), sql`lower(${orders.email}) = lower(${email.trim()})`))
  return order ?? null
}
