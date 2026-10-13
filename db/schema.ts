import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgSequence,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core'

// Conventions
// - Money is stored as integer pence (exact; never floating point). £12.50 → 1250.
// - `is_demo` marks rows created by the demo seed script. Only those rows are ever removed by
//   "Remove all demo data". Real rows default to false and are never reclassified automatically.
// - No card data is stored anywhere. Payments keep only the provider's reference.

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}
const isDemo = boolean('is_demo').notNull().default(false)

// Customer-facing order numbers (ORD-10001, ORD-10002…). nextval() is atomic across concurrent
// transactions and is never rolled back, so a number is never reused, even after a failed
// insert, a deletion or a restart.
export const orderNumberSeq = pgSequence('order_number_seq', { startWith: 10001 })
// Demo orders draw from their own range so real order numbers stay contiguous.
export const demoOrderNumberSeq = pgSequence('demo_order_number_seq', { startWith: 900001 })

export const userRole = pgEnum('user_role', ['OWNER', 'ADMIN', 'PACKER', 'VIEWER'])
export const paymentStatus = pgEnum('payment_status', ['PENDING', 'PAID', 'FAILED', 'CANCELLED', 'REFUNDED', 'PARTIALLY_REFUNDED'])
export const fulfilmentStatus = pgEnum('fulfilment_status', ['NEW', 'PACKING', 'PACKED', 'SHIPPED', 'COMPLETED', 'CANCELLED', 'REFUNDED'])
export const inventoryReason = pgEnum('inventory_reason', ['INITIAL', 'ORDER', 'CANCELLATION', 'RESTOCK', 'ADJUSTMENT'])
export const webhookStatus = pgEnum('webhook_status', ['RECEIVED', 'PROCESSED', 'FAILED', 'IGNORED'])
export const discountType = pgEnum('discount_type', ['PERCENT', 'FIXED', 'FREE_SHIPPING'])

// Admin accounts. Authentication itself is Netlify Identity; this row links an Identity user to
// audit entries and stock movements.
export const users = pgTable('users', {
  id: serial().primaryKey(),
  identityId: text('identity_id').notNull().unique(),
  email: text().notNull().unique(),
  name: text(),
  role: userRole().notNull().default('VIEWER'),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  ...timestamps,
})

// Guest-checkout customers, one per email address.
export const customers = pgTable(
  'customers',
  {
    id: serial().primaryKey(),
    email: text().notNull(),
    name: text().notNull(),
    phone: text().notNull().default(''),
    address: text().notNull().default(''),
    city: text().notNull().default(''),
    postcode: text().notNull().default(''),
    country: text().notNull().default('United Kingdom'),
    isDemo,
    ...timestamps,
  },
  (t) => [uniqueIndex('customers_email_key').on(sql`lower(${t.email})`)],
)

// IDs are stable text keys (prod_1, var_1_1) because baskets saved in browsers and existing
// order items reference them.
export const products = pgTable(
  'products',
  {
    id: text().primaryKey(),
    slug: text().notNull().unique(),
    name: text().notNull(),
    category: text().notNull(),
    shortDescription: text('short_description').notNull().default(''),
    description: text().notNull().default(''),
    // Uploaded image: a key in the `product-images` Blobs store, served from /media/products/<key>.
    imageKey: text('image_key'),
    // Bundled fallback image in public/img, used until an image is uploaded.
    imageFile: text('image_file'),
    featured: boolean().notNull().default(false),
    active: boolean().notNull().default(true),
    preOrder: boolean('pre_order').notNull().default(false),
    showSizeGuide: boolean('show_size_guide').notNull().default(false),
    sortOrder: integer('sort_order').notNull().default(0),
    isDemo,
    ...timestamps,
  },
  (t) => [index('products_active_sort_idx').on(t.active, t.sortOrder), index('products_category_idx').on(t.category)],
)

export const productVariants = pgTable(
  'product_variants',
  {
    id: text().primaryKey(),
    productId: text('product_id')
      .notNull()
      .references(() => products.id),
    inventoryCode: text('inventory_code').notNull().unique(),
    name: text().notNull(),
    sku: text().notNull().unique(),
    pricePence: integer('price_pence').notNull(),
    salePricePence: integer('sale_price_pence'),
    stock: integer().notNull().default(0),
    lowStockThreshold: integer('low_stock_threshold').notNull().default(5),
    // Sold only in multiples of this many units (e.g. pins in 10s). Prices are per unit.
    packSize: integer('pack_size').notNull().default(1),
    maxPerOrder: integer('max_per_order'),
    active: boolean().notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    isDemo,
    ...timestamps,
  },
  (t) => [
    index('product_variants_product_idx').on(t.productId),
    // The last line of defence against overselling: stock can never go negative.
    check('product_variants_stock_nonnegative', sql`${t.stock} >= 0`),
    check('product_variants_price_positive', sql`${t.pricePence} > 0`),
    check('product_variants_sale_price_valid', sql`${t.salePricePence} IS NULL OR (${t.salePricePence} > 0 AND ${t.salePricePence} <= ${t.pricePence})`),
    check('product_variants_pack_size_positive', sql`${t.packSize} >= 1`),
  ],
)

