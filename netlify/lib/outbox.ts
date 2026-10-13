import { and, eq, inArray, lte, or, sql } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { notifications, orders } from '../../db/schema.js'
import { formatMoney } from '../../src/config/site.js'
import { orderRef } from '../../src/lib/catalogue.js'
import { emailConfigured, ownerEmail, sendEmail } from './email.js'
import { EMAIL_EVENTS, type EmailEvent } from './email-templates.js'
import { sheetsConfigured, syncSheets } from './sheets.js'
import { buildLowStockMessage, buildOrderMessage, postToSlack, slackConfigured, statusMessage } from './slack.js'

// Notification outbox. The database row is written in the same transaction as the change it
// reports; delivery happens afterwards and is retried with backoff (1m, 4m, 16m, 1h, 4h). A
// channel that isn't configured is marked SKIPPED rather than retried forever.

const BACKOFF_MINUTES = [1, 4, 16, 60, 240]
export const MAX_ATTEMPTS = BACKOFF_MINUTES.length + 1
const SEND_LEASE_MS = 2 * 60_000

export type Channel = 'slack' | 'email' | 'sheets'
type Notification = typeof notifications.$inferSelect
type Writer = Pick<typeof db, 'insert'>

class NotConfigured extends Error {}

/**
 * Queues a delivery. With `again`, an existing (order, event, channel) row is reset so it is sent
 * again (used for "Resend" buttons and for Sheets, which resyncs on every change).
 */
export async function enqueue(tx: Writer, orderId: number, channel: Channel, event: string, again = false) {
  const query = tx.insert(notifications).values({ orderId, channel, event })
  const [row] = again
    ? await query
        .onConflictDoUpdate({
          target: [notifications.orderId, notifications.event, notifications.channel],
          set: { status: 'PENDING', attempts: 0, lastError: null, nextAttemptAt: new Date(), sentAt: null },
        })
        .returning({ id: notifications.id })
    : await query.onConflictDoNothing().returning({ id: notifications.id })
  return row?.id
}

async function orderMoney(orderId: number) {
  const [o] = await db.select().from(orders).where(eq(orders.id, orderId))
  return { o, ref: orderRef(o.number), total: formatMoney(o.totalPence / 100) }
}

async function slackFor(n: Notification) {
  if (!slackConfigured()) throw new NotConfigured('Slack is not configured')
  if (n.event === 'order.created') return postToSlack(await buildOrderMessage(n.orderId))
  if (n.event === 'stock.low') return postToSlack(await buildLowStockMessage())
  const { o, ref, total } = await orderMoney(n.orderId)
  const text: Record<string, string> = {
    'order.paid': `💷 Payment received · ${total}`,
    'order.shipped': `🚚 Shipped · tracking ${o.trackingNumber ?? '—'}`,
    'order.cancelled': `✖️ Cancelled · stock returned`,
  }
  return postToSlack(statusMessage(ref, text[n.event] ?? n.event))
}

async function emailFor(n: Notification) {
  if (!emailConfigured()) throw new NotConfigured('Email is not configured')
  const build = EMAIL_EVENTS[n.event as EmailEvent]
  if (!build) throw new Error(`Unknown email event ${n.event}`)
  const email = await build(n.orderId)
  // The owner gets a copy of every invoice.
  await sendEmail({ ...email, bcc: n.event === 'order.invoice' ? ownerEmail() : undefined })
}

/** Claims a notification so overlapping runs never both send it. */
async function claim(id: number) {
  const [n] = await db
    .update(notifications)
    .set({ status: 'SENDING', nextAttemptAt: new Date(Date.now() + SEND_LEASE_MS) })
    .where(
      and(
        eq(notifications.id, id),
        or(inArray(notifications.status, ['PENDING', 'RETRYING']), and(eq(notifications.status, 'SENDING'), lte(notifications.nextAttemptAt, new Date()))),
      ),
    )
    .returning()
  return n
}

async function record(ids: Array<number>, attempts: number, err?: unknown) {
  if (!err) {
    await db.update(notifications).set({ status: 'SENT', attempts, sentAt: new Date(), lastError: null }).where(inArray(notifications.id, ids))
    return
  }
  const message = err instanceof Error ? err.message : String(err)
  if (err instanceof NotConfigured) {
    await db.update(notifications).set({ status: 'SKIPPED', attempts, lastError: message }).where(inArray(notifications.id, ids))
    return
  }
  const delay = BACKOFF_MINUTES[attempts - 1]
  await db
    .update(notifications)
    .set({ status: delay ? 'RETRYING' : 'FAILED', attempts, lastError: message.slice(0, 500), nextAttemptAt: new Date(Date.now() + (delay ?? 0) * 60_000) })
    .where(inArray(notifications.id, ids))
}

/**
 * Attempts one delivery and records the outcome. Never throws: notifications are downstream of
 * the order and must not affect it.
 */
export async function deliver(id: number) {
  const n = await claim(id).catch((e) => console.error('Could not claim notification', id, e))
  if (!n) return
  const attempts = n.attempts + 1
  // Sheets is a full resync, so every other queued Sheets row is satisfied by this one run.
  let batch = [n.id]
  if (n.channel === 'sheets') {
    const others = await db
      .update(notifications)
      .set({ status: 'SENDING', nextAttemptAt: new Date(Date.now() + SEND_LEASE_MS) })
      .where(and(eq(notifications.channel, 'sheets'), inArray(notifications.status, ['PENDING', 'RETRYING']), lte(notifications.nextAttemptAt, new Date())))
      .returning({ id: notifications.id })
    batch = [n.id, ...others.map((o) => o.id)]
  }
  try {
    if (n.channel === 'slack') await slackFor(n)
    else if (n.channel === 'email') await emailFor(n)
    else if (n.channel === 'sheets') {
      if (!sheetsConfigured()) throw new NotConfigured('Google Sheets is not configured')
      await syncSheets()
    } else throw new Error(`Unknown channel ${n.channel}`)
    await record(batch, attempts)
  } catch (err) {
    console.error(`Notification ${n.id} (${n.channel} ${n.event}) failed (attempt ${attempts})`, err)
    await record(batch, attempts, err).catch((e) => console.error('Could not record notification failure', e))
    // Final failure of a customer email or Sheets sync: tell the owner on Slack.
    if (!(err instanceof NotConfigured) && attempts >= MAX_ATTEMPTS && n.channel !== 'slack' && slackConfigured()) {
      const [o] = await db.select({ number: orders.number }).from(orders).where(eq(orders.id, n.orderId))
      await postToSlack(statusMessage(orderRef(o.number), `⚠️ ${n.channel} "${n.event}" failed after ${attempts} attempts: ${err instanceof Error ? err.message : err}`)).catch(() => {})
    }
  }
}

export const deliverAll = async (ids: Array<number>) => {
  for (const id of ids) await deliver(id)
}

/** Everything due now: new rows that were never attempted, retries, and expired send leases. */
export const dueNotifications = () =>
  db
    .select({ id: notifications.id })
    .from(notifications)
    .where(
      and(
        inArray(notifications.status, ['PENDING', 'RETRYING', 'SENDING']),
        lte(notifications.nextAttemptAt, new Date()),
        // A brand-new PENDING row is normally sent by the request that created it; give it a minute.
        sql`(${notifications.status} <> 'PENDING' OR ${notifications.createdAt} < now() - interval '1 minute')`,
      ),
    )
    .orderBy(notifications.id)
    .limit(50)
