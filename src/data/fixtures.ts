/**
 * DEMO DATA — every record in this file is fictional. The storefront no longer reads it: products,
 * prices and stock come from the database. It is used only by:
 * - the admin Dashboard and Orders sample screens (until the orders milestone), and
 * - the demo seed (netlify/lib/demo-data.ts), which copies the customers and orders into the
 *   database flagged is_demo = true so they can be removed with "Remove all demo data".
 */

export const DEMO = true

export type Category = {
  slug: string
  name: string
  blurb: string
}

export type Variant = {
  id: string
  inventoryId: string
  name: string
  sku: string
  price: number
  salePrice?: number
  stock: number
  lowStockThreshold: number
  active: boolean
  /** Sold only in multiples of this many units (e.g. 10 pins). Prices are per single unit. */
  step?: number
  /** Most units one order may contain */
  maxPerOrder?: number
}

export type Product = {
  id: string
  slug: string
  name: string
  category: string
  shortDescription: string
  description: string
  image: string
  gallery: Array<string>
  featured: boolean
  active: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
  variants: Array<Variant>
  /** Show every size and price above the size picker so customers see all options before adding to basket */
  showSizeGuide?: boolean
  /** Pre-order only: dispatched separately, on a longer lead time than in-stock items */
  preOrder?: boolean
}

export const categories: Array<Category> = [
  { slug: 'single-peptides', name: 'Single peptides', blurb: 'Individual lyophilised compounds in sealed glass vials.' },
  { slug: 'copper-peptides', name: 'Copper peptides', blurb: 'Copper-complexed peptides, supplied as powder.' },
  { slug: 'supplies', name: 'Supplies', blurb: 'Diluent, swabs and storage accessories.' },
]

// Owner-entered copy goes here in production. These neutral placeholders describe the
// physical format only — no claims about effects or outcomes.
const fmt = (mg: string) =>
  `Supplied as a lyophilised powder in a sealed ${mg} glass vial with an aluminium crimp cap. Store refrigerated and away from light.`
const placeholder =
  'Product description to be written and approved by the business. This field is fully editable from the admin dashboard.'

const p = (
  id: number,
  name: string,
  category: string,
  image: string,
  variants: Array<[string, string, number, number, number?, number?]>,
  opts: Partial<Product> & Pick<Variant, 'step' | 'maxPerOrder'> = {},
): Product => ({
  id: `prod_${id}`,
  slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
  name,
  category,
  shortDescription: opts.shortDescription ?? fmt('3ml'),
  description: opts.description ?? placeholder,
  image,
  gallery: [image],
  featured: opts.featured ?? false,
  showSizeGuide: opts.showSizeGuide,
  preOrder: opts.preOrder,
  active: opts.active ?? true,
  sortOrder: id,
  createdAt: '2026-06-02T09:14:00Z',
  updatedAt: '2026-09-28T16:40:00Z',
  variants: variants.map(([vname, sku, price, stock, threshold = 5, salePrice], i) => ({
    id: `var_${id}_${i + 1}`,
    inventoryId: `INV-${String(id).padStart(3, '0')}${i + 1}`,
    name: vname,
    sku,
    price,
    salePrice,
    stock,
    lowStockThreshold: threshold,
    active: true,
    step: opts.step,
    maxPerOrder: opts.maxPerOrder,
  })),
})

