import { useEffect, useState } from 'react'
import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import { AlertTriangle, ArrowRight, Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react'
import { formatMoney, img, site } from '@/config/site'
import { cart, useCart } from '@/lib/cart'
import { maxQty, qtyStep } from '@/lib/catalogue'
import { Summary } from '@/components/store/Summary'
import { PreOrderNotice, PreOrderTag } from '@/components/store/PreOrderNotice'
import { validateBasket } from '@/server/catalogue'

export const Route = createFileRoute('/_store/cart')({
  head: () => ({ meta: [{ title: `Basket — ${site.name}` }, { name: 'robots', content: 'noindex' }] }),
  component: Cart,
})

function Cart() {
  const { items, subtotal, shipping, total } = useCart()
  const toFree = site.shipping.freeOver - subtotal

  if (!items.length) {
    return (
      <div className="mx-auto max-w-xl px-5 py-28 text-center rise">
        <ShoppingBag size={36} className="mx-auto text-ink-3" strokeWidth={1.25} />
        <h1 className="font-display text-5xl mt-6">Your basket is empty</h1>
        <p className="text-ink-2 mt-3">Browse the range and add what you need — your basket is saved on this device.</p>
        <Link to="/shop" className="btn btn-primary mt-8">Shop products <ArrowRight size={17} /></Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl px-5 pt-12">
      <h1 className="font-display text-5xl md:text-6xl">Basket</h1>
      <PreOrderNotice names={items.filter((i) => i.product.preOrder).map((i) => i.product.name)} className="mt-6 max-w-3xl" />
      <BasketCheck items={items} />
      <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_380px]">
        <div>
          <div className="hidden md:grid grid-cols-[1fr_8rem_6rem_6rem_2rem] gap-4 label text-ink-3 border-b border-line pb-3">
            <span>Product</span><span>Quantity</span><span className="text-right">Unit</span><span className="text-right">Subtotal</span><span />
          </div>
          <ul>
            {items.map(({ variantId, quantity, product, variant, price, lineTotal }) => (
              <li key={variantId} className="grid grid-cols-[4.5rem_1fr] md:grid-cols-[1fr_8rem_6rem_6rem_2rem] gap-4 items-center border-b border-line py-5">
                <div className="flex items-center gap-4 md:col-span-1 col-span-2">
                  <img src={img(product.image, 160, 160)} alt="" className="w-[4.5rem] h-[4.5rem] rounded-xl object-cover bg-paper-2" />
                  <div className="min-w-0">
                    <Link to="/product/$slug" params={{ slug: product.slug }} className="font-display text-2xl leading-tight hover:text-verdigris">
                      {product.name}
                    </Link>
                    <p className="text-sm text-ink-2">{variant.name} · <span className="font-mono text-xs text-ink-3">{variant.sku}</span>{product.preOrder && <PreOrderTag />}</p>
                    <p className="md:hidden text-sm mt-1">{qtyStep(variant) > 1 ? `${formatMoney(price * qtyStep(variant))} per ${qtyStep(variant)}` : `${formatMoney(price)} each`}</p>
                  </div>
                </div>
                <div className="col-span-2 md:col-span-1 flex items-center justify-between md:block">
                  <div className="inline-flex items-center rounded-full border border-line bg-card">
                    <button className="p-2.5 disabled:opacity-30" onClick={() => cart.set(variantId, quantity - qtyStep(variant))} aria-label="Decrease quantity">
                      <Minus size={14} />
                    </button>
                    <span className="w-7 text-center font-mono text-sm">{quantity}</span>
                    <button className="p-2.5 disabled:opacity-30" disabled={quantity + qtyStep(variant) > maxQty(variant)} onClick={() => cart.set(variantId, quantity + qtyStep(variant))} aria-label="Increase quantity">
                      <Plus size={14} />
                    </button>
                  </div>
                  {quantity + qtyStep(variant) > maxQty(variant) && <p className="text-[11px] text-amber mt-1 hidden md:block">{variant.maxPerOrder && quantity >= variant.maxPerOrder ? `Max ${variant.maxPerOrder} per order` : 'Max available'}</p>}
                  <span className="md:hidden font-medium">{formatMoney(lineTotal)}</span>
                </div>
                <span className="hidden md:block text-right text-sm text-ink-2">{formatMoney(price)}</span>
                <span className="hidden md:block text-right font-medium">{formatMoney(lineTotal)}</span>
                <button onClick={() => cart.remove(variantId)} className="hidden md:grid place-items-center text-ink-3 hover:text-oxblood" aria-label={`Remove ${product.name}`}>
                  <Trash2 size={16} />
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-5 flex justify-between text-sm">
            <Link to="/shop" className="text-ink-2 hover:text-ink">← Continue shopping</Link>
            <button onClick={() => cart.clear()} className="text-ink-3 hover:text-oxblood">Empty basket</button>
          </div>
        </div>

        <aside className="rounded-2xl border border-line bg-card p-6 self-start lg:sticky lg:top-24">
          <h2 className="font-display text-3xl mb-5">Order summary</h2>
          {toFree > 0 && (
            <div className="mb-5">
              <p className="text-xs text-ink-2 mb-2">Add {formatMoney(toFree)} more for free delivery</p>
              <div className="h-1 rounded-full bg-paper-2 overflow-hidden">
                <div className="h-full bg-verdigris origin-left transition-transform" style={{ transform: `scaleX(${subtotal / site.shipping.freeOver})` }} />
              </div>
            </div>
          )}
          <Summary subtotal={subtotal} shipping={shipping} total={total} />
          <Link to="/checkout" className="btn btn-primary w-full mt-6">Checkout <ArrowRight size={17} /></Link>
          <p className="text-[11px] text-ink-3 mt-4 text-center">Prices and stock are re-checked when you pay.</p>
        </aside>
      </div>
    </div>
  )
}

type Issue = Awaited<ReturnType<typeof validateBasket>>['issues'][number]

/** Re-checks the basket against live database stock and prices, and offers to fix any problems. */
function BasketCheck({ items }: { items: ReturnType<typeof useCart>['items'] }) {
  const router = useRouter()
  const [issues, setIssues] = useState<Array<Issue>>([])
  const key = items.map((i) => `${i.variantId}:${i.quantity}`).join(',')

  useEffect(() => {
    let cancelled = false
    validateBasket({ data: { items: items.map(({ variantId, quantity }) => ({ variantId, quantity })) } })
      .then((r) => {
        if (cancelled) return
        setIssues(r.issues)
        // Prices or stock changed since the page loaded: refresh the catalogue.
        const stale = r.lines.some((l) => items.find((i) => i.variantId === l.variantId)?.price !== l.unitPricePence / 100)
        if (r.issues.length || stale) router.invalidate()
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [key])

  if (!issues.length) return null
  const fix = () => issues.forEach((i) => (i.maxQuantity > 0 ? cart.set(i.variantId, i.maxQuantity) : cart.remove(i.variantId)))
  return (
    <div role="alert" className="mt-6 max-w-3xl rounded-xl bg-oxblood-soft px-4 py-3 text-sm text-oxblood">
      <p className="flex items-center gap-2 font-medium"><AlertTriangle size={16} /> Some items have changed since you added them</p>
      <ul className="mt-2 grid gap-1 text-ink-2">
        {issues.map((i) => <li key={i.variantId}>{i.message}</li>)}
      </ul>
      <button onClick={fix} className="mt-3 underline">Update my basket</button>
    </div>
  )
}
