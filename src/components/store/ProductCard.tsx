import { Link } from '@tanstack/react-router'
import { formatMoney, img } from '@/config/site'
import { categories, fromPrice, packPrice, priceLabel, totalStock, type Product } from '@/lib/catalogue'

export function StockTag({ stock, threshold, preOrder = false }: { stock: number; threshold: number; preOrder?: boolean }) {
  if (stock === 0) return <span className="label text-oxblood">{preOrder ? 'Pre-orders full' : 'Out of stock'}</span>
  if (preOrder) return <span className="label text-amber">Pre-order</span>
  if (stock <= threshold) return <span className="label text-amber">Only {stock} left</span>
  return (
    <span className="label text-verdigris inline-flex items-center gap-1.5">
      <span className="dot" aria-hidden /> In stock
    </span>
  )
}

export function ProductCard({ product, priority = false }: { product: Product; priority?: boolean }) {
  const stock = totalStock(product)
  const onSale = product.variants.some((v) => v.salePrice)
  const category = categories.find((c) => c.slug === product.category)

  return (
    <Link
      to="/product/$slug"
      params={{ slug: product.slug }}
      className="group relative block rounded-2xl bg-card border border-line overflow-hidden transition duration-300 hover:-translate-y-1 hover:border-ink-3/60 hover:shadow-[0_30px_60px_-30px_rgb(0_0_0/0.9)]"
    >
      <span className="pointer-events-none absolute inset-x-0 top-0 z-10 h-px bg-gradient-to-r from-transparent via-verdigris/70 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      <div className="relative aspect-square overflow-hidden bg-[#050607]">
        <img
          src={img(product.image, 600, 600)}
          alt={product.name}
          loading={priority ? 'eager' : 'lazy'}
          width={600}
          height={600}
          className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.04]"
        />
        {onSale && (
          <span className="absolute left-3 top-3 label rounded-full border border-oxblood/40 bg-oxblood-soft/80 text-oxblood px-2.5 py-1 backdrop-blur">Offer</span>
        )}
        {product.preOrder && (
          <span className="absolute right-3 top-3 label rounded-full border border-amber/40 bg-amber-soft/80 text-amber px-2.5 py-1 backdrop-blur">Pre-order</span>
        )}
        {stock === 0 && <div className="absolute inset-0 bg-paper/60" />}
      </div>
      <div className="border-t border-line p-4">
        <div className="flex items-center justify-between mb-1.5">
          <span className="label text-ink-3">{category?.name}</span>
          <StockTag stock={stock} preOrder={product.preOrder} threshold={Math.min(...product.variants.map((v) => v.lowStockThreshold))} />
        </div>
        <h3 className="font-display text-2xl leading-tight">{product.name}</h3>
        <div className="mt-2 flex items-baseline justify-between">
          <span className="text-sm text-ink-2">
            {product.variants.length > 1 ? 'From ' : ''}
            {product.variants.length === 1 && priceLabel(product.variants[0]) ? (
              <><span className="font-medium text-ink">{formatMoney(packPrice(product.variants[0]))}</span> {priceLabel(product.variants[0])}</>
            ) : (
              <span className="font-medium text-ink">{formatMoney(fromPrice(product))}</span>
            )}
          </span>
          <span className="font-mono text-[11px] text-ink-3">{product.variants.map((v) => v.name).join(' · ')}</span>
        </div>
      </div>
    </Link>
  )
}
