import { CalendarClock } from 'lucide-react'
import { site } from '@/config/site'

/** Explains that pre-order lines ship on their own timeline. Renders nothing if there are none. */
export function PreOrderNotice({ names, className = '' }: { names: Array<string>; className?: string }) {
  const unique = [...new Set(names)]
  if (!unique.length) return null
  return (
    <div className={`flex gap-3 rounded-xl bg-amber-soft px-4 py-3 text-sm text-ink-2 ${className}`}>
      <CalendarClock size={18} className="shrink-0 text-amber mt-0.5" />
      <p>
        <span className="font-medium text-ink">{unique.join(', ')} {unique.length === 1 ? 'is a pre-order' : 'are pre-orders'}</span> and
        won’t arrive with the rest of your order. {site.shipping.preOrderEstimate} In-stock items are dispatched as normal.
      </p>
    </div>
  )
}

export function PreOrderTag() {
  return <span className="label rounded-full bg-amber-soft text-amber px-2 py-0.5 ml-2 align-middle">Pre-order</span>
}
