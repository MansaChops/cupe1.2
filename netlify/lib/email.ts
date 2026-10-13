import { site } from '../../src/config/site.js'

// Transactional email through Resend (https://resend.com). Credentials stay server-side.
//   RESEND_API_KEY  API key
//   EMAIL_FROM      Sender, e.g. "Cumbria Peptides <orders@yourdomain.co.uk>" (domain verified in Resend)
//   OWNER_EMAIL     Owner copy of every invoice (BCC) and the reply-to address for customers

export const emailConfigured = () => !!process.env.RESEND_API_KEY && !!process.env.EMAIL_FROM
export const ownerEmail = () => process.env.OWNER_EMAIL?.trim() || site.email

export type Email = { to: string; subject: string; html: string; text: string; bcc?: string; replyTo?: string; idempotencyKey?: string }

export async function sendEmail(email: Email) {
  if (!emailConfigured()) throw new Error('Email is not configured: set RESEND_API_KEY and EMAIL_FROM')
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
      // Resend drops a repeat with the same key, so an outbox retry after a timeout can't double-send.
      ...(email.idempotencyKey ? { 'Idempotency-Key': email.idempotencyKey } : {}),
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM,
      to: [email.to],
      bcc: email.bcc ? [email.bcc] : undefined,
      reply_to: email.replyTo ?? ownerEmail(),
      subject: email.subject,
      html: email.html,
      text: email.text,
    }),
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) throw new Error(`Resend responded ${res.status}: ${(await res.text()).slice(0, 200)}`)
}
