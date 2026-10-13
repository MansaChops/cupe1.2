import { useEffect, useState } from 'react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { Download, RefreshCw, Search } from 'lucide-react'
import { FULFILMENT_STATUSES, PAYMENT_STATUSES, api, pounds, type FulfilmentStatus, type OrderListRow, type PaymentStatus } from '@/lib/admin-types'
import { ErrorNote, PageHeader, PaymentBadge, StatusBadge, fmtDate } from '@/components/admin/ui'

type Sort = 'newest' | 'oldest' | 'highest' | 'lowest'
type OrdersSearch = { q?: string; status?: FulfilmentStatus; payment?: PaymentStatus; sort?: Sort }

export const Route = createFileRoute('/admin/orders/')({
  validateSearch: (s: Record<string, unknown>): OrdersSearch => ({
    q: typeof s.q === 'string' && s.q ? s.q : undefined,
    status: FULFILMENT_STATUSES.includes(s.status as FulfilmentStatus) ? (s.status as FulfilmentStatus) : undefined,
    payment: PAYMENT_STATUSES.includes(s.payment as PaymentStatus) ? (s.payment as PaymentStatus) : undefined,
    sort: ['oldest', 'highest', 'lowest'].includes(s.sort as string) ? (s.sort as Sort) : undefined,
  }),
  head: () => ({ meta: [{ title: 'Orders — Management' }] }),
  component: Orders,
})

