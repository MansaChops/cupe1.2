import { useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { CheckCircle2, CircleDashed, ExternalLink, Send } from 'lucide-react'
import { api } from '@/lib/admin-types'
import { ErrorNote, PageHeader, Panel, ReadOnlyNote } from '@/components/admin/ui'

export const Route = createFileRoute('/admin/settings')({
  head: () => ({ meta: [{ title: 'Settings — Management' }] }),
  component: SettingsPage,
})

type Settings = {
  payment: { instructions: string; dueDays: number }
  integrations: {
    slack: { configured: boolean; via: string | null }
    email: { configured: boolean; from: string | null; ownerCopy: string }
    sheets: { configured: boolean; sheetUrl: string | null; serviceAccount: string | null }
    owners: Array<string>
  }
}

const EXAMPLE = `Bank transfer
Account name: Cumbria Peptides
Sort code: 00-00-00
Account number: 00000000`

function SettingsPage() {
  const { admin } = Route.useRouteContext()
  const canEdit = admin.role === 'OWNER'
  const [s, setS] = useState<Settings | null>(null)
  const [instructions, setInstructions] = useState('')
  const [dueDays, setDueDays] = useState('3')
  const [error, setError] = useState('')
  const [saved, setSaved] = useState('')
  const [busy, setBusy] = useState('')
  const [results, setResults] = useState<Record<string, { ok: boolean; message: string }>>({})

  useEffect(() => {
    api<Settings>('/api/admin/settings')
      .then((d) => {
        setS(d)
        setInstructions(d.payment.instructions)
        setDueDays(String(d.payment.dueDays))
      })
      .catch((e) => setError(e.message))
  }, [])

  const savePayment = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy('payment')
    setError('')
    setSaved('')
    try {
      await api('/api/admin/settings/payment', { method: 'PUT', json: { instructions, dueDays: Number(dueDays) || 0 } })
      setSaved('Saved. New invoices will use these details.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.')
    } finally {
      setBusy('')
    }
  }

  const test = async (channel: 'slack' | 'email' | 'sheets') => {
    setBusy(channel)
    try {
      const r = await api<{ message: string }>('/api/admin/settings/test', { method: 'POST', json: { channel } })
      setResults((x) => ({ ...x, [channel]: { ok: true, message: r.message } }))
    } catch (err) {
      setResults((x) => ({ ...x, [channel]: { ok: false, message: err instanceof Error ? err.message : 'Failed.' } }))
    } finally {
      setBusy('')
    }
  }

  const i = s?.integrations
  return (
    <div className="mx-auto max-w-[1100px] px-4 md:px-8 py-6 md:py-8">
      <PageHeader eyebrow="Configuration" title="Settings" />
      {!canEdit && <ReadOnlyNote />}
      <ErrorNote>{error}</ErrorNote>
      {!s && !error && <p className="mt-8 text-sm text-ink-3">Loading…</p>}

      {s && i && (
        <div className="mt-6 grid gap-6">
          <Panel title="Payment details on invoices">
            <form onSubmit={savePayment} className="px-5 pb-5 grid gap-4">
              <p className="text-sm text-ink-2">No payments are taken on the website. Every order emails the customer an invoice; these are the instructions it shows. The order number is always added as the payment reference.</p>
              {!instructions.trim() && <p className="rounded-xl bg-amber-soft px-4 py-3 text-sm text-ink-2">Not set yet. Until you add them, invoices tell customers you’ll email payment details separately.</p>}
              <label className="grid gap-1.5">
                <span className="text-sm font-medium">How customers pay</span>
                <textarea className="field min-h-36 font-mono text-sm" maxLength={2000} disabled={!canEdit} value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder={EXAMPLE} />
              </label>
              <label className="grid gap-1.5 max-w-48">
                <span className="text-sm font-medium">Payment due after (days)</span>
                <input className="field" inputMode="numeric" disabled={!canEdit} value={dueDays} onChange={(e) => setDueDays(e.target.value.replace(/\D/g, ''))} />
              </label>
              {canEdit && (
                <div className="flex items-center gap-3">
                  <button className="btn btn-primary" disabled={busy === 'payment'}>{busy === 'payment' ? 'Saving…' : 'Save payment details'}</button>
                  {saved && <span className="text-sm text-verdigris">{saved}</span>}
                </div>
              )}
            </form>
          </Panel>

          <div className="grid gap-6 md:grid-cols-3">
            <Integration
              title="Slack"
              configured={i.slack.configured}
              detail={i.slack.configured ? `Connected via ${i.slack.via}. Every new order, payment, shipment, cancellation and low-stock alert is posted.` : 'Set SLACK_WEBHOOK_URL in Netlify environment variables to get every order in Slack.'}
              action={canEdit && i.slack.configured ? 'Send test message' : null}
              busy={busy === 'slack'}
              onAction={() => test('slack')}
              result={results.slack}
            />
            <Integration
              title="Email invoices"
              configured={i.email.configured}
              detail={
                i.email.configured
                  ? `Sending from ${i.email.from}. Invoices are copied to ${i.email.ownerCopy}.`
                  : 'Set RESEND_API_KEY and EMAIL_FROM in Netlify environment variables to email invoices, receipts and tracking.'
              }
              action={canEdit && i.email.configured ? 'Send me a test invoice' : null}
              busy={busy === 'email'}
              onAction={() => test('email')}
              result={results.email}
            />
            <Integration
              title="Google Sheets report"
              configured={i.sheets.configured}
              detail={
                i.sheets.configured
                  ? `Orders, Order Items, Inventory, Daily Sales and Discounts tabs are rewritten on every change and nightly. Shared with ${i.sheets.serviceAccount}.`
                  : 'Set GOOGLE_SHEET_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY, then share the sheet with the service account.'
              }
              action={canEdit && i.sheets.configured ? 'Sync now' : null}
              busy={busy === 'sheets'}
              onAction={() => test('sheets')}
              result={results.sheets}
              link={i.sheets.sheetUrl}
            />
          </div>

          <Panel title="Management access">
            <div className="px-5 pb-5 grid gap-3 text-sm text-ink-2">
              <p>
                The management area is hidden: sign in at <span className="font-mono text-ink">/#management</span>. Accounts are Netlify Identity users created by invitation (Netlify →
                Project configuration → Identity → Invite users). The invite email opens a “Create your account” page for their name and password.
              </p>
              <p>
                Owners (full access to change orders, stock, prices, discounts and settings):{' '}
                {i.owners.length ? <span className="font-mono text-ink">{i.owners.join(', ')}</span> : <span className="text-amber">none set in OWNER_EMAILS</span>}. Anyone else with an
                Identity role of admin, packer or viewer can only view.
              </p>
            </div>
          </Panel>
        </div>
      )}
    </div>
  )
}

