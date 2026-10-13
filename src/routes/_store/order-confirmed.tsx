import { useEffect, useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { Check, Info } from 'lucide-react'
import { formatMoney, site } from '@/config/site'
import { PreOrderNotice, PreOrderTag } from '@/components/store/PreOrderNotice'

export const Route = createFileRoute('/_store/order-confirmed')({
  head: () => ({ meta: [{ title: `Order confirmed — ${site.name}` }, { name: 'robots', content: 'noindex' }] }),
  component: OrderConfirmed,
})

type Snapshot = {
  orderNumber: string
  createdAt?: string
  details: { name: string; email: string; address: string; city: string; postcode: string; country: string }
  items: Array<{ name: string; variant: string; quantity: number; total: number; preOrder?: boolean }>
  subtotal: number
  shipping: number
  discountCode?: string | null
  discount?: number
  total: number
}

type LiveStatus = { paymentStatus: string; fulfilmentStatus: string; trackingNumber: string | null }

const paymentLabel: Record<string, string> = {
  PENDING: 'Awaiting payment',
  PAID: 'Paid',
  FAILED: 'Payment failed',
  CANCELLED: 'Cancelled',
  REFUNDED: 'Refunded',
  PARTIALLY_REFUNDED: 'Partly refunded',
}
const fulfilmentLabel: Record<string, string> = {
  NEW: 'Received',
  PACKING: 'Being packed',
  PACKED: 'Packed',
  SHIPPED: 'Shipped',
  COMPLETED: 'Delivered',
  CANCELLED: 'Cancelled',
  REFUNDED: 'Refunded',
}

function OrderConfirmed() {
  const [snap, setSnap] = useState<Snapshot | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [live, setLive] = useState<LiveStatus | null>(null)
  useEffect(() => {
    // Written by checkout only after the order is saved and Netlify Forms has accepted it.
    try {
      const raw = JSON.parse(sessionStorage.getItem('cumbria.lastCheckout') ?? 'null')
      if (raw?.orderNumber) {
        setSnap(raw)
        // Status always comes from the database. Reaching this page never marks anything paid.
        fetch('/api/order-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderNumber: raw.orderNumber, email: raw.details?.email }),
        })
          .then((r) => (r.ok ? r.json() : null))
          .then((s) => s && setLive(s))
          .catch(() => {})
      }
    } catch {}
    setLoaded(true)
  }, [])

  if (!loaded) return <div className="min-h-[60vh]" />
  if (!snap) {
    return (
      <div className="mx-auto max-w-xl px-5 py-28 text-center">
        <h1 className="font-display text-5xl">No recent order</h1>
        <p className="text-ink-2 mt-3">We couldn’t find an order placed in this browser session. If you’ve just ordered, check your email or contact us with your order number.</p>
        <div className="mt-8 flex justify-center gap-3">
          <Link to="/shop" className="btn btn-primary">Shop products</Link>
          <Link to="/contact" className="btn btn-ghost">Contact us</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-5 pt-16">
      {/* The order number is assigned server-side by /api/orders. No payment is taken on the site:
          the invoice email carries the payment details. */}
      <div className="flex gap-3 rounded-xl bg-amber-soft px-4 py-3 text-sm text-ink-2 mb-10">
        <Info size={18} className="shrink-0 text-amber mt-0.5" />
        <span>
          <strong className="font-medium text-ink">Your invoice is on its way to {snap.details.email}.</strong> No payment has been taken. Please pay using the details in the
          invoice, quoting <span className="font-mono">{snap.orderNumber}</span>. We dispatch as soon as payment is received.
        </span>
      </div>

      <div className="text-center rise">
        <span className="mx-auto grid place-items-center w-14 h-14 rounded-full bg-verdigris text-paper"><Check size={26} /></span>
        <p className="label text-ink-3 mt-6">Order confirmed</p>
        <h1 className="font-display text-5xl md:text-6xl mt-2">Thank you for your order</h1>
        <p className="mt-4 text-ink-2">
          Order number <span className="font-mono text-ink bg-paper-2 rounded px-2 py-0.5">{snap.orderNumber}</span>
        </p>
        {live && (
          <p className="mt-3 flex justify-center gap-4 text-sm">
            <span><span className="text-ink-3">Status:</span> {fulfilmentLabel[live.fulfilmentStatus] ?? live.fulfilmentStatus}</span>
            <span><span className="text-ink-3">Payment:</span> {paymentLabel[live.paymentStatus] ?? live.paymentStatus}</span>
          </p>
        )}
        <p className="text-sm text-ink-3 mt-2">
          Received{snap.createdAt && ` ${new Date(snap.createdAt).toLocaleString(site.locale, { timeZone: 'Europe/London', dateStyle: 'medium', timeStyle: 'short' })}`}. We’ll contact you at {snap.details.email} with updates.
        </p>
      </div>

      <PreOrderNotice names={snap.items.filter((i) => i.preOrder).map((i) => i.name)} className="mt-10" />

      {snap ? (
        <div className="mt-12 rounded-2xl border border-line bg-card divide-y divide-line rise" style={{ '--d': '100ms' } as React.CSSProperties}>
          <ul className="p-6 grid gap-2 text-sm">
            {snap.items.map((i) => (
              <li key={i.name + i.variant} className="flex justify-between"><span>{i.name} {i.variant} × {i.quantity}{i.preOrder && <PreOrderTag />}</span><span>{formatMoney(i.total)}</span></li>
            ))}
            <li className="flex justify-between text-ink-2 pt-2"><span>Delivery</span><span>{snap.shipping ? formatMoney(snap.shipping) : 'Free'}</span></li>
            {!!snap.discount && (
              <li className="flex justify-between text-verdigris"><span>Discount <span className="font-mono text-xs">{snap.discountCode}</span></span><span>−{formatMoney(snap.discount)}</span></li>
            )}
            <li className="flex justify-between font-medium text-base"><span>Amount due</span><span>{formatMoney(snap.total)}</span></li>
          </ul>
          <div className="p-6 grid sm:grid-cols-2 gap-6 text-sm">
            <div>
              <p className="label text-ink-3 mb-2">Delivering to</p>
              <address className="not-italic leading-relaxed">{snap.details.name}<br />{snap.details.address}<br />{snap.details.city} {snap.details.postcode.toUpperCase()}</address>
            </div>
            <div>
              <p className="label text-ink-3 mb-2">Estimated delivery</p>
              <p className="leading-relaxed">{site.shipping.estimate} after payment. We’ll email tracking as soon as it ships.</p>
              {snap.items.some((i) => i.preOrder) && (
                <p className="leading-relaxed mt-2 text-ink-2"><span className="text-amber font-medium">Pre-order items:</span> {site.shipping.preOrderEstimate}</p>
              )}
            </div>
          </div>
        </div>
      ) : null}

      <div className="mt-10 flex justify-center gap-3">
        <Link to="/shop" className="btn btn-primary">Continue shopping</Link>
        <Link to="/contact" className="btn btn-ghost">Questions?</Link>
      </div>
    </div>
  )
}
