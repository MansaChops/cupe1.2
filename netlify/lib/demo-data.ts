import { and, count, eq, inArray, notExists, sql } from 'drizzle-orm'
import { db } from '../../db/index.js'
import {
  auditLogs,
  costs,
  customers,
  inventoryMovements,
  notifications,
  orderItems,
  orders,
  pages,
  payments,
  productVariants,
  products,
} from '../../db/schema.js'
import { customers as demoCustomers, orders as demoOrders } from '../../src/data/fixtures.js'
import type { AdminUser } from './auth.js'
import { deleteProductImage } from './images.js'

/**
 * Demo data lives in the same tables as real data, flagged `is_demo = true`. Only the seed below
 * sets that flag; nothing ever reclassifies an existing row as demo. Removal deletes flagged rows
 * only, and keeps any flagged row that a real row still depends on.
 */

const pence = (pounds: number) => Math.round(pounds * 100)
const DEMO_PRODUCT_ID = 'prod_demo_sample'
const DEMO_VARIANT_ID = 'var_demo_sample'

/** Demo vs real row counts per table, for the admin confirmation screen. */
export async function demoSummary() {
  const tally = async (table: typeof customers | typeof orders | typeof payments | typeof inventoryMovements | typeof products | typeof productVariants | typeof costs | typeof pages) => {
    const rows = await db.select({ isDemo: table.isDemo, n: count() }).from(table).groupBy(table.isDemo)
    return { demo: rows.find((r) => r.isDemo)?.n ?? 0, real: rows.find((r) => !r.isDemo)?.n ?? 0 }
  }
  return {
    customers: await tally(customers),
    orders: await tally(orders),
    payments: await tally(payments),
    inventoryMovements: await tally(inventoryMovements),
    products: await tally(products),
    productVariants: await tally(productVariants),
    costs: await tally(costs),
    pages: await tally(pages),
  }
}

/**
 * Inserts the sample customers, orders, payments, stock movements, costs and page. Safe to run
 * repeatedly (does nothing if demo orders already exist) and never updates a real row. Demo orders
 * draw numbers from demo_order_number_seq (ORD-900001…) and don't touch real stock.
 */
export async function seedDemoData(actor?: AdminUser) {
  const [already] = await db.select({ n: count() }).from(orders).where(eq(orders.isDemo, true))
  if (already.n > 0) return { seeded: false as const, reason: 'Demo data is already loaded.' }

  return db.transaction(async (tx) => {
    // A sample product that is never shown in the storefront (inactive).
    await tx
      .insert(products)
      .values({
        id: DEMO_PRODUCT_ID,
        slug: 'demo-sample-product',
        name: 'Demo sample product',
        category: 'supplies',
        shortDescription: 'Sample product for exploring the admin. Not for sale.',
        imageFile: 'vial-slate.png',
        active: false,
        sortOrder: 999,
        isDemo: true,
      })
      .onConflictDoNothing()
    await tx
      .insert(productVariants)
      .values({ id: DEMO_VARIANT_ID, productId: DEMO_PRODUCT_ID, inventoryCode: 'INV-DEMO1', name: 'Sample', sku: 'DEMO-SAMPLE', pricePence: 1000, stock: 8, isDemo: true })
      .onConflictDoNothing()
    await tx.insert(inventoryMovements).values([
      { variantId: DEMO_VARIANT_ID, reason: 'INITIAL', delta: 10, stockAfter: 10, note: 'Demo opening stock', isDemo: true },
      { variantId: DEMO_VARIANT_ID, reason: 'ADJUSTMENT', delta: -2, stockAfter: 8, note: 'Demo stock count correction', isDemo: true },
    ])

    const customerIds = new Map<string, number>()
    for (const c of demoCustomers) {
      const [row] = await tx
        .insert(customers)
        .values({ email: c.email, name: c.name, phone: c.phone, address: c.address, city: c.city, postcode: c.postcode, country: c.country, isDemo: true, createdAt: new Date(c.createdAt) })
        .onConflictDoNothing()
        .returning({ id: customers.id })
      if (row) customerIds.set(c.id, row.id)
    }

    let orderCount = 0
    for (const o of [...demoOrders].reverse()) {
      const customer = demoCustomers.find((c) => c.id === o.customerId)!
      const customerId = customerIds.get(o.customerId)
      if (!customerId) continue
      const subtotalPence = o.items.reduce((s, i) => s + pence(i.unitPrice) * i.quantity, 0)
      const shippingPence = pence(o.shipping)
      const [order] = await tx
        .insert(orders)
        .values({
          number: sql`nextval('demo_order_number_seq')`,
          customerId,
          customerName: customer.name,
          email: customer.email,
          phone: customer.phone,
          address: customer.address,
          city: customer.city,
          postcode: customer.postcode,
          country: customer.country,
          notes: o.notes ?? '',
          subtotalPence,
          shippingPence,
          totalPence: subtotalPence + shippingPence,
          paymentStatus: o.paymentStatus,
          fulfilmentStatus: o.fulfilmentStatus,
          trackingNumber: o.trackingNumber ?? null,
          isDemo: true,
          createdAt: new Date(o.createdAt),
          updatedAt: new Date(o.updatedAt),
        })
        .returning({ id: orders.id, totalPence: orders.totalPence })
      await tx.insert(orderItems).values(
        o.items.map((i) => ({ orderId: order.id, variantId: i.variantId, productName: i.productName, variantName: i.variantName, sku: i.sku, quantity: i.quantity, unitPricePence: pence(i.unitPrice) })),
      )
      await tx.insert(payments).values({
        orderId: order.id,
        provider: 'demo',
        providerRef: o.stripePaymentId,
        status: o.paymentStatus,
        amountPence: order.totalPence,
        refundedPence: o.paymentStatus === 'REFUNDED' ? order.totalPence : 0,
        isDemo: true,
        createdAt: new Date(o.createdAt),
      })
      orderCount++
    }

    await tx.insert(costs).values([
      { label: 'Demo: courier account (monthly)', category: 'shipping', amountPence: 2400, notes: 'Sample expense', isDemo: true },
      { label: 'Demo: packaging restock', category: 'packaging', amountPence: 3650, notes: 'Sample expense', isDemo: true },
      { label: 'Demo: unit cost', category: 'unit-cost', variantId: DEMO_VARIANT_ID, amountPence: 400, notes: 'Sample unit cost', isDemo: true },
    ])
    await tx
      .insert(pages)
      .values({ slug: 'demo-page', title: 'Demo page', body: 'Sample content page. Not published.', published: false, isDemo: true })
      .onConflictDoNothing()

    await tx.insert(auditLogs).values({
      userId: actor?.id ?? null,
      actor: actor?.email ?? 'seed script',
      action: 'demo_data.seeded',
      entityType: 'demo_data',
      details: { customers: customerIds.size, orders: orderCount },
    })
    return { seeded: true as const, customers: customerIds.size, orders: orderCount }
  })
}