function Integration(props: {
  title: string
  configured: boolean
  detail: string
  action: string | null
  busy: boolean
  onAction: () => void
  result?: { ok: boolean; message: string }
  link?: string | null
}) {
  return (
    <Panel className="p-5 flex flex-col">
      <div className="flex items-center gap-2">
        {props.configured ? <CheckCircle2 size={18} className="text-verdigris" /> : <CircleDashed size={18} className="text-ink-3" />}
        <h2 className="font-display text-2xl">{props.title}</h2>
      </div>
      <p className={`label mt-2 ${props.configured ? 'text-verdigris' : 'text-ink-3'}`}>{props.configured ? 'Connected' : 'Not set up'}</p>
      <p className="mt-3 text-sm text-ink-2 flex-1">{props.detail}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {props.action && (
          <button className="btn btn-ghost !py-2 text-sm" disabled={props.busy} onClick={props.onAction}><Send size={14} /> {props.busy ? 'Working…' : props.action}</button>
        )}
        {props.link && <a className="btn btn-ghost !py-2 text-sm" href={props.link} target="_blank" rel="noreferrer"><ExternalLink size={14} /> Open</a>}
      </div>
      {props.result && <p className={`mt-3 text-xs ${props.result.ok ? 'text-verdigris' : 'text-oxblood'}`}>{props.result.message}</p>}
    </Panel>
  )
}
