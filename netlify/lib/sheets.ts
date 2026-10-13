import { createSign } from 'node:crypto'
import { asc, desc, eq, sql } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { discountCodes, orderItems, orders, productVariants, products } from '../../db/schema.js'
import { orderRef } from '../../src/lib/catalogue.js'

// One-way report: the database is copied into a Google Sheet. Sheet edits are never read back.
// Auth is a Google Cloud service account; share the sheet with its email as an Editor.
//   GOOGLE_SHEET_ID                The ID in the sheet URL (/spreadsheets/d/<ID>/edit)
//   GOOGLE_SERVICE_ACCOUNT_EMAIL   e.g. reports@my-project.iam.gserviceaccount.com
//   GOOGLE_PRIVATE_KEY             The service account's private key (PEM, \n escapes are fine)

export const sheetsConfigured = () =>
  !!(process.env.GOOGLE_SHEET_ID && process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY)

const b64url = (s: string | Buffer) => Buffer.from(s).toString('base64url')

async function accessToken() {
  const now = Math.floor(Date.now() / 1000)
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claims = b64url(
    JSON.stringify({
      iss: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      scope: 'https://www.googleapis.com/auth/spreadsheets',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    }),
  )
  const key = process.env.GOOGLE_PRIVATE_KEY!.replace(/\\n/g, '\n')
  const signature = createSign('RSA-SHA256').update(`${header}.${claims}`).sign(key).toString('base64url')
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${header}.${claims}.${signature}` }),
    signal: AbortSignal.timeout(10_000),
  })
  const body = (await res.json().catch(() => ({}))) as { access_token?: string; error_description?: string; error?: string }
  if (!res.ok || !body.access_token) throw new Error(`Google sign-in failed: ${body.error_description ?? body.error ?? res.status}`)
  return body.access_token
}

async function google(token: string, path: string, init: RequestInit = {}) {
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${process.env.GOOGLE_SHEET_ID}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(15_000),
  })
  const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } } & Record<string, unknown>
  if (!res.ok) throw new Error(`Google Sheets ${res.status}: ${body.error?.message ?? 'request failed'}`)
  return body
}

const pounds = (pence: number) => Math.round(pence) / 100
const uk = (d: Date | null) => (d ? d.toLocaleString('en-GB', { timeZone: 'Europe/London' }) : '')

/** Builds every tab from the database. */
async function buildTabs(): Promise<Record<string, Array<Array<string | number>>>> {
  const allOrders = await db.select().from(orders).where(eq(orders.isDemo, false)).orderBy(desc(orders.number))
  const items = await db
    .select({ item: orderItems, number: orders.number, createdAt: orders.createdAt, status: orders.fulfilmentStatus, payment: orders.paymentStatus })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .where(eq(orders.isDemo, false))
    .orderBy(desc(orders.number), asc(orderItems.id))
  const variants = await db
    .select({ p: products, v: productVariants })
    .from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId))
    .orderBy(asc(products.sortOrder), asc(productVariants.sortOrder))
  const daily = await db
    .select({
      day: sql<string>`to_char(${orders.createdAt} AT TIME ZONE 'Europe/London', 'YYYY-MM-DD')`,
      orders: sql<number>`count(*)::int`,
      paidOrders: sql<number>`count(*) FILTER (WHERE ${orders.paymentStatus} = 'PAID')::int`,
      gross: sql<number>`coalesce(sum(${orders.totalPence}), 0)::int`,
      paid: sql<number>`coalesce(sum(${orders.totalPence}) FILTER (WHERE ${orders.paymentStatus} = 'PAID'), 0)::int`,
      discounts: sql<number>`coalesce(sum(${orders.discountPence}), 0)::int`,
      shipping: sql<number>`coalesce(sum(${orders.shippingPence}), 0)::int`,
    })
    .from(orders)
    .where(sql`${orders.isDemo} = false AND ${orders.fulfilmentStatus} <> 'CANCELLED'`)
    .groupBy(sql`1`)
    .orderBy(sql`1 desc`)
  const codes = await db.select().from(discountCodes).orderBy(asc(discountCodes.code))

  return {
    Orders: [
      ['Order', 'Placed (UK)', 'Customer', 'Email', 'Phone', 'Address', 'Town', 'Postcode', 'Items', 'Subtotal £', 'Delivery £', 'Discount code', 'Discount £', 'Total £', 'Payment', 'Status', 'Tracking', 'Paid (UK)', 'Shipped (UK)', 'Customer notes'],
      ...allOrders.map((o) => [
        orderRef(o.number), uk(o.createdAt), o.customerName, o.email, o.phone, o.address, o.city, o.postcode,
        items.filter((i) => i.number === o.number).reduce((n, i) => n + i.item.quantity, 0),
        pounds(o.subtotalPence), pounds(o.shippingPence), o.discountCode ?? '', pounds(o.discountPence), pounds(o.totalPence),
        o.paymentStatus, o.fulfilmentStatus, o.trackingNumber ?? '', uk(o.paidAt), uk(o.shippedAt), o.notes,
      ]),
    ],
    'Order Items': [
      ['Order', 'Placed (UK)', 'Product', 'Size', 'SKU', 'Qty', 'Unit £', 'Line total £', 'Payment', 'Status'],
      ...items.map(({ item: i, number, createdAt, status, payment }) => [
        orderRef(number), uk(createdAt), i.productName, i.variantName, i.sku, i.quantity, pounds(i.unitPricePence), pounds(i.unitPricePence * i.quantity), payment, status,
      ]),
    ],
    Inventory: [
      ['Product', 'Size', 'SKU', 'Stock', 'Low-stock alert at', 'Status', 'Price £', 'Sale price £', 'Pre-order', 'Active'],
      ...variants.map(({ p, v }) => [
        p.name, v.name, v.sku, v.stock, v.lowStockThreshold,
        p.preOrder ? 'Pre-order' : v.stock === 0 ? 'Out of stock' : v.stock <= v.lowStockThreshold ? 'Low' : 'OK',
        pounds(v.pricePence), v.salePricePence == null ? '' : pounds(v.salePricePence), p.preOrder ? 'Yes' : 'No', p.active && v.active ? 'Yes' : 'No',
      ]),
    ],
    'Daily Sales': [
      ['Date', 'Orders', 'Paid orders', 'Order value £', 'Paid £', 'Discounts £', 'Delivery charged £'],
      ...daily.map((d) => [d.day, d.orders, d.paidOrders, pounds(d.gross), pounds(d.paid), pounds(d.discounts), pounds(d.shipping)]),
    ],
    Discounts: [
      ['Code', 'Type', 'Value', 'Min order £', 'Uses', 'Max uses', 'Active', 'Starts', 'Ends', 'Description'],
      ...codes.map((c) => [
        c.code.toUpperCase(), c.type, c.type === 'FIXED' ? pounds(c.value) : c.type === 'PERCENT' ? `${c.value}%` : '', pounds(c.minSubtotalPence),
        c.uses, c.maxUses ?? 'Unlimited', c.active ? 'Yes' : 'No', uk(c.startsAt), uk(c.endsAt), c.description,
      ]),
    ],
  }
}

/** Rewrites every report tab from the database (creating missing tabs). Throws on failure. */
export async function syncSheets() {
  if (!sheetsConfigured()) throw new Error('Google Sheets is not configured: set GOOGLE_SHEET_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY')
  const tabs = await buildTabs()
  const token = await accessToken()

  const meta = (await google(token, '?fields=sheets.properties.title')) as { sheets?: Array<{ properties: { title: string } }> }
  const existing = new Set((meta.sheets ?? []).map((s) => s.properties.title))
  const missing = Object.keys(tabs).filter((t) => !existing.has(t))
  if (missing.length) {
    await google(token, ':batchUpdate', {
      method: 'POST',
      body: JSON.stringify({ requests: missing.map((title) => ({ addSheet: { properties: { title, gridProperties: { frozenRowCount: 1 } } } })) }),
    })
  }
  const ranges = Object.keys(tabs).map((t) => `'${t}'`)
  await google(token, '/values:batchClear', { method: 'POST', body: JSON.stringify({ ranges }) })
  await google(token, '/values:batchUpdate', {
    method: 'POST',
    body: JSON.stringify({
      valueInputOption: 'RAW',
      data: Object.entries(tabs).map(([title, values]) => ({ range: `'${title}'!A1`, values })),
    }),
  })
  return { tabs: Object.fromEntries(Object.entries(tabs).map(([t, rows]) => [t, rows.length - 1])) }
}