export const orders = pgTable(
  'orders',
  {
    id: serial().primaryKey(),
    number: integer().notNull().unique().default(sql`nextval('order_number_seq')`),
    // Generated by the browser once per checkout, so a retried submission returns the same order.
    checkoutId: text('checkout_id').unique(),
    customerId: integer('customer_id').references(() => customers.id),
    // Snapshot of the delivery details at the time of the order.
    customerName: text('customer_name').notNull(),
    email: text().notNull(),
    phone: text().notNull(),
    address: text().notNull(),
    city: text().notNull(),
    postcode: text().notNull(),
    country: text().notNull(),
    notes: text().notNull().default(''),
    subtotalPence: integer('subtotal_pence').notNull(),
    shippingPence: integer('shipping_pence').notNull(),
    // Discount code applied at checkout (snapshot of the code text) and the amount it took off.
    discountCode: text('discount_code'),
    discountPence: integer('discount_pence').notNull().default(0),
    totalPence: integer('total_pence').notNull(),
    paymentStatus: paymentStatus('payment_status').notNull().default('PENDING'),
    fulfilmentStatus: fulfilmentStatus('fulfilment_status').notNull().default('NEW'),
    trackingNumber: text('tracking_number'),
    // Internal notes, never shown to the customer.
    adminNotes: text('admin_notes').notNull().default(''),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    shippedAt: timestamp('shipped_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    isDemo,
    ...timestamps,
  },
  (t) => [
    index('orders_created_at_idx').on(t.createdAt),
    index('orders_customer_idx').on(t.customerId),
    index('orders_fulfilment_idx').on(t.fulfilmentStatus),
    check('orders_total_matches', sql`${t.totalPence} = ${t.subtotalPence} + ${t.shippingPence} - ${t.discountPence}`),
    check('orders_discount_valid', sql`${t.discountPence} >= 0 AND ${t.discountPence} <= ${t.subtotalPence} + ${t.shippingPence}`),
  ],
)

// Discount codes entered at checkout. Codes are stored upper-case and matched case-insensitively.
// PERCENT: value is 1–100 (% off the item subtotal). FIXED: value is pence off the item subtotal.
// FREE_SHIPPING: removes the delivery charge (value unused).
export const discountCodes = pgTable(
  'discount_codes',
  {
    id: serial().primaryKey(),
    code: text().notNull(),
    description: text().notNull().default(''),
    type: discountType().notNull(),
    value: integer().notNull().default(0),
    minSubtotalPence: integer('min_subtotal_pence').notNull().default(0),
    // Total redemptions allowed across all customers (null = unlimited).
    maxUses: integer('max_uses'),
    uses: integer().notNull().default(0),
    // Only one use per customer email when true.
    oncePerCustomer: boolean('once_per_customer').notNull().default(false),
    startsAt: timestamp('starts_at', { withTimezone: true }),
    endsAt: timestamp('ends_at', { withTimezone: true }),
    active: boolean().notNull().default(true),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('discount_codes_code_key').on(sql`upper(${t.code})`),
    check('discount_codes_value_valid', sql`(${t.type} = 'PERCENT' AND ${t.value} BETWEEN 1 AND 100) OR (${t.type} = 'FIXED' AND ${t.value} > 0) OR ${t.type} = 'FREE_SHIPPING'`),
    check('discount_codes_uses_valid', sql`${t.uses} >= 0 AND (${t.maxUses} IS NULL OR ${t.uses} <= ${t.maxUses})`),
  ],
)

export const orderItems = pgTable(
  'order_items',
  {
    id: serial().primaryKey(),
    orderId: integer('order_id')
      .notNull()
      .references(() => orders.id),
    variantId: text('variant_id')
      .notNull()
      .references(() => productVariants.id),
    // Snapshot of what was sold, so later catalogue edits never change past orders.
    productName: text('product_name').notNull(),
    variantName: text('variant_name').notNull(),
    sku: text().notNull(),
    quantity: integer().notNull(),
    unitPricePence: integer('unit_price_pence').notNull(),
  },
  (t) => [index('order_items_order_idx').on(t.orderId), check('order_items_quantity_positive', sql`${t.quantity} > 0`)],
)

// One row per payment attempt. Only the provider's reference is kept (e.g. a Stripe
// PaymentIntent ID), never card numbers, CVCs or expiry dates.
export const payments = pgTable(
  'payments',
  {
    id: serial().primaryKey(),
    orderId: integer('order_id')
      .notNull()
      .references(() => orders.id),
    provider: text().notNull().default('manual'),
    providerRef: text('provider_ref'),
    status: paymentStatus().notNull().default('PENDING'),
    amountPence: integer('amount_pence').notNull(),
    refundedPence: integer('refunded_pence').notNull().default(0),
    currency: text().notNull().default('GBP'),
    isDemo,
    ...timestamps,
  },
  (t) => [index('payments_order_idx').on(t.orderId), uniqueIndex('payments_provider_ref_key').on(t.provider, t.providerRef)],
)

// Every stock change, with the resulting level. (order, variant, reason) is unique for ORDER
// movements, so a retried order can never decrement stock twice.
export const inventoryMovements = pgTable(
  'inventory_movements',
  {
    id: serial().primaryKey(),
    variantId: text('variant_id')
      .notNull()
      .references(() => productVariants.id),
    orderId: integer('order_id').references(() => orders.id),
    userId: integer('user_id').references(() => users.id),
    reason: inventoryReason().notNull(),
    delta: integer().notNull(),
    stockAfter: integer('stock_after').notNull(),
    note: text().notNull().default(''),
    isDemo,
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('inventory_movements_variant_idx').on(t.variantId, t.createdAt),
    index('inventory_movements_order_idx').on(t.orderId),
    uniqueIndex('inventory_movements_order_once').on(t.orderId, t.variantId).where(sql`${t.reason} = 'ORDER'`),
  ],
)

// Outbox for downstream channels (Slack now; SMS, email and Sheets later). One row per
// (order, event, channel), so a notification is never sent twice for the same event.
export const notifications = pgTable(
  'notifications',
  {
    id: serial().primaryKey(),
    orderId: integer('order_id')
      .notNull()
      .references(() => orders.id),
    channel: text().notNull(),
    event: text().notNull(),
    status: text().notNull().default('PENDING'),
    attempts: integer().notNull().default(0),
    lastError: text('last_error'),
    nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true }).notNull().defaultNow(),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('notifications_order_event_channel').on(t.orderId, t.event, t.channel)],
)

