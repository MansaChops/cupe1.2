import { useEffect, useState } from 'react'
import { Link, createFileRoute, notFound } from '@tanstack/react-router'
import { ArrowLeft, Banknote, Check, CheckCircle2, Printer, RotateCcw, Send, Truck, Undo2, XCircle } from 'lucide-react'
import { site } from '@/config/site'
import { api, pounds, type FulfilmentStatus, type OrderAction, type OrderDetail } from '@/lib/admin-types'
import { ErrorNote, IntegrationDot, Panel, PaymentBadge, StatusBadge, fmtDate } from '@/components/admin/ui'

export const Route = createFileRoute('/admin/orders/$orderNumber')({
  loader: ({ params }) => {
    if (!/^ORD-\d+$/.test(params.orderNumber)) throw notFound()
    return params.orderNumber
  },
  head: ({ loaderData }) => ({ meta: [{ title: `${loaderData} — Management` }] }),
  component: OrderPage,
})

const FLOW: Array<FulfilmentStatus> = ['NEW', 'PACKING', 'PACKED', 'SHIPPED', 'COMPLETED']

type Act = (input: OrderAction, confirmText?: string) => Promise<boolean>

function OrderPage() {
  const orderNumber = Route.useLoaderData()
  const { admin } = Route.useRouteContext()
  const canEdit = admin.role === 'OWNER'
  const [order, setOrder] = useState<OrderDetail | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const load = () =>
    api<OrderDetail>(`/api/admin/orders/${orderNumber}`)
      .then(setOrder)
      .catch((e) => setError(e.message))
  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderNumber])

  const act: Act = async (input, confirmText) => {
    if (confirmText && !confirm(confirmText)) return false
    setBusy(true)
    setError('')
    try {
      setOrder(await api<OrderDetail>(`/api/admin/orders/${orderNumber}`, { method: 'POST', json: input }))
      // Notifications are delivered in the background; refresh shortly to show their status.
      setTimeout(load, 2500)
      return true
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.')
      return false
    } finally {
      setBusy(false)
    }
  }

  if (!order) {
    return (
      <div className="mx-auto max-w-[1400px] px-4 md:px-8 py-8">
        <Link to="/admin/orders" className="inline-flex items-center gap-1.5 text-sm text-ink-2 hover:text-ink"><ArrowLeft size={15} /> Orders</Link>
        {error ? <ErrorNote>{error}</ErrorNote> : <p className="mt-8 text-sm text-ink-3">Loading {orderNumber}…</p>}
      </div>
    )
  }

  return (
    <>
      <div className="no-print mx-auto max-w-[1400px] px-4 md:px-8 py-6 md:py-8">
        <Link to="/admin/orders" className="inline-flex items-center gap-1.5 text-sm text-ink-2 hover:text-ink">
          <ArrowLeft size={15} /> Orders
        </Link>
        <header className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-mono text-3xl md:text-4xl font-medium tracking-tight">
              {order.number}
              {order.isDemo && <span className="label align-middle ml-3 rounded-full bg-amber-soft text-amber px-2 py-0.5 text-[11px]">Demo</span>}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-ink-2">
              <StatusBadge status={order.fulfilmentStatus} />
              <PaymentBadge status={order.paymentStatus} />
              <span>Placed {fmtDate(order.createdAt)}</span>
            </div>
          </div>
          <button className="btn btn-ghost !py-2 text-sm" onClick={() => window.print()}>
            <Printer size={15} /> Print packing slip
          </button>
        </header>

        <ErrorNote>{error}</ErrorNote>
        <Stepper status={order.fulfilmentStatus} />

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <div className="grid gap-6 content-start">
            <PaymentPanel order={order} act={act} busy={busy} canEdit={canEdit} />
            <Workflow order={order} act={act} busy={busy} canEdit={canEdit} />
            <Items order={order} />
            <Notes order={order} act={act} busy={busy} canEdit={canEdit} />
          </div>
          <div className="grid gap-6 content-start">
            <Panel title="Customer">
              <div className="px-5 pb-5 text-sm grid gap-4">
                <div>
                  <p className="font-medium">{order.customerName}</p>
                  <a className="text-ink-2 hover:text-ink block" href={`mailto:${order.email}?subject=${encodeURIComponent(`Your order ${order.number}`)}`}>{order.email}</a>
                  <a className="text-ink-2 hover:text-ink block" href={`tel:${order.phone.replace(/\s/g, '')}`}>{order.phone}</a>
                </div>
                <div className="border-t border-line pt-4">
                  <p className="label text-ink-3 mb-1.5">Delivery address</p>
                  <address className="not-italic leading-relaxed">{order.customerName}<br />{order.address}<br />{order.city}<br />{order.postcode}<br />{order.country}</address>
                </div>
                {order.trackingNumber && (
                  <div className="border-t border-line pt-4">
                    <p className="label text-ink-3 mb-1.5">Tracking</p>
                    <a className="font-mono hover:text-verdigris" href={`https://www.royalmail.com/track-your-item#/tracking-results/${encodeURIComponent(order.trackingNumber.replace(/\s/g, ''))}`} target="_blank" rel="noreferrer">{order.trackingNumber}</a>
                  </div>
                )}
              </div>
            </Panel>
            <Integrations order={order} act={act} busy={busy} canEdit={canEdit} />
            <Panel title="Inventory movements">
              {order.movements.length ? (
                <ul className="border-t border-line divide-y divide-line text-sm">
                  {order.movements.map((m) => (
                    <li key={m.id} className="flex justify-between gap-3 px-5 py-2.5">
                      <span className="font-mono text-xs">{m.sku}</span>
                      <span className="text-ink-3 text-xs flex-1 truncate">{m.note || m.reason}</span>
                      <span className={`font-mono ${m.delta < 0 ? 'text-oxblood' : 'text-verdigris'}`}>{m.delta > 0 ? `+${m.delta}` : `−${-m.delta}`}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-5 pb-5 text-sm text-ink-3">No stock movements recorded.</p>
              )}
            </Panel>
            <Timeline order={order} />
          </div>
        </div>
      </div>
      <PackingSlip order={order} />
    </>
  )
}

function Stepper({ status }: { status: FulfilmentStatus }) {
  const idx = FLOW.indexOf(status)
  if (idx < 0) return null
  return (
    <ol className="mt-6 grid grid-cols-5 gap-1">
      {FLOW.map((s, i) => (
        <li key={s} className="grid gap-1.5">
          <span className={`h-1 rounded-full ${i <= idx ? 'bg-verdigris' : 'bg-line'}`} />
          <span className={`label text-[10px] ${i === idx ? 'text-ink' : 'text-ink-3'}`}>{s}</span>
        </li>
      ))}
    </ol>
  )
}

type PanelProps = { order: OrderDetail; act: Act; busy: boolean; canEdit: boolean }

function PaymentPanel({ order, act, busy, canEdit }: PanelProps) {
  const closed = order.fulfilmentStatus === 'CANCELLED' || order.fulfilmentStatus === 'REFUNDED'
  return (
    <Panel className="p-5 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="label text-ink-3">Payment · invoice {order.number}</p>
          {order.paymentStatus === 'PAID' ? (
            <p className="font-display text-3xl mt-1 text-verdigris">Paid {pounds(order.totalPence)}</p>
          ) : order.paymentStatus === 'PENDING' ? (
            <p className="font-display text-3xl mt-1">Awaiting {pounds(order.totalPence)}</p>
          ) : (
            <p className="font-display text-3xl mt-1 text-ink-2">{order.paymentStatus[0] + order.paymentStatus.slice(1).toLowerCase()}</p>
          )}
          <p className="text-sm text-ink-2 mt-1">
            {order.paidAt ? `Marked paid ${fmtDate(order.paidAt)}.` : 'No payment is taken online: the customer was emailed an invoice with your payment details.'}
          </p>
        </div>
        {canEdit && order.paymentStatus === 'PENDING' && !closed && (
          <button className="btn btn-primary w-full sm:w-auto" disabled={busy} onClick={() => act({ action: 'mark_paid' }, `Mark ${order.number} as paid (${pounds(order.totalPence)})? The customer will get a payment receipt email.`)}>
            <Banknote size={16} /> Mark as paid
          </button>
        )}
      </div>
      {canEdit && order.paymentStatus === 'PAID' && (
        <div className="mt-4 flex flex-wrap gap-4 border-t border-line pt-3 text-sm">
          <button className="inline-flex items-center gap-1.5 text-ink-3 hover:text-ink" disabled={busy} onClick={() => act({ action: 'mark_unpaid' }, 'Undo "paid"? Use this only if it was marked paid by mistake.')}>
            <Undo2 size={14} /> Undo paid
          </button>
          <button
            className="inline-flex items-center gap-1.5 text-oxblood hover:underline ml-auto"
            disabled={busy}
            onClick={() => act({ action: 'mark_refunded', restock: true }, `Mark ${order.number} as refunded? Send the refund to the customer yourself first.${['NEW', 'PACKING', 'PACKED'].includes(order.fulfilmentStatus) ? ' The order won’t be shipped and its stock will be returned.' : ''}`)}
          >
            <RotateCcw size={14} /> Mark refunded
          </button>
        </div>
      )}
    </Panel>
  )
}

function Workflow({ order, act, busy, canEdit }: PanelProps) {
  const checks = [
    ...order.items.map((i) => ({ id: `i${i.id}`, label: `${i.productName} ${i.variantName} × ${i.quantity}`, sub: i.sku })),
    { id: 'qty', label: `Quantity verified (${order.items.reduce((n, i) => n + i.quantity, 0)} units)` },
    { id: 'addr', label: `Address verified — ${order.postcode}` },
    { id: 'seal', label: 'Package sealed' },
  ]
  // Ticks are kept per order in this browser, so a refresh mid-pack doesn't lose them.
  const key = `cumbria.packing.${order.number}`
  const [ticked, setTicked] = useState<Set<string> | null>(null)
  useEffect(() => {
    try {
      setTicked(new Set(JSON.parse(localStorage.getItem(key) ?? '[]')))
    } catch {
      setTicked(new Set())
    }
  }, [key])
  useEffect(() => {
    if (ticked) localStorage.setItem(key, JSON.stringify([...ticked]))
  }, [key, ticked])
  const [tracking, setTracking] = useState('')
  const isTicked = (id: string) => !!ticked?.has(id)
  const allTicked = checks.every((x) => isTicked(x.id))
  const toggle = (id: string) => setTicked((s) => { const n = new Set(s ?? []); n.has(id) ? n.delete(id) : n.add(id); return n })
  const cancellable = ['NEW', 'PACKING', 'PACKED'].includes(order.fulfilmentStatus)
  const unpaid = order.paymentStatus !== 'PAID'

  if (!canEdit) {
    return (
      <Panel className="p-5 md:p-6">
        <p className="font-display text-3xl">{order.fulfilmentStatus[0] + order.fulfilmentStatus.slice(1).toLowerCase()}</p>
        <p className="text-sm text-ink-2 mt-1">You have view-only access. Only the owner can update orders.</p>
      </Panel>
    )
  }

  return (
    <Panel className="overflow-hidden">
      <div className="p-5 md:p-6">
        {unpaid && cancellable && (
          <p className="mb-4 rounded-xl bg-amber-soft px-4 py-2.5 text-sm text-ink-2">Not paid yet. You can still pack it, but don’t ship until payment arrives.</p>
        )}
        {order.fulfilmentStatus === 'NEW' && (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="font-display text-3xl">Ready to pack</p>
              <p className="text-sm text-ink-2 mt-1">{order.items.reduce((n, i) => n + i.quantity, 0)} units across {order.items.length} lines.</p>
            </div>
            <button className="btn btn-primary !px-8 !py-4 w-full sm:w-auto" disabled={busy} onClick={() => act({ action: 'start_packing' })}>Start packing</button>
          </div>
        )}

        {order.fulfilmentStatus === 'PACKING' && (
          <>
            <div className="flex items-baseline justify-between">
              <p className="font-display text-3xl">Packing checklist</p>
              <span className="font-mono text-sm text-ink-3">{checks.filter((x) => isTicked(x.id)).length}/{checks.length}</span>
            </div>
            <ul className="mt-4 grid gap-2">
              {checks.map((x) => {
                const on = isTicked(x.id)
                return (
                  <li key={x.id}>
                    <button
                      onClick={() => toggle(x.id)}
                      className={`w-full flex items-center gap-4 rounded-xl border px-4 py-3.5 text-left transition ${on ? 'border-verdigris bg-verdigris-soft/60' : 'border-line hover:border-ink-3'}`}
                      aria-pressed={on}
                    >
                      <span className={`grid place-items-center w-6 h-6 rounded-md border shrink-0 transition ${on ? 'bg-verdigris border-verdigris text-paper' : 'border-ink-3'}`}>
                        {on && <Check size={15} strokeWidth={3} />}
                      </span>
                      <span className={`flex-1 ${on ? 'text-ink-2' : ''}`}>{x.label}</span>
                      {'sub' in x && <span className="font-mono text-xs text-ink-3">{x.sub}</span>}
                    </button>
                  </li>
                )
              })}
            </ul>
            <button className="btn btn-primary w-full mt-5 !py-4" disabled={!allTicked || busy} onClick={() => act({ action: 'mark_packed' })}>
              {allTicked ? 'Mark as packed' : 'Tick every item to mark packed'}
            </button>
          </>
        )}

        {order.fulfilmentStatus === 'PACKED' && (
          <form
            onSubmit={async (e) => {
              e.preventDefault()
              if (!tracking.trim()) return
              if (await act({ action: 'ship', trackingNumber: tracking }, unpaid ? 'This order isn’t marked paid. Ship it anyway?' : undefined)) {
                localStorage.removeItem(key)
              }
            }}
          >
            <p className="font-display text-3xl">Packed — ready to ship</p>
            <p className="text-sm text-ink-2 mt-1">Enter the Royal Mail tracking number. The customer is emailed it when you mark shipped.</p>
            <div className="mt-4 flex flex-col sm:flex-row gap-2">
              <input className="field font-mono uppercase" placeholder="e.g. QA 1234 5678 9GB" value={tracking} onChange={(e) => setTracking(e.target.value)} />
              <button className="btn btn-primary !py-3 shrink-0" disabled={!tracking.trim() || busy}><Truck size={16} /> Mark as shipped</button>
            </div>
          </form>
        )}

        {order.fulfilmentStatus === 'SHIPPED' && (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="font-display text-3xl">On its way</p>
              <p className="text-sm text-ink-2 mt-1">Tracking <span className="font-mono">{order.trackingNumber}</span>. Mark completed once delivered.</p>
            </div>
            <button className="btn btn-primary w-full sm:w-auto" disabled={busy} onClick={() => act({ action: 'complete' })}><CheckCircle2 size={16} /> Mark completed</button>
          </div>
        )}

        {['COMPLETED', 'CANCELLED', 'REFUNDED'].includes(order.fulfilmentStatus) && (
          <p className="font-display text-3xl">
            {order.fulfilmentStatus === 'COMPLETED' ? 'Order completed' : order.fulfilmentStatus === 'CANCELLED' ? 'Order cancelled' : 'Order refunded'}
            <span className="block font-sans text-sm text-ink-2 mt-1">No further fulfilment actions.</span>
          </p>
        )}
      </div>

      {cancellable && (
        <div className="flex flex-wrap gap-2 border-t border-line bg-paper/50 px-5 py-3">
          <button
            className="inline-flex items-center gap-1.5 text-sm text-oxblood hover:underline"
            disabled={busy}
            onClick={() =>
              act(
                { action: 'cancel', restock: true },
                `Cancel ${order.number}? Stock is returned, any discount code use is released, and the customer is emailed.${order.paymentStatus === 'PAID' ? ' It’s been paid, so refund the customer, then use "Mark refunded".' : ''}`,
              )
            }
          >
            <XCircle size={15} /> Cancel order
          </button>
        </div>
      )}
    </Panel>
  )
}

function Items({ order }: { order: OrderDetail }) {
  const units = order.items.reduce((n, i) => n + i.quantity, 0)
  return (
    <Panel title={`Items · ${units} units`}>
      <table className="w-full text-sm border-t border-line">
        <thead className="label text-ink-3 text-left">
          <tr><th className="font-normal px-5 py-2.5">Product</th><th className="font-normal">SKU</th><th className="font-normal text-center">Qty</th><th className="font-normal text-right hidden sm:table-cell">Unit</th><th className="font-normal text-right px-5">Total</th></tr>
        </thead>
        <tbody className="divide-y divide-line">
          {order.items.map((i) => (
            <tr key={i.id}>
              <td className="px-5 py-3">{i.productName} <span className="text-ink-3">{i.variantName}</span>{i.preOrder && <span className="label ml-2 text-amber">Pre-order</span>}</td>
              <td className="font-mono text-xs">{i.sku}</td>
              <td className="text-center font-mono">{i.quantity}</td>
              <td className="text-right hidden sm:table-cell">{pounds(i.unitPricePence)}</td>
              <td className="text-right px-5">{pounds(i.unitPricePence * i.quantity)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <dl className="border-t border-line px-5 py-4 grid gap-1.5 text-sm ml-auto max-w-xs">
        <div className="flex justify-between"><dt className="text-ink-2">Subtotal</dt><dd>{pounds(order.subtotalPence)}</dd></div>
        <div className="flex justify-between"><dt className="text-ink-2">Delivery</dt><dd>{order.shippingPence ? pounds(order.shippingPence) : 'Free'}</dd></div>
        {order.discountPence > 0 && (
          <div className="flex justify-between text-verdigris"><dt>Discount <span className="font-mono text-xs">{order.discountCode}</span></dt><dd>−{pounds(order.discountPence)}</dd></div>
        )}
        <div className="flex justify-between font-medium text-base pt-1"><dt>Total</dt><dd>{pounds(order.totalPence)}</dd></div>
      </dl>
    </Panel>
  )
}

function Notes({ order, act, busy, canEdit }: PanelProps) {
  const [note, setNote] = useState('')
  return (
    <Panel title="Notes">
      <div className="px-5 pb-5 grid gap-4 text-sm">
        <div>
          <p className="label text-ink-3 mb-1">Customer note</p>
          <p className={order.notes ? '' : 'text-ink-3'}>{order.notes || 'None'}</p>
        </div>
        <div className="border-t border-line pt-4">
          <p className="label text-ink-3 mb-1">Internal notes · never shown to the customer</p>
          {order.adminNotes && <p className="whitespace-pre-line mb-3">{order.adminNotes}</p>}
          {canEdit && (
            <form
              className="flex gap-2"
              onSubmit={async (e) => {
                e.preventDefault()
                if (note.trim() && (await act({ action: 'note', text: note.trim() }))) setNote('')
              }}
            >
              <input className="field !py-2 text-sm" placeholder="Add a note…" value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} />
              <button className="btn btn-ghost !py-2 text-sm shrink-0" disabled={!note.trim() || busy}>Add note</button>
            </form>
          )}
        </div>
      </div>
    </Panel>
  )
}

const notificationLabel: Record<string, string> = {
  'slack:order.created': 'Slack · new order',
  'slack:order.paid': 'Slack · payment received',
  'slack:order.shipped': 'Slack · shipped',
  'slack:order.cancelled': 'Slack · cancelled',
  'slack:stock.low': 'Slack · low stock alert',
  'email:order.invoice': 'Email · invoice to customer',
  'email:order.paid': 'Email · payment receipt',
  'email:order.shipped': 'Email · shipped with tracking',
  'email:order.cancelled': 'Email · cancellation',
  'sheets:order.created': 'Google Sheets · new order',
  'sheets:order.updated': 'Google Sheets · update',
}

function Integrations({ order, act, busy, canEdit }: PanelProps) {
  const hasInvoice = order.notifications.some((n) => n.channel === 'email' && n.event === 'order.invoice')
  return (
    <Panel
      title="Notifications & sync"
      action={
        canEdit && (
          <button className="inline-flex items-center gap-1.5 text-xs text-verdigris hover:underline" disabled={busy} onClick={() => act({ action: 'resend', channel: 'email', event: 'order.invoice' }, `Email the invoice to ${order.email} again?`)}>
            <Send size={12} /> {hasInvoice ? 'Resend invoice' : 'Send invoice'}
          </button>
        )
      }
    >
      {order.notifications.length ? (
        <ul className="border-t border-line divide-y divide-line">
          {order.notifications.map((n) => (
            <li key={n.id} className="px-5 py-3 text-sm">
              <div className="flex items-center gap-3">
                <IntegrationDot status={n.status} />
                <span className="flex-1">{notificationLabel[`${n.channel}:${n.event}`] ?? `${n.channel} · ${n.event}`}</span>
                <span className="text-xs text-ink-3">{n.status === 'SENT' && n.sentAt ? fmtDate(n.sentAt) : `${n.status.toLowerCase()}${n.attempts ? ` · ${n.attempts} tries` : ''}`}</span>
              </div>
              {(n.status === 'FAILED' || n.status === 'RETRYING' || n.status === 'SKIPPED') && (
                <div className={`mt-2 ml-5 rounded-lg px-3 py-2 ${n.status === 'SKIPPED' ? 'bg-paper-2' : 'bg-oxblood-soft/60'}`}>
                  <p className={`text-xs ${n.status === 'SKIPPED' ? 'text-ink-3' : 'text-oxblood'}`}>{n.lastError}{n.status === 'SKIPPED' && ' — set it up in Settings.'}</p>
                  {canEdit && n.status !== 'SKIPPED' && (
                    <button onClick={() => act({ action: 'resend', channel: n.channel as 'slack' | 'email' | 'sheets', event: n.event })} disabled={busy} className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-ink hover:underline">
                      <RotateCcw size={12} /> Retry now
                    </button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-5 pb-5 text-sm text-ink-3">Nothing sent for this order yet.</p>
      )}
    </Panel>
  )
}

const actionLabel: Record<string, string> = {
  'order.placed': 'Order placed',
  'order.mark_paid': 'Marked paid',
  'order.mark_unpaid': 'Paid status undone',
  'order.start_packing': 'Packing started',
  'order.mark_packed': 'Packed',
  'order.ship': 'Shipped',
  'order.complete': 'Completed',
  'order.cancel': 'Cancelled',
  'order.mark_refunded': 'Marked refunded',
  'order.note': 'Note added',
  'order.resend': 'Notification re-sent',
}

function Timeline({ order }: { order: OrderDetail }) {
  return (
    <Panel title="Timeline">
      <ol className="px-5 pb-5 grid gap-4">
        {[...order.timeline].reverse().map((t, i) => (
          <li key={i} className="grid grid-cols-[12px_1fr] gap-3 text-sm">
            <span className={`mt-1.5 w-2 h-2 rounded-full ${i === 0 ? 'bg-verdigris' : 'bg-line'}`} />
            <span>
              {actionLabel[t.action] ?? t.action}
              {typeof t.details.trackingNumber === 'string' && <span className="font-mono text-ink-2"> · {t.details.trackingNumber}</span>}
              {typeof t.details.event === 'string' && <span className="text-ink-2"> · {String(t.details.channel)} {t.details.event}</span>}
              <span className="block text-xs text-ink-3">{fmtDate(t.at)} · {t.actor}</span>
            </span>
          </li>
        ))}
      </ol>
    </Panel>
  )
}

function PackingSlip({ order }: { order: OrderDetail }) {
  return (
    <section className="hidden print:block p-10 text-ink font-sans text-sm">
      <div className="flex justify-between items-start border-b border-ink pb-5">
        <div>
          <p className="font-display text-3xl">{site.name}</p>
          <p className="text-xs mt-1">{site.address}</p>
        </div>
        <div className="text-right">
          <p className="label">Packing slip</p>
          <p className="font-mono text-2xl mt-1">{order.number}</p>
          <p className="text-xs">{fmtDate(order.createdAt, false)}</p>
        </div>
      </div>
      <div className="mt-6">
        <p className="label mb-1">Deliver to</p>
        <address className="not-italic text-base leading-relaxed">{order.customerName}<br />{order.address}<br />{order.city}<br />{order.postcode}<br />{order.country}</address>
      </div>
      <table className="w-full mt-8 border-collapse">
        <thead><tr className="label text-left border-b border-ink"><th className="py-2 w-8">✓</th><th className="py-2 font-normal">Product</th><th className="py-2 font-normal">SKU</th><th className="py-2 font-normal text-right">Qty</th></tr></thead>
        <tbody>
          {order.items.map((i) => (
            <tr key={i.id} className="border-b border-line">
              <td className="py-3"><span className="inline-block w-4 h-4 border border-ink" /></td>
              <td className="py-3">{i.productName} {i.variantName}</td>
              <td className="py-3 font-mono">{i.sku}</td>
              <td className="py-3 text-right font-mono text-base">{i.quantity}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-8 grid gap-2">
        {['Quantity verified', 'Address verified', 'Package sealed'].map((l) => (
          <p key={l} className="flex items-center gap-3"><span className="inline-block w-4 h-4 border border-ink" /> {l}</p>
        ))}
      </div>
      {order.notes && <p className="mt-8 border-t border-line pt-4"><span className="label">Customer note: </span>{order.notes}</p>}
      <p className="mt-10 text-xs text-ink-3">Packed by: ____________________ Date: ____________</p>
    </section>
  )
}
