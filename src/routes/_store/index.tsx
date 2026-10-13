import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowRight, ArrowUpRight, Mail, Phone } from 'lucide-react'
import { formatMoney, img, site } from '@/config/site'
import { categories } from '@/lib/catalogue'
import { useCatalogue } from '@/lib/cart'
import { home, reasons } from '@/data/content'
import { ProductCard } from '@/components/store/ProductCard'

export const Route = createFileRoute('/_store/')({
  component: Home,
})

function Home() {
  const products = useCatalogue()
  const featured = products.filter((p) => p.featured && p.active)

  return (
    <>
      {/* Hero — asymmetric split */}
      <section className="mx-auto max-w-7xl px-5 pt-10 md:pt-16 grid gap-10 md:grid-cols-[1fr_1.15fr] items-end">
        <div className="pb-4 md:pb-14">
          <p className="label text-verdigris rise inline-flex items-center gap-2 rounded-full border border-verdigris/25 bg-verdigris-soft/50 px-3 py-1.5">
            <span className="dot dot-live" aria-hidden /> {home.eyebrow}
          </p>
          <h1 className="font-display text-[3.2rem] leading-[0.95] md:text-[5.4rem] mt-6 rise" style={{ '--d': '80ms' } as React.CSSProperties}>
            {home.heading.split(',')[0]},<br />
            <em>{home.heading.split(',').slice(1).join(',').trim()}</em>
          </h1>
          <p className="mt-6 max-w-md text-ink-2 leading-relaxed rise" style={{ '--d': '160ms' } as React.CSSProperties}>
            {home.sub}
          </p>
          <div className="mt-9 flex flex-wrap gap-3 rise" style={{ '--d': '240ms' } as React.CSSProperties}>
            <Link to="/shop" className="btn btn-primary">
              {home.cta} <ArrowRight size={17} />
            </Link>
            <Link to="/shipping" className="btn btn-ghost">
              Delivery information
            </Link>
          </div>
        </div>
        <div className="relative rise" style={{ '--d': '120ms' } as React.CSSProperties}>
          <div className="ticks aspect-[4/3] md:aspect-[5/4]">
            <div className="relative h-full overflow-hidden rounded-[1.25rem] border border-line">
              <img
                src={img('hero.png', 1200, 960)}
                srcSet={`${img('hero.png', 700, 560)} 700w, ${img('hero.png', 1200, 960)} 1200w`}
                sizes="(min-width: 768px) 55vw, 100vw"
                alt="A row of sealed glass vials on a stone surface"
                fetchPriority="high"
                className="media-tone h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-paper/70 via-transparent to-paper/10" />
              <div className="absolute top-4 right-4 flex gap-2 font-mono text-[10px] text-ink/70">
                <span className="glass rounded-full px-2.5 py-1">54.6°N 2.7°W</span>
                <span className="glass rounded-full px-2.5 py-1">GB</span>
              </div>
            </div>
          </div>
          {/* Lab-label tag overlapping the image */}
          <div className="glass scanline absolute -bottom-6 left-4 md:-left-10 w-64 rounded-2xl p-4 shadow-[0_30px_60px_-30px_rgb(0_0_0/0.9)]">
            <div className="flex justify-between label text-ink-3">
              <span className="inline-flex items-center gap-1.5 text-verdigris"><span className="dot dot-live" aria-hidden />Today</span>
              <span>Cumbria</span>
            </div>
            <p className="font-display text-[1.7rem] mt-3">Same-day dispatch</p>
            <p className="text-xs text-ink-2 mt-1">On orders paid before {site.shipping.dispatchCutoff}, Mon–Fri</p>
          </div>
        </div>
      </section>

      {/* Featured */}
      <section className="mx-auto max-w-7xl px-5 mt-28">
        <div className="flex items-end justify-between mb-8">
          <div>
            <p className="label text-ink-3">Featured</p>
            <h2 className="font-display text-4xl md:text-5xl mt-3">Most ordered this month</h2>
          </div>
          <Link to="/shop" className="hidden sm:inline-flex items-center gap-1 text-sm text-ink-2 hover:text-ink">
            View all <ArrowUpRight size={16} />
          </Link>
        </div>
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          {featured.map((p, i) => (
            <ProductCard key={p.id} product={p} priority={i < 2} />
          ))}
        </div>
      </section>

      {/* Categories — index-style rows */}
      <section className="mx-auto max-w-7xl px-5 mt-28 grid gap-10 md:grid-cols-[0.8fr_1.2fr]">
        <div>
          <p className="label text-ink-3">Categories</p>
          <h2 className="font-display text-4xl md:text-5xl mt-2 max-w-sm">A deliberately short range.</h2>
          <p className="mt-4 text-ink-2 max-w-sm">
            We stock fewer lines so each one can be stored, labelled and checked properly.
          </p>
        </div>
        <ul className="border-t border-line">
          {categories.map((c) => {
            const n = products.filter((p) => p.category === c.slug && p.active).length
            return (
              <li key={c.slug}>
                <Link
                  to="/shop"
                  search={{ category: c.slug }}
                  className="group grid grid-cols-[1fr_auto] items-center gap-4 border-b border-line py-6"
                >
                  <div>
                    <p className="font-display text-3xl transition-[color,transform] duration-300 group-hover:text-verdigris group-hover:translate-x-1">{c.name}</p>
                    <p className="text-sm text-ink-2 mt-1">{c.blurb}</p>
                  </div>
                  <span className="flex items-center gap-3">
                    <span className="label text-ink-3">{n} lines</span>
                    <span className="grid size-9 place-items-center rounded-full border border-line transition group-hover:border-verdigris/50 group-hover:text-verdigris">
                      <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      </section>

      {/* Why choose us */}
      <section className="mt-28">
        <div className="mx-auto max-w-7xl px-5">
          <p className="label text-ink-3">Why {site.name}</p>
          <h2 className="font-display text-4xl md:text-6xl mt-3 max-w-2xl">
            Small operation. <em>Careful handling.</em>
          </h2>
          <div className="mt-14 grid gap-px bg-line sm:grid-cols-2 rounded-2xl overflow-hidden border border-line">
            {reasons.map((r) => (
              <div key={r.k} className="group relative bg-paper p-8 transition-colors hover:bg-card">
                <p className="font-mono text-xs text-verdigris">[{r.k}]</p>
                <h3 className="font-display text-2xl mt-6">{r.title}</h3>
                <p className="mt-2 text-ink-2 text-sm leading-relaxed max-w-sm">{r.body}</p>
                <span className="absolute inset-x-8 top-0 h-px origin-left scale-x-0 bg-verdigris transition-transform duration-500 group-hover:scale-x-100" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Shipping */}
      <section className="mx-auto max-w-7xl px-5 mt-28 grid gap-10 md:grid-cols-2 items-center">
        <div className="ticks">
          <img
            src={img('packing.png', 900, 700)}
            alt="A packing desk with a kraft mailer and packing slip"
            loading="lazy"
            className="media-tone rounded-[1.25rem] border border-line aspect-[9/7] object-cover w-full"
          />
        </div>
        <div>
          <p className="label text-ink-3">Delivery</p>
          <h2 className="font-display text-4xl md:text-5xl mt-2">Plain packaging, tracked to your door.</h2>
          <dl className="mt-8 grid grid-cols-2 gap-6">
            {[
              ['UK tracked', formatMoney(site.shipping.standard)],
              ['Free over', formatMoney(site.shipping.freeOver)],
              ['Dispatch cut-off', `${site.shipping.dispatchCutoff} weekdays`],
              ['Typical arrival', '1–3 working days'],
            ].map(([k, v]) => (
              <div key={k} className="border-t border-line pt-3">
                <dt className="label text-ink-3">{k}</dt>
                <dd className="font-display text-3xl mt-2">{v}</dd>
              </div>
            ))}
          </dl>
          <Link to="/shipping" className="btn btn-ghost mt-8">
            Full delivery policy
          </Link>
        </div>
      </section>

      {/* Help — each topic has its own page */}
      <section className="mx-auto max-w-7xl px-5 mt-28">
        <p className="label text-ink-3">Help</p>
        <h2 className="font-display text-4xl md:text-5xl mt-2">Before you order</h2>
        <div className="mt-10 grid gap-3 md:grid-cols-3">
          {[
            { to: '/faq', title: 'FAQ', body: 'Paying by invoice, discount codes, changes and cancellations.' },
            { to: '/shipping', title: 'Delivery', body: `Tracked Royal Mail, free over ${formatMoney(site.shipping.freeOver)}, same-day dispatch before ${site.shipping.dispatchCutoff}.` },
            { to: '/about', title: 'How we pack', body: 'Picked, checked against a packing slip and sealed by hand.' },
          ].map((c) => (
            <Link key={c.to} to={c.to} className="group rounded-2xl border border-line bg-card/60 p-6 transition-colors hover:border-verdigris/50">
              <span className="flex items-center justify-between font-display text-3xl">
                {c.title} <ArrowUpRight size={20} className="text-ink-3 transition group-hover:text-verdigris" />
              </span>
              <p className="mt-2 text-sm text-ink-2">{c.body}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* Contact */}
      <section className="mx-auto max-w-7xl px-5 mt-28">
        <div className="glass relative overflow-hidden rounded-[1.5rem] p-10 md:p-14 grid gap-8 md:grid-cols-[1.3fr_1fr] items-center">
          <div className="pointer-events-none absolute -right-24 -top-24 size-80 rounded-full bg-verdigris/15 blur-3xl" />
          <div className="relative">
            <h2 className="font-display text-4xl md:text-5xl">Questions about an order?</h2>
            <p className="mt-3 text-ink-2 max-w-md">
              Reply to your confirmation email or get in touch — quote your order number and we’ll pick it up straight away.
            </p>
          </div>
          <div className="relative grid gap-3">
            <a href={`mailto:${site.email}`} className="flex items-center gap-3 rounded-xl border border-line bg-paper/60 px-5 py-4 transition-colors hover:border-verdigris/50">
              <Mail size={18} className="text-verdigris" /> {site.email}
            </a>
            <Link to="/contact" className="flex items-center gap-3 rounded-xl border border-line bg-paper/60 px-5 py-4 transition-colors hover:border-verdigris/50">
              <Phone size={18} className="text-verdigris" /> Contact form &amp; hours
            </Link>
          </div>
        </div>
      </section>
    </>
  )
}
