import { and, eq, lte } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { orderItems, orders, productVariants, products } from '../../db/schema.js'
import { formatMoney, site } from '../../src/config/site.js'
import { orderRef } from '../../src/lib/catalogue.js'

export const slackConfigured = () => !!(process.env.SLACK_WEBHOOK_URL || (process.env.SLACK_BOT_TOKEN && process.env.SLACK_CHANNEL_ID))

const adminUrl = (ref: string) => {
  const base = process.env.URL || process.env.SITE_URL
  return base ? `${base}/admin/orders/${ref}` : null
}

const money = (pence: number) => formatMoney(pence / 100)

// Slack is a packing feed: who ordered, how to reach them, and what to pack. The full address
// stays in the database (and the Netlify Forms submission).
export async function buildOrderMessage(orderId: number) {
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId))
  const items = await db
    .select({ item: orderItems, preOrder: products.preOrder })
    .from(orderItems)
    .innerJoin(productVariants, eq(productVariants.id, orderItems.variantId))
    .innerJoin(products, eq(products.id, productVariants.productId))
    .where(eq(orderItems.orderId, orderId))
    .orderBy(orderItems.id)
  const ref = orderRef(order.number)
  const lines = items.map(
    ({ item: i, preOrder }) =>
      `• ${i.quantity} × ${i.productName} ${i.variantName} \`${i.sku}\` — ${money(i.unitPricePence * i.quantity)}${preOrder ? ' — *PRE-ORDER, ships separately*' : ''}`,
  )

  return {
    text: `New order ${ref} — ${money(order.totalPence)} from ${order.customerName}`,
    blocks: [
      { type: 'header', text: { type: 'plain_text', text: `🛒 NEW ORDER ${ref}` } },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Customer*\n${order.customerName}` },
          { type: 'mrkdwn', text: `*Deliver to*\n${order.city} ${order.postcode.toUpperCase()}` },
          { type: 'mrkdwn', text: `*Email*\n${order.email}` },
          { type: 'mrkdwn', text: `*Phone*\n${order.phone}` },
          { type: 'mrkdwn', text: `*Total*\n${money(order.totalPence)}` },
          { type: 'mrkdwn', text: `*Payment*\n${order.paymentStatus === 'PENDING' ? 'Awaiting payment (invoice emailed)' : order.paymentStatus}` },
        ],
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Items*\n${lines.join('\n')}\n_Delivery: ${order.shippingPence ? money(order.shippingPence) : 'Free'}${order.discountPence ? ` · Discount ${order.discountCode}: −${money(order.discountPence)}` : ''}_`,
        },
      },
      ...(order.notes ? [{ type: 'section', text: { type: 'mrkdwn', text: `*Notes*\n${order.notes}` } }] : []),
      ...(adminUrl(ref)
        ? [{ type: 'actions', elements: [{ type: 'button', text: { type: 'plain_text', text: 'View order' }, url: adminUrl(ref), style: 'primary' }] }]
        : []),
      { type: 'context', elements: [{ type: 'mrkdwn', text: `${site.name} · ${order.createdAt.toLocaleString(site.locale, { timeZone: 'Europe/London' })}` }] },
    ],
  }
}

/** Low-stock alert listing every active variant at or below its threshold. */
export async function buildLowStockMessage() {
  const rows = await db
    .select({ product: products.name, variant: productVariants.name, sku: productVariants.sku, stock: productVariants.stock, threshold: productVariants.lowStockThreshold })
    .from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId))
    .where(and(eq(productVariants.active, true), eq(products.active, true), eq(products.preOrder, false), lte(productVariants.stock, productVariants.lowStockThreshold)))
    .orderBy(productVariants.stock)
  const list = rows.map((r) => `• ${r.product} ${r.variant} \`${r.sku}\` — *${r.stock}* left (alert at ${r.threshold})`).join('\n')
  return {
    text: `Low stock: ${rows.length} variant(s) at or below their threshold`,
    blocks: [
      { type: 'header', text: { type: 'plain_text', text: '⚠️ Low stock' } },
      { type: 'section', text: { type: 'mrkdwn', text: list || 'All variants are back above their thresholds.' } },
    ],
  }
}

/** Short status update, e.g. "ORD-10027 marked paid by Joel". */
export function statusMessage(ref: string, text: string) {
  return { text: `${ref}: ${text}`, blocks: [{ type: 'section', text: { type: 'mrkdwn', text: `*${ref}* · ${text}` } }] }
}



/**
 * Sends a message with whichever Slack credentials are configured: an incoming webhook
 * (SLACK_WEBHOOK_URL), or a bot token plus channel (SLACK_BOT_TOKEN + SLACK_CHANNEL_ID, using
 * chat.postMessage). Credentials stay server-side and are never included in errors.
 */
export async function postToSlack(message: Record<string, unknown>) {
  const webhook = process.env.SLACK_WEBHOOK_URL
  const token = process.env.SLACK_BOT_TOKEN
  const channel = process.env.SLACK_CHANNEL_ID
  if (webhook) {
    const res = await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) throw new Error(`Slack webhook responded ${res.status}: ${(await res.text()).slice(0, 200)}`)
    return
  }
  if (!token || !channel) {
    throw new Error(token ? 'SLACK_CHANNEL_ID is not set (needed with SLACK_BOT_TOKEN)' : 'Slack is not configured: set SLACK_WEBHOOK_URL, or SLACK_BOT_TOKEN and SLACK_CHANNEL_ID')
  }
  const res = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ channel, ...message }),
    signal: AbortSignal.timeout(8000),
  })
  const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string }
  if (!res.ok || !body.ok) throw new Error(`Slack chat.postMessage failed: ${body.error ?? `HTTP ${res.status}`}`)
}