export const products: Array<Product> = [
  p(1, 'BPC-157', 'single-peptides', 'bpc-157.png', [['10mg', 'BPC10', 15, 36]], { featured: true }),
  p(2, 'GHK-Cu', 'copper-peptides', 'ghk-cu.png', [['100mg', 'GHK100', 25, 62, 6]], { featured: true }),
  p(5, 'Ipamorelin', 'single-peptides', 'vial-slate.png', [['5mg', 'IPA5', 26.5, 22]], { preOrder: true }),
  p(6, 'CJC-1295 (no DAC)', 'single-peptides', 'vial-slate.png', [['2mg', 'CJC2', 23.75, 0], ['5mg', 'CJC5', 38.4, 7]], { preOrder: true }),
  p(7, 'Selank', 'single-peptides', 'vial-verdigris.png', [['5mg', 'SEL5', 27.3, 16]], { preOrder: true }),
  p(8, 'Semax', 'single-peptides', 'vial-verdigris.png', [['5mg', 'SMX5', 27.3, 2, 4]], { preOrder: true }),
  p(9, 'Epitalon', 'single-peptides', 'vial-amber.png', [['10mg', 'EPI10', 31.2, 25], ['50mg', 'EPI50', 89, 6, 2]], { preOrder: true }),
  p(10, 'KPV', 'single-peptides', 'vial-amber.png', [['5mg', 'KPV5', 25.8, 14]]),
  p(11, 'Bacteriostatic Water', 'supplies', 'vial-slate.png', [['10ml', 'BAC10', 6.5, 120, 25], ['30ml', 'BAC30', 11.9, 48, 10]], {
    shortDescription: 'Multi-use diluent in a sealed glass vial with flip-off cap.',
  }),
  p(12, 'Alcohol Prep Pads (100)', 'supplies', 'alcohol-prep-pads.jpg', [['Box of 100', 'SWAB100', 4.25, 63, 15]], {
    shortDescription: 'Individually sealed 70% isopropyl prep pads.',
  }),
  p(15, '30G Pin', 'supplies', '30g-pin.webp', [['30G', 'PIN30G', 0.5, 500, 50]], {
    shortDescription: '30 gauge pins, individually sealed. Sold in packs of 10, up to 50 per order.',
    step: 10,
    maxPerOrder: 50,
  }),
  p(13, 'MT2', 'single-peptides', 'mt2.png', [['10mg', 'MT10', 25, 20]], { featured: true }),
  p(14, 'Reta', 'single-peptides', 'reta.png', [['10mg', 'RETA10', 50, 20], ['20mg', 'RETA20', 90, 20], ['30mg', 'RETA30', 130, 20]], { featured: true, showSizeGuide: true }),
]

export const findProduct = (slug: string) => products.find((x) => x.slug === slug)
export const findVariant = (variantId: string) => {
  for (const product of products) {
    const variant = product.variants.find((v) => v.id === variantId)
    if (variant) return { product, variant }
  }
  return undefined
}
export const unitPrice = (v: Variant) => v.salePrice ?? v.price
export const fromPrice = (product: Product) => Math.min(...product.variants.map(unitPrice))
/** Quantity increment for a variant (1 unless sold in packs) */
export const qtyStep = (v: Variant) => v.step ?? 1
/** Most units of a variant one basket/order may hold: limited by stock and any per-order cap, rounded down to a whole pack */
export const maxQty = (v: Variant) => {
  const step = qtyStep(v)
  return Math.floor(Math.min(v.stock, v.maxPerOrder ?? Infinity) / step) * step
}
/** Snap a requested quantity to a valid one (a whole number of packs, within limits); 0 means remove */
export const clampQty = (v: Variant, quantity: number) => {
  const step = qtyStep(v)
  return Math.max(0, Math.min(Math.floor(quantity / step) * step, maxQty(v)))
}
/** Price shown to customers: per pack for pack-sold items, otherwise per unit */
export const packPrice = (v: Variant) => unitPrice(v) * qtyStep(v)
export const priceLabel = (v: Variant) => (qtyStep(v) > 1 ? `per ${qtyStep(v)}` : '')
export const totalStock = (product: Product) => product.variants.reduce((n, v) => n + v.stock, 0)

// ─── Orders ───────────────────────────────────────────────────────────────

export type PaymentStatus = 'PAID' | 'PENDING' | 'FAILED' | 'REFUNDED' | 'PARTIALLY_REFUNDED'
export type FulfilmentStatus =
  | 'NEW'
  | 'PACKING'
  | 'PACKED'
  | 'SHIPPED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'REFUNDED'
