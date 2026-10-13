import { eq } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { settings } from '../../db/schema.js'

/** How customers pay. Shown on every invoice email. Edited in management → Settings. */
export type PaymentSettings = {
  /** Free text, e.g. bank name, sort code, account number and the reference to use. */
  instructions: string
  /** Days after the order date that payment is due. */
  dueDays: number
}

export const DEFAULT_PAYMENT: PaymentSettings = { instructions: '', dueDays: 3 }

export async function getPaymentSettings(): Promise<PaymentSettings> {
  const [row] = await db.select().from(settings).where(eq(settings.key, 'payment'))
  return { ...DEFAULT_PAYMENT, ...((row?.value as Partial<PaymentSettings>) ?? {}) }
}

export async function savePaymentSettings(value: PaymentSettings, userId: number) {
  await db
    .insert(settings)
    .values({ key: 'payment', value, updatedBy: userId })
    .onConflictDoUpdate({ target: settings.key, set: { value, updatedBy: userId, updatedAt: new Date() } })
}
