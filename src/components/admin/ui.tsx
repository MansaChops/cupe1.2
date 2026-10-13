import type { FulfilmentStatus, NotificationState, PaymentStatus } from '@/lib/admin-types'

const fulfilmentTone: Record<FulfilmentStatus, string> = {
  NEW: 'bg-ink text-paper',
  PACKING: 'bg-amber-soft text-amber',
  PACKED: 'bg-verdigris-soft text-verdigris',
  SHIPPED: 'bg-verdigris text-paper',
  COMPLETED: 'bg-paper-2 text-ink-2',
  CANCELLED: 'bg-oxblood-soft text-oxblood',
  REFUNDED: 'bg-oxblood-soft text-oxblood',
}

const paymentTone: Record<PaymentStatus, string> = {
  PAID: 'text-verdigris',
  PENDING: 'text-amber',
  CANCELLED: 'text-ink-3',
  FAILED: 'text-oxblood',
  REFUNDED: 'text-oxblood',
  PARTIALLY_REFUNDED: 'text-amber',
}

export function StatusBadge({ status }: { status: FulfilmentStatus }) {
  return <span className={`label inline-flex rounded-full px-2.5 py-1 whitespace-nowrap ${fulfilmentTone[status]}`}>{status}</span>
}

export function PaymentBadge({ status }: { status: PaymentStatus }) {
  return (
    <span className={`label inline-flex items-center gap-1.5 whitespace-nowrap ${paymentTone[status]}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {status === 'PENDING' ? 'AWAITING PAYMENT' : status.replace('_', ' ')}
    </span>
  )
}

export function IntegrationDot({ status }: { status: NotificationState }) {
  const tone = { SENT: 'bg-verdigris', FAILED: 'bg-oxblood', PENDING: 'bg-ink-3', SENDING: 'bg-ink-3', RETRYING: 'bg-amber', SKIPPED: 'bg-line' }[status]
  return <span className={`inline-block w-2 h-2 rounded-full ${tone}`} title={status} />
}

export const fmtDate = (iso: string, withTime = true) =>
  new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : { year: 'numeric' }),
    timeZone: 'Europe/London',
  }).format(new Date(iso))

export function Panel({ title, action, children, className = '' }: { title?: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-line bg-card ${className}`}>
      {title && (
        <header className="flex items-center justify-between px-5 pt-4 pb-3">
          <h2 className="label text-ink-3">{title}</h2>
          {action}
        </header>
      )}
      {children}
    </section>
  )
}

export function PageHeader({ eyebrow, title, children }: { eyebrow: string; title: string; children?: React.ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="label text-ink-3">{eyebrow}</p>
        <h1 className="font-display text-4xl md:text-5xl mt-1">{title}</h1>
      </div>
      {children}
    </header>
  )
}

export function ErrorNote({ children }: { children: React.ReactNode }) {
  return children ? <p role="alert" className="mt-4 rounded-xl bg-oxblood-soft px-4 py-3 text-sm text-oxblood">{children}</p> : null
}

export const ReadOnlyNote = () => (
  <p className="mt-4 rounded-xl bg-amber-soft px-4 py-3 text-sm text-ink-2">You have view-only access. Only the owner can make changes.</p>
)