export type IntegrationState = 'SENT' | 'FAILED' | 'PENDING' | 'RETRYING'

export type OrderItem = {
  productId: string
  variantId: string
  productName: string
  variantName: string
  sku: string
  quantity: number
  unitPrice: number
}

export type Customer = {
  id: string
  name: string
  email: string
  phone: string
  address: string
  city: string
  postcode: string
  country: string
  createdAt: string
}

export type NotificationRecord = {
  type: 'SLACK_NEW_ORDER' | 'SLACK_STATUS' | 'SMS_ADMIN' | 'EMAIL_CONFIRMATION' | 'EMAIL_SHIPPED' | 'SHEETS_SYNC'
  provider: 'Slack' | 'Twilio' | 'Email' | 'Google Sheets'
  status: IntegrationState
  at: string
  error?: string
  attempts: number
}

export type TimelineEvent = { at: string; label: string; actor: string }

export type Order = {
  id: string
  orderNumber: string
  customerId: string
  createdAt: string
  updatedAt: string
  items: Array<OrderItem>
  shipping: number
  currency: 'GBP'
  paymentStatus: PaymentStatus
  fulfilmentStatus: FulfilmentStatus
  trackingNumber?: string
  notes?: string
  adminNotes?: string
  stripePaymentId: string
  notifications: Array<NotificationRecord>
  timeline: Array<TimelineEvent>
}

export const customers: Array<Customer> = [
  ['Priya Raman', 'priya.raman', 'Leeds', 'LS6 2QT'],
  ['Callum Ferris', 'c.ferris', 'Glasgow', 'G12 8LB'],
  ['Hannah Okafor', 'hannah.ok', 'Manchester', 'M20 3FJ'],
  ['Tomasz Wilk', 'tomwilk', 'Bristol', 'BS7 9NR'],
  ['Eleri Pugh', 'eleri.p', 'Cardiff', 'CF24 4HQ'],
  ['Marcus Bellamy', 'mbellamy', 'Brighton', 'BN2 1TW'],
  ['Saoirse Doyle', 'sdoyle', 'Belfast', 'BT9 6AE'],
  ['Dev Chaudhry', 'dev.c', 'Leicester', 'LE2 1RH'],
  ['Freya Lindqvist', 'freyal', 'Edinburgh', 'EH9 1PR'],
  ['Joel Asante', 'j.asante', 'London', 'SE15 4QL'],
].map(([name, handle, city, postcode], i) => ({
  id: `cus_${i + 1}`,
  name,
  email: `${handle}@demo.invalid`,
  phone: `07700 900${String(100 + i * 37).slice(0, 3)}`,
  address: `${12 + i * 7} Demo Street`,
  city,
  postcode,
  country: 'United Kingdom',
  createdAt: `2026-0${7 + (i % 3)}-${String(3 + i * 2).padStart(2, '0')}T10:00:00Z`,
}))

export const findCustomer = (id: string) => customers.find((c) => c.id === id)!

const item = (variantId: string, quantity: number): OrderItem => {
  const { product, variant } = findVariant(variantId)!
  return {
    productId: product.id,
    variantId,
    productName: product.name,
    variantName: variant.name,
    sku: variant.sku,
    quantity,
    unitPrice: unitPrice(variant),
  }
}

const ok = (type: NotificationRecord['type'], provider: NotificationRecord['provider'], at: string): NotificationRecord => ({
  type, provider, status: 'SENT', at, attempts: 1,
})

