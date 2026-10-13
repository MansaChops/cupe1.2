import { useState } from 'react'
import { Link, Outlet, createFileRoute } from '@tanstack/react-router'
import { Menu, Search, ShoppingBag, X } from 'lucide-react'
import { formatMoney, img, site } from '@/config/site'
import { useCart } from '@/lib/cart'
import { legalPages } from '@/data/content'
import { getCatalogue } from '@/server/catalogue'
import type { Product } from '@/lib/catalogue'

export const Route = createFileRoute('/_store')({
  // Products, prices and stock come from the database via a server function. Pages read this
  // through useCatalogue(); it refreshes in the background at most every 30 seconds.
  loader: (): Promise<Array<Product>> => getCatalogue(),
  staleTime: 30_000,
  component: StoreLayout,
})

const nav = [
  { to: '/shop', label: 'Shop' },
  { to: '/about', label: 'About' },
  { to: '/shipping', label: 'Delivery' },
  { to: '/faq', label: 'FAQ' },
  { to: '/contact', label: 'Contact' },
] as const

export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <img src={img(site.logoMark, 96, 96)} alt="" width={40} height={40} className="size-10 rounded-lg" />
      <span className="font-display text-[1.15rem] sm:text-[1.3rem] leading-none whitespace-nowrap">{site.name}</span>
    </span>
  )
}

function StoreLayout() {
  const { count } = useCart()
  const [open, setOpen] = useState(false)

  return (
    <div className="theme-store flex min-h-screen flex-col">
      <div className="border-b border-line text-ink-2 text-center font-mono text-[11px] tracking-wide py-2 px-4 flex items-center justify-center gap-2">
        <span className="dot dot-live text-verdigris shrink-0" aria-hidden />
        <span>
          Free tracked UK delivery over {formatMoney(site.shipping.freeOver)} · Orders before{' '}
          {site.shipping.dispatchCutoff} dispatched same working day
        </span>
      </div>
      <header className="sticky top-0 z-40 border-b border-line bg-paper/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-5">
          <button className="md:hidden -ml-1 p-1" onClick={() => setOpen(!open)} aria-label="Menu">
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
          <Link to="/" aria-label={`${site.name} home`}>
            <Wordmark />
          </Link>
          <nav className="hidden md:flex items-center gap-1 ml-4 rounded-full border border-line bg-card/60 p-1 text-[13px] text-ink-2">
            {nav.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                className="rounded-full px-3.5 py-1.5 transition-colors hover:text-ink"
                activeProps={{ className: 'bg-paper-2 text-ink shadow-[inset_0_1px_0_rgb(233_239_237/0.06)]' }}
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-1">
            <Link to="/shop" className="p-2.5 rounded-full hover:bg-paper-2" aria-label="Search products">
              <Search size={19} />
            </Link>
            <Link to="/cart" className="relative p-2.5 rounded-full hover:bg-paper-2" aria-label={`Basket, ${count} items`}>
              <ShoppingBag size={19} />
              {count > 0 && (
                <span className="absolute top-1 right-0.5 min-w-[18px] h-[18px] grid place-items-center rounded-full bg-verdigris text-paper text-[10px] font-mono px-1">
                  {count}
                </span>
              )}
            </Link>
          </div>
        </div>
        {open && (
          <nav className="md:hidden border-t border-line px-5 py-4 grid gap-3" onClick={() => setOpen(false)}>
            {nav.map((n) => (
              <Link key={n.to} to={n.to} className="font-display text-3xl">
                {n.label}
              </Link>
            ))}
          </nav>
        )}
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="mt-32 border-t border-line bg-card/40 text-ink-2">
        <div className="mx-auto max-w-7xl px-5 py-16 grid gap-12 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <img src={img(site.logo, 320, 320)} alt={site.name} width={160} height={160} className="size-28 rounded-xl ring-1 ring-line" />
            <p className="mt-5 max-w-xs text-sm leading-relaxed text-ink-3">{site.description}</p>
          </div>
          <FooterCol title="Shop" links={[['/shop', 'All products'], ['/cart', 'Basket'], ['/shipping', 'Delivery']]} />
          <FooterCol title="Company" links={[['/about', 'About'], ['/faq', 'FAQ'], ['/contact', 'Contact']]} />
          <FooterCol title="Policies" links={legalPages.map((p) => [`/${p.slug}`, p.title] as [string, string])} />
        </div>
        <div className="border-t border-line">
          <div className="mx-auto max-w-7xl px-5 py-6 flex flex-col md:flex-row gap-3 justify-between font-mono text-[11px] text-ink-3">
            <p>
              © 2026 {site.legalName}. {site.address}.
            </p>
            <p>Customers must be 18 or over. Please read our product disclaimer before ordering.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}

function FooterCol({ title, links }: { title: string; links: Array<[string, string]> }) {
  return (
    <div>
      <p className="label text-ink-3 mb-4">{title}</p>
      <ul className="grid gap-2.5 text-sm">
        {links.map(([to, label]) => (
          <li key={to}>
            <a href={to} className="transition-colors hover:text-ink">
              {label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}
