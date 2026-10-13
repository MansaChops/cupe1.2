import { and, asc, desc, eq, inArray, lte, sql } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { customers, discountCodes, inventoryMovements, notifications, orderItems, orders, productVariants, products, users } from '../../db/schema.js'
import { orderRef } from '../../src/lib/catalogue.js'
import type { FulfilmentStatus, InventoryRow, Movement, NotificationState, Report } from '../../src/lib/admin-types.js'
import { listOrders } from './order-ops.js'

const iso = (d: Date | string) => (typeof d === 'string' ? new Date(d).toISOString() : d.toISOString())
// Days are UK calendar days.
const ukDay = sql<string>`to_char(${orders.createdAt} AT TIME ZONE 'Europe/London', 'YYYY-MM-DD')`

/** Everything the dashboard and reports page show, for orders placed in [from, to]. */
export async function buildReport(from: Date, to: Date, includeDemo: boolean): Promise<Report> {
  const range = and(
    sql`${orders.createdAt} >= ${from.toISOString()}`,
    sql`${orders.createdAt} < ${to.toISOString()}`,
    includeDemo ? sql`true` : eq(orders.isDemo, false),
  )
  const live = sql`${orders.fulfilmentStatus} NOT IN ('CANCELLED', 'REFUNDED')`

  const [k] = await db
    .select({
      orders: sql<number>`count(*) FILTER (WHERE ${live})::int`,
      paidOrders: sql<number>`count(*) FILTER (WHERE ${orders.paymentStatus} = 'PAID')::int`,
      awaitingPayment: sql<number>`count(*) FILTER (WHERE ${orders.paymentStatus} = 'PENDING' AND ${live})::int`,
      awaitingPaymentPence: sql<number>`coalesce(sum(${orders.totalPence}) FILTER (WHERE ${orders.paymentStatus} = 'PENDING' AND ${live}), 0)::int`,
      revenuePaidPence: sql<number>`coalesce(sum(${orders.totalPence}) FILTER (WHERE ${orders.paymentStatus} = 'PAID'), 0)::int`,
      orderValuePence: sql<number>`coalesce(sum(${orders.totalPence}) FILTER (WHERE ${live}), 0)::int`,
      discountsPence: sql<number>`coalesce(sum(${orders.discountPence}) FILTER (WHERE ${live}), 0)::int`,
      shippingPence: sql<number>`coalesce(sum(${orders.shippingPence}) FILTER (WHERE ${live}), 0)::int`,
      cancelled: sql<number>`count(*) FILTER (WHERE NOT ${live})::int`,
      customers: sql<number>`count(DISTINCT lower(${orders.email})) FILTER (WHERE ${live})::int`,
    })
    .from(orders)
    .where(range)

  const [{ units }] = await db
    .select({ units: sql<number>`coalesce(sum(${orderItems.quantity}), 0)::int` })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .where(and(range, live))

  // Open work is not limited to the date range.
  const [work] = await db
    .select({
      toPack: sql<number>`count(*) FILTER (WHERE ${orders.fulfilmentStatus} IN ('NEW', 'PACKING'))::int`,
      toShip: sql<number>`count(*) FILTER (WHERE ${orders.fulfilmentStatus} = 'PACKED')::int`,
    })
    .from(orders)
    .where(includeDemo ? sql`true` : eq(orders.isDemo, false))

  const [{ repeat }] = await db
    .select({ repeat: sql<number>`count(*)::int` })
    .from(
      db
        .select({ e: sql`lower(${orders.email})`.as('e') })
        .from(orders)
        .where(and(range, live))
        .groupBy(sql`lower(${orders.email})`)
        .having(sql`count(*) > 1`)
        .as('r'),
    )

  const dailyRows = await db
    .select({
      date: ukDay,
      orders: sql<number>`count(*)::int`,
      revenue: sql<number>`coalesce(sum(${orders.totalPence}), 0)::int`,
      paid: sql<number>`coalesce(sum(${orders.totalPence}) FILTER (WHERE ${orders.paymentStatus} = 'PAID'), 0)::int`,
    })
    .from(orders)
    .where(and(range, live))
    .groupBy(ukDay)
  const byDay = new Map(dailyRows.map((d) => [d.date, d]))
  // One point per UK calendar day from the first to the last day of the range, including today.
  const ukKey = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: 'Europe/London' })
  const lastKey = ukKey(new Date(to.getTime() - 1))
  const daily: Report['daily'] = []
  for (let d = new Date(from); daily.at(-1)?.date !== lastKey && daily.length < 400; d = new Date(d.getTime() + 6 * 3_600_000)) {
    const key = ukKey(d)
    if (daily.at(-1)?.date === key) continue
    const row = byDay.get(key)
    daily.push({ date: key, orders: row?.orders ?? 0, revenue: (row?.revenue ?? 0) / 100, paid: (row?.paid ?? 0) / 100 })
  }

  const topProducts = await db
    .select({
      label: orderItems.productName,
      sub: orderItems.variantName,
      units: sql<number>`sum(${orderItems.quantity})::int`,
      revenuePence: sql<number>`sum(${orderItems.quantity} * ${orderItems.unitPricePence})::int`,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .where(and(range, live))
    .groupBy(orderItems.productName, orderItems.variantName)
    .orderBy(desc(sql`sum(${orderItems.quantity})`))
    .limit(10)

  const byStatus = await db
    .select({ status: orders.fulfilmentStatus, count: sql<number>`count(*)::int` })
    .from(orders)
    .where(range)
    .groupBy(orders.fulfilmentStatus)

  const discounts = await db
    .select({
      code: sql<string>`upper(${orders.discountCode})`,
      uses: sql<number>`count(*)::int`,
      discountPence: sql<number>`sum(${orders.discountPence})::int`,
      revenuePence: sql<number>`sum(${orders.totalPence})::int`,
    })
    .from(orders)
    .where(and(range, live, sql`${orders.discountCode} IS NOT NULL`))
    .groupBy(sql`upper(${orders.discountCode})`)
    .orderBy(desc(sql`count(*)`))

  const lowStock = await db
    .select({ variantId: productVariants.id, productName: products.name, variantName: productVariants.name, sku: productVariants.sku, stock: productVariants.stock, lowStockThreshold: productVariants.lowStockThreshold })
    .from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId))
    .where(and(eq(products.active, true), eq(productVariants.active, true), eq(products.preOrder, false), lte(productVariants.stock, productVariants.lowStockThreshold)))
    .orderBy(asc(productVariants.stock))

  const failed = await db
    .select({ number: orders.number, channel: notifications.channel, event: notifications.event, status: notifications.status, lastError: notifications.lastError })
    .from(notifications)
    .innerJoin(orders, eq(orders.id, notifications.orderId))
    .where(inArray(notifications.status, ['FAILED', 'RETRYING']))
    .orderBy(desc(notifications.id))
    .limit(10)

  const recent = (await listOrders({ limit: 8, demo: includeDemo ? undefined : false })).slice(0, 8)

  return {
    from: from.toISOString(),
    to: to.toISOString(),
    kpis: {
      ...k,
      units,
      averageOrderPence: k.orders ? Math.round(k.orderValuePence / k.orders) : 0,
      toPack: work.toPack,
      toShip: work.toShip,
      repeatCustomers: repeat,
    },
    daily,
    topProducts,
    byStatus: byStatus as Array<{ status: FulfilmentStatus; count: number }>,
    discounts,
    lowStock,
    failedNotifications: failed.map((f) => ({ orderNumber: orderRef(f.number), channel: f.channel, event: f.event, status: f.status as NotificationState, lastError: f.lastError })),
    recent,
  }
}

