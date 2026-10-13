import { formatMoney, site } from '@/config/site'

/**
 * Netlify Forms submission for a placed order. Netlify only accepts fields it registered at deploy
 * time from `public/order-form.html`, so every name built here must also exist in that file.
 */
export const ORDER_FORM_NAME = 'customer-order'
export const ORDER_FORM_PATH = '/order-form.html'
// Lines beyond this still appear in `order-summary` and `items-json`.
export const MAX_ITEM_FIELDS = 20

export type PlacedOrder = {
  orderNumber: string
  createdAt: string
  items: Array<{ variantId: string; name: string; variant: string; sku: string; quantity: number; unitPrice: number; lineTotal: number }>
  subtotal: number
  shipping: number
  discountCode?: string | null
  discount?: number
  total: number
}

export type OrderDetails = { name: string; email: string; phone: string; address: string; city: string; postcode: string; country: string; notes: string }

const ukTime = (iso: string) =>
  new Date(iso).toLocaleString(site.locale, { timeZone: 'Europe/London', dateStyle: 'medium', timeStyle: 'short' })

export function orderFormFields(order: PlacedOrder, d: OrderDetails): Record<string, string> {
  const postcode = d.postcode.trim().toUpperCase()
  const deliveryAddress = [d.name, d.address, `${d.city} ${postcode}`, d.country].map((s) => s.trim()).join('\n')
  const totalQuantity = order.items.reduce((s, i) => s + i.quantity, 0)
  const delivery = order.shipping ? formatMoney(order.shipping) : 'Free'
  const itemLine = (i: PlacedOrder['items'][number]) =>
    `${i.name} ${i.variant} × ${i.quantity} — ${formatMoney(i.lineTotal)} (SKU ${i.sku}, ${formatMoney(i.unitPrice)} each)`

  const summary = [
    `ORDER ${order.orderNumber}`,
    `Placed: ${ukTime(order.createdAt)} (UK time)`,
    '',
    'ORDER ITEMS:',
    ...order.items.map(itemLine),
    '',
    `Total quantity: ${totalQuantity}`,
    `Subtotal: ${formatMoney(order.subtotal)}`,
    `Delivery: ${delivery}`,
    ...(order.discount ? [`Discount (${order.discountCode}): −${formatMoney(order.discount)}`] : []),
    `TOTAL: ${formatMoney(order.total)}`,
    '',
    'DELIVER TO:',
    deliveryAddress,
    '',
    `Email: ${d.email.trim()}`,
    `Phone: ${d.phone.trim()}`,
    ...(d.notes.trim() ? ['', `Notes: ${d.notes.trim()}`] : []),
  ].join('\n')

  const itemFields = Object.fromEntries(
    Array.from({ length: MAX_ITEM_FIELDS }, (_, n) => [`item-${n + 1}`, order.items[n] ? itemLine(order.items[n]) : '']).filter(([, v]) => v),
  )

  return {
    'form-name': ORDER_FORM_NAME,
    subject: `New order ${order.orderNumber} — ${formatMoney(order.total)} from ${d.name.trim()}`,
    'order-number': order.orderNumber,
    'submitted-at': `${ukTime(order.createdAt)} (UK) · ${order.createdAt}`,
    'customer-name': d.name.trim(),
    email: d.email.trim(),
    phone: d.phone.trim(),
    address: d.address.trim(),
    city: d.city.trim(),
    postcode,
    country: d.country,
    'delivery-address': deliveryAddress,
    notes: d.notes.trim(),
    'order-summary': summary,
    ...itemFields,
    'item-count': String(order.items.length),
    'total-quantity': String(totalQuantity),
    subtotal: formatMoney(order.subtotal),
    delivery,
    total: formatMoney(order.total),
    discount: order.discount ? `${order.discountCode} −${formatMoney(order.discount)}` : '',
    'payment-status': 'Awaiting payment — invoice emailed to customer',
    'items-json': JSON.stringify(order.items),
  }
}

/** Posts the order to Netlify Forms. Resolves only once Netlify has accepted it. */
export async function submitOrderForm(fields: Record<string, string>) {
  const res = await fetch(ORDER_FORM_PATH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(fields).toString(),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw Object.assign(new Error(`Netlify Forms responded ${res.status}`), { status: res.status, body: body.slice(0, 500) })
  }
}
