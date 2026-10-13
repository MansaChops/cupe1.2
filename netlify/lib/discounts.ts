import { and, eq, ne, sql } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { discountCodes, orders } from '../../db/schema.js'
import { formatMoney } from '../../src/config/site.js'

export type DiscountRow = typeof discountCodes.$inferSelect
type Reader = Pick<typeof db, 'select'>

export const normaliseCode = (code: string) => code.trim().toUpperCase().replace(/\s+/g, '')

/** Rejection with a message that is safe to show to the customer. */
export class DiscountRejected extends Error {}

/** How much a code takes off: a share of the item subtotal, a fixed amount, or the delivery charge. */
export function discountAmount(code: Pick<DiscountRow, 'type' | 'value'>, subtotalPence: number, shippingPence: number) {
  if (code.type === 'FREE_SHIPPING') return shippingPence
  if (code.type === 'PERCENT') return Math.min(subtotalPence, Math.round((subtotalPence * code.value) / 100))
  return Math.min(subtotalPence, code.value)
}

/** Human-readable summary, e.g. "10% off", "£5.00 off", "Free delivery". */
export function describeDiscount(code: Pick<DiscountRow, 'type' | 'value'>) {
  if (code.type === 'FREE_SHIPPING') return 'Free delivery'
  if (code.type === 'PERCENT') return `${code.value}% off`
  return `${formatMoney(code.value / 100)} off`
}

/**
 * Checks a code can be used for this basket and customer. Throws DiscountRejected otherwise.
 * `reader` is the transaction when called while placing an order, so the use-count check sees
 * the locked row.
 */
export async function checkDiscount(reader: Reader, code: DiscountRow | undefined, subtotalPence: number, email?: string, now = new Date()) {
  if (!code || !code.active) throw new DiscountRejected('That discount code isn’t valid.')
  if (code.startsAt && code.startsAt > now) throw new DiscountRejected('That discount code isn’t active yet.')
  if (code.endsAt && code.endsAt < now) throw new DiscountRejected('That discount code has expired.')
  if (code.maxUses !== null && code.uses >= code.maxUses) throw new DiscountRejected('That discount code has been fully redeemed.')
  if (subtotalPence < code.minSubtotalPence) {
    throw new DiscountRejected(`That code needs an order of at least ${formatMoney(code.minSubtotalPence / 100)} before delivery.`)
  }
  if (code.oncePerCustomer && email) {
    const [used] = await reader
      .select({ n: sql<number>`count(*)::int` })
      .from(orders)
      .where(and(sql`upper(${orders.discountCode}) = ${code.code.toUpperCase()}`, sql`lower(${orders.email}) = lower(${email})`, ne(orders.fulfilmentStatus, 'CANCELLED')))
    if (used.n > 0) throw new DiscountRejected('You’ve already used that discount code.')
  }
}

export async function findDiscount(reader: Reader, code: string) {
  const [row] = await reader.select().from(discountCodes).where(sql`upper(${discountCodes.code}) = ${normaliseCode(code)}`)
  return row
}

/** Read-only preview for the checkout page. The order transaction checks everything again. */
export async function previewDiscount(code: string, subtotalPence: number, shippingPence: number, email?: string) {
  const row = await findDiscount(db, code)
  await checkDiscount(db, row, subtotalPence, email)
  return {
    code: row!.code.toUpperCase(),
    label: describeDiscount(row!),
    discountPence: discountAmount(row!, subtotalPence, shippingPence),
  }
}

/** Gives a redemption back when its order is cancelled. */
export async function releaseDiscount(tx: Pick<typeof db, 'update'>, code: string | null) {
  if (!code) return
  await tx
    .update(discountCodes)
    .set({ uses: sql`greatest(${discountCodes.uses} - 1, 0)`, updatedAt: new Date() })
    .where(eq(sql`upper(${discountCodes.code})`, code.toUpperCase()))
}