const mkOrder = (
  n: number,
  customer: number,
  createdAt: string,
  items: Array<OrderItem>,
  fulfilmentStatus: FulfilmentStatus,
  extra: Partial<Order> = {},
): Order => {
  const subtotal = items.reduce((s, i) => s + i.unitPrice * i.quantity, 0)
  const notifications: Array<NotificationRecord> = extra.notifications ?? [
    ok('SLACK_NEW_ORDER', 'Slack', createdAt),
    ok('SMS_ADMIN', 'Twilio', createdAt),
    ok('SHEETS_SYNC', 'Google Sheets', createdAt),
    ok('EMAIL_CONFIRMATION', 'Email', createdAt),
  ]
  const timeline: Array<TimelineEvent> = [
    { at: createdAt, label: 'Payment confirmed by Stripe webhook', actor: 'System' },
    { at: createdAt, label: `Order ORD-${n} created · stock reserved`, actor: 'System' },
    ...(extra.timeline ?? []),
  ]
  return {
    id: `ord_${n}`,
    orderNumber: `ORD-${n}`,
    customerId: `cus_${customer}`,
    createdAt,
    updatedAt: extra.updatedAt ?? createdAt,
    items,
    shipping: subtotal >= 120 ? 0 : 4.99,
    currency: 'GBP',
    paymentStatus: 'PAID',
    fulfilmentStatus,
    stripePaymentId: `pi_demo_${n}`,
    ...extra,
    notifications,
    timeline,
  }
}

export const orders: Array<Order> = [
  mkOrder(10027, 1, '2026-10-07T07:42:00Z', [item('var_1_1', 2), item('var_2_1', 1)], 'NEW', {
    notes: 'Please leave with the neighbour at no. 14 if out.',
  }),
  mkOrder(10026, 6, '2026-10-07T06:58:00Z', [item('var_14_1', 1), item('var_11_1', 2)], 'NEW', {
    notifications: [
      ok('SLACK_NEW_ORDER', 'Slack', '2026-10-07T06:58:00Z'),
      { type: 'SMS_ADMIN', provider: 'Twilio', status: 'FAILED', at: '2026-10-07T06:58:04Z', attempts: 3, error: 'Twilio 21608: unverified destination number (trial account)' },
      ok('SHEETS_SYNC', 'Google Sheets', '2026-10-07T06:58:02Z'),
      ok('EMAIL_CONFIRMATION', 'Email', '2026-10-07T06:58:01Z'),
    ],
  }),
  mkOrder(10025, 3, '2026-10-06T19:11:00Z', [item('var_13_1', 1), item('var_12_1', 1)], 'PACKING', {
    updatedAt: '2026-10-07T08:05:00Z',
    timeline: [{ at: '2026-10-07T08:05:00Z', label: 'Status NEW → PACKING', actor: 'Owner' }],
  }),
  mkOrder(10024, 8, '2026-10-06T15:27:00Z', [item('var_9_1', 2), item('var_7_1', 1), item('var_11_2', 1)], 'PACKED', {
    updatedAt: '2026-10-06T17:40:00Z',
    timeline: [
      { at: '2026-10-06T16:52:00Z', label: 'Status NEW → PACKING', actor: 'Owner' },
      { at: '2026-10-06T17:40:00Z', label: 'Status PACKING → PACKED', actor: 'Owner' },
    ],
    notifications: [
      ok('SLACK_NEW_ORDER', 'Slack', '2026-10-06T15:27:00Z'),
      ok('SMS_ADMIN', 'Twilio', '2026-10-06T15:27:00Z'),
      { type: 'SHEETS_SYNC', provider: 'Google Sheets', status: 'RETRYING', at: '2026-10-06T15:27:00Z', attempts: 4, error: 'Google API 429: quota exceeded — next retry in 16 min' },
      ok('EMAIL_CONFIRMATION', 'Email', '2026-10-06T15:27:00Z'),
    ],
  }),
  mkOrder(10023, 2, '2026-10-06T09:03:00Z', [item('var_2_1', 2)], 'SHIPPED', {
    trackingNumber: 'QA 1234 5678 9GB',
    updatedAt: '2026-10-06T14:20:00Z',
    timeline: [
      { at: '2026-10-06T11:30:00Z', label: 'Status NEW → PACKING', actor: 'Owner' },
      { at: '2026-10-06T11:52:00Z', label: 'Status PACKING → PACKED', actor: 'Owner' },
      { at: '2026-10-06T14:20:00Z', label: 'Status PACKED → SHIPPED · tracking added', actor: 'Owner' },
    ],
  }),
  mkOrder(10022, 9, '2026-10-05T20:46:00Z', [item('var_5_1', 1), item('var_6_2', 1)], 'SHIPPED', { trackingNumber: 'QA 2210 4471 3GB' }),
  mkOrder(10021, 4, '2026-10-05T12:18:00Z', [item('var_1_1', 3)], 'COMPLETED', { trackingNumber: 'QA 9981 0042 7GB' }),
  mkOrder(10020, 10, '2026-10-04T17:35:00Z', [item('var_10_1', 1), item('var_8_1', 1)], 'COMPLETED', { trackingNumber: 'QA 5520 1189 4GB' }),
  mkOrder(10019, 5, '2026-10-04T08:09:00Z', [item('var_9_2', 1), item('var_2_1', 2)], 'COMPLETED', { trackingNumber: 'QA 3307 6625 1GB' }),
  mkOrder(10018, 7, '2026-10-03T13:50:00Z', [item('var_1_1', 1)], 'REFUNDED', {
    paymentStatus: 'REFUNDED',
    adminNotes: 'Customer requested cancellation before dispatch. Full refund issued via Stripe.',
  }),
  mkOrder(10017, 1, '2026-10-02T10:22:00Z', [item('var_14_1', 2), item('var_11_1', 1)], 'COMPLETED', { trackingNumber: 'QA 7781 0093 2GB' }),
  mkOrder(10016, 3, '2026-10-01T18:04:00Z', [item('var_7_1', 1)], 'CANCELLED', { paymentStatus: 'REFUNDED' }),
  mkOrder(10015, 6, '2026-09-30T09:40:00Z', [item('var_1_1', 1), item('var_5_1', 1)], 'COMPLETED', { trackingNumber: 'QA 1160 2287 8GB' }),
  mkOrder(10014, 8, '2026-09-29T21:12:00Z', [item('var_2_1', 1), item('var_12_1', 2)], 'COMPLETED', { trackingNumber: 'QA 6402 9918 5GB' }),
]

