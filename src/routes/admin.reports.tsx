import { useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Download, ExternalLink } from 'lucide-react'
import { api, pounds, type Report } from '@/lib/admin-types'
import { SalesChart } from '@/components/admin/charts'
import { ErrorNote, PageHeader, Panel, StatusBadge } from '@/components/admin/ui'

export const Route = createFileRoute('/admin/reports')({
  head: () => ({ meta: [{ title: 'Reports — Management' }] }),
  component: Reports,
})

const RANGES = [
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
  { days: 365, label: '12 months' },
]
const EXPORTS = [
  ['orders', 'Orders'],
  ['order-items', 'Order items'],
  ['inventory', 'Inventory'],
  ['customers', 'Customers'],
  ['discounts', 'Discount codes'],
] as const

function Reports() {
  const [days, setDays] = useState<number | null>(30)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [demo, setDemo] = useState(false)
  const [r, setR] = useState<Report | null>(null)
  const [error, setError] = useState('')
  const [sheetUrl, setSheetUrl] = useState<string | null>(null)

  useEffect(() => {
    api<{ integrations: { sheets: { sheetUrl: string | null; configured: boolean } } }>('/api/admin/settings')
      .then((s) => setSheetUrl(s.integrations.sheets.configured ? s.integrations.sheets.sheetUrl : null))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (days === null && (!from || !to)) return
    const p = new URLSearchParams(days ? { days: String(days) } : { from, to })
    if (demo) p.set('demo', '1')
    setError('')
    api<Report>(`/api/admin/reports?${p}`).then(setR).catch((e) => setError(e.message))
  }, [days, from, to, demo])

  const k = r?.kpis
  return (
    <div className="mx-auto max-w-[1400px] px-4 md:px-8 py-6 md:py-8">
      <PageHeader eyebrow="Reporting" title="Reports">
        {sheetUrl && (
          <a className="btn btn-ghost !py-2 text-sm" href={sheetUrl} target="_blank" rel="noreferrer"><ExternalLink size={15} /> Open Google Sheet</a>
        )}
      </PageHeader>

      {/* Filters: one row above the charts */}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <div className="flex rounded-full border border-line bg-card p-1 text-sm">
          {RANGES.map((x) => (
            <button key={x.days} onClick={() => setDays(x.days)} className={`rounded-full px-3.5 py-1.5 ${days === x.days ? 'bg-ink text-paper' : 'text-ink-2 hover:text-ink'}`}>{x.label}</button>
          ))}
          <button onClick={() => setDays(null)} className={`rounded-full px-3.5 py-1.5 ${days === null ? 'bg-ink text-paper' : 'text-ink-2 hover:text-ink'}`}>Custom</button>
        </div>
        {days === null && (
          <div className="flex items-center gap-2 text-sm">
            <input type="date" className="field !w-auto !py-2" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From" />
            <span className="text-ink-3">to</span>
            <input type="date" className="field !w-auto !py-2" value={to} onChange={(e) => setTo(e.target.value)} aria-label="To" />
          </div>
        )}
        <label className="ml-auto inline-flex items-center gap-2 text-sm text-ink-2 cursor-pointer">
          <input type="checkbox" className="accent-verdigris" checked={demo} onChange={(e) => setDemo(e.target.checked)} /> Include demo orders
        </label>
      </div>

      <ErrorNote>{error}</ErrorNote>
      {!r && !error && <p className="mt-8 text-sm text-ink-3">{days === null && (!from || !to) ? 'Pick a start and end date.' : 'Loading…'}</p>}

      {r && k && (
        <>
          <div className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-px bg-line border border-line rounded-2xl overflow-hidden">
            {[
              ['Paid revenue', pounds(k.revenuePaidPence), `${k.paidOrders} paid orders`],
              ['Order value', pounds(k.orderValuePence), `${k.orders} orders placed`],
              ['Awaiting payment', pounds(k.awaitingPaymentPence), `${k.awaitingPayment} invoices`],
              ['Average order', pounds(k.averageOrderPence), `${k.units} units`],
              ['Discounts given', pounds(k.discountsPence), `${r.discounts.reduce((n, d) => n + d.uses, 0)} codes used`],
              ['Delivery charged', pounds(k.shippingPence), 'customer-paid delivery'],
              ['Customers', String(k.customers), `${k.repeatCustomers} ordered more than once`],
              ['Cancelled / refunded', String(k.cancelled), 'excluded from totals'],
            ].map(([label, value, sub]) => (
              <div key={label} className="bg-card p-4 md:p-5">
                <p className="label text-ink-3">{label}</p>
                <p className="font-display text-3xl md:text-4xl mt-2">{value}</p>
                <p className="text-xs text-ink-3 mt-1">{sub}</p>
              </div>
            ))}
          </div>

          <Panel title="Order value per day" className="mt-6">
            <div className="px-3 pb-3"><SalesChart data={r.daily} label="Order value per day" /></div>
          </Panel>

          <div className="mt-6 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
            <Panel title="Best sellers">
              {r.topProducts.length ? (
                <table className="w-full text-sm border-t border-line">
                  <thead className="label text-ink-3 text-left"><tr><th className="font-normal px-5 py-2.5">Product</th><th className="font-normal text-right">Units</th><th className="font-normal text-right px-5">Sales</th></tr></thead>
                  <tbody className="divide-y divide-line">
                    {r.topProducts.map((t) => (
                      <tr key={t.label + t.sub}><td className="px-5 py-2.5">{t.label} <span className="text-ink-3">{t.sub}</span></td><td className="text-right font-mono">{t.units}</td><td className="text-right px-5">{pounds(t.revenuePence)}</td></tr>
                    ))}
                  </tbody>
                </table>
              ) : <p className="px-5 pb-5 text-sm text-ink-3">No sales in this period.</p>}
            </Panel>
            <div className="grid gap-6 content-start">
              <Panel title="Orders by status">
                <ul className="px-5 pb-5 grid gap-2">
                  {r.byStatus.length ? r.byStatus.map((s) => (
                    <li key={s.status} className="flex items-center justify-between"><StatusBadge status={s.status} /><span className="font-mono">{s.count}</span></li>
                  )) : <li className="text-sm text-ink-3">No orders in this period.</li>}
                </ul>
              </Panel>
              <Panel title="Discount codes">
                {r.discounts.length ? (
                  <ul className="border-t border-line divide-y divide-line text-sm">
                    {r.discounts.map((d) => (
                      <li key={d.code} className="flex justify-between gap-3 px-5 py-2.5"><span className="font-mono">{d.code}</span><span className="text-ink-3">{d.uses} uses · −{pounds(d.discountPence)}</span><span>{pounds(d.revenuePence)}</span></li>
                    ))}
                  </ul>
                ) : <p className="px-5 pb-5 text-sm text-ink-3">No codes used in this period.</p>}
              </Panel>
            </div>
          </div>
        </>
      )}

      <Panel title="CSV exports · all time" className="mt-6">
        <div className="px-5 pb-5 flex flex-wrap gap-2">
          {EXPORTS.map(([type, label]) => (
            <a key={type} className="btn btn-ghost !py-2 text-sm" href={`/api/admin/export/${type}.csv`}><Download size={15} /> {label}</a>
          ))}
        </div>
      </Panel>
    </div>
  )
}
