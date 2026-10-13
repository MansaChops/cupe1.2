import { useEffect, useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { AlertTriangle, ArrowRight } from 'lucide-react'
import { api, pounds, type Report } from '@/lib/admin-types'
import { BarList, SalesChart } from '@/components/admin/charts'
import { ErrorNote, IntegrationDot, Panel, StatusBadge, fmtDate } from '@/components/admin/ui'

export const Route = createFileRoute('/admin/dashboard')({
  head: () => ({ meta: [{ title: 'Dashboard — Management' }] }),
  component: Dashboard,
})

const greeting = () => {
  const h = Number(new Date().toLocaleString('en-GB', { hour: 'numeric', hour12: false, timeZone: 'Europe/London' }))
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

function Dashboard() {
  const { admin } = Route.useRouteContext()
  const [r, setR] = useState<Report | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    api<Report>('/api/admin/reports?days=30').then(setR).catch((e) => setError(e.message))
  }, [])

  // Date and greeting depend on the viewer's clock, so they're set after hydration.
  const [today, setToday] = useState({ date: '', hello: 'Hello' })
  useEffect(() => {
    setToday({ date: new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/London' }), hello: greeting() })
  }, [])
  const k = r?.kpis
  const kpis = k
    ? [
        { k: 'To pack', v: String(k.toPack), s: 'New + packing', to: '/admin/orders', search: { status: 'NEW' } },
        { k: 'To ship', v: String(k.toShip), s: 'Packed, not shipped', to: '/admin/orders', search: { status: 'PACKED' } },
        { k: 'Awaiting payment', v: pounds(k.awaitingPaymentPence), s: `${k.awaitingPayment} ${k.awaitingPayment === 1 ? 'invoice' : 'invoices'} outstanding`, warn: k.awaitingPayment > 0, to: '/admin/orders', search: { payment: 'PENDING' } },
        { k: 'Low stock', v: String(r.lowStock.length), s: 'sizes at alert level', warn: r.lowStock.length > 0, to: '/admin/inventory' },
        { k: 'Paid · 30 days', v: pounds(k.revenuePaidPence), s: `${k.paidOrders} paid ${k.paidOrders === 1 ? 'order' : 'orders'}` },
        { k: 'Orders · 30 days', v: String(k.orders), s: `${pounds(k.orderValuePence)} order value` },
        { k: 'Average order', v: pounds(k.averageOrderPence), s: `${k.units} units sold` },
        { k: 'Discounts given', v: pounds(k.discountsPence), s: `${k.customers} customers · ${k.repeatCustomers} repeat` },
      ]
    : []

  return (
    <div className="mx-auto max-w-[1400px] px-4 md:px-8 py-6 md:py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label text-ink-3 min-h-4">{today.date}</p>
          <h1 className="font-display text-4xl md:text-5xl mt-1">{today.hello}{admin.name ? `, ${admin.name.split(' ')[0]}` : ''}</h1>
        </div>
        <Link to="/admin/orders" search={{ status: 'NEW' }} className="btn btn-primary">
          Pack today’s orders <ArrowRight size={16} />
        </Link>
      </header>

      <ErrorNote>{error}</ErrorNote>
      {!r && !error && <p className="mt-8 text-sm text-ink-3">Loading…</p>}

      {r && k && (
        <>
          <div className="mt-8 grid grid-cols-2 lg:grid-cols-4 gap-px bg-line border border-line rounded-2xl overflow-hidden">
            {kpis.map((x) => {
              const body = (
                <>
                  <p className="label text-ink-3 flex items-center gap-1.5">
                    {x.warn && <AlertTriangle size={12} className="text-amber" />}
                    {x.k}
                  </p>
                  <p className={`font-display text-3xl md:text-4xl mt-2 ${x.warn ? 'text-amber' : ''}`}>{x.v}</p>
                  <p className="text-xs text-ink-3 mt-1">{x.s}</p>
                </>
              )
              return x.to ? (
                <Link key={x.k} to={x.to} search={x.search as never} className="bg-card p-4 md:p-5 hover:bg-paper-2/60">{body}</Link>
              ) : (
                <div key={x.k} className="bg-card p-4 md:p-5">{body}</div>
              )
            })}
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
            <Panel title="Order value · last 30 days" action={<Link to="/admin/reports" className="text-xs text-verdigris">Full reports</Link>}>
              <div className="px-3 pb-3">
                <SalesChart data={r.daily} label="Daily order value, last 30 days" />
              </div>
            </Panel>
            <Panel title="Top products · units ordered">
              <div className="px-5 pb-5">
                <BarList rows={r.topProducts.slice(0, 6).map((t) => ({ label: t.label, sub: t.sub, value: t.units }))} format={(n) => `${n} units`} />
              </div>
            </Panel>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
            <Panel title="Recent orders" action={<Link to="/admin/orders" className="text-xs text-verdigris">View all</Link>}>
              {r.recent.length ? (
                <ul className="divide-y divide-line border-t border-line">
                  {r.recent.map((o) => (
                    <li key={o.number}>
                      <Link to="/admin/orders/$orderNumber" params={{ orderNumber: o.number }} className="grid grid-cols-[auto_1fr_auto] md:grid-cols-[7rem_1fr_7rem_6rem] items-center gap-3 px-5 py-3 hover:bg-paper/60">
                        <span className="font-mono text-sm">{o.number}</span>
                        <span className="text-sm truncate">{o.customerName} <span className="text-ink-3 hidden md:inline">· {fmtDate(o.createdAt)}</span></span>
                        <span className="hidden md:block"><StatusBadge status={o.fulfilmentStatus} /></span>
                        <span className="text-sm text-right font-medium">{pounds(o.totalPence)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-5 pb-5 text-sm text-ink-3">No orders yet. They’ll appear here the moment a customer checks out.</p>
              )}
            </Panel>

            <div className="grid gap-6 content-start">
              <Panel title="Low stock alerts" action={<Link to="/admin/inventory" className="text-xs text-verdigris">Inventory</Link>}>
                {r.lowStock.length ? (
                  <ul className="divide-y divide-line border-t border-line">
                    {r.lowStock.map((v) => (
                      <li key={v.variantId} className="flex items-center justify-between px-5 py-3 text-sm">
                        <span>{v.productName} <span className="text-ink-3">{v.variantName}</span><br /><span className="font-mono text-[11px] text-ink-3">{v.sku} · alert at {v.lowStockThreshold}</span></span>
                        <span className={`font-display text-2xl ${v.stock === 0 ? 'text-oxblood' : 'text-amber'}`}>{v.stock}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="px-5 pb-5 text-sm text-ink-3">Every size is above its alert level.</p>
                )}
              </Panel>
              <Panel title="Notifications needing attention">
                {r.failedNotifications.length ? (
                  <ul className="divide-y divide-line border-t border-line">
                    {r.failedNotifications.map((n, i) => (
                      <li key={i}>
                        <Link to="/admin/orders/$orderNumber" params={{ orderNumber: n.orderNumber }} className="flex gap-3 px-5 py-3 text-sm hover:bg-paper/60">
                          <span className="pt-1.5"><IntegrationDot status={n.status} /></span>
                          <span>
                            <span className="font-mono">{n.orderNumber}</span> · {n.channel} {n.status.toLowerCase()}
                            <span className="block text-xs text-ink-3">{n.lastError}</span>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="px-5 pb-5 text-sm text-ink-3">All Slack, email and Google Sheets deliveries are up to date.</p>
                )}
              </Panel>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
