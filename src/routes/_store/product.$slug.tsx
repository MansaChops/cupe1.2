import { useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowLeft, CalendarClock, Check, Minus, Plus, ShieldCheck, Truck } from 'lucide-react'
import { formatMoney, img, site } from '@/config/site'
import { categories, maxQty, packPrice, priceLabel, qtyStep, unitPrice, type Product } from '@/lib/catalogue'
import { cart, useCart, useCatalogue } from '@/lib/cart'
import { getProduct } from '@/server/catalogue'
import { ProductCard, StockTag } from '@/components/store/ProductCard'

export const Route = createFileRoute('/_store/product/$slug')({
  // Read straight from the database, so the page always shows the current price and stock.
  loader: ({ params }): Promise<Product> => getProduct({ data: { slug: params.slug } }),
  head: ({ loaderData: p }) =>
    p
      ? {
          meta: [
            { title: `${p.name} — ${site.name}` },
            { name: 'description', content: p.shortDescription },
            { property: 'og:title', content: p.name },
            { property: 'og:image', content: img(p.image, 1200, 1200) },
          ],
          scripts: [
            {
              type: 'application/ld+json',
              children: JSON.stringify({
                '@context': 'https://schema.org',
                '@type': 'Product',
                name: p.name,
                description: p.shortDescription,
                image: img(p.image, 1200, 1200),
                offers: p.variants.map((v) => ({
                  '@type': 'Offer',
                  sku: v.sku,
                  price: unitPrice(v).toFixed(2),
                  priceCurrency: site.currency,
                  availability: v.stock > 0 ? (p.preOrder ? 'https://schema.org/PreOrder' : 'https://schema.org/InStock') : 'https://schema.org/OutOfStock',
                })),
              }),
            },
          ],
        }
      : {},
  component: ProductPage,
})

