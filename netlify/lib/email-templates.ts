import { asc, eq } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { orderItems, orders } from '../../db/schema.js'
import { formatMoney, site } from '../../src/config/site.js'
import { orderRef } from '../../src/lib/catalogue.js'
import { getPaymentSettings } from './settings.js'

type Order = typeof orders.$inferSelect
type Item = typeof orderItems.$inferSelect

const money = (pence: number) => formatMoney(pence / 100)
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
const ukDate = (d: Date) => d.toLocaleDateString(site.locale, { timeZone: 'Europe/London', day: 'numeric', month: 'long', year: 'numeric' })
export const trackingUrl = (tracking: string) => `https://www.royalmail.com/track-your-item#/tracking-results/${encodeURIComponent(tracking.replace(/\s/g, ''))}`

async function load(orderId: number) {
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId))
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId)).orderBy(asc(orderItems.id))
  return { order, items }
}

/* ---------- Layout ---------- */

const layout = (title: string, body: string) => `<!doctype html><html><body style="margin:0;background:#eef1ef;font-family:-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;color:#141a18">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:28px 12px"><tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #dde3e0">
<tr><td style="background:#121816;padding:22px 28px;color:#e9efed;font-size:18px;letter-spacing:.02em">${esc(site.name)}</td></tr>
<tr><td style="padding:28px">
<h1 style="font-size:22px;font-weight:600;margin:0 0 16px">${esc(title)}</h1>
${body}
</td></tr>
<tr><td style="padding:18px 28px;background:#f6f8f7;color:#5d6b66;font-size:12px;line-height:1.6">
${esc(site.legalName)} · ${esc(site.address)} · ${esc(site.email)}<br>
Customers must be 18 or over. Please read our product disclaimer before use.
</td></tr></table></td></tr></table></body></html>`

const itemsTable = (order: Order, items: Array<Item>) => `
<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:14px;margin:6px 0 4px">
<tr style="color:#5d6b66;font-size:12px;text-transform:uppercase;letter-spacing:.06em">
<td style="padding:6px 0;border-bottom:1px solid #dde3e0">Item</td><td align="center" style="border-bottom:1px solid #dde3e0">Qty</td>
<td align="right" style="border-bottom:1px solid #dde3e0">Price</td><td align="right" style="border-bottom:1px solid #dde3e0">Total</td></tr>
${items
  .map(
    (i) => `<tr><td style="padding:10px 0;border-bottom:1px solid #eef1ef">${esc(i.productName)} <span style="color:#5d6b66">${esc(i.variantName)}</span><br><span style="font-family:monospace;font-size:11px;color:#8a9692">${esc(i.sku)}</span></td>
<td align="center" style="border-bottom:1px solid #eef1ef">${i.quantity}</td>
<td align="right" style="border-bottom:1px solid #eef1ef">${money(i.unitPricePence)}</td>
<td align="right" style="border-bottom:1px solid #eef1ef">${money(i.unitPricePence * i.quantity)}</td></tr>`,
  )
  .join('')}
<tr><td colspan="3" align="right" style="padding:10px 0 2px;color:#5d6b66">Subtotal</td><td align="right" style="padding:10px 0 2px">${money(order.subtotalPence)}</td></tr>
<tr><td colspan="3" align="right" style="padding:2px 0;color:#5d6b66">Delivery</td><td align="right">${order.shippingPence ? money(order.shippingPence) : 'Free'}</td></tr>
${order.discountPence ? `<tr><td colspan="3" align="right" style="padding:2px 0;color:#5d6b66">Discount (${esc(order.discountCode ?? '')})</td><td align="right">−${money(order.discountPence)}</td></tr>` : ''}
<tr><td colspan="3" align="right" style="padding:8px 0;font-weight:700;font-size:16px">Total</td><td align="right" style="font-weight:700;font-size:16px">${money(order.totalPence)}</td></tr>
</table>`

const itemsText = (order: Order, items: Array<Item>) =>
  [
    ...items.map((i) => `${i.quantity} × ${i.productName} ${i.variantName} — ${money(i.unitPricePence * i.quantity)}`),
    `Subtotal: ${money(order.subtotalPence)}`,
    `Delivery: ${order.shippingPence ? money(order.shippingPence) : 'Free'}`,
    ...(order.discountPence ? [`Discount (${order.discountCode}): −${money(order.discountPence)}`] : []),
    `TOTAL: ${money(order.totalPence)}`,
  ].join('\n')

const addressHtml = (o: Order) => [o.customerName, o.address, o.city, o.postcode, o.country].map(esc).join('<br>')
const addressText = (o: Order) => [o.customerName, o.address, `${o.city} ${o.postcode}`, o.country].join(', ')

/* ---------- Templates ---------- */