/* ---------- Inventory ---------- */

export async function inventoryRows(): Promise<Array<InventoryRow>> {
  const sold = db
    .select({ variantId: orderItems.variantId, n: sql<number>`sum(${orderItems.quantity})::int`.as('n') })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .where(sql`${orders.createdAt} > now() - interval '30 days' AND ${orders.fulfilmentStatus} NOT IN ('CANCELLED', 'REFUNDED')`)
    .groupBy(orderItems.variantId)
    .as('sold')
  const rows = await db
    .select({ p: products, v: productVariants, sold: sql<number>`coalesce(${sold.n}, 0)::int` })
    .from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId))
    .leftJoin(sold, eq(sold.variantId, productVariants.id))
    .orderBy(asc(products.sortOrder), asc(products.id), asc(productVariants.sortOrder), asc(productVariants.id))
  return rows.map(({ p, v, sold }) => ({
    productId: p.id, productName: p.name, category: p.category, productActive: p.active, preOrder: p.preOrder, featured: p.featured,
    variantId: v.id, variantName: v.name, sku: v.sku, pricePence: v.pricePence, salePricePence: v.salePricePence, stock: v.stock,
    lowStockThreshold: v.lowStockThreshold, packSize: v.packSize, maxPerOrder: v.maxPerOrder, active: v.active, sold30d: sold, isDemo: v.isDemo,
  }))
}

export async function movements(variantId?: string, limit = 100): Promise<Array<Movement>> {
  const rows = await db
    .select({ m: inventoryMovements, sku: productVariants.sku, productName: products.name, variantName: productVariants.name, actorName: users.name, actorEmail: users.email, number: orders.number })
    .from(inventoryMovements)
    .innerJoin(productVariants, eq(productVariants.id, inventoryMovements.variantId))
    .innerJoin(products, eq(products.id, productVariants.productId))
    .leftJoin(users, eq(users.id, inventoryMovements.userId))
    .leftJoin(orders, eq(orders.id, inventoryMovements.orderId))
    .where(variantId ? eq(inventoryMovements.variantId, variantId) : sql`true`)
    .orderBy(desc(inventoryMovements.id))
    .limit(limit)
  return rows.map((r) => ({
    id: r.m.id, variantId: r.m.variantId, sku: r.sku, productName: r.productName, variantName: r.variantName, reason: r.m.reason, delta: r.m.delta,
    stockAfter: r.m.stockAfter, note: r.m.note, actor: r.actorName ?? r.actorEmail ?? null, orderNumber: r.number ? orderRef(r.number) : null, createdAt: iso(r.m.createdAt),
  }))
}

