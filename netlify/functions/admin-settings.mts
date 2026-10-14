import type { Config } from '@netlify/functions'
import { desc } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../../db/index.js'
import { auditLogs, orders } from '../../db/schema.js'
import { READ_ROLES, WRITE_ROLES, ownerEmails, requireAdmin } from '../lib/auth.js'
import { emailConfigured, ownerEmail, sendEmail } from '../lib/email.js'
import { invoiceEmail } from '../lib/email-templates.js'
import { getPaymentSettings, savePaymentSettings } from '../lib/settings.js'
import { sheetsConfigured, syncSheets } from '../lib/sheets.js'
import { postToSlack, slackConfigured, statusMessage } from '../lib/slack.js'

const headers = { 'Cache-Control': 'no-store' }
const err = (status: number, error: string) => Response.json({ error }, { status, headers })

const Payment = z.object({ instructions: z.string().trim().max(2000), dueDays: z.number().int().min(0).max(60) })
const Test = z.object({ channel: z.enum(['slack', 'email', 'sheets']) })

const status = () => ({
  slack: { configured: slackConfigured(), via: process.env.SLACK_WEBHOOK_URL ? 'Incoming webhook' : process.env.SLACK_BOT_TOKEN ? 'Bot token' : null },
  email: { configured: emailConfigured(), from: process.env.EMAIL_FROM ?? null, ownerCopy: ownerEmail() },
  sheets: {
    configured: sheetsConfigured(),
    sheetUrl: process.env.GOOGLE_SHEET_ID ? `https://docs.google.com/spreadsheets/d/${process.env.GOOGLE_SHEET_ID}/edit` : null,
    serviceAccount: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ?? null,
  },
  owners: ownerEmails(),
})

/**
 * GET  /api/admin/settings          → payment instructions and integration status (no secrets)
 * PUT  /api/admin/settings/payment  → save payment instructions shown on invoices (OWNER)
 * POST /api/admin/settings/test     → send a test Slack message / email, or run a full Sheets sync (OWNER)
 */
export default async (req: Request) => {
  const admin = await requireAdmin(req, req.method === 'GET' ? READ_ROLES : WRITE_ROLES)
  if (admin instanceof Response) return admin
  const path = new URL(req.url).pathname.replace(/\/+$/, '')

  try {
    if (req.method === 'GET' && path === '/api/admin/settings') {
      return Response.json({ payment: await getPaymentSettings(), integrations: status() }, { headers })
    }
    if (req.method === 'PUT' && path === '/api/admin/settings/payment') {
      const parsed = Payment.safeParse(await req.json().catch(() => null))
      if (!parsed.success) return err(400, 'Check the payment details and try again.')
      await savePaymentSettings(parsed.data, admin.id)
      await db.insert(auditLogs).values({ userId: admin.id, actor: admin.name ?? admin.email, action: 'settings.payment', entityType: 'settings', entityId: 'payment', details: { dueDays: parsed.data.dueDays } })
      return Response.json({ ok: true }, { headers })
    }
    if (req.method === 'POST' && path === '/api/admin/settings/test') {
      const parsed = Test.safeParse(await req.json().catch(() => null))
      if (!parsed.success) return err(400, 'Unknown test.')
      if (parsed.data.channel === 'slack') {
        await postToSlack(statusMessage('TEST', `Slack is connected. Sent from management by ${admin.name ?? admin.email}.`))
        return Response.json({ ok: true, message: 'Test message posted to Slack.' }, { headers })
      }
      if (parsed.data.channel === 'email') {
        // Sends a copy of the latest invoice (or a plain test) to the owner, never to a customer.
        const [latest] = await db.select({ id: orders.id }).from(orders).orderBy(desc(orders.id)).limit(1)
        const sample = latest ? await invoiceEmail(latest.id) : null
        await sendEmail({
          to: ownerEmail(),
          subject: sample ? `[TEST] ${sample.subject}` : '[TEST] Cumbria Peptides email is connected',
          html: sample?.html ?? '<p>Email is connected.</p>',
          text: sample?.text ?? 'Email is connected.',
        })
        return Response.json({ ok: true, message: `Test email sent to ${ownerEmail()}${sample ? ' (a copy of the latest invoice)' : ''}.` }, { headers })
      }
      const result = await syncSheets()
      const summary = Object.entries(result.tabs).map(([t, n]) => `${t}: ${n}`).join(', ')
      return Response.json({ ok: true, message: `Google Sheet updated — ${summary}.` }, { headers })
    }
  } catch (e) {
    console.error(`[admin-settings] ${req.method} ${path} failed`, e)
    return err(502, e instanceof Error ? e.message : 'Something went wrong.')
  }
  return err(404, 'Not found')
}

export const config: Config = { path: ['/api/admin/settings', '/api/admin/settings/payment', '/api/admin/settings/test'], method: ['GET', 'PUT', 'POST'] }