export const orderSubtotal = (o: Order) => o.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0)
export const orderTotal = (o: Order) => orderSubtotal(o) + o.shipping
export const orderUnits = (o: Order) => o.items.reduce((s, i) => s + i.quantity, 0)
export const findOrder = (orderNumber: string) => orders.find((o) => o.orderNumber === orderNumber)

export const inventoryMovements = [
  { at: '2026-10-07T07:42:00Z', sku: 'BPC10', change: -2, reason: 'ORDER ORD-10027', actor: 'System' },
  { at: '2026-10-07T07:42:00Z', sku: 'GHK100', change: -1, reason: 'ORDER ORD-10027', actor: 'System' },
  { at: '2026-10-07T06:58:00Z', sku: 'BTB10', change: -1, reason: 'ORDER ORD-10026', actor: 'System' },
  { at: '2026-10-07T06:58:00Z', sku: 'BAC10', change: -2, reason: 'ORDER ORD-10026', actor: 'System' },
  { at: '2026-10-06T10:15:00Z', sku: 'BAC10', change: 50, reason: 'New supplier delivery', actor: 'Owner' },
  { at: '2026-10-03T14:02:00Z', sku: 'TB10', change: 1, reason: 'Restock — ORD-10018 refunded', actor: 'System' },
]

// 30 days of demo revenue for the dashboard chart, oldest first.
export const dailySales = Array.from({ length: 30 }, (_, i) => {
  const d = new Date(Date.UTC(2026, 8, 8 + i))
  const wave = Math.sin(i / 3.1) * 38 + Math.cos(i / 1.7) * 21
  const revenue = Math.max(48, Math.round((182 + wave + i * 3.4) * 100) / 100)
  return { date: d.toISOString().slice(0, 10), revenue, orders: Math.max(1, Math.round(revenue / 61)) }
})