function ProductPage() {
  const product: Product = Route.useLoaderData()
  const { items } = useCart()
  const products = useCatalogue()
  const firstAvailable = product.variants.find((v) => v.stock > 0) ?? product.variants[0]
  const [variantId, setVariantId] = useState(firstAvailable.id)
  const [qty, setQty] = useState(qtyStep(firstAvailable))
  const [added, setAdded] = useState(false)

  const variant = product.variants.find((v) => v.id === variantId)!
  const inBasket = items.find((i) => i.variantId === variantId)?.quantity ?? 0
  const step = qtyStep(variant)
  const available = Math.max(0, maxQty(variant) - inBasket)
  const category = categories.find((c) => c.slug === product.category)
  const related = products.filter((p) => p.category === product.category && p.id !== product.id && p.active).slice(0, 4)

  const add = () => {
    cart.add(variantId, Math.min(qty, available))
    setQty(step)
    setAdded(true)
    setTimeout(() => setAdded(false), 2200)
  }

  return (
    <div className="mx-auto max-w-7xl px-5 pt-8">
      <Link to="/shop" className="inline-flex items-center gap-1.5 text-sm text-ink-2 hover:text-ink">
        <ArrowLeft size={15} /> All products
      </Link>

      <div className="mt-6 grid gap-10 md:grid-cols-[1.1fr_1fr] md:gap-16">
        <div className="ticks md:sticky md:top-24 self-start rise">
          <div className="rounded-[1.25rem] overflow-hidden border border-line bg-[#050607] aspect-square">
            <img src={img(product.image, 1000, 1000)} alt={product.name} fetchPriority="high" className="w-full h-full object-cover" />
          </div>
        </div>

        <div className="rise" style={{ '--d': '80ms' } as React.CSSProperties}>
          <p className="label text-ink-3">{category?.name}</p>
          <h1 className="font-display text-5xl md:text-6xl mt-2 leading-none">{product.name}</h1>
          <div className="mt-5 flex items-baseline gap-3">
            <span className="text-3xl font-medium">{formatMoney(packPrice(variant))}</span>
            {variant.salePrice && <span className="text-ink-3 line-through">{formatMoney(variant.price * step)}</span>}
            {priceLabel(variant) && <span className="text-ink-2">{priceLabel(variant)}</span>}
          </div>
          <p className="mt-5 text-ink-2 leading-relaxed">{product.shortDescription}</p>

          {product.preOrder && (
            <section className="mt-6 flex gap-3 rounded-2xl border border-amber/40 bg-amber-soft p-5" aria-labelledby="pre-order">
              <CalendarClock size={20} className="shrink-0 text-amber mt-0.5" />
              <div>
                <h2 id="pre-order" className="label text-amber">Pre-order item</h2>
                <p className="mt-2 text-sm text-ink-2">
                  {product.name} is not held in stock and does not ship on our usual same-day timeline. {site.shipping.preOrderEstimate} Other
                  items in your order are sent as normal.
                </p>
              </div>
            </section>
          )}

          {product.showSizeGuide && (
            <section className="mt-8 rounded-2xl border border-verdigris/40 bg-verdigris-soft/60 p-5" aria-labelledby="size-guide">
              <h2 id="size-guide" className="label text-verdigris">Available sizes</h2>
              <p className="mt-2 text-sm text-ink-2">
                {product.name} comes in {product.variants.length} sizes. Pick the one you need below before adding to your basket.
              </p>
              <ul className="mt-4 grid grid-cols-3 gap-2">
                {product.variants.map((v) => (
                  <li key={v.id}>
                    <button
                      onClick={() => {
                        setVariantId(v.id)
                        setQty(qtyStep(v))
                      }}
                      className={`w-full rounded-xl border px-3 py-2.5 text-center transition ${
                        v.id === variantId ? 'border-verdigris bg-card ring-1 ring-verdigris/40' : 'border-line bg-paper hover:border-ink-3'
                      }`}
                    >
                      <span className="block font-medium">{v.name}</span>
                      <span className="block text-sm text-ink-2">{formatMoney(packPrice(v))} {priceLabel(v)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <fieldset className="mt-8">
            <legend className="label text-ink-3 mb-3">Size</legend>
            <div className="flex flex-wrap gap-2">
              {product.variants.map((v) => (
                <button
                  key={v.id}
                  onClick={() => {
                    setVariantId(v.id)
                    setQty(qtyStep(v))
                  }}
                  aria-pressed={v.id === variantId}
                  className={`rounded-xl border px-4 py-3 text-left transition min-w-28 ${
                    v.id === variantId ? 'border-verdigris bg-card ring-1 ring-verdigris/40' : 'border-line hover:border-ink-3'
                  } ${v.stock === 0 ? 'opacity-50' : ''}`}
                >
                  <span className="block font-medium">{v.name}</span>
                  <span className="block font-mono text-[11px] text-ink-3 mt-0.5">{v.sku}</span>
                </button>
              ))}
            </div>
          </fieldset>

          <div className="mt-6 flex items-center justify-between">
            <StockTag stock={variant.stock} threshold={variant.lowStockThreshold} preOrder={product.preOrder} />
            {inBasket > 0 && <span className="text-xs text-ink-3">{inBasket} already in your basket</span>}
          </div>

          <div className="mt-4 flex gap-3">
            <div className="flex items-center rounded-full border border-line bg-card">
              <button className="p-3 disabled:opacity-30" onClick={() => setQty(Math.max(step, qty - step))} disabled={qty <= step} aria-label="Decrease quantity">
                <Minus size={16} />
              </button>
              <span className="w-8 text-center font-mono" aria-live="polite">{qty}</span>
              <button className="p-3 disabled:opacity-30" onClick={() => setQty(Math.min(available, qty + step))} disabled={qty + step > available} aria-label="Increase quantity">
                <Plus size={16} />
              </button>
            </div>
            <button className="btn btn-primary flex-1" disabled={available === 0} onClick={add}>
              {variant.stock === 0 ? (product.preOrder ? 'Pre-orders full' : 'Out of stock') : available === 0 ? 'Maximum in basket' : added ? (<><Check size={17} /> Added</>) : product.preOrder ? 'Pre-order now' : 'Add to basket'}
            </button>
          </div>
          {added && (
            <Link to="/cart" className="mt-3 block text-center text-sm text-verdigris underline underline-offset-4">
              View basket &amp; checkout
            </Link>
          )}

          <div className="mt-8 grid gap-3 text-sm text-ink-2">
            <p className="flex gap-3"><Truck size={18} className="shrink-0 text-ink-3" /> Tracked UK delivery · free over {formatMoney(site.shipping.freeOver)}{product.preOrder ? ' · ships separately when available' : ''}</p>
            <p className="flex gap-3"><ShieldCheck size={18} className="shrink-0 text-ink-3" /> No card details taken — pay by invoice</p>
          </div>

          <div className="mt-10 border-t border-line pt-6">
            <h2 className="label text-ink-3 mb-3">Description</h2>
            <p className="leading-relaxed text-ink-2">{product.description}</p>
            <dl className="mt-6 grid grid-cols-2 gap-y-3 text-sm">
              <dt className="text-ink-3">SKU</dt><dd className="font-mono">{variant.sku}</dd>
              <dt className="text-ink-3">Inventory ID</dt><dd className="font-mono">{variant.inventoryId}</dd>
              <dt className="text-ink-3">Format</dt><dd>{variant.name}</dd>
            </dl>
            <p className="mt-6 text-xs text-ink-3">
              Sold to customers aged 18+. See our <Link to="/disclaimer" className="underline">product disclaimer</Link>.
            </p>
          </div>
        </div>
      </div>

      {related.length > 0 && (
        <section className="mt-24">
          <h2 className="font-display text-4xl mb-6">Also in {category?.name.toLowerCase()}</h2>
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            {related.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        </section>
      )}
    </div>
  )
}