function Orders() {
  const search = Route.useSearch()
  const navigate = useNavigate({ from: '/admin/orders/' })
  const set = (p: Partial<OrdersSearch>) => navigate({ search: (prev: OrdersSearch) => ({ ...prev, ...p }), replace: true })
  const [all, setAll] = useState<Array<OrderListRow> | null>(null)
  const [error, setError] = useState('')
  const [q, setQ] = useState(search.q ?? '')
  const [tick, setTick] = useState(0)

  // Search is debounced and runs on the server (name, email, phone, postcode, SKU, product, code).
  useEffect(() => {
    const t = setTimeout(() => q !== (search.q ?? '') && set({ q: q || undefined }), 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q])

  useEffect(() => {
    const params = new URLSearchParams()
    if (search.q) params.set('q', search.q)
    if (search.payment) params.set('payment', search.payment)
    if (search.sort) params.set('sort', search.sort)
    setError('')
    api<Array<OrderListRow>>(`/api/admin/orders?${params}`)
      .then(setAll)
      .catch((e) => setError(e.message))
  }, [search.q, search.payment, search.sort, tick])

  const rows = (all ?? []).filter((o) => !search.status || o.fulfilmentStatus === search.status)
  const count = (s?: FulfilmentStatus) => (all ?? []).filter((o) => !s || o.fulfilmentStatus === s).length
  const exportUrl = `/api/admin/export/orders.csv${search.status ? `?status=${search.status}` : ''}`

  return (
    <div className="mx-auto max-w-[1400px] px-4 md:px-8 py-6 md:py-8">
      <PageHeader eyebrow="Order management" title="Orders">
        <div className="flex gap-2">
          <button className="btn btn-ghost !py-2 text-sm" onClick={() => setTick((t) => t + 1)}><RefreshCw size={15} /> Refresh</button>
          <a className="btn btn-ghost !py-2 text-sm" href={exportUrl}><Download size={15} /> Export CSV</a>
        </div>
      </PageHeader>

      <div className="mt-6 -mx-4 px-4 md:mx-0 md:px-0 overflow-x-auto">
        <div className="flex gap-1 min-w-max border-b border-line">
          {([undefined, ...FULFILMENT_STATUSES] as const).map((s) => (
            <button
              key={s ?? 'all'}
              onClick={() => set({ status: s })}
              className={`px-3 py-2.5 text-sm border-b-2 -mb-px transition ${search.status === s ? 'border-ink text-ink' : 'border-transparent text-ink-3 hover:text-ink'}`}
            >
              {s ? s[0] + s.slice(1).toLowerCase() : 'All'} <span className="font-mono text-[11px] text-ink-3 ml-0.5">{count(s)}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <label className="relative flex-1 min-w-60">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
          <input className="field !pl-9 !py-2.5 text-sm" placeholder="Order no., name, email, phone, postcode, SKU, product or code" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <select className="field !w-auto !py-2.5 text-sm" value={search.payment ?? ''} onChange={(e) => set({ payment: (e.target.value || undefined) as PaymentStatus })} aria-label="Payment status">
          <option value="">Any payment</option>
          {PAYMENT_STATUSES.map((p) => <option key={p} value={p}>{p === 'PENDING' ? 'Awaiting payment' : p[0] + p.slice(1).toLowerCase()}</option>)}
        </select>
        <select className="field !w-auto !py-2.5 text-sm" value={search.sort ?? 'newest'} onChange={(e) => set({ sort: e.target.value === 'newest' ? undefined : (e.target.value as Sort) })} aria-label="Sort">
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
          <option value="highest">Highest value</option>
          <option value="lowest">Lowest value</option>
        </select>
      </div>

      <ErrorNote>{error}</ErrorNote>
      {!all && !error && <p className="mt-8 text-sm text-ink-3">Loading orders…</p>}

      {all && (
        <>
          {/* Desktop table */}
          <div className="mt-4 hidden md:block rounded-2xl border border-line bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="label text-ink-3 text-left border-b border-line">
                  <th className="font-normal px-5 py-3">Order</th>
                  <th className="font-normal py-3">Customer</th>
                  <th className="font-normal py-3">Items</th>
                  <th className="font-normal py-3">Payment</th>
                  <th className="font-normal py-3">Status</th>
                  <th className="font-normal py-3 text-right px-5">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((o) => (
                  <tr key={o.number} className="hover:bg-paper/60 cursor-pointer" onClick={() => navigate({ to: '/admin/orders/$orderNumber', params: { orderNumber: o.number } })}>
                    <td className="px-5 py-3.5">
                      <Link to="/admin/orders/$orderNumber" params={{ orderNumber: o.number }} className="font-mono font-medium hover:text-verdigris">{o.number}</Link>
                      {o.isDemo && <span className="label ml-2 rounded-full bg-amber-soft text-amber px-1.5">Demo</span>}
                      <p className="text-xs text-ink-3">{fmtDate(o.createdAt)}</p>
                    </td>
                    <td>{o.customerName}<p className="text-xs text-ink-3">{o.city} {o.postcode}</p></td>
                    <td className="max-w-72">
                      <p className="truncate">{o.itemsSummary}</p>
                      <p className="text-xs text-ink-3">{o.units} units{o.discountCode && <> · code <span className="font-mono">{o.discountCode}</span></>}</p>
                    </td>
                    <td><PaymentBadge status={o.paymentStatus} /></td>
                    <td><StatusBadge status={o.fulfilmentStatus} /></td>
                    <td className="text-right px-5 font-medium">{pounds(o.totalPence)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!rows.length && <Empty />}
          </div>

          {/* Mobile cards */}
          <ul className="mt-4 md:hidden grid gap-2">
            {rows.map((o) => (
              <li key={o.number}>
                <Link to="/admin/orders/$orderNumber" params={{ orderNumber: o.number }} className="block rounded-xl border border-line bg-card p-4 active:bg-paper-2">
                  <div className="flex justify-between items-center">
                    <span className="font-mono font-medium">{o.number}</span>
                    <StatusBadge status={o.fulfilmentStatus} />
                  </div>
                  <p className="mt-2 text-sm">{o.customerName} · <span className="text-ink-3">{fmtDate(o.createdAt)}</span></p>
                  <p className="text-xs text-ink-3 truncate mt-0.5">{o.itemsSummary}</p>
                  <div className="mt-3 flex justify-between items-center">
                    <PaymentBadge status={o.paymentStatus} />
                    <span className="font-medium">{pounds(o.totalPence)}</span>
                  </div>
                </Link>
              </li>
            ))}
            {!rows.length && <Empty />}
          </ul>
        </>
      )}
    </div>
  )
}

function Empty() {
  return <p className="py-16 text-center text-ink-3 text-sm">No orders match these filters.</p>
}