/**
 * Deletes every demo row, children before parents, in one transaction. A demo row that a real
 * row still references (for example a demo customer who later placed a real order) is kept and
 * reported, so no real record is ever deleted or orphaned. Audit logs are never deleted; the
 * removal itself is audited.
 */
export async function removeDemoData(actor: AdminUser) {
  const result = await db.transaction(async (tx) => {
    // Demo orders that no real payment, stock movement or other record depends on.
    const demoOrders = tx
      .select({ id: orders.id })
      .from(orders)
      .where(
        and(
          eq(orders.isDemo, true),
          notExists(tx.select({ x: sql`1` }).from(payments).where(and(eq(payments.orderId, orders.id), eq(payments.isDemo, false)))),
          notExists(tx.select({ x: sql`1` }).from(inventoryMovements).where(and(eq(inventoryMovements.orderId, orders.id), eq(inventoryMovements.isDemo, false)))),
        ),
      )
    const orderIds = (await demoOrders).map((o) => o.id)

    const deleted = { notifications: 0, orderItems: 0, payments: 0, inventoryMovements: 0, orders: 0, customers: 0, costs: 0, pages: 0, productVariants: 0, products: 0 }
    const n = (rows: Array<unknown>) => rows.length

    if (orderIds.length) {
      deleted.notifications = n(await tx.delete(notifications).where(inArray(notifications.orderId, orderIds)).returning({ id: notifications.id }))
      deleted.orderItems = n(await tx.delete(orderItems).where(inArray(orderItems.orderId, orderIds)).returning({ id: orderItems.id }))
    }
    deleted.payments = n(await tx.delete(payments).where(eq(payments.isDemo, true)).returning({ id: payments.id }))
    deleted.inventoryMovements = n(await tx.delete(inventoryMovements).where(eq(inventoryMovements.isDemo, true)).returning({ id: inventoryMovements.id }))
    if (orderIds.length) {
      deleted.orders = n(await tx.delete(orders).where(and(inArray(orders.id, orderIds), eq(orders.isDemo, true))).returning({ id: orders.id }))
    }
    deleted.customers = n(
      await tx
        .delete(customers)
        .where(and(eq(customers.isDemo, true), notExists(tx.select({ x: sql`1` }).from(orders).where(eq(orders.customerId, customers.id)))))
        .returning({ id: customers.id }),
    )
    deleted.costs = n(await tx.delete(costs).where(eq(costs.isDemo, true)).returning({ id: costs.id }))
    deleted.pages = n(await tx.delete(pages).where(eq(pages.isDemo, true)).returning({ id: pages.id }))
    deleted.productVariants = n(
      await tx
        .delete(productVariants)
        .where(
          and(
            eq(productVariants.isDemo, true),
            notExists(tx.select({ x: sql`1` }).from(orderItems).where(eq(orderItems.variantId, productVariants.id))),
            notExists(tx.select({ x: sql`1` }).from(inventoryMovements).where(eq(inventoryMovements.variantId, productVariants.id))),
            notExists(tx.select({ x: sql`1` }).from(costs).where(eq(costs.variantId, productVariants.id))),
          ),
        )
        .returning({ id: productVariants.id }),
    )
    const removedProducts = await tx
      .delete(products)
      .where(and(eq(products.isDemo, true), notExists(tx.select({ x: sql`1` }).from(productVariants).where(eq(productVariants.productId, products.id)))))
      .returning({ id: products.id, imageKey: products.imageKey })
    deleted.products = removedProducts.length

    const kept = {
      orders: (await tx.select({ n: count() }).from(orders).where(eq(orders.isDemo, true)))[0].n,
      customers: (await tx.select({ n: count() }).from(customers).where(eq(customers.isDemo, true)))[0].n,
      products: (await tx.select({ n: count() }).from(products).where(eq(products.isDemo, true)))[0].n,
    }

    await tx.insert(auditLogs).values({
      userId: actor.id,
      actor: actor.email,
      action: 'demo_data.removed',
      entityType: 'demo_data',
      details: { deleted, keptBecauseReferenced: kept },
    })
    return { deleted, kept, imageKeys: removedProducts.map((p) => p.imageKey).filter((k): k is string => !!k) }
  })

  // Blobs aren't transactional: delete images only after the rows are gone.
  for (const key of result.imageKeys) await deleteProductImage(key).catch((e) => console.error('[demo-data] Could not delete image', key, e))
  return { deleted: result.deleted, kept: result.kept }
}