// Append-only record of administrative actions. Never deleted by demo-data removal.
export const auditLogs = pgTable(
  'audit_logs',
  {
    id: serial().primaryKey(),
    userId: integer('user_id').references(() => users.id),
    actor: text().notNull(),
    action: text().notNull(),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id'),
    details: jsonb().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('audit_logs_entity_idx').on(t.entityType, t.entityId), index('audit_logs_created_at_idx').on(t.createdAt)],
)

// Incoming webhooks (Stripe in the payments milestone). The (provider, event_id) key makes
// duplicate deliveries no-ops.
export const webhookEvents = pgTable(
  'webhook_events',
  {
    id: serial().primaryKey(),
    provider: text().notNull(),
    eventId: text('event_id').notNull(),
    type: text().notNull(),
    status: webhookStatus().notNull().default('RECEIVED'),
    payload: jsonb().notNull(),
    error: text(),
    receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
    processedAt: timestamp('processed_at', { withTimezone: true }),
  },
  (t) => [uniqueIndex('webhook_events_provider_event_key').on(t.provider, t.eventId)],
)

export const settings = pgTable('settings', {
  key: text().primaryKey(),
  value: jsonb().notNull(),
  updatedBy: integer('updated_by').references(() => users.id),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// Editable content pages (legal pages, about). Wired to the admin editor in the settings milestone.
export const pages = pgTable('pages', {
  id: serial().primaryKey(),
  slug: text().notNull().unique(),
  title: text().notNull(),
  body: text().notNull().default(''),
  published: boolean().notNull().default(false),
  isDemo,
  ...timestamps,
})

// Business costs for profit reporting: unit costs per variant, or general expenses.
export const costs = pgTable(
  'costs',
  {
    id: serial().primaryKey(),
    label: text().notNull(),
    category: text().notNull(),
    variantId: text('variant_id').references(() => productVariants.id),
    amountPence: integer('amount_pence').notNull(),
    incurredOn: date('incurred_on').notNull().defaultNow(),
    notes: text().notNull().default(''),
    isDemo,
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('costs_incurred_on_idx').on(t.incurredOn), check('costs_amount_nonnegative', sql`${t.amountPence} >= 0`)],
)
