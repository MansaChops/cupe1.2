// Shapes returned by the management APIs (/api/admin/*), shared by the server and the admin pages.
// Money is in pence.

export type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'CANCELLED' | 'REFUNDED' | 'PARTIALLY_REFUNDED'
export type FulfilmentStatus = 'NEW' | 'PACKING' | 'PACKED' | 'SHIPPED' | 'COMPLETED' | 'CANCELLED' | 'REFUNDED'
export type NotificationState = 'PENDING' | 'SENDING' | 'SENT' | 'RETRYING' | 'FAILED' | 'SKIPPED'

export const FULFILMENT_STATUSES: Array<FulfilmentStatus> = ['NEW', 'PACKING', 'PACKED', 'SHIPPED', 'COMPLETED', 'CANCELLED', 'REFUNDED']
export const PAYMENT_STATUSES: Array<PaymentStatus> = ['PENDING', 'PAID', 'CANCELLED', 'REFUNDED']

export type OrderListRow = {
  number: string
  createdAt: string
  customerName: string
  email: string
  city: string
  postcode: string
  totalPence: number
  discountCode: string | null
  paymentStatus: PaymentStatus
  fulfilmentStatus: FulfilmentStatus
  units: number
  itemsSummary: string
  isDemo: boolean
}

export type OrderDetail = {
  number: string
  createdAt: string
  updatedAt: string
  customerName: string
  email: string
  phone: string
  address: string
  city: string
  postcode: string
  country: string
  notes: string
  adminNotes: string
  subtotalPence: number
  shippingPence: number
  discountCode: string | null
  discountPence: number
  totalPence: number
  paymentStatus: PaymentStatus
  fulfilmentStatus: FulfilmentStatus
  trackingNumber: string | null
  paidAt: string | null
  shippedAt: string | null
  completedAt: string | null
  cancelledAt: string | null
  isDemo: boolean
  items: Array<{ id: number; variantId: string; productName: string; variantName: string; sku: string; quantity: number; unitPricePence: number; preOrder: boolean }>
  movements: Array<{ id: number; sku: string; reason: string; delta: number; stockAfter: number; note: string; createdAt: string }>
  notifications: Array<{ id: number; channel: string; event: string; status: NotificationState; attempts: number; lastError: string | null; sentAt: string | null; createdAt: string }>
  timeline: Array<{ at: string; actor: string; action: string; details: Record<string, unknown> }>
}

export type OrderAction =
  | { action: 'mark_paid' }
  | { action: 'mark_unpaid' }
  | { action: 'start_packing' }
  | { action: 'mark_packed' }
  | { action: 'ship'; trackingNumber: string }
  | { action: 'complete' }
  | { action: 'cancel'; restock: boolean }
  | { action: 'mark_refunded'; restock: boolean }
  | { action: 'note'; text: string }
  | { action: 'resend'; channel: 'slack' | 'email' | 'sheets'; event: string }

export type InventoryRow = {
  productId: string
  productName: string
  category: string
  productActive: boolean
  preOrder: boolean
  featured: boolean
  variantId: string
  variantName: string
  sku: string
  pricePence: number
  salePricePence: number | null
  stock: number
  lowStockThreshold: number
  packSize: number
  maxPerOrder: number | null
  active: boolean
  sold30d: number
  isDemo: boolean
}

export type Movement = { id: number; variantId: string; sku: string; productName: string; variantName: string; reason: string; delta: number; stockAfter: number; note: string; actor: string | null; orderNumber: string | null; createdAt: string }

export type DiscountCode = {
  id: number
  code: string
  description: string
  type: 'PERCENT' | 'FIXED' | 'FREE_SHIPPING'
  value: number
  minSubtotalPence: number
  maxUses: number | null
  uses: number
  oncePerCustomer: boolean
  startsAt: string | null
  endsAt: string | null
  active: boolean
  createdAt: string
  revenuePence: number
  discountGivenPence: number
}

export type Report = {
  from: string
  to: string
  kpis: {
    orders: number
    paidOrders: number
    awaitingPayment: number
    awaitingPaymentPence: number
    revenuePaidPence: number
    orderValuePence: number
    averageOrderPence: number
    discountsPence: number
    shippingPence: number
    units: number
    cancelled: number
    toPack: number
    toShip: number
    customers: number
    repeatCustomers: number
  }
  daily: Array<{ date: string; orders: number; revenue: number; paid: number }>
  topProducts: Array<{ label: string; sub: string; units: number; revenuePence: number }>
  byStatus: Array<{ status: FulfilmentStatus; count: number }>
  discounts: Array<{ code: string; uses: number; discountPence: number; revenuePence: number }>
  lowStock: Array<{ variantId: string; productName: string; variantName: string; sku: string; stock: number; lowStockThreshold: number }>
  failedNotifications: Array<{ orderNumber: string; channel: string; event: string; status: NotificationState; lastError: string | null }>
  recent: Array<OrderListRow>
}

/** fetch() wrapper for the management APIs: JSON in and out, server error messages surfaced. */
export async function api<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, ...rest } = init
  const res = await fetch(path, {
    ...rest,
    headers: { ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(rest.headers ?? {}) },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `Request failed (${res.status})`)
  return data as T
}

export const pounds = (pence: number) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(pence / 100)