/** Sent the moment an order is placed. No payment is taken on the site, so this is the invoice. */
export async function invoiceEmail(orderId: number) {
  const { order, items } = await load(orderId)
  const payment = await getPaymentSettings()
  const ref = orderRef(order.number)
  const due = new Date(order.createdAt.getTime() + payment.dueDays * 86_400_000)
  const instructions = payment.instructions.trim()
    ? payment.instructions.trim()
    : 'We’ll email you separately with how to pay. Please don’t send payment until you hear from us.'

  const html = layout(`Invoice ${ref}`, `
<p style="margin:0 0 18px;line-height:1.6">Hi ${esc(order.customerName.split(' ')[0])}, thank you for your order. This email is your invoice. <strong>No payment has been taken yet.</strong> Your order will be packed and dispatched as soon as payment is received.</p>
<table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;margin-bottom:18px"><tr>
<td valign="top" style="padding-right:12px"><div style="color:#5d6b66;font-size:11px;text-transform:uppercase;letter-spacing:.08em">Invoice no.</div><strong style="font-family:monospace;font-size:15px">${ref}</strong></td>
<td valign="top" style="padding-right:12px"><div style="color:#5d6b66;font-size:11px;text-transform:uppercase;letter-spacing:.08em">Invoice date</div>${ukDate(order.createdAt)}</td>
<td valign="top"><div style="color:#5d6b66;font-size:11px;text-transform:uppercase;letter-spacing:.08em">Payment due</div>${ukDate(due)}</td>
</tr></table>
${itemsTable(order, items)}
<div style="margin:22px 0;padding:18px;border-radius:12px;background:#eaf5f0;border:1px solid #bfe0d1">
<div style="font-weight:600;margin-bottom:8px">How to pay · ${money(order.totalPence)}</div>
<div style="white-space:pre-line;line-height:1.6;font-size:14px">${esc(instructions)}</div>
<div style="margin-top:10px;font-size:13px">Please use <strong style="font-family:monospace">${ref}</strong> as your payment reference.</div>
</div>
<table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;line-height:1.6"><tr>
<td valign="top" width="50%"><div style="color:#5d6b66;font-size:11px;text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px">Bill & deliver to</div>${addressHtml(order)}</td>
<td valign="top"><div style="color:#5d6b66;font-size:11px;text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px">Contact</div>${esc(order.email)}<br>${esc(order.phone)}</td>
</tr></table>
${order.notes ? `<p style="margin:16px 0 0;font-size:13px;color:#5d6b66">Your note: ${esc(order.notes)}</p>` : ''}
<p style="margin:22px 0 0;font-size:13px;color:#5d6b66">Questions? Reply to this email and quote ${ref}.</p>`)

  const text = `Invoice ${ref} — ${site.name}
Invoice date: ${ukDate(order.createdAt)} · Payment due: ${ukDate(due)}

No payment has been taken yet. Your order will be dispatched once payment is received.

${itemsText(order, items)}

HOW TO PAY (${money(order.totalPence)}):
${instructions}
Payment reference: ${ref}

Deliver to: ${addressText(order)}
Questions? Reply to this email and quote ${ref}.`

  return { to: order.email, subject: `Invoice ${ref} — ${money(order.totalPence)} · ${site.name}`, html, text }
}

export async function paidEmail(orderId: number) {
  const { order, items } = await load(orderId)
  const ref = orderRef(order.number)
  const html = layout(`Payment received — ${ref}`, `
<p style="margin:0 0 18px;line-height:1.6">Thanks ${esc(order.customerName.split(' ')[0])}, we’ve received your payment of <strong>${money(order.totalPence)}</strong>. Orders confirmed before ${site.shipping.dispatchCutoff} on a working day are packed and dispatched the same day. We’ll email your tracking number when it ships.</p>
${itemsTable(order, items)}`)
  return {
    to: order.email,
    subject: `Payment received — ${ref}`,
    html,
    text: `We’ve received your payment of ${money(order.totalPence)} for ${ref}. We’ll email tracking when it ships.\n\n${itemsText(order, items)}`,
  }
}

export async function shippedEmail(orderId: number) {
  const { order, items } = await load(orderId)
  const ref = orderRef(order.number)
  const tracking = order.trackingNumber ?? ''
  const url = trackingUrl(tracking)
  const html = layout(`Your order ${ref} is on its way`, `
<p style="margin:0 0 16px;line-height:1.6">Your order has been packed by hand and handed to Royal Mail. Typical delivery is ${esc(site.shipping.estimate)}.</p>
<p style="margin:0 0 18px">Tracking number: <strong style="font-family:monospace">${esc(tracking)}</strong></p>
<a href="${url}" style="display:inline-block;background:#2f8f6b;color:#ffffff;padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:600">Track your parcel</a>
<div style="margin-top:22px">${itemsTable(order, items)}</div>
<p style="font-size:14px;line-height:1.6;margin:16px 0 0"><span style="color:#5d6b66">Delivering to:</span><br>${addressHtml(order)}</p>`)
  return {
    to: order.email,
    subject: `Shipped: ${ref} — tracking ${tracking}`,
    html,
    text: `Your order ${ref} has been dispatched.\nTracking number: ${tracking}\nTrack it: ${url}\n\n${itemsText(order, items)}`,
  }
}

export async function cancelledEmail(orderId: number) {
  const { order, items } = await load(orderId)
  const ref = orderRef(order.number)
  const paid = order.paymentStatus === 'PAID' || order.paymentStatus === 'REFUNDED'
  const html = layout(`Order ${ref} cancelled`, `
<p style="margin:0 0 16px;line-height:1.6">Your order ${ref} has been cancelled.${paid ? ' Any payment you made will be refunded to you.' : ' No payment is due.'} If this is unexpected, just reply to this email.</p>
${itemsTable(order, items)}`)
  return { to: order.email, subject: `Order ${ref} cancelled`, html, text: `Your order ${ref} has been cancelled.${paid ? ' Any payment you made will be refunded.' : ' No payment is due.'}` }
}

export const EMAIL_EVENTS = {
  'order.invoice': invoiceEmail,
  'order.paid': paidEmail,
  'order.shipped': shippedEmail,
  'order.cancelled': cancelledEmail,
} as const
export type EmailEvent = keyof typeof EMAIL_EVENTS