/* ---------- CSV exports ---------- */

const csvCell = (v: unknown) => {
  if (v === null || v === undefined) return ''
  const s = v instanceof Date ? v.toISOString() : String(v)
  // Quote everything that needs it, and neutralise spreadsheet formula injection.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}
const toCsv = (rows: Array<Array<unknown>>) => rows.map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n'
const gbp = (pence: number) => (pence / 100).toFixed(2)

export async function exportCsv(type: string, opts: { status?: string } = {}) {
  if (type === 'orders') {
    const rows = await db
      .select()
      .from(orders)
      .where(opts.status ? sql`${orders.fulfilmentStatus} = ${opts.status}` : sql`true`)
      .orderBy(desc(orders.number))
    return toCsv([
      ['order', 'placed_at', 'customer', 'email', 'phone', 'address', 'city', 'postcode', 'country', 'subtotal_gbp', 'delivery_gbp', 'discount_code', 'discount_gbp', 'total_gbp', 'payment', 'status', 'tracking', 'paid_at', 'shipped_at', 'customer_notes', 'internal_notes', 'demo'],
      ...rows.map((o) => [orderRef(o.number), o.createdAt, o.customerName, o.email, o.phone, o.address, o.city, o.postcode, o.country, gbp(o.subtotalPence), gbp(o.shippingPence), o.discountCode, gbp(o.discountPence), gbp(o.totalPence), o.paymentStatus, o.fulfilmentStatus, o.trackingNumber, o.paidAt, o.shippedAt, o.notes, o.adminNotes, o.isDemo]),
    ])
  }
  if (type === 'order-items') {
    const rows = await db
      .select({ i: orderItems, number: orders.number, createdAt: orders.createdAt, status: orders.fulfilmentStatus, payment: orders.paymentStatus })
      .from(orderItems)
      .innerJoin(orders, eq(orders.id, orderItems.orderId))
      .orderBy(desc(orders.number), asc(orderItems.id))
    return toCsv([
      ['order', 'placed_at', 'product', 'size', 'sku', 'quantity', 'unit_gbp', 'line_total_gbp', 'payment', 'status'],
      ...rows.map(({ i, number, createdAt, status, payment }) => [orderRef(number), createdAt, i.productName, i.variantName, i.sku, i.quantity, gbp(i.unitPricePence), gbp(i.unitPricePence * i.quantity), payment, status]),
    ])
  }
  if (type === 'inventory') {
    const rows = await inventoryRows()
    return toCsv([
      ['product', 'size', 'sku', 'stock', 'low_stock_alert_at', 'price_gbp', 'sale_price_gbp', 'sold_last_30_days', 'pre_order', 'active'],
      ...rows.map((r) => [r.productName, r.variantName, r.sku, r.stock, r.lowStockThreshold, gbp(r.pricePence), r.salePricePence === null ? '' : gbp(r.salePricePence), r.sold30d, r.preOrder, r.productActive && r.active]),
    ])
  }
  if (type === 'customers') {
    const rows = await db
      .select({
        c: customers,
        orders: sql<number>`(SELECT count(*)::int FROM ${orders} WHERE ${orders.customerId} = ${customers.id} AND ${orders.fulfilmentStatus} NOT IN ('CANCELLED', 'REFUNDED'))`,
        spent: sql<number>`(SELECT coalesce(sum(${orders.totalPence}), 0)::int FROM ${orders} WHERE ${orders.customerId} = ${customers.id} AND ${orders.paymentStatus} = 'PAID')`,
      })
      .from(customers)
      .orderBy(asc(customers.name))
    return toCsv([
      ['name', 'email', 'phone', 'address', 'city', 'postcode', 'orders', 'paid_total_gbp', 'first_seen', 'demo'],
      ...rows.map(({ c, orders: n, spent }) => [c.name, c.email, c.phone, c.address, c.city, c.postcode, n, gbp(spent), c.createdAt, c.isDemo]),
    ])
  }
  if (type === 'discounts') {
    const rows = await db.select().from(discountCodes).orderBy(asc(discountCodes.code))
    return toCsv([
      ['code', 'type', 'value', 'min_order_gbp', 'uses', 'max_uses', 'once_per_customer', 'starts_at', 'ends_at', 'active', 'description'],
      ...rows.map((c) => [c.code, c.type, c.type === 'FIXED' ? gbp(c.value) : c.value, gbp(c.minSubtotalPence), c.uses, c.maxUses, c.oncePerCustomer, c.startsAt, c.endsAt, c.active, c.description]),
    ])
  }
  return null
}
