import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { Search, X } from 'lucide-react'
import { categories, fromPrice, totalStock } from '@/lib/catalogue'
import { useCatalogue } from '@/lib/cart'
import { ProductCard } from '@/components/store/ProductCard'
import { site } from '@/config/site'

type ShopSearch = { q?: string; category?: string; sort?: 'featured' | 'price-asc' | 'price-desc' | 'name'; stock?: boolean }

export const Route = createFileRoute('/_store/shop')({
  validateSearch: (s: Record<string, unknown>): ShopSearch => ({
    q: typeof s.q === 'string' && s.q ? s.q : undefined,
    category: categories.some((c) => c.slug === s.category) ? (s.category as string) : undefined,
    sort: ['price-asc', 'price-desc', 'name'].includes(s.sort as string) ? (s.sort as ShopSearch['sort']) : undefined,
    stock: s.stock === true || s.stock === 'true' ? true : undefined,
  }),
  head: () => ({
    meta: [
      { title: `Shop all products — ${site.name}` },
      { name: 'description', content: `Browse the full ${site.name} range of peptides and supplies. Tracked UK delivery.` },
    ],
  }),
  component: Shop,
})

function Shop() {
  const products = useCatalogue()
  const search = Route.useSearch()
  const navigate = useNavigate({ from: '/shop' })
  const set = (patch: Partial<ShopSearch>) => navigate({ search: (prev: ShopSearch) => ({ ...prev, ...patch }), replace: true })

  const q = search.q?.toLowerCase().trim()
  let list = products.filter(
    (p) =>
      p.active &&
      (!search.category || p.category === search.category) &&
      (!search.stock || totalStock(p) > 0) &&
      (!q || p.name.toLowerCase().includes(q) || p.variants.some((v) => v.sku.toLowerCase().includes(q))),
  )
  list = [...list].sort((a, b) => {
    if (search.sort === 'price-asc') return fromPrice(a) - fromPrice(b)
    if (search.sort === 'price-desc') return fromPrice(b) - fromPrice(a)
    if (search.sort === 'name') return a.name.localeCompare(b.name)
    return Number(b.featured) - Number(a.featured) || a.sortOrder - b.sortOrder
  })
  const active = categories.find((c) => c.slug === search.category)

  return (
    <div className="mx-auto max-w-7xl px-5 pt-12">
      <div className="grid gap-6 md:grid-cols-[1fr_auto] md:items-end">
        <div>
          <p className="label text-ink-3">Catalogue</p>
          <h1 className="font-display text-5xl md:text-6xl mt-2">{active ? active.name : 'All products'}</h1>
          <p className="text-ink-2 mt-3 max-w-md">{active ? active.blurb : 'Every line we currently stock, with live availability.'}</p>
        </div>
        <label className="relative block md:w-80">
          <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3" />
          <input
            className="field pl-10"
            placeholder="Search name or SKU"
            defaultValue={search.q}
            onChange={(e) => set({ q: e.target.value || undefined })}
            aria-label="Search products"
          />
        </label>
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-2 border-y border-line py-3">
        <Chip active={!search.category} onClick={() => set({ category: undefined })}>
          All
        </Chip>
        {categories.map((c) => (
          <Chip key={c.slug} active={search.category === c.slug} onClick={() => set({ category: c.slug })}>
            {c.name}
          </Chip>
        ))}
        <span className="mx-2 h-5 w-px bg-line hidden sm:block" />
        <label className="flex items-center gap-2 text-sm text-ink-2 cursor-pointer px-2">
          <input
            type="checkbox"
            className="accent-verdigris"
            checked={!!search.stock}
            onChange={(e) => set({ stock: e.target.checked || undefined })}
          />
          In stock only
        </label>
        <select
          className="ml-auto field !w-auto !py-2 text-sm"
          value={search.sort ?? 'featured'}
          onChange={(e) => set({ sort: e.target.value === 'featured' ? undefined : (e.target.value as ShopSearch['sort']) })}
          aria-label="Sort products"
        >
          <option value="featured">Featured</option>
          <option value="price-asc">Price: low to high</option>
          <option value="price-desc">Price: high to low</option>
          <option value="name">Name A–Z</option>
        </select>
      </div>

      <p className="label text-ink-3 mt-6 mb-4">{list.length} products</p>

      {list.length ? (
        <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {list.map((p, i) => (
            <div key={p.id} className="rise" style={{ '--d': `${Math.min(i, 8) * 40}ms` } as React.CSSProperties}>
              <ProductCard product={p} priority={i < 4} />
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-line py-20 text-center">
          <p className="font-display text-3xl">Nothing matches that search</p>
          <p className="text-ink-2 mt-2">Try a different name or SKU, or clear the filters.</p>
          <Link to="/shop" className="btn btn-ghost mt-6">
            <X size={16} /> Clear filters
          </Link>
        </div>
      )}
    </div>
  )
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3.5 py-1.5 text-sm transition ${active ? 'bg-ink text-paper' : 'text-ink-2 hover:bg-paper-2'}`}
    >
      {children}
    </button>
  )
}
